import api, { ApiResponse } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeEntryType = 'checkin' | 'checkout';

export interface TimeEntry {
  id: string;
  userId: string;
  obraId: string;
  type: TimeEntryType;
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TimeEntryStatus {
  isCheckedIn: boolean;
  lastEntry?: TimeEntry | null;
  checkedInSince?: string | null;
}

export interface CheckInData {
  obraId: string;
  latitude: number;
  longitude: number;
  address?: string;
  notes?: string;
}

export interface CheckOutData {
  latitude: number;
  longitude: number;
  address?: string;
  notes?: string;
}

export interface GetEntriesParams {
  month?: number;
  year?: number;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function checkIn(data: CheckInData): Promise<TimeEntry> {
  const response = await api.post<ApiResponse<TimeEntry>>(
    '/time-entries/checkin',
    data,
  );
  return response.data.data;
}

export async function checkOut(data: CheckOutData): Promise<TimeEntry> {
  const response = await api.post<ApiResponse<TimeEntry>>(
    '/time-entries/checkout',
    data,
  );
  return response.data.data;
}

export async function getMyEntries(
  params?: GetEntriesParams,
): Promise<ApiResponse<TimeEntry[]>> {
  const response = await api.get<ApiResponse<TimeEntry[]>>(
    '/time-entries/me',
    { params },
  );
  return response.data;
}

export async function getMyStatus(): Promise<TimeEntryStatus> {
  const response = await api.get<ApiResponse<TimeEntryStatus>>(
    '/time-entries/me/status',
  );
  return response.data.data;
}
