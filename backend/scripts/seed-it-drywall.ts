import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-02',
      title: 'Execução de Parede em Drywall (Steel Frame)',
      discipline: 'alvenaria',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução de paredes em drywall com perfis de aço galvanizado, conforme NBR 15758-1:2009, garantindo prumo, nível, reforços adequados e acabamento de qualidade.',
      materials: [
        'Guias de aço galvanizado 70mm (fixação no piso e teto)',
        'Montantes de aço galvanizado 70mm (estrutura vertical, espaçamento 400mm a 600mm)',
        'Chapas de gesso ST (Standard) — ambientes secos',
        'Chapas de gesso RU (Resistente à Umidade / verde) — banheiros, cozinhas, áreas molhadas',
        'Chapas de gesso RF (Resistente ao Fogo / rosa) — shafts, áreas técnicas e onde exigido em projeto',
        'Parafusos fosfatizados 3,5x25mm (fixação chapa-montante)',
        'Parafusos 3,5x13mm (fixação guia-montante)',
        'Fita de vedação acústica (banda acústica para guias)',
        'Fita telada de 50mm (tratamento de juntas)',
        'Massa para drywall (tratamento de juntas e acabamento)',
        'Cantoneira de PVC ou metálica (proteção de quinas externas)',
        'Lã de rocha ou lã de vidro (isolamento acústico e/ou térmico)',
        'Madeira de reforço tratada (em pontos de fixação de TVs, armários, equipamentos)',
        'Buchas e parafusos para fixação das guias no piso/teto',
        'Perfil montante duplo (entorno de portas e janelas)'
      ],
      tools: [
        'Nível a laser (indispensável — nunca usar apenas nível de bolha)',
        'Prumo de face',
        'Trena',
        'Parafusadeira com controle de torque',
        'Alicate puncionador (fixação guia-montante)',
        'Tesoura para perfis metálicos (corte de guias e montantes)',
        'Estilete largo e afiado (corte das chapas)',
        'Régua metálica de 1,20m (guia de corte)',
        'Serra copo ou tico-tico (recortes para tomadas e interruptores)',
        'Lixadeira ou lixa manual (acabamento das juntas)',
        'Espátula e desempenadeira (aplicação de massa)',
        'Espanador ou aspirador (limpeza antes do acabamento)'
      ],
      steps: [
        { order: 1, title: 'Locação e marcação', description: 'Com nível a laser, marcar no piso a posição exata das guias conforme planta. Projetar a linha no teto e paredes laterais. Verificar prumo e esquadro — erro na locação compromete toda a parede. Marcar também as posições das portas, janelas e aberturas.' },
        { order: 2, title: 'Fixação das guias inferiores', description: 'Colar a fita de vedação acústica (banda acústica) na face inferior da guia antes de fixar — esta fita evita transmissão de vibração e ruído entre a parede de drywall e o piso/teto. Fixar a guia no piso com parafuso + bucha a cada 600mm, no máximo. Em piso cerâmico ou porcelanato existente, usar bucha específica. Verificar alinhamento com o traçado a laser.' },
        { order: 3, title: 'Fixação das guias superiores', description: 'Aplicar fita de vedação acústica na face superior da guia. Fixar no teto alinhada exatamente com a guia inferior (usar o laser). Fixação a cada 600mm. Em lajes de concreto, usar parafuso cebola ou bucha de nylon 6mm.' },
        { order: 4, title: 'Instalação dos montantes', description: 'Cortar os montantes com 5mm menos que o pé-direito (folga obrigatória para acomodar movimentação estrutural — montante que toca a laje causa trinca). Encaixar os montantes nas guias a cada 400mm para ambientes comuns ou onde houver revestimento cerâmico, e a cada 600mm para paredes simples sem revestimento pesado. Fixar com alicate puncionador (2 pontos por encaixe — superior e inferior). Verificar prumo de cada montante.' },
        { order: 5, title: 'Reforços estruturais — ETAPA CRÍTICA', description: 'ANTES de fechar qualquer lado da parede, instalar todos os reforços previstos em projeto e os padrão BER: TVs até 55": montante duplo + chapa de madeira tratada 20mm preenchendo o espaço entre montantes na altura do suporte. TVs acima de 55": estrutura metálica adicional. Armários aéreos e prateleiras: madeira tratada horizontal entre montantes na altura dos suportes. Vasos sanitários suspensos: estrutura metálica reforçada específica. Corrimãos e barras de apoio: montante duplo + madeira. Documentar com foto todos os reforços antes de fechar.' },
        { order: 6, title: 'Passagem de instalações', description: 'Passar toda a fiação elétrica, tubulações de dados e outros dutos pelo interior da parede antes de fechar o segundo lado. Organizar os cabos com espaguete ou presilhas. Marcar na guia a posição de cada ponto elétrico para referência no fechamento. Verificar com o responsável pelo elétrico se todas as caixas estão posicionadas.' },
        { order: 7, title: 'Lã de rocha ou lã de vidro (quando especificado)', description: 'Inserir a lã de rocha ou lã de vidro entre os montantes antes do fechamento do segundo lado. A lã não deve ficar comprimida — deve preencher o espaço sem pressionar as chapas. Espessura conforme projeto acústico. Em banheiros entre unidades, a lã é obrigatória.' },
        { order: 8, title: 'Fixação das chapas — primeiro lado', description: 'Selecionar a chapa correta para o ambiente: ST em áreas secas, RU em áreas úmidas, RF onde exigido. A chapa deve ter altura 10mm menor que o pé-direito — apoiar com cunha/calço na parte inferior, deixando a folga em baixo (não em cima). Iniciar o parafusamento de cima para baixo. Distância dos parafusos: 15cm nas bordas laterais, 30cm no miolo. Distância mínima da borda da chapa: 10mm. Cabeça do parafuso: 1mm abaixo da superfície (afundada, sem rasgar o papel). Juntas verticais entre chapas devem coincidir com o centro de um montante.' },
        { order: 9, title: 'Fixação das chapas — segundo lado', description: 'Verificar se todas as instalações e reforços estão concluídos e documentados por foto. Fechar o segundo lado com o mesmo procedimento. As juntas do segundo lado devem ser desencontradas das juntas do primeiro lado (defasagem mínima de 600mm) — isso aumenta a rigidez e o isolamento acústico da parede.' },
        { order: 10, title: 'Tratamento de juntas — primeira demão', description: 'Aplicar massa para drywall sobre todas as juntas com espátula, cobrindo completamente o rebaixo entre chapas. Antes de secar, pressionar a fita telada de 50mm sobre a massa ao longo de toda a junta. Passar a espátula para embeber a fita e remover o excesso de massa. Aguardar secagem completa (mínimo 24h).' },
        { order: 11, title: 'Tratamento de juntas — segunda e terceira demão', description: 'Após secagem, aplicar segunda demão de massa cobrindo a fita e alargando levemente a área (15cm de largura). Lixar levemente entre demãos. Aplicar terceira demão mais fina para nivelar completamente. O objetivo é que a junta fique imperceptível após pintura. Tratar também as cabeças dos parafusos (2 demãos de massa). Instalar cantoneira metálica nas quinas externas antes das demãos finais.' },
        { order: 12, title: 'Verificação final e lixamento', description: 'Após cura completa de todas as demãos (mínimo 48h), lixar toda a parede com lixa 120, removendo imperfeições. Passar a mão para sentir irregularidades que o olho não enxerga. Aspirar o pó antes da pintura. Verificar prumo e planicidade com régua de 2m — desvio máximo aceitável: 3mm.' }
      ],
      attentionPoints: [
        'FOLGA DO MONTANTE: sempre 5mm menor que o pé-direito — montante tocando a laje causa trinca na junta superior, problema muito comum na BER',
        'REFORÇOS ANTES DE FECHAR: nunca fechar o segundo lado sem documentar e fotografar todos os reforços — impossível corrigir depois sem demolir',
        'BANDA ACÚSTICA: obrigatória em todas as guias — sem ela a parede transmite impacto e vibração entre ambientes',
        'JUNTAS DESENCONTRADAS: o segundo lado deve ter juntas defasadas do primeiro — paredes com juntas alinhadas nos dois lados são estruturalmente frágeis',
        'CHAPA CORRETA POR AMBIENTE: nunca usar ST em banheiro ou área de serviço — a umidade destrói a chapa em poucos meses',
        'CABEÇA DO PARAFUSO: 1mm afundada — parafuso para fora cria saliência visível; parafuso fundo demais rasga o papel e perde resistência',
        'NÍVEL A LASER: obrigatório na locação — nível de bolha não tem precisão suficiente para paredes longas',
        'PORTA E JANELA: montante duplo obrigatório nas laterais — montante simples em vão de porta afunda com o tempo'
      ],
      approvalCriteria: [
        'Prumo verificado com nível a laser — desvio máximo 3mm em 2m',
        'Planicidade verificada com régua de 2m — desvio máximo 3mm',
        'Todas as juntas tratadas e invisíveis após lixamento',
        'Reforços documentados com foto antes do fechamento do segundo lado',
        'Chapa correta instalada em cada ambiente (ST/RU/RF)',
        'Folga inferior de 10mm e superior de 5mm confirmadas',
        'Banda acústica instalada em todas as guias',
        'Nenhuma trinca visível nas juntas ou entorno de portas'
      ]
    }
  });

  console.log('IT-02 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
