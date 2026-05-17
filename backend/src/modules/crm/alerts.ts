import { prisma } from '../../config/database';

const BRUNO_CHAT = process.env.TELEGRAM_CRM_CHAT_ID || process.env.TELEGRAM_ALERT_CHAT_ID || '6216144100';

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch {
    // best-effort
  }
}

export async function checkCrmAlerts() {
  const agora = new Date();
  const msgs: string[] = [];

  // ── 1. Follow-ups vencidos (atividades não concluídas no passado)
  const followupsVencidos = await prisma.crmAtividade.findMany({
    where: { concluida: false, dataHora: { lt: agora } },
    include: {
      oportunidade: { select: { titulo: true, empresa: { select: { razaoSocial: true } } } },
      usuario: { select: { name: true } },
    },
    orderBy: { dataHora: 'asc' },
    take: 10,
  });

  if (followupsVencidos.length > 0) {
    const linhas = followupsVencidos.map((a) => {
      const dias = Math.floor((agora.getTime() - new Date(a.dataHora).getTime()) / 86_400_000);
      const empresa = a.oportunidade?.empresa?.razaoSocial ?? '';
      return `  • ${a.oportunidade?.titulo ?? 'sem oportunidade'}${empresa ? ` (${empresa})` : ''} — ${dias}d atrás [${a.usuario?.name ?? '?'}]`;
    });
    msgs.push(`⚠️ <b>${followupsVencidos.length} follow-up(s) vencido(s):</b>\n${linhas.join('\n')}`);
  }

  // ── 2. Oportunidades paradas (sem atividade há mais de 14 dias, não ganhas/perdidas)
  const diasParado = 14;
  const corteParado = new Date(agora.getTime() - diasParado * 86_400_000);

  const paradas = await prisma.crmOportunidade.findMany({
    where: {
      etapa: { notIn: ['ganho', 'perdido'] },
      OR: [
        { updatedAt: { lt: corteParado } },
      ],
    },
    include: {
      empresa: { select: { razaoSocial: true } },
      responsavel: { select: { name: true } },
      atividades: { orderBy: { dataHora: 'desc' }, take: 1, select: { dataHora: true } },
    },
    take: 10,
  });

  const paradasSemAtividade = paradas.filter((op) => {
    const ultima = op.atividades[0]?.dataHora;
    if (!ultima) return true;
    return new Date(ultima) < corteParado;
  });

  if (paradasSemAtividade.length > 0) {
    const linhas = paradasSemAtividade.map((op) => {
      const ultima = op.atividades[0]?.dataHora;
      const dias = ultima
        ? Math.floor((agora.getTime() - new Date(ultima).getTime()) / 86_400_000)
        : null;
      const resp = op.responsavel?.name ?? '?';
      return `  • ${op.titulo}${op.empresa ? ` (${op.empresa.razaoSocial})` : ''} — ${dias !== null ? `${dias}d sem atividade` : 'sem histórico'} [${resp}]`;
    });
    msgs.push(`🔇 <b>${paradasSemAtividade.length} oportunidade(s) parada(s) (+${diasParado}d):</b>\n${linhas.join('\n')}`);
  }

  // ── 3. Empresas em nutrição com mais de 30 dias sem contato
  const corteNutricao = new Date(agora.getTime() - 30 * 86_400_000);
  const nutricaoAtrasadas = await prisma.crmEmpresa.findMany({
    where: {
      nutricao: true,
      OR: [
        { ultimoContato: { lt: corteNutricao } },
        { ultimoContato: null },
      ],
    },
    take: 5,
  });

  if (nutricaoAtrasadas.length > 0) {
    const linhas = nutricaoAtrasadas.map((e) => {
      const dias = e.ultimoContato
        ? Math.floor((agora.getTime() - new Date(e.ultimoContato).getTime()) / 86_400_000)
        : null;
      return `  • ${e.razaoSocial} — ${dias !== null ? `${dias}d` : 'sem registro'}`;
    });
    msgs.push(`🌱 <b>${nutricaoAtrasadas.length} empresa(s) em nutrição sem contato (+30d):</b>\n${linhas.join('\n')}`);
  }

  if (msgs.length > 0) {
    const texto = `🎯 <b>CRM BÈR — Alertas do dia</b>\n\n${msgs.join('\n\n')}`;
    await sendTelegram(BRUNO_CHAT, texto);
  }
}
