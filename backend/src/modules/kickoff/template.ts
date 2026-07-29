// Template padrão do Kickoff de Obra (origem: planilha 'Kickoff obra.xlsx').
// 17 seções, 96 itens. Usado pra semear os itens de um kickoff novo por obra.
export interface KickoffTemplateSecao { secao: string; itens: string[] }

export const KICKOFF_TEMPLATE: KickoffTemplateSecao[] = [
  {
    secao: "INFORMAÇÕES COMERCIAIS",
    itens: [
      "Obra terá gestão de Gerenciadora",
      "Informações do Cliente / Gerenciadora",
      "Contatos do Cliente / Gerenciadora",
      "LOI - Sem Contrato Assinado",
      "Cláusulas Especiais de Contrato",
    ],
  },
  {
    secao: "INFORMAÇÕES FINANCEIRAS",
    itens: [
      "Particularidades da Forma de Pagamento",
      "Periodicidade de Medição",
      "Emisão de PO",
      "Prazo de Pagamento",
    ],
  },
  {
    secao: "APROVAÇÕES",
    itens: [
      "Requer CNO",
      "Alguma pendência de Aprovação",
      "Corpo de Bombeiros",
      "Prefeitura",
    ],
  },
  {
    secao: "EDIFÍCIO",
    itens: [
      "Horário de Obras - Condições de Trabalho e autorizações",
      "Manual de Obras do Condomínio",
      "Logística de obra (horário, fluxo, acessos horizontal e vertical, caçambas etc)",
      "Vistoria Inicial (check list técnico e fotos)",
      "Edifício Permite furar laje para hidráulica / Necessário no projeto?",
      "Manual de segurança do condomínio",
    ],
  },
  {
    secao: "EQUIPE",
    itens: [
      "Equipe condizente com a obra?",
      "Definida escala de Trabalho",
    ],
  },
  {
    secao: "SEGURANÇA DO TRABALHO",
    itens: [
      "Plano de Emergência para Acidente de Trabalho",
      "Análise Preliminar de Risco",
      "Regras de Segurançado Trabalho / Cliente",
      "TST dedicado ou Part time?",
    ],
  },
  {
    secao: "CANTEIRO DE OBRAS",
    itens: [
      "Considerado Canteiro?",
      "Banheiros Provisórios?",
      "Locação de Mobiliário para escritório provisório?",
    ],
  },
  {
    secao: "EQUIPAMENTOS ESPECIAIS",
    itens: [
      "Considerado algum equipamento especial?",
    ],
  },
  {
    secao: "OBRA EXTERNA (FORA DE SP)",
    itens: [
      "Locação de Imóvel",
      "Hospedagem em Hotel",
      "Locação de Veículo",
    ],
  },
  {
    secao: "PASSAGEM DE ORÇAMENTOS PARA ENGENHARIA (Destacar itens com alto prazo de entrega e lista de exclusões)",
    itens: [
      "Premissas Técnicas",
      "Premissas Adotadas",
      "Dúvidas de projetos respondidas durante concorrência",
      "Pontos de atenção",
      "Itens de longa data de entrega",
      "Reengenharias de valores",
      "Condições comerciais e condições gerais",
      "Proposta técnica enviada ao cliente",
      "Proposta comercial enviada ao cliente",
      "Planilha custo",
      "Planilha venda",
      "Pacote de contratação (pacotes)",
      "Propostas de fornecedores consideradas em orçamentos",
      "Lista de projetos considerados em orçamentos",
      "Últimas revisões de projetos",
      "Considerações de Reengenharia",
    ],
  },
  {
    secao: "PLANEJAMENTO",
    itens: [
      "Plano de Ação de Obra",
      "Logística / Faseamento / Ondas",
      "Cronograma Orientativo da Obra",
      "Cronograma Detalhado da Obra",
    ],
  },
  {
    secao: "LEED",
    itens: [
      "Considerações Leed - Certificação",
      "Consultor Leed",
    ],
  },
  {
    secao: "WELL BEING",
    itens: [
      "Considerações Wellbeing",
      "Consultor Well Being",
    ],
  },
  {
    secao: "COMISSIONAMENTO",
    itens: [
      "Comissionamento Externo",
      "Comissionamento Interno",
    ],
  },
  {
    secao: "PROJETOS",
    itens: [
      "D&B - Protocolo de entrega dos projetos junto ao condomínio",
    ],
  },
  {
    secao: "PROJETOS ARQUITETURA",
    itens: [
      "Maquete eletrônica - Look and Feel",
      "Lista de Mock Ups Definida",
      "Lista de Amostras Necessárias",
      "Layout - apresentação",
      "Mobiliário e acessórios",
      "Arquitetura / Civil",
      "Indicação de pontos",
      "Piso",
      "Forro",
      "Marcenaria",
      "Portas e caixilhos",
      "Elevações",
      "ARTs Arquitetura / D&B",
    ],
  },
  {
    secao: "PROJETOS TÉCNICOS",
    itens: [
      "Projeto técnico do sistema de ar condicionado-exaustão-ventilação",
      "Projeto técnico de elétrica",
      "Aumento de Carga?",
      "Projeto técnico hidro-sanitário",
      "Projeto técnico de detecção e alarme e combate a incêndio",
      "Projeto técnico de fundação e estrutura",
      "Projeto técnico do cabeamento de dados-voz-telecomunicações",
      "Projeto luminotécnico",
      "Projeto técnico de controle de acesso",
      "Projeto técnico do circuito fechado de televisão (CFTV)",
      "Projeto técnico de automação predial",
      "Projeto técnico de acustica",
      "Projeto técnico de elevador",
      "Projeto técnico de laboratório",
      "Projeto de Escada",
      "Serviço técnico de consultoria, levantamento e sondagem de solos",
      "Serviço de consultoria técnica",
      "Projeto técnico de sistema multimídia",
      "Projeto técnico de paisagismo",
      "Projeto técnico de comunicação visual",
      "Projeto técnico de cozinha industrial",
      "Projeto estrutural",
      "Memorial descritivo técnicos - complemento do projeto técnico",
      "ARTs projetistas / D&B",
    ],
  },
];
