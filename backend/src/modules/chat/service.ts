import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateRoomInput, SendMessageInput } from './types';

export async function listRooms(userId: string) {
  const rooms = await prisma.chatRoom.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      obra: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rooms.map((room) => ({
    ...room,
    lastMessage: room.messages[0] || null,
    messages: undefined,
  }));
}

export async function createRoom(creatorId: string, input: CreateRoomInput) {
  const memberIds = [...new Set([creatorId, ...input.memberIds])];

  const room = await prisma.chatRoom.create({
    data: {
      name: input.name,
      type: input.type,
      obraId: input.obraId,
      members: {
        create: memberIds.map((userId) => ({ userId })),
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  return room;
}

export async function getMessages(roomId: string, userId: string, page: number, limit: number) {
  // Verify membership
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!membership) throw AppError.forbidden('Você não é membro desta sala');

  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { roomId },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.chatMessage.count({ where: { roomId } }),
  ]);
  return { messages, total };
}

export async function sendMessage(roomId: string, senderId: string, input: SendMessageInput) {
  // Verify membership
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId: senderId } },
  });
  if (!membership) throw AppError.forbidden('Você não é membro desta sala');

  return prisma.chatMessage.create({
    data: {
      roomId,
      senderId,
      body: input.body,
      attachmentUrl: input.attachmentUrl,
      attachmentType: input.attachmentType,
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function markAsRead(messageId: string, userId: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw AppError.notFound('Mensagem');

  if (!message.readBy.includes(userId)) {
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { readBy: { push: userId } },
    });
  }
}

export async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  const member = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  return !!member;
}
