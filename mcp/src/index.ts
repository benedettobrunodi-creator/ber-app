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

// ─── CRM ─────────────────────────────────────────────────────────────────────

server.tool(
  'list_oportunidades',
  'Lista oportunidades do pipeline CRM com filtros opcionais',
  {
    etapa: z.string().optional().describe('lead | qualificacao | proposta_producao | proposta_enviada | negociacao | ganho | perdido'),
    responsavelId: z.string().optional().describe('UUID do responsável'),
    empresaId: z.string().optional().describe('UUID da empresa'),
    origem: z.string().optional().describe('gerenciadora | marketing | outbound | networking | broker | arquitetura | recorrente'),
    search: z.string().optional().describe('Busca por título'),
  },
  async ({ etapa, responsavelId, empresaId, origem, search }) => {
    const params = new URLSearchParams();
    if (etapa) params.set('etapa', etapa);
    if (responsavelId) params.set('responsavelId', responsavelId);
    if (empresaId) params.set('empresaId', empresaId);
    if (origem) params.set('origem', origem);
    if (search) params.set('search', search);
    const data = await req('GET', `/crm/oportunidades?${params}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'get_oportunidade',
  'Retorna detalhes completos de uma oportunidade incluindo atividades',
  { id: z.string().describe('UUID da oportunidade') },
  async ({ id }) => {
    const data = await req('GET', `/crm/oportunidades/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'create_oportunidade',
  'Cria uma nova oportunidade no pipeline CRM',
  {
    titulo: z.string().describe('Título/nome da oportunidade'),
    valor: z.number().optional().describe('Valor estimado em reais'),
    etapa: z.string().optional().describe('Default: lead. Opções: lead | qualificacao | proposta_producao | proposta_enviada | negociacao'),
    origem: z.string().optional().describe('gerenciadora | marketing | outbound | networking | broker | arquitetura | recorrente'),
    probabilidade: z.string().optional().describe('alta | media | baixa'),
    empresaId: z.string().optional().describe('UUID da empresa'),
    contatoId: z.string().optional().describe('UUID do contato'),
    responsavelId: z.string().optional().describe('UUID do responsável (usuário)'),
    dataFechamentoPrevisto: z.string().optional().describe('Data prevista de fechamento ISO: YYYY-MM-DD'),
    observacoes: z.string().optional(),
  },
  async (body) => {
    const data = await req('POST', '/crm/oportunidades', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'update_oportunidade',
  'Atualiza campos de uma oportunidade existente (incluindo mover de etapa)',
  {
    id: z.string().describe('UUID da oportunidade'),
    titulo: z.string().optional(),
    valor: z.number().optional(),
    etapa: z.string().optional().describe('lead | qualificacao | proposta_producao | proposta_enviada | negociacao | ganho | perdido'),
    origem: z.string().optional(),
    probabilidade: z.string().optional().describe('alta | media | baixa'),
    empresaId: z.string().optional(),
    contatoId: z.string().optional(),
    responsavelId: z.string().optional(),
    dataFechamentoPrevisto: z.string().optional().describe('YYYY-MM-DD ou null para limpar'),
    motivoPerda: z.string().optional().describe('Obrigatório quando etapa=perdido'),
    observacoes: z.string().optional(),
  },
  async ({ id, ...body }) => {
    const data = await req('PATCH', `/crm/oportunidades/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'list_empresas_crm',
  'Lista empresas cadastradas no CRM',
  {
    search: z.string().optional().describe('Busca por razão social'),
    segmento: z.string().optional().describe('Corporativo | Residencial | Industrial | Igreja | Hotel | Outros'),
    nutricao: z.boolean().optional().describe('Filtrar empresas em nutrição'),
  },
  async ({ search, segmento, nutricao }) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (segmento) params.set('segmento', segmento);
    if (nutricao !== undefined) params.set('nutricao', String(nutricao));
    const data = await req('GET', `/crm/empresas?${params}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'create_empresa_crm',
  'Cadastra uma nova empresa no CRM',
  {
    razaoSocial: z.string().describe('Razão social ou nome da empresa'),
    cnpj: z.string().optional(),
    segmento: z.string().optional().describe('Corporativo | Residencial | Industrial | Igreja | Hotel | Outros'),
    cidade: z.string().optional(),
  },
  async (body) => {
    const data = await req('POST', '/crm/empresas', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'create_contato_crm',
  'Adiciona um contato a uma empresa no CRM',
  {
    empresaId: z.string().describe('UUID da empresa'),
    nome: z.string().describe('Nome completo do contato'),
    cargo: z.string().optional(),
    email: z.string().optional(),
    telefone: z.string().optional(),
  },
  async (body) => {
    const data = await req('POST', '/crm/contatos', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'create_atividade_crm',
  'Registra uma atividade (reunião, ligação, e-mail, visita) em uma oportunidade',
  {
    oportunidadeId: z.string().describe('UUID da oportunidade'),
    tipo: z.string().describe('reuniao | ligacao | email | visita | outro'),
    dataHora: z.string().describe('Data e hora ISO: YYYY-MM-DDTHH:mm'),
    notas: z.string().optional().describe('Resumo / notas da atividade'),
    concluida: z.boolean().optional().describe('Default: false'),
  },
  async (body) => {
    const data = await req('POST', '/crm/atividades', { ...body, duracao: null });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'list_atividades_crm',
  'Lista atividades de uma oportunidade ou de todas as oportunidades',
  {
    oportunidadeId: z.string().optional().describe('Filtrar por oportunidade'),
    concluida: z.boolean().optional().describe('Filtrar por status de conclusão'),
  },
  async ({ oportunidadeId, concluida }) => {
    const params = new URLSearchParams();
    if (oportunidadeId) params.set('oportunidadeId', oportunidadeId);
    if (concluida !== undefined) params.set('concluida', String(concluida));
    const data = await req('GET', `/crm/atividades?${params}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'get_funil_crm',
  'Retorna resumo do funil de conversão (qualificação, propostas, conversão) com contagens e valores',
  {},
  async () => {
    const data = await req('GET', '/crm/stats/funil');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
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
