import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-09',
      title: 'Instalação de Sistemas de Ar Condicionado',
      discipline: 'ar_condicionado',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para instalação de sistemas de ar condicionado residencial (split hi-wall, VRV) e corporativo (VRV, fancoil, cassete 4 vias, fancolete, dutado com difusores), garantindo eficiência, estanqueidade do circuito frigorífico, drenagem correta e setup completo de automação.',
      materials: [
        'Unidades evaporadoras e condensadoras conforme projeto',
        'Tubulação de cobre frigorífico (linha de líquido e linha de sucção) — diâmetro conforme fabricante',
        'Isolamento térmico para tubulação (espuma elastomérica — obrigatório em toda a extensão)',
        'Tubos PVC para drenagem de condensado (mínimo 3/4" com caimento de 1%)',
        'Caixa sifonada para drenagem (evita retorno de odor)',
        'Suportes e estrutura metálica para condensadoras',
        'Passa-muro com bucha de vedação (onde tuberiam atravessa parede)',
        'Cabos elétricos conforme projeto (alimentação e comunicação)',
        'Cabo de comunicação entre unidades VRV (par trançado blindado)',
        'Nitrogênio seco (limpeza e teste de pressão do circuito)',
        'Bomba de vácuo (evacuação do sistema)',
        'Manifold com manômetros (verificação de pressão)',
        'Gás refrigerante R-410A ou R-32 conforme equipamento'
      ],
      tools: [
        'Cortador de tubo de cobre',
        'Alargador de tubo (flaring tool)',
        'Chaves de torque (aperto das conexões)',
        'Bomba de vácuo (mínimo 2 estágios)',
        'Manifold com manômetros',
        'Cilindro de nitrogênio seco com regulador',
        'Detector de vazamento de gás (eletrônico)',
        'Nível a laser (alinhamento de unidades)',
        'Furadeira, martelete e serra copo',
        'Multímetro (verificação elétrica)',
        'Tablet ou notebook (setup e comissionamento VRV)'
      ],
      steps: [
        { order: 1, title: 'Análise do projeto e planejamento', description: 'Verificar o projeto de AR com atenção a: capacidade de cada ambiente (BTUs), posicionamento das unidades evaporadoras e condensadoras, traçado da tubulação de cobre e drenagem, infraestrutura elétrica disponível. Para VRV: verificar o diagrama de endereçamento de todas as unidades internas. Para dutado: verificar o projeto de difusores, retornos e balanceamento de vazão. Confirmar que o ramal elétrico está dimensionado para a carga total do sistema antes de instalar.' },
        { order: 2, title: 'Instalação das condensadoras', description: 'Instalar estrutura metálica ou suporte conforme projeto — suporte subdimensionado é risco de queda. Nivelar a condensadora: desvio máximo 3mm (condensadora desnivelada causa falha no compressor). Manter espaçamento mínimo para circulação de ar: lateral 30cm, traseira 30cm, topo livre (verificar manual do fabricante — VRV tem requisitos específicos). Em coberturas: verificar a resistência da laje antes de instalar. Distância máxima entre unidades interna e externa: verificar no projeto (cada fabricante tem limite de comprimento e desnível).' },
        { order: 3, title: 'Instalação das evaporadoras', description: 'SPLIT HI-WALL: fixar suporte com nível a laser, mínimo 15cm do teto, livre de obstáculos na frente. CASSETE 4 VIAS: instalar no centro do ambiente conforme projeto, alinhado com a estrutura do forro — cassete deve ser acessível pelo painel removível. FANCOLETE: verificar espaço de manutenção no forro. DUTADO COM DIFUSORES: posicionar a unidade conforme projeto de dutos, verificar o sentido do fluxo de ar. Para todas: deixar acesso para manutenção do filtro.' },
        { order: 4, title: 'Tubulação de cobre frigorífico', description: 'Usar apenas cobre frigorífico desidratado (não usar cobre para água). Dobras: usar curvador de tubo — nunca dobrar na mão (amassa e restringe o fluxo). Raio mínimo de curva: 4x o diâmetro. Flare nas pontas: usar alargador calibrado — flare irregular causa vazamento de gás. Torque de aperto das porcas flare: conforme tabela do fabricante (geralmente 18-42 Nm por diâmetro) — usar chave de torque obrigatoriamente. ISOLAMENTO TÉRMICO: aplicar em 100% da tubulação, inclusive dentro de paredes e forros — tubulação sem isolamento causa condensação e gotejamento.' },
        { order: 5, title: 'Drenagem de condensado', description: 'Usar PVC rígido mínimo 3/4". Caimento mínimo: 1% em direção ao ponto de descarte — verificar com nível. Sem caimento o condensado acumula, vaza pela evaporadora e causa manchas no forro e paredes. Instalar caixa sifonada no início da linha de drenagem — evita retorno de odores do esgoto para o ambiente. Ponto de descarte: esgoto sanitário (nunca em ralos de piso sem sifão). Para evaporadoras em forro alto: instalar bandeja coletora com sensor de nível (alarme de transbordamento). Testar a drenagem com água antes de fechar o forro.' },
        { order: 6, title: 'Cabos elétricos e de comunicação', description: 'Alimentação elétrica: cabo bitola conforme projeto, com proteção por disjuntor exclusivo e DR (diferencial residual). NUNCA compartilhar disjuntor com outros equipamentos. VRV/SISTEMAS MULTI-SPLIT: cabo de comunicação entre unidades — usar par trançado blindado conforme manual do fabricante. Polaridade importa: verificar A+ e B- na ligação. Comprimento máximo do cabo de comunicação: verificar no manual (geralmente 1000m total). Identificar todos os cabos nas duas extremidades.' },
        { order: 7, title: 'Teste de pressão com nitrogênio', description: 'ANTES de carregar o gás refrigerante, testar a estanqueidade do circuito com nitrogênio seco. Pressurizar a 300 PSI (20 bar) — nunca usar ar comprimido (contamina o sistema com umidade). Aguardar 24 horas com pressão mantida. Verificar com detector eletrônico de vazamento em todas as conexões. Qualquer queda de pressão indica vazamento — localizar com água e sabão, corrigir e repetir. Registrar pressão inicial e final com foto do manômetro.' },
        { order: 8, title: 'Evacuação do sistema (vácuo)', description: 'Obrigatório antes de abrir as válvulas da condensadora. Conectar bomba de vácuo de 2 estágios ao manifold. Evacuar até 500 microns ou menos (verificar no vacuômetro). Aguardar 30 minutos — se a pressão subir indica umidade ou vazamento. Repetir se necessário. Vácuo insuficiente deixa umidade no sistema que congela no expansor e destrói o compressor. Este é o passo mais negligenciado em campo — exigir o vacuômetro na documentação.' },
        { order: 9, title: 'Carga de gás e abertura das válvulas', description: 'VRV e splits inverter: na maioria dos casos o gás já vem pré-carregado na condensadora para o comprimento padrão de tubulação. Verificar no manual se é necessário adicionar gás extra (cálculo por metro adicional de tubulação). Abrir as válvulas de serviço com chave allen conforme sequência do fabricante. Registrar a pressão de operação com o manifold (linha de alta e baixa pressão) e comparar com os valores de referência do fabricante para a temperatura ambiente.' },
        { order: 10, title: 'Setup e comissionamento — ETAPA CRÍTICA', description: 'Este é o ponto crítico mais frequente na BER. VRV: acessar o controlador central ou software de comissionamento. Endereçar cada unidade interna: número do grupo, endereço individual, capacidade. Configurar: modo de operação (frio/calor/ventilação), setpoints, horários, integração com BMS se houver. Testar individualmente cada unidade: ligar, verificar temperatura de insuflamento, verificar drenagem, verificar comunicação com o controle. NUNCA entregar o sistema sem o comissionamento completo e documentado. Elaborar a planilha de comissionamento com: endereço de cada unidade, pressão de operação, temperatura de insuflamento e retorno, status de comunicação.' }
      ],
      attentionPoints: [
        'ISOLAMENTO TÉRMICO: 100% da tubulação — sem isolamento condensa e goteja, danificando forro e revestimentos',
        'CAIMENTO DA DRENAGEM: mínimo 1% — sem caimento vaza pela evaporadora',
        'TORQUE DO FLARE: usar chave de torque — aperto insuficiente vaza gás, excessivo racha o flare',
        'VÁCUO: evacuação mínima 500 microns — umidade no sistema destrói o compressor',
        'TESTE COM NITROGÊNIO: nunca com ar comprimido — umidade contamina o circuito',
        'SETUP VRV: endereçamento completo de todas as unidades antes da entrega — sistema sem comissionamento não funciona corretamente',
        'CABO DE COMUNICAÇÃO: polaridade correta (A+/B-) e blindagem conectada — inversão causa falha de comunicação',
        'ACESSO PARA MANUTENÇÃO: toda unidade deve ter acesso ao filtro e à bandeja — forro sem acesso é entrega incompleta'
      ],
      approvalCriteria: [
        'Teste de pressão com nitrogênio aprovado: 300 PSI por 24 horas sem queda',
        'Vácuo atingido: máximo 500 microns verificado com vacuômetro',
        'Drenagem testada com água: escoamento correto sem acúmulo',
        'Todas as unidades endereçadas e comunicando no sistema VRV',
        'Temperatura de insuflamento dentro do especificado em todas as unidades',
        'Planilha de comissionamento preenchida e arquivada',
        'Acesso à manutenção garantido em todas as unidades',
        'Manual de operação e contatos de assistência técnica entregues ao cliente'
      ]
    }
  });

  console.log('IT-09 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
