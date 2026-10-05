// Integração BÈR OS → BÈR App (04/10/26): busca read-only pro campo único
// do BÈR OS. Chamada servidor-a-servidor com API Key de nível diretoria;
// o e-mail identifica QUEM busca e o escopo segue as regras do app:
// coordenação pra cima vê tudo, o resto só as obras onde é membro.
import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { ROLE_HIERARCHY } from '../../config/constants';
import type { Role } from '../../config/constants';

const router = Router();

router.get('/busca', authenticate, requireRole('diretoria'), async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  const email = String(req.query.email ?? '').trim().toLowerCase();
  if (q.length < 2 || !email) return res.json({ obras: [], documentos: [] });

  const usuario = await prisma.user.findUnique({ where: { email } });
  if (!usuario || !usuario.isActive) return res.json({ obras: [], documentos: [], semVinculo: true });

  // Escopo de obras: nível >= coordenação vê tudo; demais, só onde é membro
  const nivel = ROLE_HIERARCHY[usuario.role as Role] ?? 0;
  let obraIds: string[] | null = null; // null = sem restrição
  if (nivel < 3) {
    const membros = await prisma.obraMember.findMany({ where: { userId: usuario.id }, select: { obraId: true } });
    obraIds = membros.map(m => m.obraId);
    if (obraIds.length === 0) return res.json({ obras: [], documentos: [] });
  }
  const filtroObra = obraIds ? { id: { in: obraIds } } : {};
  const filtroObraId = obraIds ? { obraId: { in: obraIds } } : {};

  const [obras, projetoDocs, obraDocs] = await Promise.all([
    prisma.obra.findMany({
      where: {
        ...filtroObra,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { client: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, client: true, status: true },
    }),
    prisma.projetoDocumento.findMany({
      where: {
        ...filtroObraId,
        obsoleto: false,
        OR: [
          { codigo: { contains: q, mode: 'insensitive' } },
          { titulo: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 8,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, codigo: true, titulo: true, disciplina: true, obraId: true, obra: { select: { name: true } } },
    }),
    prisma.obraDocumento.findMany({
      where: { ...filtroObraId, nome: { contains: q, mode: 'insensitive' } },
      take: 8,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, nome: true, tipo: true, obraId: true, obra: { select: { name: true } } },
    }),
  ]);

  res.json({
    obras: obras.map(o => ({ id: o.id, nome: o.name, cliente: o.client, status: o.status })),
    documentos: [
      ...projetoDocs.map(d => ({
        id: d.id, nome: d.titulo ? `${d.codigo} — ${d.titulo}` : d.codigo,
        detalhe: d.disciplina, obraId: d.obraId, obraNome: d.obra.name, origem: 'projeto' as const,
      })),
      ...obraDocs.map(d => ({
        id: d.id, nome: d.nome, detalhe: d.tipo, obraId: d.obraId, obraNome: d.obra.name, origem: 'gestao' as const,
      })),
    ].slice(0, 10),
  });
});

// ─── Co-worker BÈR OS (04/10/26): leituras e ações de BAIXO risco, sempre
// em nome de um usuário identificado por e-mail, tudo auditável pelo app.
// NUNCA: dinheiro, exclusões, ganho/perda de oportunidade.

async function usuarioPorEmail(email: string) {
  if (!email) return null;
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return u && u.isActive ? u : null;
}

// Pipeline comercial (esteira) — valores só pra nível diretoria+
// Bug encontrado 05/10 (Bruno comparou com o CRM de verdade e os números não
// batiam): "take: 60" + "orderBy etapa asc" cortava o resultado DENTRO da
// etapa "lead" (ordem alfabética: lead < negociacao < proposta_* < qualificacao),
// então nenhuma oportunidade de outra etapa chegava a aparecer — a ferramenta
// via 60 leads e achava que era o pipeline inteiro. CRM real tinha 108 ativas
// espalhadas em 4 etapas. Corrigido: sem corte artificial, ordenado na
// sequência real do funil (não alfabética).
const ORDEM_FUNIL = ['lead', 'qualificacao', 'proposta_producao', 'proposta_enviada', 'negociacao'];
router.get('/crm/pipeline', authenticate, requireRole('diretoria'), async (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  const usuario = await usuarioPorEmail(email);
  if (!usuario) return res.status(404).json({ error: { message: 'Usuário não encontrado no BÈR App' } });
  const nivel = ROLE_HIERARCHY[usuario.role as Role] ?? 0;
  const oportunidades = await prisma.crmOportunidade.findMany({
    where: { etapa: { notIn: ['ganho', 'perdido', 'declinado', 'cancelado'] } },
    orderBy: [{ ordem: 'asc' }],
    take: 500, // teto de segurança, não um corte esperado — hoje são 108 ativas
    select: {
      id: true, titulo: true, etapa: true, probabilidade: true,
      dataFechamentoPrevisto: true, valor: true,
      empresa: { select: { razaoSocial: true } },
      responsavel: { select: { name: true } },
    },
  });
  oportunidades.sort((a, b) => ORDEM_FUNIL.indexOf(a.etapa) - ORDEM_FUNIL.indexOf(b.etapa));
  res.json({
    total: oportunidades.length,
    porEtapa: Object.fromEntries(ORDEM_FUNIL.map(e => [e, oportunidades.filter(o => o.etapa === e).length])),
    oportunidades: oportunidades.map(o => ({
      id: o.id, titulo: o.titulo, etapa: o.etapa,
      empresa: o.empresa?.razaoSocial ?? null,
      responsavel: o.responsavel?.name ?? null,
      probabilidade: o.probabilidade,
      fechamentoPrevisto: o.dataFechamentoPrevisto,
      ...(nivel >= 4 && o.valor != null ? { valor: Number(o.valor) } : {}),
    })),
  });
});

// Tarefas de uma obra (por nome aproximado ou id)
router.get('/tarefas', authenticate, requireRole('diretoria'), async (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  const obraQ = String(req.query.obra ?? '').trim();
  const usuario = await usuarioPorEmail(email);
  if (!usuario) return res.status(404).json({ error: { message: 'Usuário não encontrado no BÈR App' } });
  if (!obraQ) return res.status(400).json({ error: { message: 'Informe a obra' } });
  const obra = await prisma.obra.findFirst({
    where: { name: { contains: obraQ, mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!obra) return res.status(404).json({ error: { message: `Obra "${obraQ}" não encontrada` } });
  // escopo: quem não é coordenação+ precisa ser membro da obra
  const nivel = ROLE_HIERARCHY[usuario.role as Role] ?? 0;
  if (nivel < 3) {
    const membro = await prisma.obraMember.findFirst({ where: { obraId: obra.id, userId: usuario.id } });
    if (!membro) return res.status(403).json({ error: { message: 'Usuário não participa dessa obra' } });
  }
  const tarefas = await prisma.obraTask.findMany({
    where: { obraId: obra.id, status: { not: 'done' } },
    orderBy: [{ dueDate: 'asc' }],
    take: 40,
    select: { id: true, title: true, status: true, priority: true, dueDate: true },
  });
  res.json({ obra: { id: obra.id, nome: obra.name }, tarefas });
});

// Contatos da BÈR pro BÈR OS (pedido Bruno 05/10): nomes e e-mails dos
// usuários ativos — alimenta o autocomplete de destinatários da ata.
router.get('/contatos', authenticate, requireRole('diretoria'), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { name: true, email: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
  res.json({ contatos: users.map(u => ({ nome: u.name, email: u.email.toLowerCase() })) });
});

// Indicadores do dia pro BÈR OS (item 1 do backlog, 05/10): counts por usuário,
// read-only, sem valores financeiros. Escopo: membro vê as obras dele;
// coordenação+ vê todas as ativas; esteira só escritório(4)+.
router.get('/indicadores', authenticate, requireRole('diretoria'), async (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  const usuario = await usuarioPorEmail(email);
  if (!usuario) return res.status(404).json({ error: { message: 'Usuário não encontrado no BÈR App' } });
  const nivel = ROLE_HIERARCHY[usuario.role as Role] ?? 0;

  let obraIds: string[] | null = null; // null = todas
  if (nivel < 3) {
    const membros = await prisma.obraMember.findMany({ where: { userId: usuario.id }, select: { obraId: true } });
    obraIds = membros.map(m => m.obraId);
  }
  const whereTarefa = {
    status: { not: 'done' as const },
    ...(obraIds ? { obraId: { in: obraIds } } : {}),
  };
  const hoje = new Date();
  const [tarefasAbertas, tarefasAtrasadas, oportunidadesAtivas] = await Promise.all([
    prisma.obraTask.count({ where: whereTarefa }),
    prisma.obraTask.count({ where: { ...whereTarefa, dueDate: { lt: hoje } } }),
    nivel >= 4
      ? prisma.crmOportunidade.count({ where: { etapa: { notIn: ['ganho', 'perdido', 'declinado', 'cancelado'] } } })
      : Promise.resolve(null),
  ]);
  res.json({ tarefasAbertas, tarefasAtrasadas, oportunidadesAtivas });
});

// Criar tarefa numa obra (ação de escrita — autoria do usuário)
router.post('/tarefas', authenticate, requireRole('diretoria'), async (req, res) => {
  const { email, obra: obraQ, titulo, descricao, prazo, prioridade } = req.body ?? {};
  const usuario = await usuarioPorEmail(String(email ?? ''));
  if (!usuario) return res.status(404).json({ error: { message: 'Usuário não encontrado no BÈR App' } });
  if (!obraQ || !titulo) return res.status(400).json({ error: { message: 'Informe obra e título' } });
  const obra = await prisma.obra.findFirst({
    where: { name: { contains: String(obraQ), mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!obra) return res.status(404).json({ error: { message: `Obra "${obraQ}" não encontrada` } });
  const nivel = ROLE_HIERARCHY[usuario.role as Role] ?? 0;
  if (nivel < 3) {
    const membro = await prisma.obraMember.findFirst({ where: { obraId: obra.id, userId: usuario.id } });
    if (!membro) return res.status(403).json({ error: { message: 'Usuário não participa dessa obra' } });
  }
  const tarefa = await prisma.obraTask.create({
    data: {
      obraId: obra.id,
      title: String(titulo).slice(0, 255),
      description: descricao ? String(descricao).slice(0, 2000) : null,
      priority: ['low', 'medium', 'high', 'urgent'].includes(prioridade) ? prioridade : 'medium',
      dueDate: prazo ? new Date(String(prazo)) : null,
      createdBy: usuario.id,
    },
  });
  res.status(201).json({ ok: true, tarefa: { id: tarefa.id, titulo: tarefa.title, obra: obra.name, prazo: tarefa.dueDate } });
});

// Registrar atividade/nota numa oportunidade do CRM
router.post('/crm/atividades', authenticate, requireRole('diretoria'), async (req, res) => {
  const { email, oportunidade: opQ, tipo, notas } = req.body ?? {};
  const usuario = await usuarioPorEmail(String(email ?? ''));
  if (!usuario) return res.status(404).json({ error: { message: 'Usuário não encontrado no BÈR App' } });
  if (!opQ || !notas) return res.status(400).json({ error: { message: 'Informe a oportunidade e a nota' } });
  const op = await prisma.crmOportunidade.findFirst({
    where: { titulo: { contains: String(opQ), mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!op) return res.status(404).json({ error: { message: `Oportunidade "${opQ}" não encontrada` } });
  const atividade = await prisma.crmAtividade.create({
    data: {
      oportunidadeId: op.id,
      usuarioId: usuario.id,
      tipo: ['nota', 'ligacao', 'reuniao', 'email', 'followup'].includes(tipo) ? tipo : 'nota',
      dataHora: new Date(),
      notas: String(notas).slice(0, 4000),
      concluida: true,
    },
  });
  res.status(201).json({ ok: true, atividade: { id: atividade.id, oportunidade: op.titulo, tipo: atividade.tipo } });
});

// Mover oportunidade de etapa (NUNCA pra ganho/perdido/declinado/cancelado)
router.patch('/crm/oportunidades/etapa', authenticate, requireRole('diretoria'), async (req, res) => {
  const { email, oportunidade: opQ, etapa } = req.body ?? {};
  const usuario = await usuarioPorEmail(String(email ?? ''));
  if (!usuario) return res.status(404).json({ error: { message: 'Usuário não encontrado no BÈR App' } });
  const PERMITIDAS = ['lead', 'qualificacao', 'proposta_producao', 'proposta_enviada', 'negociacao'];
  if (!PERMITIDAS.includes(etapa)) {
    return res.status(400).json({ error: { message: `Etapa deve ser uma de: ${PERMITIDAS.join(', ')} (ganho/perda só manualmente no app)` } });
  }
  const op = await prisma.crmOportunidade.findFirst({
    where: { titulo: { contains: String(opQ ?? ''), mode: 'insensitive' }, etapa: { notIn: ['ganho', 'perdido', 'declinado', 'cancelado'] } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!op) return res.status(404).json({ error: { message: `Oportunidade ativa "${opQ}" não encontrada` } });
  const anterior = op.etapa;
  await prisma.crmOportunidade.update({ where: { id: op.id }, data: { etapa } });
  await prisma.crmOportunidadeHistorico.create({
    data: { oportunidadeId: op.id, campo: 'etapa', valorAntigo: anterior, valorNovo: etapa, alteradoPor: `${usuario.name} (via BÈR OS)` },
  }).catch(() => { /* histórico é melhor-esforço */ });
  res.json({ ok: true, oportunidade: op.titulo, de: anterior, para: etapa });
});

export default router;
