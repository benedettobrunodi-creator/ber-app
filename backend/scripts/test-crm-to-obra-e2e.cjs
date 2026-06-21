/**
 * Teste E2E do fluxo CRM → Obra:
 *  1. Cria CrmEmpresa + CrmOportunidade (etapa: 'qualificacao')
 *  2. Chama createObra() com crmOportunidadeId
 *  3. Valida:
 *     - obra criada e vinculada via crmOportunidadeId
 *     - oportunidade movida pra etapa='ganho' com dataGanho preenchida
 *     - registro em crmOportunidadeHistorico
 *     - GET de oportunidade inclui `obra`
 *  4. Limpa tudo
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function log(ok, msg) {
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
  if (!ok) process.exitCode = 1;
}

(async () => {
  // pega um user qualquer pra ser createdBy da oportunidade
  const user = await prisma.user.findFirst({ where: { isActive: true } });
  if (!user) { console.log('❌ Nenhum usuário ativo no DB'); process.exit(1); }
  console.log(`→ usando user: ${user.name} (${user.id})`);

  const empresa = await prisma.crmEmpresa.create({
    data: { razaoSocial: '__TESTE_E2E_BER__', cidade: 'São Paulo' },
  });
  console.log(`→ empresa criada: ${empresa.id}`);

  const opp = await prisma.crmOportunidade.create({
    data: {
      titulo: '__TESTE_E2E_BER__ Conversão CRM→Obra',
      empresaId: empresa.id,
      valor: '1850000',
      etapa: 'qualificacao',
      createdById: user.id,
      dataEntradaPipeline: new Date(),
    },
  });
  console.log(`→ oportunidade criada: ${opp.id} (etapa: ${opp.etapa})`);

  // Importa o service real e chama createObra
  const { createObra } = require('./dist/modules/obras/service');
  let obra;
  try {
    obra = await createObra({
      name: '__TESTE_E2E_BER__ Obra Convertida',
      client: empresa.razaoSocial,
      status: 'planejamento',
      valorContrato: 1850000,
      crmOportunidadeId: opp.id,
    });
    console.log(`→ obra criada: ${obra.id}`);
  } catch (e) {
    console.log(`❌ createObra falhou: ${e.message}`);
    // limpa antes de sair
    await prisma.crmOportunidade.delete({ where: { id: opp.id } }).catch(() => {});
    await prisma.crmEmpresa.delete({ where: { id: empresa.id } }).catch(() => {});
    process.exit(1);
  }

  // --- VALIDAÇÕES ---
  log(obra.crmOportunidadeId === opp.id, `obra.crmOportunidadeId === ${opp.id}`);
  log(String(obra.valorContrato) === '1850000', `obra.valorContrato = 1850000 (atual: ${obra.valorContrato})`);

  const oppPostConvert = await prisma.crmOportunidade.findUnique({
    where: { id: opp.id },
    include: { obra: { select: { id: true, name: true } }, historico: { orderBy: { alteradoEm: 'desc' }, take: 5 } },
  });
  log(oppPostConvert.etapa === 'ganho', `oportunidade.etapa moveu pra "ganho" (atual: ${oppPostConvert.etapa})`);
  log(!!oppPostConvert.dataGanho, `oportunidade.dataGanho preenchido (${oppPostConvert.dataGanho?.toISOString().slice(0, 10)})`);
  log(oppPostConvert.obra?.id === obra.id, `relação reversa op.obra → obra.id`);

  const histEtapa = oppPostConvert.historico.find(h => h.campo === 'etapa' && h.valorNovo === 'ganho');
  log(!!histEtapa, 'crmOportunidadeHistorico tem entrada de etapa → ganho');
  log(histEtapa?.alteradoPor?.includes('conversão em obra'), `historico.alteradoPor menciona conversão (${histEtapa?.alteradoPor})`);

  // Teste idempotência: chamar de novo (com OUTRA op já em ganho) NÃO duplica histórico
  const opp2 = await prisma.crmOportunidade.create({
    data: {
      titulo: '__TESTE_E2E_BER__ Op já ganha',
      empresaId: empresa.id,
      etapa: 'ganho',
      dataGanho: new Date(),
      createdById: user.id,
    },
  });
  let obra2;
  try {
    obra2 = await createObra({
      name: '__TESTE_E2E_BER__ Obra de op já ganha',
      crmOportunidadeId: opp2.id,
      status: 'planejamento',
    });
  } catch (e) { log(false, `createObra com op já ganha falhou: ${e.message}`); }
  const opp2Post = await prisma.crmOportunidade.findUnique({
    where: { id: opp2.id },
    include: { historico: true },
  });
  const histEtapa2 = opp2Post.historico.find(h => h.campo === 'etapa');
  log(!histEtapa2, 'idempotência: op já em ganho não gerou novo histórico de etapa');

  // --- CLEANUP ---
  console.log('→ limpando dados de teste...');
  await prisma.checklist.deleteMany({ where: { obraId: { in: [obra.id, obra2?.id].filter(Boolean) } } });
  await prisma.obra.deleteMany({ where: { id: { in: [obra.id, obra2?.id].filter(Boolean) } } });
  await prisma.crmOportunidadeHistorico.deleteMany({ where: { oportunidadeId: { in: [opp.id, opp2.id] } } });
  await prisma.crmOportunidade.deleteMany({ where: { id: { in: [opp.id, opp2.id] } } });
  await prisma.crmEmpresa.delete({ where: { id: empresa.id } });
  console.log('→ cleanup OK');

  await prisma.$disconnect();
  console.log(process.exitCode ? '\n❌ TESTE FALHOU' : '\n✅ TODOS OS TESTES PASSARAM');
})().catch(async e => {
  console.error('💥 erro:', e);
  await prisma.$disconnect();
  process.exit(1);
});
