/**
 * FVS Notifications Job
 * Roda via cron a cada 1h. Verifica:
 * 1. FVS pré-execução não preenchida em 4h → alerta ao mestre
 * 2. FVS aguardando aprovação +48h → alerta ao coordenador
 * 3. FVS rejeitada sem ação em 24h → lembrete ao mestre
 *
 * Uso: npx tsx src/jobs/fvs-notifications.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BRUNO_CHAT = '6216144100';
const GROUP_CHAT = '-1003864528870';

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[TELEGRAM SKIP] No bot token. Message: ${text}`);
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!resp.ok) console.error(`Telegram error: ${resp.status}`);
  } catch (e) {
    console.error('Telegram send failed:', e);
  }
}

async function checkFvsNotifications() {
  const now = new Date();
  const h4ago = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let alerts: string[] = [];

  // 1. FVS pendente criada há mais de 4h (pré-execução não preenchida)
  const pending4h = await prisma.obraFvs.findMany({
    where: { status: 'pendente', createdAt: { lt: h4ago } },
    include: {
      template: { select: { code: true, name: true } },
      etapa: { select: { name: true } },
      obra: { select: { name: true } },
    },
  });
  for (const fvs of pending4h) {
    alerts.push(`⚠️ <b>FVS pendente há +4h</b>\n📋 ${fvs.template?.code} — ${fvs.template?.name}\n🏗 ${fvs.obra?.name} → ${fvs.etapa?.name}\nPré-execução não preenchida.`);
  }

  // 2. FVS aguardando aprovação do gestor ou coordenador há +48h
  const waiting48h = await prisma.obraFvs.findMany({
    where: {
      status: { in: ['aguardando_gestor', 'aguardando_coord'] },
      createdAt: { lt: h48ago },
    },
    include: {
      template: { select: { code: true, name: true } },
      etapa: { select: { name: true } },
      obra: { select: { name: true } },
    },
  });
  for (const fvs of waiting48h) {
    const who = fvs.status === 'aguardando_gestor' ? 'gestor' : 'coordenador';
    alerts.push(`🔴 <b>FVS parada há +48h</b>\n📋 ${fvs.template?.code} — ${fvs.template?.name}\n🏗 ${fvs.obra?.name} → ${fvs.etapa?.name}\nAguardando aprovação do ${who}.`);
  }

  // 3. FVS rejeitada sem ação em 24h
  const rejected24h = await prisma.obraFvs.findMany({
    where: {
      status: 'rejeitada',
      createdAt: { lt: h24ago },
    },
    include: {
      template: { select: { code: true, name: true } },
      etapa: { select: { name: true } },
      obra: { select: { name: true } },
    },
  });
  for (const fvs of rejected24h) {
    alerts.push(`🟡 <b>FVS rejeitada sem correção há +24h</b>\n📋 ${fvs.template?.code} — ${fvs.template?.name}\n🏗 ${fvs.obra?.name}\nMotivo: ${fvs.rejectionReason?.slice(0, 100) ?? '—'}`);
  }

  // Summary
  if (alerts.length === 0) {
    console.log(`[FVS Notifications] ${new Date().toISOString()} — Nenhum alerta.`);
    return;
  }

  const header = `📋 <b>FVS — ${alerts.length} alerta(s)</b>\n${'─'.repeat(20)}`;
  const message = `${header}\n\n${alerts.join('\n\n')}`;

  console.log(`[FVS Notifications] ${alerts.length} alerta(s) — enviando...`);
  await sendTelegram(BRUNO_CHAT, message);
  console.log('[FVS Notifications] Enviado ao Bruno.');
}

checkFvsNotifications()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
