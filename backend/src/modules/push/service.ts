import webpush from 'web-push';
import { prisma } from '../../config/database';

/**
 * Web Push do PWA (11/09/26): alertas no celular da equipe.
 * Chaves VAPID via env (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT).
 * enviarPush é fire-and-forget: falha de push NUNCA derruba o fluxo que chamou.
 */

let configurado = false;
function garantirVapid(): boolean {
  if (configurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:bruno@ber-engenharia.com.br', pub, priv);
  configurado = true;
  return true;
}

export function chavePublica(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function inscrever(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function desinscrever(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/** Envia pra usuários específicos (userIds) ou pra todos os inscritos (null). */
export async function enviarPush(
  userIds: string[] | null,
  payload: { title: string; body: string; url?: string },
) {
  if (!garantirVapid()) return { enviados: 0, motivo: 'VAPID não configurado' };
  const subs = await prisma.pushSubscription.findMany({
    where: userIds ? { userId: { in: userIds } } : {},
  });
  let enviados = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      enviados++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
  }));
  return { enviados };
}
