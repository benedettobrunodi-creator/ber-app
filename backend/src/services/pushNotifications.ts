import { prisma } from '../config/database';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ sent: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, name: true },
  });

  if (!user?.pushToken) {
    return { sent: false, error: 'Usuário sem push token' };
  }

  const message: ExpoPushMessage = {
    to: user.pushToken,
    title,
    body,
    data,
    sound: 'default',
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json() as { data: ExpoPushTicket };

    if (result.data.status === 'error') {
      console.error(`[Push] Erro ao enviar para ${user.name}:`, result.data.message);
      return { sent: false, error: result.data.message };
    }

    console.log(`[Push] Enviado para ${user.name}: "${title}"`);
    return { sent: true };
  } catch (err) {
    console.error('[Push] Falha na requisição:', (err as Error).message);
    return { sent: false, error: (err as Error).message };
  }
}

export async function sendPushToMultiple(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, pushToken: { not: null } },
    select: { pushToken: true, name: true },
  });

  if (users.length === 0) {
    return { sent: 0, failed: userIds.length };
  }

  const messages: ExpoPushMessage[] = users.map((u) => ({
    to: u.pushToken!,
    title,
    body,
    data,
    sound: 'default',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json() as { data: ExpoPushTicket[] };
    const sent = result.data.filter((t) => t.status === 'ok').length;
    const failed = result.data.filter((t) => t.status === 'error').length;

    console.log(`[Push] Batch: ${sent} enviados, ${failed} falharam`);
    return { sent, failed: failed + (userIds.length - users.length) };
  } catch (err) {
    console.error('[Push] Batch falhou:', (err as Error).message);
    return { sent: 0, failed: userIds.length };
  }
}
