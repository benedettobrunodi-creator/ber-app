/**
 * Manual do Proprietário digital (03/09/26, GO Bruno msg 11171).
 * Modelo: BER_Manual_ObraPoatek_v3.pdf. Parte 1: formulário + persistência +
 * auto-preenchimento (projetos ← Controle de Documentos, ficha ← obra,
 * fornecedores ← contratações). Parte 2 (gerador PDF) vem depois.
 */
import { z } from 'zod';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

// ─── Biblioteca "Usar e manter" — materiais possíveis ───────────────────────
// O checklist da obra marca o que existe; o PDF só monta as seções marcadas.
// Os TEXTOS padrão de cada seção entram na parte 2 (gerador) — aqui é o menu.
export const MANUAL_MATERIAIS: { key: string; label: string; grupo: string }[] = [
  { key: 'eletrica',           label: 'Instalações elétricas · quadros e tomadas', grupo: 'Sistemas' },
  { key: 'hidraulica',         label: 'Hidráulica · filtros e ralos',              grupo: 'Sistemas' },
  { key: 'ar_condicionado',    label: 'Ar condicionado',                           grupo: 'Sistemas' },
  { key: 'porcelanato',        label: 'Piso · porcelanato',                        grupo: 'Pisos' },
  { key: 'ceramica_azulejo',   label: 'Piso/parede · cerâmica e azulejo',          grupo: 'Pisos' },
  { key: 'carpete',            label: 'Piso · carpete',                            grupo: 'Pisos' },
  { key: 'tacos_madeira',      label: 'Piso · tacos de madeira',                   grupo: 'Pisos' },
  { key: 'laminado',           label: 'Piso · laminado',                           grupo: 'Pisos' },
  { key: 'vinilico',           label: 'Piso · vinílico',                           grupo: 'Pisos' },
  { key: 'forro_gesso',        label: 'Forro · gesso/drywall',                     grupo: 'Forros e paredes' },
  { key: 'forro_madeira',      label: 'Forro · madeira',                           grupo: 'Forros e paredes' },
  { key: 'forro_acustico',     label: 'Forro · acústico/modular',                  grupo: 'Forros e paredes' },
  { key: 'laje_aparente',      label: 'Laje aparente',                             grupo: 'Forros e paredes' },
  { key: 'pintura_acrilica',   label: 'Pintura acrílica',                          grupo: 'Forros e paredes' },
  { key: 'pintura_cimenticia', label: 'Pintura cimentícia / cimento queimado',     grupo: 'Forros e paredes' },
  { key: 'esquadrias_aluminio',label: 'Esquadrias de alumínio',                    grupo: 'Esquadrias e vidros' },
  { key: 'portas_pintadas',    label: 'Portas pintadas',                           grupo: 'Esquadrias e vidros' },
  { key: 'divisorias_vidro',   label: 'Divisórias e portas de vidro',              grupo: 'Esquadrias e vidros' },
  { key: 'vidros',             label: 'Vidros em geral',                           grupo: 'Esquadrias e vidros' },
  { key: 'marmore_granito',    label: 'Mármore e granito',                         grupo: 'Pedras e revestimentos' },
  { key: 'pedras_naturais',    label: 'Pedras naturais',                           grupo: 'Pedras e revestimentos' },
  { key: 'tijolo_aparente',    label: 'Tijolo aparente',                           grupo: 'Pedras e revestimentos' },
  { key: 'rejunte',            label: 'Rejunte',                                   grupo: 'Pedras e revestimentos' },
  { key: 'marcenaria',         label: 'Marcenaria / madeiras',                     grupo: 'Acabamentos' },
  { key: 'metais',             label: 'Metais · cromado, inox, epóxi',             grupo: 'Acabamentos' },
  { key: 'fechaduras',         label: 'Fechaduras e puxadores',                    grupo: 'Acabamentos' },
  { key: 'plasticos_resinas',  label: 'Plásticos e resinas',                       grupo: 'Acabamentos' },
  { key: 'eletrodomesticos',   label: 'Eletrodomésticos (garantias)',              grupo: 'Acabamentos' },
];

// ─── Validação ──────────────────────────────────────────────────────────────
const itemGaleria = z.object({ url: z.string().min(1), legenda: z.string().max(200).optional().nullable() });
const itemAcabamento = z.object({
  grupo: z.string().max(80),
  nome: z.string().max(150),
  cor: z.string().max(20).optional().nullable(), // hex opcional
  tipo: z.string().max(120).optional().nullable(),
  fornecedor: z.string().max(150).optional().nullable(),
});
const itemMobiliario = z.object({
  nome: z.string().max(150),
  medida: z.string().max(60).optional().nullable(),
  descricao: z.string().max(300).optional().nullable(),
});
const itemFornecedor = z.object({
  categoria: z.string().max(100),
  nome: z.string().max(150),
  telefone: z.string().max(40).optional().nullable(),
  email: z.string().max(150).optional().nullable(),
  endereco: z.string().max(250).optional().nullable(),
});
const itemEquipe = z.object({
  papel: z.string().max(80),
  nome: z.string().max(150),
  email: z.string().max(150).optional().nullable(),
});
const itemAnexo = z.object({
  tipo: z.string().max(40), // ART | RRT | outro
  nome: z.string().max(200),
  url: z.string().min(1),
});

