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
