import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-10',
      title: 'Execução de Forros (Drywall, Modular Mineral, Acústico e Tabicado)',
      discipline: 'acabamento',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução dos principais tipos de forro utilizados em interiores corporativos e residenciais: drywall (gesso acartonado), modular mineral (placas 625x625mm), acústico (nuvens de lã PET ou Nexacoustic), tabicado e chapa Cleaneo, garantindo nivelamento, alinhamento e acesso para manutenção.',
      materials: [
        'DRYWALL: chapas de gesso ST 12,5mm (RF onde exigido), perfis canaleta e montante, pendurais, tirantes reguláveis, fita telada, massa para drywall',
        'MODULAR MINERAL: placas 625x625mm ou 625x1250mm (Armstrong, USG ou similar), perfis T24 ou T15 (visível ou semi-oculto), bordas kerfed ou tegular, pendurais e arames de aço',
        'ACÚSTICO NUVENS: painéis de lã PET (Autex, Sonex) ou Nexacoustic, cabos de aço e tensor de fixação, estrutura metálica de suporte quando necessário',
        'TABICADO: chapas de gesso ou MDF, montantes de aço, fita e massa para juntas',
        'CLEANEO: chapas Knauf Cleaneo (gesso perfurado com lã de vidro), perfis específicos Cleaneo, massa e fita para juntas',
        'GERAL: buchas e parafusos para fixação na laje, fio de prumo, linha de nível, selante acrílico para juntas perimetrais'
      ],
      tools: [
        'Nível a laser (imprescindível — nível de bolha não tem precisão suficiente)',
        'Régua de alumínio 3m (verificação de planicidade)',
        'Parafusadeira com controle de torque',
        'Furadeira e martelete (fixação na laje)',
        'Alicate puncionador (conexão guia-montante)',
        'Tesoura para perfis metálicos',
        'Estilete e espaçador (corte de chapas)',
        'Espátula e desempenadeira (massa drywall)',
        'Trena e esquadro',
        'Andaime ou cavalete (trabalho em altura)'
      ],
      steps: [
        { order: 1, title: 'Planejamento e verificação de infraestrutura', description: 'ANTES de iniciar qualquer forro: verificar se TODA a infraestrutura acima está concluída e testada — elétrica (cabeamento, caixas de passagem), dados, AR condicionado (tubulação, drenagem, unidades instaladas), hidráulica (tubulação testada). Forro fechado sobre infraestrutura não testada é garantia de problema futuro. Definir a cota do forro com o arquiteto/coordenador — considerar pé-direito mínimo (2,50m residencial, 2,70m corporativo) e espaço para infraestrutura acima (mínimo 30cm para AR).' },
        { order: 2, title: 'Nível de referência com laser', description: 'Projetar o nível do forro em todas as paredes do ambiente com nível a laser. Marcar com lápis ou giz. Verificar se o nível é viável em todo o perímetro — lajes irregulares podem forçar a reduzir a cota em algum ponto. Planejar rebaixos, sancas e volumes antes de iniciar a estrutura. Para forro modular: verificar se a cota permite a instalação das placas sem interferir com as unidades de AR cassete (clearance mínimo conforme manual do fabricante).' },
        { order: 3, title: 'FORRO DRYWALL — estrutura metálica', description: 'Fixar canaleta perimetral nas paredes no nível marcado com parafuso + bucha a cada 60cm. Fixar pendurais na laje a cada 1,20m (eixo x eixo) com tirante regulável — verificar carga admissível da laje. Instalar perfis portantes (de 60mm) nos pendurais, espaçamento 1,20m. Instalar perfis secundários (samambaia) perpendiculares aos portantes, espaçamento 40cm (para chapas 1,20m) ou 60cm (para chapas menores). Nivelar toda a estrutura com linha de nível e régua antes de fixar as chapas.' },
        { order: 4, title: 'FORRO DRYWALL — fixação das chapas', description: 'Chapa 12,5mm ST (área seca) ou RF (onde exigido — sobre cozinhas, shafts, saídas de emergência). Altura da chapa: perpendicular ao perfil secundário. Parafusos a cada 17cm, borda mínima 15mm da chapa. Juntas entre chapas: sempre sobre um perfil — nunca junta no ar. Juntas desencontradas entre fiadas. Deixar folga de 5mm na borda perimetral (coberta pela canaleta). Recortes para luminárias, sprinklers e dutos: fazer APÓS nivelar toda a estrutura, nunca antes.' },
        { order: 5, title: 'FORRO DRYWALL — tratamento de juntas e acabamento', description: 'Aplicar massa + fita telada em todas as juntas. Mínimo 3 demãos com lixamento entre demãos. Tratar cabeças dos parafusos (2 demãos). Canto perimetral: selante acrílico pintável entre o forro e a parede — nunca massa rígida (fissura com a movimentação). Selante também em todos os recortes. Após lixamento final, aspirar toda a superfície antes da pintura.' },
        { order: 6, title: 'FORRO MODULAR MINERAL — estrutura T24/T15', description: 'Fixar perfil de borda (L) nas paredes no nível marcado. Instalar perfis T primários (1,20m ou 1,25m de eixo a eixo) suspensos por arames de aço fixados na laje a cada 1,20m. Nivelar os T primários com linha tensor antes de instalar os T secundários. Instalar T secundários perpendiculares, encaixando nas aberturas dos T primários — espaçamento 62,5cm. Verificar o esquadro da grelha: erros de esquadro causam cortes desproporcionais nas bordas. Planejar a paginação para sobras iguais nos dois lados.' },
        { order: 7, title: 'FORRO MODULAR MINERAL — assentamento das placas', description: 'Assentar as placas apoiando os 4 cantos nos perfis T — nunca forçar. Placas com borda kerfed: encaixar no perfil oculto. Placas tegular: apoiar sobre a aba do perfil visível. Cortes de borda: marcar, cortar com estilete e régua (face para cima). Borda cortada: sempre voltada para a parede (coberta pelo perfil L). Placa cortada com menos de 1/3 da medida: reposicionar a paginação. Verificar alinhamento a cada fileira com linha de nível.' },
        { order: 8, title: 'FORRO ACÚSTICO — nuvens lã PET e Nexacoustic', description: 'Definir o layout das nuvens conforme projeto (posição, altura e inclinação). Fixar cabos de aço na laje com buchas metálicas M8 — verificar a resistência do ponto de fixação (carga mínima 5x o peso do painel). Instalar tensores reguláveis nos cabos para ajuste de altura. Posicionar os painéis na altura definida, verificando nível e alinhamento entre painéis. Espaçamento entre nuvens e paredes: mínimo 20cm (a reflexão nas bordas faz parte do sistema acústico). Painéis Nexacoustic: verificar o lado correto (face absorvente para baixo).' },
        { order: 9, title: 'FORRO TABICADO', description: 'Marcar o layout das tabicas no teto com laser — alinhamento é fundamental. Fixar guias na laje e nas paredes. Instalar montantes verticais (tabicas) nos espaçamentos definidos em projeto (geralmente 30, 40 ou 60cm). Fixar as chapas de fechamento nos montantes. Tratamento de juntas igual ao drywall. Para tabicado com efeito 3D: verificar o projeto de paginação antes de cortar qualquer peça.' },
        { order: 10, title: 'FORRO CLEANEO (gesso perfurado acústico)', description: 'Instalação similar ao drywall, mas com atenção especial: instalar a lã de vidro ANTES de fixar as chapas (a lã fica acima da chapa, entre ela e a laje — é o elemento absorvente). Chapas Cleaneo têm perfurações padronizadas — verificar a orientação antes de parafusar (setas no verso indicam o sentido). Juntas: tratamento discreto com massa específica Cleaneo nas bordas rebaixadas — o objetivo é minimizar a visibilidade das juntas.' },
        { order: 11, title: 'Acesso para manutenção — obrigatório', description: 'Todo forro fechado deve ter alçapões de inspeção em: pontos de manutenção de AR (filtros, bandejas), registros e válvulas hidráulicas, caixas de passagem elétrica e de dados, sensores de sprinkler e detectores de fumaça que precisem de teste. Tamanho mínimo do alçapão: 60x60cm. Posição: documentada no as built do forro. Para forro modular: as placas já são removíveis — indicar no projeto quais zonas têm acesso livre.' }
      ],
      attentionPoints: [
        'INFRAESTRUTURA PRIMEIRO: nunca fechar forro sobre infraestrutura não testada — regra absoluta da BER',
        'NÍVEL A LASER: obrigatório — forro desnivelado é inaceitável e impossível de corrigir sem demolir',
        'ACESSO PARA MANUTENÇÃO: alçapão em todos os pontos críticos — forro sem acesso gera custo de demolição futura',
        'FORRO MODULAR — PAGINAÇÃO: planejar sobras iguais nos dois lados antes de instalar a grelha',
        'CLEANEO — LÃ DE VIDRO: instalar antes das chapas — sem lã o sistema não tem desempenho acústico',
        'DRYWALL — CANTO PERIMETRAL: selante acrílico (não massa rígida) — massa fissura com movimentação',
        'NUVENS ACÚSTICAS — FIXAÇÃO: verificar resistência da laje no ponto de fixação — painel pesado solto causa acidente',
        'RECORTES: executar apenas após nivelar toda a estrutura — recorte em estrutura deformada fica errado'
      ],
      approvalCriteria: [
        'Nivelamento verificado com régua 3m: desvio máximo 3mm',
        'Paginação simétrica nas bordas (modular e tabicado)',
        'Alçapões de inspeção instalados em todos os pontos de manutenção',
        'Infraestrutura acima testada e aprovada antes do fechamento',
        'Juntas invisíveis após lixamento (drywall e Cleaneo)',
        'Nenhuma placa solta ou vibrando (modular)',
        'Recortes para luminárias e AR com acabamento limpo',
        'As built do forro com localização dos alçapões entregue'
      ]
    }
  });

  console.log('IT-10 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
