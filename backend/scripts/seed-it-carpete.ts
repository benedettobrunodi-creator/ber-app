import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-05',
      title: 'Instalação de Carpete em Placas',
      discipline: 'revestimento',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para instalação de carpete em placas (50x50cm) em ambientes corporativos, sobre piso elevado ou contrapiso, com adesivo TAC permanente ou sistema click, garantindo alinhamento, padrão estético e facilidade de manutenção futura.',
      materials: [
        'Carpete em placas 50x50cm (Interface, Shaw, Belgotex ou equivalente) — verificar lote, cor e direção do pelo',
        'Adesivo TAC permanente à base de água (Mapei Ecobond 810 ou equivalente) — para piso elevado e contrapiso',
        'Rolo de espuma para aplicação do adesivo (rolo de pelo curto)',
        'Fita de borda (acabamento em soleiras e transições)',
        'Perfil de transição em alumínio (encontro com outros revestimentos)',
        'Rodapé de carpete ou rodapé emborrachado (acabamento perimetral)'
      ],
      tools: [
        'Nível a laser (definição dos eixos de paginação)',
        'Trena e esquadro metálico 90°',
        'Giz de linha (marcação dos eixos no piso)',
        'Estilete com lâmina nova (corte das placas)',
        'Régua metálica de corte (mínimo 1m)',
        'Tapete de corte (proteção da base durante cortes)',
        'Rolo de pressão ou rolo de borracha (assentamento)',
        'Ventosa de borracha (remoção de placas em piso elevado)',
        'Martelo de borracha (ajuste fino de posição)',
        'Vassoura e aspirador (limpeza da base antes da cola)'
      ],
      steps: [
        { order: 1, title: 'Aclimatação do material', description: 'Obrigatório: desembalar as placas e deixar no ambiente por no mínimo 24 horas antes da instalação (48 horas para placas com base Ecobase ou similar). Temperatura mínima do ambiente: 18°C. Umidade relativa: máximo 65%. Isso evita que as placas se contraiam ou expandam após a instalação, causando juntas aparentes ou empenamento. Armazenar as caixas horizontalmente, nunca em pé.' },
        { order: 2, title: 'Verificação e preparação da base', description: 'PISO ELEVADO: verificar se todas as placas estão travadas e niveladas — desvio máximo 2mm entre placas adjacentes. Placa que se move ao pisar deve ser corrigida antes. Limpar toda a superfície com aspirador — poeira impede a aderência do TAC. CONTRAPISO: verificar planicidade com régua 2m — desvio máximo 2mm. Umidade máxima: 3% (medir com medidor de umidade). Base muito lisa: lixar levemente. Remover toda gordura, tinta solta e materiais pulverulentos.' },
        { order: 3, title: 'Definição do padrão e paginação', description: 'Definir o padrão de instalação conforme especificação do projeto: MONOLÍTICO: todas as setas direcionais apontando na mesma direção — aspecto uniforme, mais formal. QUARTER TURN (xadrez): placas giradas 90° alternadamente — esconde variações de tonalidade entre lotes, padrão mais usado pela BER em corporativo. TIJOLINHO (brick): placas defasadas em 50% — efeito tijolo. NUNCA misturar padrões no mesmo ambiente. Com nível a laser, traçar os eixos principais do ambiente (perpendiculares entre si). Fazer simulação a seco para verificar sobras nas bordas — sobra mínima: 1/3 da placa (16,5cm). Ajustar o ponto de partida se necessário.' },
        { order: 4, title: 'Aplicação do adesivo TAC', description: 'Aplicar o adesivo TAC com rolo de espuma em uma seção do piso de cada vez (máximo 20m² por vez para não secar antes de assentar). Rendimento: 300-400g/m². Cobrir toda a superfície uniformemente sem acumular. Aguardar o tempo de tack: o adesivo deve estar seco ao toque mas ainda pegajoso — teste com o dedo: não deve transferir adesivo para o dedo mas deve oferecer resistência ao toque. Tempo médio: 15-30 minutos dependendo da temperatura e umidade. ATENÇÃO: adesivo muito molhado causa escorregamento das placas; adesivo muito seco perde a aderência.' },
        { order: 5, title: 'Assentamento — início pelo centro', description: 'Iniciar sempre pelo centro do ambiente no cruzamento dos dois eixos principais. Nunca iniciar de uma parede — isso gera sobras desproporcionais no lado oposto. Posicionar a primeira placa exatamente no cruzamento dos eixos. Pressionar firmemente com a mão e rolar com rolo de pressão. Verificar alinhamento com a linha de giz. Avançar em quadrantes a partir do centro, verificando alinhamento a cada 4-5 placas.' },
        { order: 6, title: 'Respeitar a direção das setas', description: 'CRÍTICO: cada placa tem uma seta indicando a direção do pelo impressa no verso. No padrão monolítico: todas as setas na mesma direção. No quarter turn: setas alternadas 0°/90°. Antes de assentar cada placa, verificar a seta. Uma placa virada errada no meio do ambiente é visível e impossível de corrigir sem levantar toda a área ao redor. Em caso de dúvida sobre a direção, sobrepor a placa à já assentada e verificar se o padrão combina.' },
        { order: 7, title: 'Cortes de borda', description: 'Medir cada corte individualmente — nunca assumir que as bordas são retas ou paralelas. Marcar no verso da placa com caneta. Cortar com estilete afiado e régua metálica em uma única passagem firme — cortes em múltiplas passagens ficam irregulares. Para recortes complexos (entorno de colunas, batentes): fazer gabarito em papelão primeiro. Em piso elevado: toda placa cortada deve ter apoio de pedestal em todas as bordas — placa sem apoio afunda com o tráfego.' },
        { order: 8, title: 'Acabamentos e transições', description: 'Instalar perfil de transição em alumínio no encontro com outros revestimentos (cerâmica, madeira, vinílico). O perfil protege a borda do carpete e cria uma transição limpa. Instalar rodapé perimetral cobrindo a folga entre o carpete e a parede (folga padrão: 5mm). Em soleiras de porta: usar fita de borda ou perfil de alumínio reto. Não deixar bordas livres expostas ao tráfego — desfiam rapidamente.' },
        { order: 9, title: 'Limpeza final e liberação', description: 'Aspirar toda a área instalada para remover resíduos de fibra e poeira do corte. Verificar visualmente todas as juntas — juntas abertas ou desalinhadas devem ser corrigidas imediatamente (TAC ainda ativo por 24-48h). Verificar se alguma placa está com a seta na direção errada. O carpete pode ser liberado para tráfego leve imediatamente após a instalação com TAC. Tráfego pesado (mobiliário): aguardar 24h.' }
      ],
      attentionPoints: [
        'ACLIMATAÇÃO: obrigatória 24h — carpete instalado sem aclimatação contrai e abre juntas',
        'SETAS DIRECIONAIS: verificar cada placa antes de assentar — erro de direção no meio da área é inaceitável',
        'PONTO DE PARTIDA: sempre pelo centro, nunca da parede — sobras desproporcionais são erro de execução',
        'TEMPO DE TACK: não assentar com adesivo molhado (placa escorrega) nem seco demais (não adere) — o ponto certo é quando não transfere para o dedo',
        'SUPORTE EM PISO ELEVADO: toda placa cortada precisa de pedestal em todas as bordas — borda sem apoio afunda',
        'UMIDADE DA BASE: máximo 3% para contrapiso — carpete sobre base úmida desenvolve mofo e descola',
        'CORTES: estilete sempre com lâmina nova — lâmina cega rasga a fibra em vez de cortar limpo',
        'CARPETE SOLTANDO (problema BER): causas principais — base não aspirada antes do TAC, tempo de tack incorreto, ou umidade na base'
      ],
      approvalCriteria: [
        'Padrão de instalação (quarter turn/monolítico) uniforme em todo o ambiente',
        'Juntas alinhadas — desvio máximo 1mm',
        'Nenhuma placa com direção errada (verificar a seta)',
        'Sobras de borda proporcionais — mínimo 1/3 da placa (16,5cm)',
        'Todas as placas cortadas com apoio de pedestal em piso elevado',
        'Perfis de transição e rodapés instalados',
        'Nenhuma junta aparente ou placa levantando'
      ]
    }
  });

  console.log('IT-05 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
