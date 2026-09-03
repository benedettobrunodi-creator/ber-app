/**
 * Checklist mestre de Vistoria de Qualidade — transcrição fiel do
 * "Checklist MODELO.xlsx" enviado pelo Bruno em 03/09/26.
 *
 * Pesos somam 1.0. Itens respondidos guardam snapshot do texto no banco,
 * então editar este arquivo NÃO altera vistorias já feitas — só as próximas.
 */

export interface ChecklistItem {
  key: string;
  texto: string;
  // (03/09, Bruno: "foto pra tudo") — foto de evidência é obrigatória em TODO
  // item respondido Sim/Não; regra global aplicada no front, não por item.
}

export interface ChecklistCategoria {
  key: string;
  nome: string;
  peso: number;
  itens: ChecklistItem[];
}

export const QUALIDADE_CHECKLIST: ChecklistCategoria[] = [
  {
    key: 'documentacao',
    nome: 'Documentação e Planejamento',
    peso: 0.15,
    itens: [
      { key: '1.1', texto: 'Cronograma físico atualizado e impresso no canteiro' },
      { key: '1.2', texto: 'Planejamento semanal afixado e atualizado (Kanban)' },
      { key: '1.3', texto: 'Última revisão de projeto disponível (versão datada e aprovada)' },
      { key: '1.4', texto: 'Pasta física de documentos atualizada com ART e outros' },
      { key: '1.5', texto: 'Ata de reunião com fornecedores atualizada' },
      { key: '1.6', texto: 'Diário de obra atualizado e assinado' },
      { key: '1.7', texto: 'Envio dos relatórios gerenciais em dia' },
    ],
  },
  {
    key: 'seguranca',
    nome: 'Segurança do Trabalho (EHS)',
    peso: 0.15,
    itens: [
      { key: '2.1', texto: 'EPIs completos, em uso e em bom estado' },
      { key: '2.2', texto: 'Sinalização de segurança visível (rotas de fuga, EPIs obrigatórios)' },
      { key: '2.3', texto: 'Extintores de incêndio bem localizados e sinalizados' },
      { key: '2.4', texto: 'Primeiros socorros e contatos de emergência disponíveis' },
    ],
  },
  {
    key: 'organizacao',
    nome: 'Organização e Limpeza do Canteiro',
    peso: 0.10,
    itens: [
      { key: '3.1', texto: 'Limpeza geral adequada (sem entulhos, poeira excessiva ou resíduos)' },
      { key: '3.2', texto: 'Caminhos e áreas de circulação desobstruídos' },
      { key: '3.3', texto: 'Equipamentos (bebedouro, micro-ondas, etc) em bom funcionamento' },
      { key: '3.4', texto: 'Áreas de convivência (refeitório, vestiário, sanitário) em boas condições' },
    ],
  },
  {
    key: 'armazenamento',
    nome: 'Armazenamento e Logística',
    peso: 0.07,
    itens: [
      { key: '4.1', texto: 'Produtos identificados por tipo' },
      { key: '4.2', texto: 'Controle de entrada e saída de materiais atualizado' },
      { key: '4.3', texto: 'Proteção de material contra intempéries (lonas, coberturas)' },
    ],
  },
  {
    key: 'execucao',
    nome: 'Execução e Qualidade',
    peso: 0.20,
    itens: [
      { key: '5.1', texto: 'Validação de serviços conforme última revisão de projeto' },
      { key: '5.2', texto: 'Checklists internos de execução preenchidos (ex.: alvenaria, pintura, elétrica)' },
      { key: '5.3', texto: 'Ensaios e testes realizados e registrados' },
      { key: '5.4', texto: 'Não conformidades registradas e tratadas' },
      { key: '5.5', texto: 'As-builts das paredes com tubulações passadas' },
      { key: '5.6', texto: 'Boletins de medição de clientes e fornecedores atualizados' },
      { key: '5.7', texto: 'Fotografias de avanço arquivadas e organizadas' },
    ],
  },
  {
    key: 'protecoes',
    nome: 'Proteções e Acabamentos',
    peso: 0.08,
    itens: [
      { key: '6.1', texto: 'Proteções de piso, rodapés e esquadrias instaladas e íntegras' },
      { key: '6.2', texto: 'Barreira física nas áreas críticas (vidros, guarda-corpos, shafts)' },
      { key: '6.3', texto: 'Proteção de aberturas contra intempéries' },
      { key: '6.4', texto: 'Equipamentos e mobiliários protegidos durante a obra' },
    ],
  },
  {
    key: 'sinalizacao',
    nome: 'Sinalização e Identidade da Obra',
    peso: 0.05,
    itens: [
      { key: '7.1', texto: 'Placas de identificação de ambientes visíveis, atualizadas e conservadas' },
      { key: '7.2', texto: 'Comunicação visual interna (cronograma, plantas) padronizada' },
      { key: '7.3', texto: 'Painel de avaliação de fornecedores atualizado' },
      { key: '7.4', texto: 'Quadro de avisos atualizado e organizado' },
    ],
  },
  {
    key: 'equipe',
    nome: 'Equipe e Conduta',
    peso: 0.10,
    itens: [
      { key: '8.1', texto: 'Uniformes padronizados e limpos (BÈR e fornecedores)' },
      { key: '8.3', texto: 'Equipe ciente das metas de qualidade e prazos' },
      { key: '8.4', texto: 'Registro de presença' },
    ],
  },
  {
    key: 'imagem',
    nome: 'Imagem e Percepção do Cliente',
    peso: 0.10,
    itens: [
      { key: '9.1', texto: 'Organização geral transmite padrão BÈR Engenharia' },
      { key: '9.2', texto: 'Áreas visitáveis em padrão de apresentação' },
      { key: '9.3', texto: 'Relatórios e comunicações ao cliente com linguagem e formatação padrão' },
    ],
  },
];

/** Escala de interpretação do modelo (nota 0–5). */
export function classificarNota(nota: number): { key: string; label: string } {
  if (nota >= 4.5) return { key: 'excelente', label: 'Excelente' };
  if (nota >= 3.5) return { key: 'boa', label: 'Boa conformidade' };
  if (nota >= 2.5) return { key: 'regular', label: 'Regular' };
  if (nota >= 1.5) return { key: 'critico', label: 'Crítico' };
  return { key: 'inaceitavel', label: 'Inaceitável' };
}

/** Nota abaixo disso dispara alerta imediato por e-mail (decisão Bruno 03/09). */
export const NOTA_ALERTA_CRITICO = 2.5;
