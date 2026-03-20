import api, { ApiResponse } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  sent: boolean;
  createdAt: string;
}

export interface UnreadCount {
  count: number;
}

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getNotifications(
  params?: GetNotificationsParams,
): Promise<ApiResponse<Notification[]>> {
  const response = await api.get<ApiResponse<Notification[]>>(
    '/notifications',
    { params },
  );
  return response.data;
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}

export async function getUnreadCount(): Promise<number> {
  const response = await api.get<ApiResponse<UnreadCount>>(
    '/notifications/unread-count',
  );
  return response.data.data.count;
}
