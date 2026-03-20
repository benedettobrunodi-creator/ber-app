import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-01',
      title: 'Demolição e Preparação de Ambientes para Reforma',
      discipline: 'outro',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução de demolições parciais em interiores corporativos e residenciais — remoção de revestimentos, alvenaria, drywall, forros e instalações — garantindo segurança dos trabalhadores e do entorno, proteção das instalações existentes e descarte correto de entulho, conforme NR-18.',
      materials: [
        'Lona plástica pesada (isolamento de poeira — piso a teto)',
        'Fita adesiva dupla face e fita crepe larga (fixação das lonas)',
        'Tapume de MDF ou placa de vidro/acrílico (isolamento visual e físico em corporativo)',
        'Sacos de entulho reforçados (60L e 100L)',
        'Caçamba para entulho (obras maiores)',
        'Água para umidificação do entulho (controle de poeira)',
        'Spray marcador e fita colorida (marcação das instalações existentes)',
        'Esparadrapo e protetor para tubulações expostas',
        'Plástico bolha (proteção de equipamentos e móveis próximos)'
      ],
      tools: [
        'Martelete elétrico com ponteira e talhadeira (demolição de alvenaria e revestimento)',
        'Esmerilhadeira com disco de corte (cortes precisos em alvenaria e concreto)',
        'Cortadeira de parede com disco diamantado (rasgos para instalações)',
        'Furadeira de impacto (rasgos menores)',
        'Espátula larga e talhadeira manual (remoção de revestimento cerâmico)',
        'Pé de cabra (remoção de rodapés, soleiras e materiais fixados)',
        'Parafusadeira (desmontagem de drywall)',
        'Aspirador industrial (coleta de poeira após demolição)',
        'Detector de tubulação e elétrica (OBRIGATÓRIO antes de qualquer rasgo)',
        'EPI completo: capacete, óculos, protetor auricular, luvas de raspa, botina com biqueira, máscara PFF2 (poeira fina)'
      ],
      steps: [
        { order: 1, title: 'Levantamento e mapeamento das instalações existentes — ETAPA CRÍTICA', description: 'ANTES de qualquer demolição: mapear 100% das instalações existentes na área. Solicitar o projeto elétrico e hidráulico do pavimento ao síndico/administradora do edifício. Usar detector eletrônico de tubulação e elétrica em todas as paredes e pisos a serem demolidos. Marcar com spray colorido: vermelho = elétrica, azul = água fria, laranja = água quente, verde = dados, amarelo = gás. Fotografar todo o mapeamento. Desligar e selar os circuitos elétricos da área no quadro antes de iniciar. Fechar os registros de água que alimentam a área. NUNCA iniciar demolição sem este levantamento — corte de tubulação ou elétrica escondida é o acidente mais comum em reforma de interiores.' },
        { order: 2, title: 'Isolamento e proteção do ambiente', description: 'CORPORATIVO EM EDIFÍCIO OCUPADO: instalar tapume de MDF ou vidro/acrílico do piso ao teto separando a área de obra das áreas em uso. Vedar todas as frestas com fita e lona para controle absoluto de poeira. Proteger os difusores de ar condicionado das áreas adjacentes com plástico — poeira de demolição entope filtros e danifica equipamentos. Colocar tapete adesivo na entrada da área de obra para não carregar entulho para fora. RESIDENCIAL: proteger com lona plástica todos os ambientes adjacentes, móveis e equipamentos. Sinalizar a área com fita zebrada e aviso de obra.' },
        { order: 3, title: 'Remoção de revestimento cerâmico (piso e parede)', description: 'Iniciar pelos cantos e bordas com espátula e talhadeira. Bater com martelete em ângulo de 45° — não bater perpendicular à parede (risco de dano à estrutura atrás). Trabalhar em faixas horizontais de baixo para cima nas paredes. Umedecer o entulho periodicamente para controle de poeira — nunca varrer a seco. Verificar se há impermeabilização sob o revestimento (banheiros) — se houver, preservar ao máximo para avaliação. Embalar o entulho cerâmico em sacos — cacos de cerâmica perfuram sacos de entulho comuns, usar sacos reforçados.' },
        { order: 4, title: 'Demolição de alvenaria e drywall', description: 'DRYWALL: remover as chapas com parafusadeira (não arrancar) — preservar a estrutura metálica para reaproveitamento se possível. Verificar se há instalações no interior antes de remover a segunda face. ALVENARIA: antes de qualquer demolição de parede, verificar se é estrutural — parede estrutural NUNCA pode ser demolida sem projeto e aprovação de engenheiro. Iniciar pelos tijolos do topo, trabalhando de cima para baixo. Nunca demolir uma parede de baixo para cima. Fazer cortes perimetrais com cortadeira antes de usar o martelete — evita trincas na estrutura adjacente.' },
        { order: 5, title: 'Remoção de forro', description: 'FORRO DRYWALL: remover as chapas com parafusadeira. Verificar e registrar todas as instalações acima antes de desmontar a estrutura metálica. FORRO MODULAR: remover as placas e guardar em local seguro (podem ser reaproveitadas). Desmontar a grelha metálica cuidadosamente — perfis reutilizáveis. Verificar se há goteiras ou manchas de umidade acima do forro — documentar e comunicar ao gestor da obra antes de prosseguir. Forro com manchas pode indicar vazamento ativo — investigar antes de fechar novamente.' },
        { order: 6, title: 'Abertura de rasgos para instalações', description: 'Usar cortadeira de parede com disco diamantado para rasgos limpos e precisos. Profundidade do rasgo: mínimo 3cm acima do diâmetro do conduíte/tubo. NUNCA usar martelete para abrir rasgo — causa trincas além do necessário e pode atingir instalações adjacentes. Umedecer o disco e a parede durante o corte — reduz poeira e resfria o disco. Em paredes de concreto: usar perfuratriz com broca específica para concreto. Não abrir rasgo horizontal em parede estrutural — enfraquecer a viga de amarração.' },
        { order: 7, title: 'Gerenciamento do entulho', description: 'Segregar o entulho na origem: cerâmica e porcelanato separado de madeira, separado de metal, separado de gesso. Facilita o descarte correto e pode reduzir o custo da caçamba. Nunca acumular entulho na área de demolição — remover diariamente para não comprometer a circulação e segurança. Em edifício corporativo: verificar horário e local autorizado pelo condomínio para saída de entulho. Entulho deve ser descartado em aterro licenciado — nunca em terreno baldio ou caçamba comum de lixo doméstico.' },
        { order: 8, title: 'Limpeza técnica pós-demolição', description: 'Após conclusão da demolição: aspirar toda a área com aspirador industrial antes de varrer — varrer a seco levanta poeira fina que demora horas para assentar. Lavar o piso com água e rodo. Verificar e limpar os filtros de ar condicionado das áreas adjacentes — poeira de obra entope em 1 dia. Remover todas as lonas e proteções. Inspecionar a área adjacente — verificar se há poeira, respingo ou dano em áreas que deveriam estar protegidas. Registrar com fotos o estado final antes de iniciar a próxima etapa.' },
        { order: 9, title: 'Vistoria final e liberação para próxima etapa', description: 'Com o gestor da obra, verificar: todas as instalações preservadas e marcadas conforme mapeamento, estrutura íntegra sem trincas não planejadas, rasgos nas dimensões corretas conforme projeto, área limpa e organizada. Fotografar o estado final completo — esta documentação é a referência para eventuais reclamações posteriores do condomínio ou cliente. Somente após aprovação desta vistoria liberar o início das instalações (elétrica, hidráulica, AR).' }
      ],
      attentionPoints: [
        'MAPEAMENTO DE INSTALAÇÕES: obrigatório antes de qualquer demolição — corte de tubulação ou elétrica escondida é o acidente mais comum',
        'PAREDE ESTRUTURAL: NUNCA demolir sem verificação de engenheiro — erro irreversível e de alto risco',
        'CONTROLE DE POEIRA EM CORPORATIVO: isolamento absoluto — poeira de obra em área ocupada gera reclamação e pode contaminar equipamentos de TI',
        'DEMOLIÇÃO DE CIMA PARA BAIXO: sempre — demolir de baixo para cima causa desabamento',
        'CIRCUITO ELÉTRICO: desligar no quadro antes de qualquer demolição — não confiar apenas em desligar o interruptor',
        'REGISTRO DE ÁGUA: fechar antes de demolir paredes com hidráulica — um erro de martelete inunda o andar',
        'ENTULHO: remover diariamente — acúmulo compromete a segurança e o andamento da obra',
        'FORRO COM MANCHAS: documentar e investigar antes de fechar — goteira ativa causa danos recorrentes'
      ],
      approvalCriteria: [
        'Mapeamento de instalações documentado com fotos antes do início',
        'Circuitos elétricos desligados e registros de água fechados verificados',
        'Nenhuma instalação danificada durante a demolição',
        'Estrutura sem trincas não planejadas',
        'Rasgos nas dimensões e posições corretas conforme projeto',
        'Área limpa e entulho removido',
        'Fotos do estado final arquivadas antes de liberar para instalações',
        'Áreas adjacentes sem dano ou contaminação por poeira'
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
