import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_URL = process.env.BER_API_URL ?? 'https://ber-app-production.up.railway.app/v1';
const API_KEY = process.env.BER_API_KEY ?? '';

async function req(method: string, path: string, body?: unknown) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as { data?: unknown; error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json.data;
}

const server = new McpServer({
  name: 'ber-app',
  version: '1.0.0',
});

// ─── ORÇAMENTOS ──────────────────────────────────────────────────────────────

server.tool(
  'list_orcamentos',
  'Lista orçamentos da esteira comercial com filtros opcionais',
  {
    status: z.string().optional().describe('Filtrar por status: A_INICIAR, PRODUZINDO, REVISAO, ENVIADO, AGUARDANDO, APROVADO, ENTREGUE, DECLINADO, NO_GO, CHANGE_ORDER'),
    q: z.string().optional().describe('Busca por número, cliente ou descrição'),
    segmento: z.string().optional().describe('Corporativo, Residencial, Industrial, Igreja, Hotel, Outros'),
    estrategico: z.boolean().optional().describe('Filtrar só estratégicos'),
  },
  async ({ status, q, segmento, estrategico }) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    if (segmento) params.set('segmento', segmento);
    if (estrategico !== undefined) params.set('estrategico', String(estrategico));
    const data = await req('GET', `/orcamentos?${params}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'get_orcamento',
  'Retorna detalhes completos de um orçamento incluindo histórico de alterações',
  { id: z.string().describe('UUID do orçamento') },
  async ({ id }) => {
    const data = await req('GET', `/orcamentos/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'create_orcamento',
  'Cria um novo orçamento na esteira',
  {
    numero: z.string().describe('Número do orçamento ex: 583.26'),
    cliente: z.string().describe('Nome do cliente'),
    descricaoCurta: z.string().optional(),
    valorVenda: z.number().optional().describe('Valor em reais'),
    segmento: z.string().optional(),
    status: z.string().optional().describe('Default: A_INICIAR'),
    tipo: z.string().optional().describe('NOVO, REVISAO ou CHANGE_ORDER'),
    probabilidade: z.string().optional().describe('ALTA, MEDIA ou BAIXA'),
    observacoes: z.string().optional(),
  },
  async (body) => {
    const data = await req('POST', '/orcamentos', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'update_orcamento',
  'Atualiza campos de um orçamento existente',
  {
    id: z.string().describe('UUID do orçamento'),
    status: z.string().optional(),
    probabilidade: z.string().optional().describe('ALTA, MEDIA, BAIXA ou null para limpar'),
    valorVenda: z.number().optional(),
    observacoes: z.string().optional(),
    tipo: z.string().optional(),
    estrategico: z.boolean().optional(),
  },
  async ({ id, ...body }) => {
    const data = await req('PATCH', `/orcamentos/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'get_pipeline_orcamentos',
  'Retorna orçamentos em ENVIADO, AGUARDANDO e APROVADO agrupados por probabilidade com totais R$',
  {},
  async () => {
    const all = await req('GET', '/orcamentos?status=ENVIADO') as any[];
    const aguardando = await req('GET', '/orcamentos?status=AGUARDANDO') as any[];
    const aprovado = await req('GET', '/orcamentos?status=APROVADO') as any[];
    const items = [...all, ...aguardando, ...aprovado];
    const byProb: Record<string, { count: number; total: number; items: any[] }> = {
      ALTA: { count: 0, total: 0, items: [] },
      MEDIA: { count: 0, total: 0, items: [] },
      BAIXA: { count: 0, total: 0, items: [] },
      SEM_CLASSIFICACAO: { count: 0, total: 0, items: [] },
    };
    for (const o of items) {
      const key = o.probabilidade ?? 'SEM_CLASSIFICACAO';
      byProb[key].count++;
      byProb[key].total += Number(o.valorVenda ?? 0);
      byProb[key].items.push({ id: o.id, numero: o.numero, cliente: o.cliente, valorVenda: o.valorVenda, status: o.status });
    }
    return { content: [{ type: 'text', text: JSON.stringify(byProb, null, 2) }] };
  },
);

// ─── OBRAS ───────────────────────────────────────────────────────────────────

server.tool(
  'list_obras',
  'Lista obras ativas com filtros opcionais',
  {
    status: z.string().optional().describe('Status da obra'),
    q: z.string().optional().describe('Busca por nome ou código'),
  },
  async ({ status, q }) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    const data = await req('GET', `/obras?${params}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'get_obra',
  'Retorna detalhes completos de uma obra',
  { id: z.string().describe('UUID da obra') },
  async ({ id }) => {
    const data = await req('GET', `/obras/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── USUÁRIOS ────────────────────────────────────────────────────────────────

server.tool(
  'list_users',
  'Lista usuários ativos do BÈR App',
  {},
  async () => {
    const data = await req('GET', '/users?limit=100');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
