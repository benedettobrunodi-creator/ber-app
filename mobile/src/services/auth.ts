import * as SecureStore from 'expo-secure-store';
import api, { ApiResponse, STORAGE_KEYS } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
    email,
    password,
  });

  const { accessToken, refreshToken, user } = response.data.data;

  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

  return response.data.data;
}

export async function refreshToken(): Promise<RefreshTokenResponse> {
  const storedRefreshToken = await SecureStore.getItemAsync(
    STORAGE_KEYS.REFRESH_TOKEN,
  );

  const response = await api.post<ApiResponse<RefreshTokenResponse>>(
    '/auth/refresh',
    { refreshToken: storedRefreshToken },
  );

  const { accessToken, refreshToken: newRefreshToken } = response.data.data;

  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

  return response.data.data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}

// ---------------------------------------------------------------------------
// SecureStore helpers
// ---------------------------------------------------------------------------

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}
