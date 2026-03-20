import api, { ApiResponse } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProposalStatus =
  | 'leads_info'
  | 'leads_aguardando'
  | 'contato'
  | 'analise'
  | 'go_aguardando'
  | 'proposta_dev'
  | 'enviada_alta'
  | 'enviada_media'
  | 'enviada_baixa'
  | 'ganha'
  | 'perdida';

export interface Proposal {
  id: string;
  agendorDealId: string | null;
  clientName: string;
  title: string;
  value: number;
  status: ProposalStatus;
  sentDate: string | null;
  closedDate: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineItem {
  status: ProposalStatus;
  count: number;
  totalValue: number;
}

export interface ProposalStats {
  pipeline: Record<ProposalStatus, number>;
  total: number;
  totalValue: string;
  wonValue: string;
  conversionRate: string;
  thisMonth: number;
}

// ---------------------------------------------------------------------------
// Agendor Stats Types
// ---------------------------------------------------------------------------

export interface AgendorStageStats {
  count: number;
  value: number;
}

export interface AgendorStats {
  total: number;
  byStage: Record<string, AgendorStageStats>;
  byStatus: Record<string, AgendorStageStats>;
}

export interface GetProposalsParams {
  status?: ProposalStatus;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getProposals(
  params?: GetProposalsParams,
): Promise<ApiResponse<Proposal[]>> {
  const response = await api.get<ApiResponse<Proposal[]>>('/proposals', {
    params,
  });
  return response.data;
}

export async function getProposal(id: string): Promise<Proposal> {
  const response = await api.get<ApiResponse<Proposal>>(`/proposals/${id}`);
  return response.data.data;
}

export async function getProposalStats(): Promise<ProposalStats> {
  const response = await api.get<ApiResponse<ProposalStats>>(
    '/proposals/stats',
  );
  return response.data.data;
}

export async function getAgendorStats(): Promise<AgendorStats> {
  const response = await api.get<ApiResponse<AgendorStats>>(
    '/proposals/agendor-stats',
  );
  return response.data.data;
}
