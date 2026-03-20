import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Buscar usuário Bruno
  const bruno = await prisma.user.findUnique({ where: { email: 'bruno@ber-engenharia.com.br' } });
  if (!bruno) throw new Error('Usuário Bruno não encontrado');

  // Buscar obra referência
  const obra = await prisma.obra.findFirst({ where: { name: 'Escritorio Corporativo Paulista' } });
  if (!obra) throw new Error('Obra "Escritorio Corporativo Paulista" não encontrada');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ─── 1. APRs modelo ──────────────────────────────────────────────────────

  const aprs = [
    {
      activityName: 'Trabalho em Altura (NR-35)',
      responsible: 'Bruno Di Benedetto',
      risks: [
        { description: 'Queda de pessoa', severity: 'critico', control: 'Cinto de segurança tipo paraquedista + linha de vida ancorada em ponto certificado' },
        { description: 'Queda de ferramenta', severity: 'alto', control: 'Amarração de ferramentas com cordoalha e sacola porta-ferramentas' },
        { description: 'Choque elétrico', severity: 'alto', control: 'Mapa de instalações elétricas + desligamento do circuito antes do início' },
        { description: 'Condições climáticas adversas', severity: 'medio', control: 'Suspender atividade em caso de chuva, vento forte ou raios' },
      ],
    },
    {
      activityName: 'Instalações Elétricas (NR-10)',
      responsible: 'Bruno Di Benedetto',
      risks: [
        { description: 'Choque elétrico', severity: 'critico', control: 'Desligar circuito no quadro + teste com multímetro antes de manusear' },
        { description: 'Arco elétrico', severity: 'alto', control: 'EPI específico para arco elétrico (vestimenta FR, luvas isolantes classe adequada)' },
        { description: 'Circuito energizado não sinalizado', severity: 'alto', control: 'Sinalização e bloqueio LOTO (Lock Out / Tag Out) obrigatório' },
        { description: 'Queda em trabalho em altura', severity: 'medio', control: 'NR-35 aplicável quando instalação acima de 2m — cinto + linha de vida' },
      ],
    },
    {
      activityName: 'Demolição',
      responsible: 'Bruno Di Benedetto',
      risks: [
        { description: 'Queda de estrutura', severity: 'critico', control: 'Verificar estabilidade estrutural antes de iniciar — nunca demolir de baixo para cima' },
        { description: 'Corte de instalação elétrica', severity: 'alto', control: 'Mapeamento obrigatório de todas as instalações com detector eletrônico' },
        { description: 'Inalação de poeira', severity: 'alto', control: 'Máscara PFF2 obrigatória + umidificação do entulho' },
        { description: 'Projeção de partículas', severity: 'medio', control: 'Óculos de proteção obrigatório para todos na área' },
      ],
    },
    {
      activityName: 'Movimentação de Cargas',
      responsible: 'Bruno Di Benedetto',
      risks: [
        { description: 'Queda de carga', severity: 'alto', control: 'Eslingamento correto + inspeção do equipamento antes do uso' },
        { description: 'Esmagamento de membros', severity: 'alto', control: 'Nunca posicionar-se sob carga suspensa — manter distância de segurança' },
        { description: 'Sobrecarga do equipamento', severity: 'medio', control: 'Verificar capacidade nominal do equipamento x peso da carga' },
        { description: 'Área de circulação não isolada', severity: 'medio', control: 'Isolar perímetro com fita zebrada e sinaleiro dedicado' },
      ],
    },
    {
      activityName: 'Uso de Ferramentas Elétricas',
      responsible: 'Bruno Di Benedetto',
      risks: [
        { description: 'Choque elétrico', severity: 'alto', control: 'Verificar aterramento e isolamento da ferramenta antes do uso' },
        { description: 'Corte/amputação', severity: 'alto', control: 'Protetor de disco obrigatório + luvas de proteção mecânica' },
        { description: 'Projeção de partículas', severity: 'medio', control: 'Óculos de proteção obrigatório — sem exceção' },
        { description: 'Cabo danificado', severity: 'medio', control: 'Inspeção visual do cabo e plugue antes de cada uso' },
      ],
    },
    {
      activityName: 'Trabalho em Espaço Confinado (NR-33)',
      responsible: 'Bruno Di Benedetto',
      risks: [
        { description: 'Atmosfera deficiente de oxigênio', severity: 'critico', control: 'Medição com detector de gases 4 em 1 antes e durante a permanência' },
        { description: 'Gases tóxicos', severity: 'critico', control: 'Detector de gases + ventilação forçada obrigatória antes do ingresso' },
        { description: 'Impossibilidade de resgate', severity: 'alto', control: 'Equipe de resgate posicionada e treinada no local durante toda a atividade' },
        { description: 'Queda', severity: 'alto', control: 'Cinto de segurança tipo paraquedista + linha de vida com tripé de resgate' },
      ],
    },
  ];

  let aprCount = 0;
  for (const apr of aprs) {
    await prisma.aPR.create({
      data: {
        obraId: obra.id,
        activityName: apr.activityName,
        date: today,
        responsible: apr.responsible,
        risks: apr.risks,
        status: 'aprovada',
        createdBy: bruno.id,
        approvedBy: bruno.id,
      },
    });
    aprCount++;
  }
  console.log(`✔ ${aprCount} APRs criadas`);

  // ─── 2. EPIs do Bruno ─────────────────────────────────────────────────────

  const epis = [
    { epiName: 'Capacete de segurança', epiType: 'protecao_cabeca', caNumber: 'CA-12345' },
    { epiName: 'Óculos de proteção incolor', epiType: 'protecao_visual', caNumber: 'CA-23456' },
    { epiName: 'Botina de segurança com biqueira de aço', epiType: 'protecao_pes', caNumber: 'CA-34567' },
    { epiName: 'Luva de raspa de couro', epiType: 'protecao_maos', caNumber: 'CA-45678' },
    { epiName: 'Protetor auricular tipo plug', epiType: 'protecao_auditiva', caNumber: 'CA-56789' },
    { epiName: 'Máscara PFF2', epiType: 'protecao_respiratoria', caNumber: 'CA-67890' },
    { epiName: 'Cinto de segurança tipo paraquedista', epiType: 'protecao_quedas', caNumber: 'CA-78901' },
    { epiName: 'Óculos de solda', epiType: 'protecao_visual', caNumber: 'CA-89012' },
  ];

  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  let epiCount = 0;
  for (const epi of epis) {
    await prisma.ePIControl.create({
      data: {
        obraId: obra.id,
        userId: bruno.id,
        epiName: epi.epiName,
        epiType: epi.epiType,
        deliveredAt: sixMonthsAgo,
        expiresAt: oneYearFromNow,
        quantity: 1,
        caNumber: epi.caNumber,
      },
    });
    epiCount++;
  }
  console.log(`✔ ${epiCount} EPIs registrados para Bruno`);

  // ─── 3. Treinamentos do Bruno ─────────────────────────────────────────────

  const oneYear = new Date(today);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  const twoYears = new Date(today);
  twoYears.setFullYear(twoYears.getFullYear() + 2);

  const trainings = [
    { trainingName: 'NR-18 Segurança na Construção Civil', nr: 'NR-18', provider: 'BER Engenharia', expiresAt: oneYear },
    { trainingName: 'NR-06 Equipamentos de Proteção Individual', nr: 'NR-06', provider: 'BER Engenharia', expiresAt: oneYear },
    { trainingName: 'NR-35 Trabalho em Altura', nr: 'NR-35', provider: 'SENAI', expiresAt: twoYears },
    { trainingName: 'NR-10 Segurança em Eletricidade', nr: 'NR-10', provider: 'SENAI', expiresAt: twoYears },
    { trainingName: 'NR-33 Espaço Confinado', nr: 'NR-33', provider: 'SENAI', expiresAt: oneYear },
  ];

  let trainingCount = 0;
  for (const t of trainings) {
    await prisma.training.create({
      data: {
        userId: bruno.id,
        trainingName: t.trainingName,
        nr: t.nr,
        provider: t.provider,
        completedAt: today,
        expiresAt: t.expiresAt,
      },
    });
    trainingCount++;
  }
  console.log(`✔ ${trainingCount} treinamentos registrados para Bruno`);

  console.log('\nSeed de segurança concluído!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
