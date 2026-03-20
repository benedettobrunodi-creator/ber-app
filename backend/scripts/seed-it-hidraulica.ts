import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-08',
      title: 'Execução de Instalações Hidráulicas Prediais',
      discipline: 'hidraulica',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução de instalações hidráulicas de água fria e quente em interiores corporativos e residenciais, com PVC, CPVC e PPR conforme aplicação, garantindo estanqueidade e conformidade com a NBR 5626 e NBR 7198.',
      materials: [
        'Tubos e conexões PVC soldável (água fria em corporativo e áreas secas)',
        'Tubos e conexões CPVC (água quente em corporativo — resistente até 93°C)',
        'Tubos e conexões PPR (água fria e quente em residencial — solda por termofusão)',
        'Tubos e conexões de cobre (retrofit em apartamentos existentes)',
        'Solda PVC (adesivo + primer — nunca usar sem primer)',
        'Máquina de termofusão PPR com ponteiras correspondentes',
        'Maçarico e solda de prata ou estanho (cobre)',
        'Registros de gaveta e esfera (gaveta para colunas, esfera para ramais)',
        'Fita veda-rosca PTFE (conexões roscadas — mínimo 3 voltas)',
        'Abraçadeiras plásticas e metálicas (fixação de tubulação)',
        'Lã de vidro ou espuma elastomérica (isolamento térmico em água quente)',
        'Teste hidrostático: manômetro e bomba de pressão'
      ],
      tools: [
        'Cortador de tubo (PVC, CPVC, PPR, cobre)',
        'Escariador (remoção de rebarbas internas após corte)',
        'Furadeira e martelete (passagem de tubulação)',
        'Serra copo (furos para passagem em lajes e paredes)',
        'Nível a laser e nível de bolha',
        'Manômetro (teste de pressão)',
        'Bomba de teste hidrostático',
        'Máquina de termofusão PPR',
        'Maçarico (cobre)',
        'Chaves de grifo e ajustável',
        'Trena e prumo'
      ],
      steps: [
        { order: 1, title: 'Análise do projeto hidráulico', description: 'NUNCA iniciar sem projeto aprovado. Verificar: traçado de toda a tubulação, posição de registros de corte, diâmetros por trecho, pontos de consumo e cotas de instalação. Em reforma: localizar a tubulação existente antes de quebrar paredes — use detector de tubulação ou mapa hidráulico. Identificar o ponto de alimentação e a pressão disponível. Pressão mínima nos pontos: 10 kPa (1 mca). Pressão máxima: 400 kPa (40 mca) — acima disso instalar redutor de pressão.' },
        { order: 2, title: 'Seleção do material por aplicação', description: 'CORPORATIVO — ÁGUA FRIA: PVC soldável (econômico, fácil instalação, durável). CORPORATIVO — ÁGUA QUENTE: CPVC (suporta até 93°C, solda com adesivo específico CPVC — nunca usar adesivo PVC comum no CPVC). RESIDENCIAL — ÁGUA FRIA E QUENTE: PPR por termofusão (mais durável, sem solventes, juntas mais resistentes — preferência da BER em residencial novo). RETROFIT APARTAMENTO: cobre (compatível com instalação existente, mais fácil de adaptar em espaços restritos). Nunca misturar materiais incompatíveis sem adaptadores adequados.' },
        { order: 3, title: 'Passagem da tubulação', description: 'Rasgos em alvenaria: largura mínima 2cm acima do diâmetro do tubo. Nunca rasgar horizontalmente em paredes estruturais. Furos em lajes: usar serra copo do tamanho correto — furo rasgado enfraquece a laje. Tubulação embutida em drywall: fixar com abraçadeiras nos montantes antes de fechar. Deixar folga de 1cm entre tubo e parede do rasgo — o tubo precisa de espaço para dilatar. Tubulação de água quente: isolamento térmico obrigatório em trechos expostos (lã de vidro ou espuma elastomérica 13mm).' },
        { order: 4, title: 'Corte e preparo dos tubos', description: 'Usar sempre cortador de tubo — nunca serra manual (deixa rebarbas que causam turbulência e entupimento). Após o corte, escariar OBRIGATORIAMENTE o interior do tubo para remover rebarbas. Rebarbas internas reduzem a vazão e acumulam impurezas. Limpar a superfície a ser colada com pano seco — qualquer umidade ou gordura impede a aderência da solda PVC.' },
        { order: 5, title: 'Solda PVC e CPVC', description: 'SEQUÊNCIA OBRIGATÓRIA: 1) Aplicar primer em ambas as superfícies (tubo e conexão) — aguardar 10 segundos. 2) Aplicar adesivo em ambas as superfícies com pincel. 3) Encaixar girando 1/4 de volta para distribuir o adesivo. 4) Segurar por 30 segundos sem soltar. 5) Remover excesso de adesivo. Tempo de cura antes de pressurizar: 30 minutos a 23°C (mais tempo em temperaturas baixas). NUNCA pular o primer — é a causa número 1 de vazamento em PVC. Para CPVC: usar adesivo específico CPVC, nunca PVC comum.' },
        { order: 6, title: 'Termofusão PPR', description: 'Aquecer a máquina de termofusão até 260°C (aguardar o indicador de temperatura). Inserir simultaneamente o tubo e a conexão nas ponteiras correspondentes pelo tempo indicado (varia por diâmetro: 20mm=5s, 25mm=7s, 32mm=8s). Retirar e encaixar imediatamente em linha reta — sem girar. Segurar firme por o dobro do tempo de aquecimento sem mover. Juntas de PPR são mais resistentes que o próprio tubo quando bem executadas — mas junta mal feita (temperatura errada ou movimento durante cura) vaza inevitavelmente.' },
        { order: 7, title: 'Conexões roscadas e registros', description: 'Fita veda-rosca PTFE: aplicar no sentido da rosca (horário visto de frente), mínimo 3 voltas, sem folgas. Apertar o registro com chave — nunca na mão. Apertar até firme mais 1/4 de volta — aperto excessivo racha a conexão. Posição dos registros: acessíveis para manutenção futura — nunca embutir registro sem caixa de inspeção. Todo banheiro, cozinha e área de serviço deve ter registro de corte individual acessível.' },
        { order: 8, title: 'Fixação da tubulação', description: 'Abraçadeiras a cada: 1,0m para tubos até 25mm; 1,5m para tubos de 32-50mm; 2,0m para tubos acima de 50mm. Nunca fixar tubo de água quente rígido sem folga para dilatação — usar abraçadeira solta que permite movimento axial. Tubulação vertical: abraçadeira a cada pavimento e a cada 2m em trechos longos. Manter afastamento mínimo de 5cm entre tubulação de água quente e cabos elétricos.' },
        { order: 9, title: 'Teste hidrostático — ETAPA CRÍTICA', description: 'OBRIGATÓRIO antes de fechar qualquer parede ou laje. Pressurizar o sistema a 1,5x a pressão de trabalho (mínimo 150 kPa) com bomba manual. Aguardar 4 horas com a pressão mantida. Verificar o manômetro: qualquer queda de pressão indica vazamento. Localizar o vazamento com spray revelador ou água com sabão nas conexões. Corrigir e repetir o teste. Somente após aprovação do teste hidrostático autorizar o fechamento das paredes. Fotografar o manômetro no início e fim do teste para documentação.' },
        { order: 10, title: 'Identificação e documentação', description: 'Identificar todos os registros com etiqueta: qual ambiente/ponto corta. Elaborar o "as built" da tubulação — foto ou croqui de cada parede antes de fechar, indicando a posição exata dos tubos. Este documento é essencial para futuras manutenções. Registros de corte gerais: identificar com plaquinha permanente. Entregar ao cliente: localização de todos os registros e o as built hidráulico.' }
      ],
      attentionPoints: [
        'PRIMER NO PVC: nunca pular — é a causa número 1 de vazamento; sem primer a solda não adere adequadamente',
        'CPVC vs PVC: adesivos incompatíveis — usar sempre adesivo específico para cada material',
        'TESTE HIDROSTÁTICO: obrigatório antes de fechar qualquer parede — vazamento descoberto depois exige quebrar tudo',
        'TERMOFUSÃO PPR: temperatura exata (260°C) e tempo correto por diâmetro — junta mal feita vaza inevitavelmente',
        'FITA VEDA-ROSCA: mínimo 3 voltas no sentido da rosca — menos vaza, mais pode rachar a conexão',
        'DILATAÇÃO ÁGUA QUENTE: tubo de água quente dilata — nunca fixar rígido sem folga',
        'REGISTRO ACESSÍVEL: nunca embutir sem caixa de inspeção — manutenção impossível',
        'AS BUILT: fotografar tubulação antes de fechar paredes — sem documentação a próxima intervenção destrói o revestimento'
      ],
      approvalCriteria: [
        'Teste hidrostático aprovado: pressão mantida por 4 horas sem queda',
        'Todos os registros identificados e acessíveis',
        'As built fotográfico arquivado antes do fechamento das paredes',
        'Isolamento térmico instalado em toda a tubulação de água quente exposta',
        'Abraçadeiras instaladas nos espaçamentos corretos',
        'Nenhuma emenda em trecho embutido sem caixa de inspeção',
        'Primer utilizado em todas as soldas PVC verificado pelo fiscal'
      ]
    }
  });

  console.log('IT-08 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
