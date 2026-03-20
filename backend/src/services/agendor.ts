import { env } from '../config/env';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgendorOrganization {
  id: number;
  name: string;
}

export interface AgendorDealStage {
  id: number;
  name: string;
  sequence: number;
  funnel?: {
    id: number;
    name: string;
  };
}

export interface AgendorDealStatus {
  id: number;
  name: string;
}

export interface AgendorDeal {
  id: number;
  title: string;
  value: number | null;
  organization?: AgendorOrganization | null;
  dealStage: AgendorDealStage;
  dealStatus: AgendorDealStatus;
  startTime: string | null;
  endTime: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
  _webUrl: string;
}

export interface AgendorListResponse {
  data: AgendorDeal[];
  meta: {
    totalCount: number;
  };
  links: {
    next?: string;
  };
}

// ─── Client ──────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const PER_PAGE = 100;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function agendorFetch<T>(path: string, retries = MAX_RETRIES): Promise<T> {
  const url = path.startsWith('http') ? path : `${env.agendorBaseUrl}${path}`;
  const token = env.agendorApiToken;

  if (!token) {
    throw new Error('AGENDOR_API_TOKEN não configurado');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        console.warn(`[Agendor] Rate limit hit, aguardando ${retryAfter}s (tentativa ${attempt}/${retries})`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Agendor API ${response.status}: ${body}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Agendor] Erro na tentativa ${attempt}/${retries}, retrying...`, (err as Error).message);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error('Agendor API: max retries exceeded');
}

// Funil DNN — único funil sincronizado
const FUNNEL_DNN_ID = 771405;

export async function fetchAllDeals(): Promise<AgendorDeal[]> {
  const allDeals: AgendorDeal[] = [];
  let page = 1;

  console.log(`[Agendor] Iniciando busca de deals (funil DNN: ${FUNNEL_DNN_ID})...`);

  while (true) {
    const response = await agendorFetch<AgendorListResponse>(
      `/deals?per_page=${PER_PAGE}&page=${page}`
    );

    // API não suporta filtro por funil — filtramos client-side
    const funnelDeals = response.data.filter(
      (d) => d.dealStage.funnel?.id === FUNNEL_DNN_ID
    );
    allDeals.push(...funnelDeals);
    console.log(`[Agendor] Página ${page}: ${funnelDeals.length}/${response.data.length} deals do funil DNN (acumulado: ${allDeals.length})`);

    if (!response.links.next || response.data.length < PER_PAGE) {
      break;
    }

    page++;
  }

  console.log(`[Agendor] Busca completa: ${allDeals.length} deals do funil DNN`);
  return allDeals;
}

export async function fetchDealById(id: number): Promise<AgendorDeal> {
  const response = await agendorFetch<{ data: AgendorDeal }>(`/deals/${id}`);
  return response.data;
}

// ─── Status Mapping (Funil DNN — id 771405) ─────────────────────────────────
//
// Cada stage do Agendor mapeia 1:1 para um status no kanban.
// dealStatus Ganho/Perdido tem prioridade e não aparece no kanban.

const STAGE_TO_STATUS: Record<string, string> = {
  'Leads - Informações de mercado':        'leads_info',
  'Leads - Aguardando entrada':            'leads_aguardando',
  'Contato / Identificação de interesse':  'contato',
  'ANALISE DE GO X NO GO':                 'analise',
  'GO - Aguardando para inicio de orcamento': 'go_aguardando',
  'Proposta em desenvolvimento':           'proposta_dev',
  'Enviadas - Probabilidade Alta':         'enviada_alta',
  'Enviadas - Probabilidade Media':        'enviada_media',
  'Enviadas - Probabilidade Baixa':        'enviada_baixa',
};

export function mapAgendorStatus(deal: AgendorDeal): string {
  if (deal.dealStatus.name === 'Ganho' || deal.wonAt) {
    return 'ganha';
  }

  if (deal.dealStatus.name === 'Perdido' || deal.lostAt) {
    return 'perdida';
  }

  return STAGE_TO_STATUS[deal.dealStage.name] || 'leads_info';
}