export const updateManualSchema = z.object({
  fotoCapaUrl: z.string().nullable().optional(),
  dataEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  urlOnline: z.string().max(300).nullable().optional(),
  canalAssistencia: z.string().max(300).nullable().optional(),
  textoBemVindos: z.string().max(5000).nullable().optional(),
  materiais: z.array(z.string().max(40)).max(60).optional(),
  galeria: z.array(itemGaleria).max(60).optional(),
  acabamentos: z.array(itemAcabamento).max(80).optional(),
  mobiliario: z.array(itemMobiliario).max(80).optional(),
  fornecedores: z.array(itemFornecedor).max(80).optional(),
  equipe: z.array(itemEquipe).max(30).optional(),
  anexos: z.array(itemAnexo).max(40).optional(),
});
export type UpdateManualInput = z.infer<typeof updateManualSchema>;

// ─── Service ────────────────────────────────────────────────────────────────

export async function getManual(obraId: string) {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: { id: true, name: true, client: true, address: true, areaM2: true, dataFimObra: true },
  });
  if (!obra) throw AppError.notFound('Obra');

  const manual = await prisma.manualProprietario.upsert({
    where: { obraId },
    update: {},
    create: { obraId },
  });

  // Auto: projetos entregues ← Controle de Documentos (última revisão de cada doc ativo)
  const documentos = await prisma.projetoDocumento.findMany({
    where: { obraId, obsoleto: false },
    include: { revisoes: { orderBy: { data: 'desc' }, take: 1, select: { revisao: true } } },
    orderBy: [{ disciplina: 'asc' }, { codigo: 'asc' }],
  });
  const projetos = documentos.map((d) => ({
    codigo: d.codigo,
    disciplina: d.disciplina,
    revisao: d.revisoes[0]?.revisao ?? '—',
  }));

  // Auto: sugestão de fornecedores ← contratações da obra
  const contratacoes = await prisma.obraContratacao.findMany({
    where: { obraId },
    select: { fornecedor: true, disciplina: true },
    orderBy: { disciplina: 'asc' },
  });
  const fornecedoresSugestao = contratacoes
    .filter((c) => c.fornecedor?.trim())
    .map((c) => ({ categoria: c.disciplina ?? 'Outros', nome: c.fornecedor }));

  return {
    manual,
    biblioteca: MANUAL_MATERIAIS,
    auto: { obra, projetos, fornecedoresSugestao },
  };
}

export async function updateManual(obraId: string, input: UpdateManualInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  const data = {
    ...(input.fotoCapaUrl !== undefined && { fotoCapaUrl: input.fotoCapaUrl }),
    ...(input.dataEntrega !== undefined && {
      dataEntrega: input.dataEntrega ? new Date(`${input.dataEntrega}T12:00:00Z`) : null,
    }),
    ...(input.urlOnline !== undefined && { urlOnline: input.urlOnline }),
    ...(input.canalAssistencia !== undefined && { canalAssistencia: input.canalAssistencia }),
    ...(input.textoBemVindos !== undefined && { textoBemVindos: input.textoBemVindos }),
    ...(input.materiais !== undefined && { materiais: input.materiais }),
    ...(input.galeria !== undefined && { galeria: input.galeria }),
    ...(input.acabamentos !== undefined && { acabamentos: input.acabamentos }),
    ...(input.mobiliario !== undefined && { mobiliario: input.mobiliario }),
    ...(input.fornecedores !== undefined && { fornecedores: input.fornecedores }),
    ...(input.equipe !== undefined && { equipe: input.equipe }),
    ...(input.anexos !== undefined && { anexos: input.anexos }),
  };
  return prisma.manualProprietario.upsert({
    where: { obraId },
    update: data,
    create: { obraId, ...data },
  });
}

/** Upload de arquivo do manual (foto de capa, galeria, anexo ART/RRT) → R2. */
export async function uploadArquivoManual(
  obraId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
) {
  const { uploadToR2, isR2Configured } = await import('../../services/storage');
  if (!isR2Configured()) throw AppError.badRequest('Storage de arquivos não configurado no servidor');
  const url = await uploadToR2(
    file.buffer,
    `manual-proprietario/${obraId}-${Date.now()}-${file.originalname}`,
    file.mimetype,
  );
  return { url, nome: file.originalname };
}
