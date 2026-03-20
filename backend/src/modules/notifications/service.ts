import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateNotificationInput } from './types';

export async function listNotifications(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return { notifications, total };
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw AppError.notFound('Notificação');
  if (notification.userId !== userId) throw AppError.forbidden();

  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    },
  });

  // TODO: Send push notification via FCM
  await sendPushNotification(input.userId, input.title, input.body);

  return notification;
}

// Push notification placeholder
async function sendPushNotification(userId: string, title: string, body?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });

  if (!user?.pushToken) return;

  // TODO: Implement Firebase Cloud Messaging
  // const message = {
  //   token: user.pushToken,
  //   notification: { title, body },
  // };
  // await admin.messaging().send(message);

  console.log(`[Push] Would send to ${userId}: ${title}`);

  // Mark as sent
  // await prisma.notification.updateMany({ where: { userId, sent: false }, data: { sent: true } });
}

// Helper to create notifications for multiple users
export async function notifyUsers(userIds: string[], type: string, title: string, body?: string, data: Record<string, any> = {}) {
  const notifications = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      data,
    })),
  });

  // Send push to each user (in background)
  for (const userId of userIds) {
    sendPushNotification(userId, title, body).catch(console.error);
  }

  return notifications;
}
