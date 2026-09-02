/**
 * Relatório de Recebimento do Imóvel (02/09/26) — vistoria fotográfica das
 * condições existentes. Fluxo: upload em lote → ambientes → legendas (com
 * sugestão de IA opcional) → PDF no padrão BÈR.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { uploadToR2, downloadFile } from '../../services/storage';

const INCLUDE = {
  ambientes: { orderBy: { ordem: 'asc' as const }, include: { fotos: { orderBy: { ordem: 'asc' as const } } } },
  fotos: { orderBy: { ordem: 'asc' as const } },
  responsavel: { select: { id: true, name: true } },
};

function objetivoPadrao(endereco: string | null): string {
  const local = endereco ? ` no endereço situado à ${endereco}` : '';
  return (
    `O presente relatório tem como objetivo registrar as condições físicas do imóvel no início das atividades${local}. ` +
    'Os registros fotográficos a seguir documentam as instalações elétricas, hidráulicas, os equipamentos presentes no local, ' +
    'bem como eventuais patologias e avarias.'
  );
}

/** Busca (ou cria) o relatório da obra, com ambientes e fotos. */
export async function getOrCreate(obraId: string, userId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true, address: true } });
  if (!obra) throw AppError.notFound('Obra');
  let rel = await prisma.recebimentoRelatorio.findUnique({ where: { obraId }, include: INCLUDE });
  if (!rel) {
    rel = await prisma.recebimentoRelatorio.create({
      data: { obraId, responsavelId: userId, dataVistoria: new Date(), objetivo: objetivoPadrao(obra.address) },
      include: INCLUDE,
    });
  }
  return rel;
}

export async function updateRelatorio(id: string, input: { dataVistoria?: string | null; objetivo?: string; status?: string; responsavelId?: string }) {
  const data: Record<string, unknown> = {};
  if (input.dataVistoria !== undefined) data.dataVistoria = input.dataVistoria ? new Date(input.dataVistoria) : null;
  if (input.objetivo !== undefined) data.objetivo = input.objetivo;
  if (input.responsavelId !== undefined) data.responsavelId = input.responsavelId;
  if (input.status !== undefined) {
    if (!['rascunho', 'concluido'].includes(input.status)) throw AppError.badRequest('status inválido (rascunho | concluido)');
    data.status = input.status;
  }
  return prisma.recebimentoRelatorio.update({ where: { id }, data, include: INCLUDE });
}

export async function addFotos(relatorioId: string, files: { buffer: Buffer; originalname: string; mimetype: string }[]) {
  const rel = await prisma.recebimentoRelatorio.findUnique({ where: { id: relatorioId }, select: { id: true, status: true } });
  if (!rel) throw AppError.notFound('Relatório');
  if (rel.status === 'concluido') throw AppError.badRequest('Relatório concluído — reabra pra adicionar fotos.');
  const last = await prisma.recebimentoFoto.findFirst({ where: { relatorioId }, orderBy: { ordem: 'desc' }, select: { ordem: true } });
  let ordem = (last?.ordem ?? 0) + 1;
  const criadas = [];
  for (const f of files) {
    const url = await uploadToR2(f.buffer, f.originalname, f.mimetype);
    criadas.push(await prisma.recebimentoFoto.create({ data: { relatorioId, url, ordem: ordem++ } }));
  }
  return criadas;
}

export async function updateFoto(fotoId: string, input: { legenda?: string; patologia?: boolean; ambienteId?: string | null; ordem?: number }) {
  const data: Record<string, unknown> = {};
  if (input.legenda !== undefined) data.legenda = input.legenda;
  if (input.patologia !== undefined) data.patologia = input.patologia;
  if (input.ambienteId !== undefined) data.ambienteId = input.ambienteId;
  if (input.ordem !== undefined) data.ordem = input.ordem;
  return prisma.recebimentoFoto.update({ where: { id: fotoId }, data });
}

export async function deleteFoto(fotoId: string) {
  await prisma.recebimentoFoto.delete({ where: { id: fotoId } });
}

export async function addAmbiente(relatorioId: string, nome: string) {
  if (!nome?.trim()) throw AppError.badRequest('Informe o nome do ambiente');
  const last = await prisma.recebimentoAmbiente.findFirst({ where: { relatorioId }, orderBy: { ordem: 'desc' }, select: { ordem: true } });
  return prisma.recebimentoAmbiente.create({
    data: { relatorioId, nome: nome.trim(), ordem: (last?.ordem ?? 0) + 1 },
  });
}

export async function updateAmbiente(id: string, input: { nome?: string; ordem?: number }) {
  const data: Record<string, unknown> = {};
  if (input.nome !== undefined) data.nome = String(input.nome).trim();
  if (input.ordem !== undefined) data.ordem = input.ordem;
  return prisma.recebimentoAmbiente.update({ where: { id }, data });
}

export async function deleteAmbiente(id: string) {
  // fotos voltam pra "sem ambiente" (FK onDelete: SetNull)
  await prisma.recebimentoAmbiente.delete({ where: { id } });
}

// ─── Sugestão de legenda por IA (visão) ───────────────────────────────────
const LEGENDA_PROMPT = `Você está legendando fotos de um relatório de vistoria de obra (registro das condições existentes de um imóvel antes da reforma).

Olhe a foto e escreva UMA legenda curta em português do Brasil, no estilo destes exemplos reais:
- "Quadro elétrico principal."
- "Longa fissura na parede de divisa com o escritório ao lado."
- "Banheiro PNE, pia, torneira e barras em bom estado."
- "Marca de infiltração no shaft do salão."
- "Falta de detector de fumaça e peça existente, não fixada."

Regras: descreva O QUE aparece e a CONDIÇÃO (bom estado, danificado, sujeira, trinca, infiltração...). Máximo 120 caracteres. Se identificar patologia/avaria, mencione.

Retorne APENAS JSON minificado: {"legenda":"...","patologia":true|false}`;

const VISAO_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash'];

export async function sugerirLegenda(fotoId: string): Promise<{ legenda: string; patologia: boolean }> {
  const foto = await prisma.recebimentoFoto.findUnique({ where: { id: fotoId } });
  if (!foto) throw AppError.notFound('Foto');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw AppError.badRequest('IA não configurada no servidor');

  const buffer = await downloadFile(foto.url);
  const ext = foto.url.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastErr: Error | null = null;
  for (const modelName of VISAO_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 300 },
      });
      const res = await model.generateContent([
        { inlineData: { mimeType: mime, data: buffer.toString('base64') } },
        LEGENDA_PROMPT,
      ]);
      const out = JSON.parse(res.response.text()) as { legenda?: string; patologia?: boolean };
      if (!out.legenda) throw new Error('resposta sem legenda');
      return { legenda: String(out.legenda).slice(0, 200), patologia: !!out.patologia };
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[RECEBIMENTO] legenda IA ${modelName} falhou: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  throw AppError.badRequest(`Sugestão de legenda falhou: ${lastErr?.message.slice(0, 120) ?? 'erro'}`);
}
