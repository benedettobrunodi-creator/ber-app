import api, { ApiResponse } from './api';
import { User } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatRoomType = 'group' | 'direct' | 'obra';

export interface ChatRoom {
  id: string;
  name: string;
  type: ChatRoomType;
  obraId: string | null;
  createdAt: string;
  lastMessage?: ChatMessage;
  unreadCount?: number;
  members?: User[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  readBy: string[];
  createdAt: string;
  sender?: User;
}

export interface GetMessagesParams {
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getChatRooms(): Promise<ChatRoom[]> {
  const response = await api.get<ApiResponse<ChatRoom[]>>('/chat/rooms');
  return response.data.data;
}

export async function getRoomMessages(
  roomId: string,
  params?: GetMessagesParams,
): Promise<ApiResponse<ChatMessage[]>> {
  const response = await api.get<ApiResponse<ChatMessage[]>>(
    `/chat/rooms/${roomId}/messages`,
    { params },
  );
  return response.data;
}

export async function sendMessage(
  roomId: string,
  body: string,
  attachmentUrl?: string,
  attachmentType?: string,
): Promise<ChatMessage> {
  const response = await api.post<ApiResponse<ChatMessage>>(
    `/chat/rooms/${roomId}/messages`,
    {
      body,
      attachmentUrl,
      attachmentType,
    },
  );
  return response.data.data;
}
