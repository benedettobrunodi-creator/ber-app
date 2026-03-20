import api, { ApiResponse } from './api';
import { User } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnnouncementCategory =
  | 'urgente'
  | 'informativo'
  | 'rh'
  | 'obra';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  targetRoles: string[];
  authorId: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author?: User;
  readCount?: number;
  isRead?: boolean;
}

export interface AnnouncementRead {
  id: string;
  announcementId: string;
  userId: string;
  readAt: string;
  user?: User;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getAnnouncements(): Promise<Announcement[]> {
  const response = await api.get<ApiResponse<Announcement[]>>(
    '/announcements',
  );
  return response.data.data;
}

export async function getAnnouncement(id: string): Promise<Announcement> {
  const response = await api.get<ApiResponse<Announcement>>(
    `/announcements/${id}`,
  );
  return response.data.data;
}

export async function getAnnouncementReads(
  id: string,
): Promise<AnnouncementRead[]> {
  const response = await api.get<ApiResponse<AnnouncementRead[]>>(
    `/announcements/${id}/reads`,
  );
  return response.data.data;
}
