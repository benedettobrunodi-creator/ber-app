import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAnyRole } from '../../middleware/rbac';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);

const read = requireAnyRole('orcamentos', 'comercial', 'coordenacao', 'pmo', 'diretoria');
const write = requireAnyRole('orcamentos', 'comercial', 'coordenacao', 'diretoria');
const admin = requireAnyRole('diretoria');

// ── Empresas
router.get('/empresas', read, ctrl.listEmpresas);
router.get('/empresas/nutricao', read, ctrl.getNutricao);
router.get('/empresas/:id', read, ctrl.getEmpresa);
router.post('/empresas', write, ctrl.createEmpresa);
router.patch('/empresas/:id', write, ctrl.updateEmpresa);
router.delete('/empresas/:id', admin, ctrl.deleteEmpresa);

// ── Contatos
router.get('/contatos', read, ctrl.listContatos);
router.post('/contatos', write, ctrl.createContato);
router.patch('/contatos/:id', write, ctrl.updateContato);
router.delete('/contatos/:id', write, ctrl.deleteContato);

// ── Oportunidades
router.get('/oportunidades', read, ctrl.listOportunidades);
router.get('/oportunidades/:id', read, ctrl.getOportunidade);
router.post('/oportunidades', write, ctrl.createOportunidade);
router.patch('/oportunidades/:id', write, ctrl.updateOportunidade);
router.delete('/oportunidades/:id', admin, ctrl.deleteOportunidade);

// ── Atividades
router.get('/atividades', read, ctrl.listAtividades);
router.post('/atividades', write, ctrl.createAtividade);
router.patch('/atividades/:id', write, ctrl.updateAtividade);
router.delete('/atividades/:id', write, ctrl.deleteAtividade);

// ── Nutrição
router.get('/nutricao', read, ctrl.listNutricao);
router.get('/nutricao/agenda', read, ctrl.getNutricaoAgenda);
router.post('/contatos/:id/contatar', write, ctrl.contatarAgora);
router.post('/contatos/:id/interacao', write, ctrl.registrarInteracao);
router.get('/contatos/:id/historico', read, ctrl.getContatoHistorico);

// ── Campanhas
router.get('/campanhas', read, ctrl.listCampanhas);
router.get('/campanhas/:id', read, ctrl.getCampanha);
router.post('/campanhas', write, ctrl.createCampanha);
router.patch('/campanhas/:id', write, ctrl.updateCampanha);
router.delete('/campanhas/:id', write, ctrl.deleteCampanha);
router.post('/campanhas/:id/contatos', write, ctrl.addContatosCampanha);
router.patch('/campanhas/:id/contatos/:contatoId', write, ctrl.updateCampanhaContato);
router.patch('/campanhas/:id/status-bulk', write, ctrl.bulkUpdateCampanhaStatus);
router.delete('/campanhas/:id/contatos/:contatoId', write, ctrl.removeContatoCampanha);

// ── Metas
router.get('/metas/:ano', read, ctrl.getMetasAno);
router.put('/metas', admin, ctrl.upsertMetasAnuais);

// ── Integração
router.post('/oportunidades/:id/criar-orcamento', write, ctrl.criarOrcamentoDeOportunidade);
router.patch('/oportunidades/:id/vincular-orcamento', write, ctrl.vincularOrcamento);
router.post('/orcamentos/:id/criar-obra', write, ctrl.criarObraDeOrcamento);
router.get('/orcamentos/:id/contexto', read, ctrl.getContextoOrcamento);

// ── Stats / Relatórios
router.get('/stats/pipeline', read, ctrl.getPipelineStats);
router.get('/stats/funil', read, ctrl.getFunilMacro);
router.get('/stats/forecast/:ano', read, ctrl.getForecast);
router.get('/stats/vendas-vs-meta/:ano', read, ctrl.getVendasVsMeta);
router.get('/stats/pipeline-mes-a-mes/:ano', read, ctrl.getPipelineMesAMes);
router.get('/stats/ticket-medio', read, ctrl.getTicketMedio);
router.get('/stats/win-rate', read, ctrl.getWinRate);
router.get('/stats/pipeline-ativo-acumulado', read, ctrl.getPipelineAtivoAcumulado);
router.get('/stats/funil-conversao', read, ctrl.getFunilConversao);
router.get('/stats/motivos-perda', read, ctrl.getMotivosPerda);
router.get('/stats/performance-responsavel', read, ctrl.getPerformanceResponsavel);
router.get('/stats/forecast-horizonte', read, ctrl.getForecastHorizonte);
router.get('/stats/ciclo-vendas', read, ctrl.getCicloVendas);
router.get('/stats/win-rate-segmento', read, ctrl.getWinRateSegmento);
router.get('/stats/pipeline-aging', read, ctrl.getPipelineAging);
router.get('/stats/recorrencia-clientes', read, ctrl.getRecorrenciaClientes);
router.get('/stats/cohort', read, ctrl.getCohort);

export default router;
