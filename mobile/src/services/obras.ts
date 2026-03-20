import api, { ApiResponse } from './api';
import { User } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ObraStatus = 'planejamento' | 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';

export interface Obra {
  id: string;
  name: string;
  client: string;
  address: string;
  status: ObraStatus;
  startDate: string;
  expectedEndDate: string;
  actualEndDate: string | null;
  progressPercent: number;
  coordinatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObraMember {
  id: string;
  obraId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: User;
}

export interface ObraStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  membersCount: number;
  photosCount: number;
  progressPercent: number;
}

export interface GetObrasParams {
  status?: ObraStatus;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getObras(
  params?: GetObrasParams,
): Promise<ApiResponse<Obra[]>> {
  const response = await api.get<ApiResponse<Obra[]>>('/obras', { params });
  return response.data;
}

export async function getObra(id: string): Promise<Obra> {
  const response = await api.get<ApiResponse<Obra>>(`/obras/${id}`);
  return response.data.data;
}

export async function getObraMembers(id: string): Promise<ObraMember[]> {
  const response = await api.get<ApiResponse<ObraMember[]>>(
    `/obras/${id}/members`,
  );
  return response.data.data;
}

export async function getObraStats(id: string): Promise<ObraStats> {
  const response = await api.get<ApiResponse<ObraStats>>(
    `/obras/${id}/stats`,
  );
  return response.data.data;
}
