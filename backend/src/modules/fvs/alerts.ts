import { prisma } from '../../config/database';
import { destinatariosAlerta } from '../../config/responsavel-areas';

/**
 * Gatilho de e-mail: item do Sequenciamento (FVS) com prazo vencido e ainda
 * não preenchido (nem checked nem N/A). Roda 1x/dia, agrupa por área
 * responsável (1 e-mail por área, não 1 por item — evita spam), cada e-mail
 * lista todos os itens vencidos daquela área em todas as obras.
 */
export async function checkFvsItensVencidos() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const itens = await prisma.obraFvsItem.findMany({
    where: {
      checked: false,
      na: false,
      dataLimite: { not: null, lt: hoje },
    },
    include: {
      templateItem: true,
      fvs: { include: { obra: { select: { id: true, name: true } } } },
    },
  });

  if (itens.length === 0) return { alertasEnviados: 0, itensVencidos: 0 };

  type ItemInfo = { obraNome: string; descricao: string; dataLimite: Date };
  const porArea = new Map<string, ItemInfo[]>();
  for (const item of itens) {
    const area = item.templateItem?.responsavelArea ?? 'Sem área definida';
    const lista = porArea.get(area) ?? [];
    lista.push({
      obraNome: item.fvs.obra.name,
      descricao: item.templateItem?.descricao ?? item.descricao ?? '(sem descrição)',
      dataLimite: item.dataLimite!,
    });
    porArea.set(area, lista);
  }

  const { sendEmailObra } = await import('../../services/email-obras');
  const { itensVencidosHtml } = await import('./alerts-html');

  let alertasEnviados = 0;
  for (const [area, lista] of porArea) {
    if (area === 'Sem área definida') continue; // sem área não tem pra quem mandar
    const to = destinatariosAlerta(area);
    if (to.length === 0) continue;
    await sendEmailObra({
      to,
      subject: `${lista.length} ${lista.length === 1 ? 'item vencido' : 'itens vencidos'} — Sequenciamento (${area}) · BÈR Engenharia`,
      html: itensVencidosHtml({ area, itens: lista }),
    });
    alertasEnviados++;
  }

  return { alertasEnviados, itensVencidos: itens.length };
}

/**
 * Alerta de fase "FICOU PRA TRÁS" (02/09/26): fase do Sequenciamento anterior
 * à fase efetiva da obra com itens ainda abertos. Mesma régua do selo vermelho
 * da trilha. Roda 1x/dia; 1 e-mail digest com todas as obras (Chris + Gritti
 * + Bruno). dryRun computa sem enviar (usado na validação).
 */
export async function checkFasesAtrasadas(opts: { dryRun?: boolean } = {}) {
  const { getFaseObra } = await import('../../services/fase-sequenciamento');

  const obras = await prisma.obra.findMany({
    where: { status: { in: ['em_andamento', 'pos_obra'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const ordemFase = (code?: string | null) => Number(String(code ?? '').replace(/\D/g, '')) || 0;
  type FaseAtrasada = { obraNome: string; faseCode: string; faseNome: string; abertos: number; total: number; faseAtual: string };
  const atrasadas: FaseAtrasada[] = [];

  for (const obra of obras) {
    let faseEfetiva: string | null = null;
    try {
      faseEfetiva = (await getFaseObra(obra.id)).faseEfetiva;
    } catch { continue; }
    const ordemAtual = ordemFase(faseEfetiva);
    if (ordemAtual === 0) continue;

    const fvsList = await prisma.obraFvs.findMany({
      where: { obraId: obra.id },
      include: { template: { select: { code: true, name: true } }, items: { select: { checked: true, na: true } } },
    });
    for (const fvs of fvsList) {
      const ordem = ordemFase(fvs.template?.code);
      if (ordem === 0 || ordem >= ordemAtual) continue; // só fase JÁ passada
      const total = fvs.items.length;
      const abertos = fvs.items.filter(i => !i.checked && !i.na).length;
      if (total > 0 && abertos > 0) {
        atrasadas.push({
          obraNome: obra.name,
          faseCode: fvs.template?.code ?? '?',
          faseNome: fvs.template?.name ?? 'Fase',
          abertos,
          total,
          faseAtual: faseEfetiva!,
        });
      }
    }
  }

  if (atrasadas.length === 0 || opts.dryRun) {
    return { alertasEnviados: 0, fasesAtrasadas: atrasadas };
  }

  const { FASE_ATRASADA_EMAILS } = await import('../../config/responsavel-areas');
  const { sendEmailObra } = await import('../../services/email-obras');
  const { fasesAtrasadasHtml } = await import('./alerts-html');
  await sendEmailObra({
    to: FASE_ATRASADA_EMAILS,
    subject: `${atrasadas.length} ${atrasadas.length === 1 ? 'fase ficou' : 'fases ficaram'} pra trás — Sequenciamento · BÈR Engenharia`,
    html: fasesAtrasadasHtml({ fases: atrasadas }),
  });

  return { alertasEnviados: 1, fasesAtrasadas: atrasadas };
}
