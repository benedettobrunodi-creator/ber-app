import api, { ApiResponse } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Meeting {
  id: string;
  googleEventId: string | null;
  title: string;
  description: string | null;
  clientName: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  proposalId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface GetMeetingsParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getMeetings(
  params?: GetMeetingsParams,
): Promise<ApiResponse<Meeting[]>> {
  const response = await api.get<ApiResponse<Meeting[]>>('/meetings', {
    params,
  });
  return response.data;
}

export async function getUpcomingMeetings(): Promise<Meeting[]> {
  const response = await api.get<ApiResponse<Meeting[]>>(
    '/meetings/upcoming',
  );
  return response.data.data;
}
