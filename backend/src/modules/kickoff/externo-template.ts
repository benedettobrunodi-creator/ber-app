// Template default do Kickoff EXTERNO — estrutura e textos-padrão extraídos do
// kickoff Segura AI (10/09/26, aprovado pelo Bruno como modelo). O PMO ajusta
// por obra no formulário; seções com ativo=false não saem no PPT/PDF.

export interface PessoaKE { papel: string; nome: string; contato: string }
export interface ItemKE { titulo: string; descricao: string }
export interface BlocoTecnicoKE { titulo: string; topicos: ItemKE[] }

export interface KickoffExternoConteudo {
  dataReuniao: string | null; // YYYY-MM-DD
  nomeCliente: string;        // como o cliente é chamado no deck (ex: "Segura AI")
  time: { ativo: boolean; ladoBer: PessoaKE[]; backOffice: PessoaKE[]; ladoCliente: PessoaKE[] };
  escopo: { ativo: boolean; texto: string };
  responsabilidades: { ativo: boolean; cliente: string[]; ber: string[] };
  aprovacoes: { ativo: boolean; intro: string; itens: ItemKE[] };
  comunicacao: { ativo: boolean; blocos: ItemKE[] };
  projetosAprovacoes: { ativo: boolean; etapas: ItemKE[] };
  periodoObras: { ativo: boolean; texto: string; observacao: string };
  registros: { ativo: boolean; blocos: ItemKE[] };
  logistica: { ativo: boolean; titulo: string; texto: string };
  tecnicos: { ativo: boolean; blocos: BlocoTecnicoKE[] };
  condominio: { ativo: boolean; texto: string };
  encerramento: string;
}

export function templateDefault(nomeCliente: string): KickoffExternoConteudo {
  const c = nomeCliente || 'Cliente';
  return {
    dataReuniao: null,
    nomeCliente: c,
    time: {
      ativo: true,
      ladoBer: [
        { papel: 'PM', nome: '', contato: 'pmo@ber-engenharia.com.br' },
        { papel: 'Coordenador de Engenharia', nome: '', contato: '' },
        { papel: 'Supervisor de Obra', nome: '', contato: '' },
        { papel: 'Residente de Obra', nome: '', contato: '' },
      ],
      backOffice: [
        { papel: 'Financeiro', nome: '', contato: '' },
        { papel: 'Compras', nome: '', contato: '' },
      ],
      ladoCliente: [
        { papel: 'Ponto focal', nome: '', contato: '' },
      ],
    },
    escopo: { ativo: true, texto: '' },
    responsabilidades: {
      ativo: true,
      cliente: ['Definição técnica', 'Definição de arquitetura', 'Aprovações de amostras e mockups'],
      ber: ['Gestão e execução da obra', 'Coordenação de fornecedores', 'Comunicação e reportes semanais'],
    },
    aprovacoes: {
      ativo: true,
      intro: `A alinhar na reunião — lado ${c}:`,
      itens: [
        { titulo: 'Tomador de decisão', descricao: 'Quem bate o martelo no dia a dia do projeto' },
        { titulo: 'Aprovador de valores', descricao: 'Alçadas e limites de aprovação financeira' },
        { titulo: 'Change orders', descricao: 'Rito de aprovação de mudanças de escopo' },
      ],
    },
    comunicacao: {
      ativo: true,
      blocos: [
        { titulo: 'Projeto', descricao: `${c} (cliente) · BÈR (gestão e execução) · Arquitetura` },
        { titulo: 'Obra · autorizações e serviços', descricao: `BÈR Obra (canteiro) · ${c} (solicitações formais) · Condomínio (autorizações)` },
        { titulo: 'Reuniões semanais', descricao: 'Obra — definição do dia da semana' },
      ],
    },
    projetosAprovacoes: {
      ativo: true,
      etapas: [
        { titulo: c, descricao: 'Validação interna do cliente' },
        { titulo: 'Arquitetura', descricao: 'Compatibilização de arquitetura' },
        { titulo: 'Condomínio', descricao: 'Aprovação formal para execução' },
      ],
    },
    periodoObras: {
      ativo: true,
      texto: 'Segunda a sexta',
      observacao: 'Horários de obra conforme regras do edifício.',
    },
    registros: {
      ativo: true,
      blocos: [
        { titulo: 'Relatório Semanal', descricao: 'Emissão às sextas-feiras (proposta BÈR): status, avanço, histograma, principais atividades, pontos de atenção e fotos.' },
        { titulo: 'Atas de Reuniões', descricao: 'Emissão no mesmo dia da reunião semanal — itens tratados em reunião semanal e comunicação do projeto.' },
      ],
    },
    logistica: {
      ativo: true,
      titulo: 'Estacionamento do edifício',
      texto: 'Podemos utilizar durante a obra? Ponto de decisão com o condomínio — vagas para equipe e carga/descarga.',
    },
    tecnicos: {
      ativo: true,
      blocos: [
        {
          titulo: 'Infraestrutura, elétrica e T.I.',
          topicos: [
            { titulo: 'Planta de elétrica, dados e voz', descricao: 'Revisão e validação final da planta de pontos com o time do cliente.' },
          ],
        },
      ],
    },
    condominio: {
      ativo: true,
      texto: 'Regras, horários e autorizações — alinhamento na reunião. Elevador de serviço · descarte de entulho · silêncio · acessos e crachás da equipe.',
    },
    encerramento: "Let's Move Forward!",
  };
}
