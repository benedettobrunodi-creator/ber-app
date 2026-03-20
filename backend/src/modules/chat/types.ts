import { z } from 'zod';
import { CHAT_ROOM_TYPES } from '../../config/constants';

export const createRoomSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(CHAT_ROOM_TYPES).default('group'),
  obraId: z.string().uuid().optional(),
  memberIds: z.array(z.string().uuid()).min(1),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1),
  attachmentUrl: z.string().url().optional(),
  attachmentType: z.enum(['image', 'file', 'audio']).optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Socket.io event types
export interface ServerToClientEvents {
  new_message: (message: any) => void;
  typing: (data: { userId: string; roomId: string; userName: string }) => void;
  user_joined: (data: { userId: string; roomId: string }) => void;
  user_left: (data: { userId: string; roomId: string }) => void;
}

export interface ClientToServerEvents {
  join_room: (roomId: string) => void;
  leave_room: (roomId: string) => void;
  message: (data: { roomId: string; body: string; attachmentUrl?: string; attachmentType?: string }) => void;
  typing: (data: { roomId: string }) => void;
  read: (data: { roomId: string; messageId: string }) => void;
}
