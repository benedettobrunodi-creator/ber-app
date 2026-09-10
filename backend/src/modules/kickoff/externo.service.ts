import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { templateDefault, type KickoffExternoConteudo } from './externo-template';

// Kickoff EXTERNO — get devolve o conteúdo salvo ou o template default já
// pré-preenchido com o time do Kickoff INTERNO (confirmado pelo Bruno 10/09/26).

export async function getExterno(obraId: string) {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: { id: true, name: true, address: true, client: true, status: true },
  });
  if (!obra) throw AppError.notFound('Obra');

  const salvo = await prisma.obraKickoffExterno.findUnique({ where: { obraId } });
  if (salvo && salvo.conteudo && Object.keys(salvo.conteudo as object).length > 0) {
    return { obra, conteudo: salvo.conteudo as unknown as KickoffExternoConteudo, salvoEm: salvo.updatedAt };
  }

  // primeiro acesso: template default + time herdado do kickoff interno
  const clienteNome = (obra.client || obra.name || 'Cliente').trim();
  const conteudo = templateDefault(clienteNome);
  const interno = await prisma.obraKickoff.findUnique({ where: { obraId } });
  if (interno) {
    const setNome = (papel: string, nome?: string | null) => {
      if (!nome) return;
      const p = conteudo.time.ladoBer.find((x) => x.papel === papel);
      if (p) p.nome = nome;
    };
    const deptos = (interno.participantesDeptos ?? {}) as Record<string, string>;
    setNome('PM', deptos.pmo);
    setNome('Coordenador de Engenharia', interno.coordenador ?? deptos.coordenador);
    setNome('Supervisor de Obra', interno.supervisor);
    setNome('Residente de Obra', interno.engenheiro ?? deptos.engenheiro);
    const bo = (papel: string, nome?: string | null) => {
      if (!nome) return;
      const p = conteudo.time.backOffice.find((x) => x.papel === papel);
      if (p) p.nome = nome;
    };
    bo('Financeiro', deptos.financeiro);
    bo('Compras', deptos.suprimentos);
    if (interno.dataKickoff) conteudo.dataReuniao = interno.dataKickoff.toISOString().slice(0, 10);
  }
  return { obra, conteudo, salvoEm: null };
}

export async function upsertExterno(obraId: string, conteudo: KickoffExternoConteudo) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  const row = await prisma.obraKickoffExterno.upsert({
    where: { obraId },
    create: { obraId, conteudo: conteudo as never },
    update: { conteudo: conteudo as never },
  });
  return { conteudo: row.conteudo as unknown as KickoffExternoConteudo, salvoEm: row.updatedAt };
}
