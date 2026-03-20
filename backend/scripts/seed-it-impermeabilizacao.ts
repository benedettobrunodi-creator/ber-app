import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-01',
      title: 'Execução de Impermeabilização com Argamassa Polimérica',
      discipline: 'impermeabilizacao',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução de impermeabilização com argamassa polimérica (Viaplus 7000 - Viapol), garantindo estanqueidade e conformidade com a NBR 9574:2008.',
      materials: [
        'Viaplus 7000 (componente A - resina + componente B - pó cinza)',
        'Primer Viapol',
        'Viafix (emulsão adesiva para argamassa de regularização)',
        'Cimento Portland CP II',
        'Areia média lavada',
        'Tela de poliéster (quando especificado em projeto)',
        'Argamassa de reparo para ninhos e falhas',
        'Aditivo de pega rápida (para tamponamento de jorros)'
      ],
      tools: [
        'Trincha ou vassoura de pelo (aplicação do Primer e Viaplus)',
        'Rolo de lã de carneiro',
        'Furadeira com hélice misturadora',
        'Recipiente para mistura (balde)',
        'Espátula e desempenadeira',
        'Escovão de aço (limpeza do substrato)',
        'Régua de alumínio',
        'Nível',
        'Fita crepe (proteção de ralos e tubulações durante aplicação)'
      ],
      steps: [
        { order: 1, title: 'Inspeção e preparação do substrato', description: 'Verificar se o substrato está firme, coeso e homogêneo. Remover todo material solto, pó, gordura, desmoldantes, fungos e restos de obra com escovão de aço e água. Tratar ninhos e falhas de concretagem com argamassa de reparo. Em caso de jorro d\'água ativo, tamponar com cimento + aditivo de pega rápida antes de prosseguir. O substrato deve estar saturado mas sem película ou jorro de água.' },
        { order: 2, title: 'Verificação da declividade e arredondamento de cantos', description: 'Confirmar declividade mínima de 0,5% em áreas internas e 1% em áreas externas em direção aos ralos. Arredondar todos os cantos e arestas (meia-cana) com argamassa de regularização — ponto crítico: cantos vivos concentram tensões e causam fissuração. Traço: cimento e areia média 1:3 com Viafix diluído (1 vol. Viafix + 2 vol. água). Aguardar cura mínima de 7 dias antes de iniciar a impermeabilização.' },
        { order: 3, title: 'Aplicação do Primer Viapol', description: 'Homogeneizar o Primer Viapol antes do uso. Aplicar uma demão com trincha ou rolo de lã de carneiro de forma homogênea em toda a área, incluindo rodapé até a altura especificada em projeto (mínimo 30cm). Aguardar secagem mínima de 6 horas. O Primer garante a aderência do sistema ao substrato — não pular esta etapa.' },
        { order: 4, title: 'Preparo do Viaplus 7000', description: 'Adicionar aos poucos o componente B (pó cinza) ao componente A (resina) e misturar mecanicamente por 3 minutos com furadeira e hélice misturadora até obter pasta homogênea sem grumos. Tempo de utilização máximo: 40 minutos a 25°C. Preparar apenas a quantidade a ser usada neste período. Nunca adicionar água à mistura.' },
        { order: 5, title: '1ª demão — piso', description: 'Aplicar a primeira demão com trincha ou vassoura de pelo em sentido único (ex: horizontal) sobre toda a área do piso. Garantir cobertura uniforme sem falhas. Atenção especial nos ralos: aplicar contornando completamente a gola do ralo, sem cobrir a abertura — usar fita crepe para proteger a abertura durante a aplicação.' },
        { order: 6, title: 'Aplicação da tela de poliéster', description: 'Posicionar a tela após a primeira demão ainda fresca nos pontos críticos obrigatórios: emendas entre piso e parede (rodapé), cantos internos e externos, regiões de dobras e curvas, e perímetro dos ralos. A tela deve ser totalmente recoberta pelas demãos subsequentes. Sobreposição mínima entre telas: 10cm.' },
        { order: 7, title: '2ª demão — sentido cruzado', description: 'Aguardar 2 a 6 horas após a 1ª demão. Se estiver seca ao toque, umedecer levemente antes de aplicar. Aplicar a 2ª demão em sentido perpendicular à primeira. Isso garante cobertura uniforme sem falhas de aplicação.' },
        { order: 8, title: 'Impermeabilização do rodapé — virada piso-parede', description: 'Ponto crítico mais frequente de falha. Aplicar o Viaplus na virada do piso para a parede de forma contínua, sem interrupção, garantindo cobertura mínima de 30cm na parede e retorno completo ao piso. Tela de poliéster obrigatória nesta região. Não ultrapassar 3 horas entre aplicação do piso e do rodapé para evitar delaminação.' },
        { order: 9, title: '3ª demão (quando especificado)', description: 'Em reservatórios, áreas de alta umidade ou onde o projeto especificar, aplicar 3ª demão seguindo o mesmo procedimento. Aguardar intervalo de 2 a 6 horas após a 2ª demão.' },
        { order: 10, title: 'Cura e hidratação', description: 'Após a última demão, hidratar por no mínimo 72 horas em áreas expostas ao sol — borrifar água 3x ao dia. Não expor a impermeabilização ao tráfego ou carga antes da cura completa.' },
        { order: 11, title: 'Teste de estanqueidade — prova d\'água', description: 'Após cura completa (mínimo 72h), vedar todos os ralos e realizar prova d\'água com lâmina de 5cm por 72 horas (3 dias). Inspecionar diariamente a área abaixo e adjacente. Critério de aprovação: ausência total de manchas de umidade, gotejamento ou infiltração. Em caso de falha, identificar o ponto, secar, lixar levemente e reaplicar localmente, repetindo o teste.' },
        { order: 12, title: 'Proteção mecânica', description: 'Antes de executar o revestimento final, aplicar chapisco cimento:areia 1:2, seguido de argamassa desempenada cimento:areia 1:3 com Viafix (1 vol. + 2 vol. água). Aguardar cura desta proteção antes de assentar o revestimento.' }
      ],
      attentionPoints: [
        'RALOS: aplicar Viaplus contornando completamente a gola — falha neste ponto é a causa número 1 de infiltração',
        'RODAPÉ E VIRADAS: a transição piso-parede deve ser contínua, com tela e sem interrupção — nunca aplicar piso e rodapé em dias diferentes sem tratamento da junta',
        'CANTOS E DOBRAS: arredondar TODOS os cantos antes de iniciar — canto vivo fissurar a impermeabilização',
        'TELA DE POLIÉSTER: sempre posicionar após a 1ª demão e garantir que está completamente coberta — tela exposta indica aplicação insuficiente',
        'TEMPO ENTRE DEMÃOS: não ultrapassar 3 horas entre demãos do Viaplus 7000 para evitar delaminação',
        'SUBSTRATO ÚMIDO: deve estar saturado mas sem jorro — substrato seco causa bolhas e descolamento',
        'TEMPERATURA: não aplicar abaixo de 5°C ou acima de 40°C, nem sob chuva ou sol forte',
        'PRIMER: nunca pular a etapa do Primer — sem imprimação a aderência é comprometida'
      ],
      approvalCriteria: [
        'Prova d\'água aprovada: lâmina de 5cm por 72 horas sem nenhuma mancha de umidade ou infiltração',
        'Cobertura uniforme sem falhas visíveis, bolhas ou delaminações',
        'Tela de poliéster completamente coberta em todos os pontos críticos',
        'Rodapé impermeabilizado até a altura mínima especificada em projeto (mínimo 30cm)',
        'Todos os ralos tratados e funcionando corretamente após o teste',
        'Registro fotográfico de cada etapa arquivado na obra'
      ]
    }
  });

  console.log('IT-01 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
