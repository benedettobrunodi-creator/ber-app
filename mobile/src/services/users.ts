import api, { ApiResponse } from './api';
import { User } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpdateMeData {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getMe(): Promise<User> {
  const response = await api.get<ApiResponse<User>>('/users/me');
  return response.data.data;
}

export async function updateMe(data: UpdateMeData): Promise<User> {
  const response = await api.put<ApiResponse<User>>('/users/me', data);
  return response.data.data;
}

export async function registerPushToken(token: string): Promise<void> {
  await api.put('/users/me/push-token', { pushToken: token });
}
