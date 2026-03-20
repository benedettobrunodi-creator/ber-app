import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-04',
      title: 'Execução de Contrapiso e Regularização de Base',
      discipline: 'revestimento',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução de contrapiso e regularização de base, garantindo nivelamento, planicidade e resistência adequados para recebimento de revestimentos cerâmicos, vinílicos, carpete e pisos de madeira, conforme NBR 13753.',
      materials: [
        'Cimento Portland CP II-F ou CP II-Z',
        'Areia média lavada (granulometria máxima 2mm)',
        'Cal hidratada CH-III (traço com cal)',
        'Água limpa para amassamento',
        'Tela de aço soldada malha 10x10cm fio 1,7mm (em áreas acima de 20m² ou sobre aterro)',
        'Espaçadores de tela (mínimo 1cm do substrato)',
        'Isopor 20mm ou manta acústica (contrapiso flutuante para piso de madeira/vinílico)',
        'Primer de aderência (bases lisas ou muito absorventes)',
        'Argamassa autonivelante (opção para regularização fina — desvios até 30mm)'
      ],
      tools: [
        'Nível a laser (referência obrigatória)',
        'Régua de alumínio 2m e 3m',
        'Taliscas de cerâmica ou plástico (referência de nível)',
        'Betoneira ou argamassadeira',
        'Carrinho de mão',
        'Enxada e pá',
        'Soquete de compactação',
        'Desempenadeira de madeira (sarrafeamento)',
        'Desempenadeira metálica (desempeno liso para piso vinílico/madeira)',
        'Vassoura de pelo duro (ponte de aderência)',
        'Régua metálica para mestras',
        'Espaçador de nível (laser ou mangueira de nível)'
      ],
      steps: [
        { order: 1, title: 'Verificação das cotas e planejamento', description: 'Antes de qualquer execução, verificar no projeto arquitetônico a cota final do piso acabado em cada ambiente. Calcular a espessura do contrapiso considerando: cota final menos espessura do revestimento (cerâmica: ~12mm com argamassa; vinílico: ~5mm; madeira: ~15-20mm). Espessura mínima do contrapiso: 3cm. Espessura máxima recomendada em camada única: 5cm. Para desníveis acima de 5cm, executar em duas camadas com intervalo de 7 dias. Identificar caimentos necessários: banheiros e cozinhas mínimo 0,5% em direção aos ralos; demais ambientes: piso plano.' },
        { order: 2, title: 'Preparação da base', description: 'Verificar se a laje tem no mínimo 28 dias de cura (concreto) ou 14 dias (argamassa). Remover toda sujeira, poeira, óleos, desmoldantes e material solto. Bases muito lisas (concreto aparente): picotar ou escarificar. Verificar se há trincas na laje — trincas ativas devem ser tratadas antes. Verificar umidade ascendente — se houver, impermeabilizar antes do contrapiso. Em pavimento térreo sobre solo: verificar compactação e executar lastro de concreto magro (traço 1:4:8) com mínimo 5cm antes do contrapiso.' },
        { order: 3, title: 'Instalação da tela de aço (quando aplicável)', description: 'Usar tela de aço soldada malha 10x10cm fio 1,7mm nos seguintes casos: áreas acima de 20m², ambientes com tráfego intenso, sobre aterro compactado, e sempre que especificado em projeto. Posicionar a tela com espaçadores de pelo menos 1cm do substrato (tela deve ficar no meio da espessura do contrapiso, não no fundo). Sobreposição entre telas: mínimo 20cm. A tela NÃO é necessária em contrapisos sobre laje em ambientes residenciais normais com área menor que 20m².' },
        { order: 4, title: 'Contrapiso flutuante (para piso vinílico, carpete e madeira)', description: 'Para ambientes que receberão piso vinílico em placas, carpete em placas ou piso de madeira: executar contrapiso flutuante com manta acústica ou isopor de 20mm sobre a laje (sem colar — apenas apoiado). A manta ou isopor cria dessolidarização entre o contrapiso e a laje, melhorando o isolamento acústico de impacto. Vira as bordas da manta nas paredes em pelo menos 5cm. O contrapiso flutuante exige acabamento desempenado liso (não sarrafeado).' },
        { order: 5, title: 'Instalação das taliscas de nível', description: 'Marcar o nível do contrapiso nas paredes com nível a laser. Assentar taliscas com a própria argamassa nos cantos do ambiente e a cada 1,5m no máximo. Verificar todas as taliscas com régua e nível — uma talisca errada compromete toda a área. Em áreas com caimento (banheiros), as taliscas devem já refletir o caimento especificado em direção ao ralo.' },
        { order: 6, title: 'Execução da ponte de aderência', description: 'Umedecer a base sem deixar poças de água. Preparar argamassa plástica traço 1:1 (cimento:areia) e espalhar energicamente com vassoura de pelo duro sobre toda a superfície. Lançar o contrapiso imediatamente sobre a ponte de aderência ainda fresca — nunca deixar a ponte secar antes de lançar o contrapiso.' },
        { order: 7, title: 'Preparo e lançamento da argamassa', description: 'Traço padrão BER para contrapiso: 1:4 (cimento:areia média) em volume — resistência superior ao traço NBR 1:0,25:6. Misturar em betoneira até pasta homogênea. Consistência: firme, que não escorre mas cede à pressão da mão. Lançar entre as mestras em excesso e compactar com soquete. Sarrafear com régua de alumínio apoiada sobre as mestras em movimento de vaivém até nivelar.' },
        { order: 8, title: 'Acabamento superficial por tipo de revestimento', description: 'CERÂMICA/PORCELANATO: acabamento sarrafeado (rugoso) — melhor aderência da AC-III. VINÍLICO EM PLACAS: acabamento desempenado liso com desempenadeira metálica — planeza máxima, desvio máximo 2mm em 2m. CARPETE EM PLACAS: idem vinílico — desempenado liso. PISO DE MADEIRA (tacos/tábuas): desempenado liso. PISO ELEVADO CORPORATIVO: caimento zero, tolerância ±1mm/m.' },
        { order: 9, title: 'Juntas de retração', description: 'Obrigatórias em áreas acima de 20m² ou quando qualquer dimensão superar 4m. Executar com espátula ou régua imediatamente após o sarrafeamento, antes da pega. Profundidade mínima: 1/3 da espessura. As juntas de retração do contrapiso devem coincidir com as juntas de movimentação do revestimento final.' },
        { order: 10, title: 'Cura úmida', description: 'Cura mínima de 7 dias. Manter o contrapiso úmido borrifando água 2x ao dia (manhã e tarde). Proteger contra sol direto, vento forte e chuva nas primeiras 24h. Não permitir tráfego por 24h. Tráfego leve (a pé): após 3 dias. Início do revestimento cerâmico: mínimo 14 dias. Piso vinílico/madeira: mínimo 28 dias (verificar umidade residual com medidor — máximo 3% de umidade).' },
        { order: 11, title: 'Verificação de qualidade antes do revestimento', description: 'Verificar planicidade com régua de 2m — desvio máximo: 3mm para cerâmica; 2mm para vinílico/madeira. Testar aderência: bater com objeto — som cavo indica descolamento — refazer área afetada. Medir umidade residual com medidor (obrigatório para vinílico e madeira — máximo 3%). Verificar caimentos com nível — água deve escoar para o ralo sem empoçar.' }
      ],
      attentionPoints: [
        'ESPESSURA: mínimo 3cm — contrapiso fino racha e solta; máximo 5cm por camada — acima disso dividir em duas camadas',
        'TELA DE AÇO: posicionar no meio da espessura com espaçadores — tela no fundo não trabalha e não protege',
        'CONTRAPISO FLUTUANTE: obrigatório para vinílico e madeira — sem flutuante o ruído de impacto é inaceitável em corporativo',
        'ACABAMENTO POR TIPO: sarrafeado para cerâmica; liso para vinílico/madeira — trocar o acabamento compromete o revestimento final',
        'CURA: mínimo 14 dias para cerâmica; 28 dias para vinílico/madeira — revestimento sobre contrapiso verde fissura',
        'UMIDADE RESIDUAL: medir antes de instalar vinílico ou madeira — umidade acima de 3% causa bolhas e descolamento',
        'CAIMENTO: banheiros e áreas molhadas devem ter caimento correto — contrapiso plano em área molhada causa empoçamento',
        'PONTE DE ADERÊNCIA: nunca pular — contrapiso sem ponte descola da laje com o tempo'
      ],
      approvalCriteria: [
        'Planicidade verificada com régua 2m: desvio máximo 3mm (cerâmica) ou 2mm (vinílico/madeira)',
        'Teste de percussão sem som cavo em toda a área',
        'Caimentos verificados — água escoa corretamente para os ralos',
        'Umidade residual medida: máximo 3% para vinílico e madeira',
        'Cura mínima respeitada antes de iniciar o revestimento',
        'Juntas de retração executadas em áreas acima de 20m²',
        'Espessura mínima de 3cm confirmada'
      ]
    }
  });

  console.log('IT-04 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
