import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BluePaperTemplate {
  name: string;
  fase: string;
  bluepaperDoc: number;
  required: boolean;
  responsibleRole: string;
  items: string[];
}

const BLUEPAPER_TEMPLATES: BluePaperTemplate[] = [
  // ── kickoff_interno (docs 1–9) ──
  {
    name: 'Proposta Técnica Assinada',
    fase: 'kickoff_interno',
    bluepaperDoc: 1,
    required: true,
    responsibleRole: 'gestor',
    items: ['Proposta assinada pelo cliente', 'Valor e escopo validados', 'Data de início confirmada'],
  },
  {
    name: 'Ficha DNN (Dados do Novo Negócio)',
    fase: 'kickoff_interno',
    bluepaperDoc: 2,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Dados do cliente completos', 'Endereço da obra', 'Contatos do cliente e arquiteto'],
  },
  {
    name: 'Termo de Aceite de Proposta',
    fase: 'kickoff_interno',
    bluepaperDoc: 3,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Documento assinado', 'Cópia digitalizada arquivada'],
  },
  {
    name: 'ART/RRT do Responsável Técnico',
    fase: 'kickoff_interno',
    bluepaperDoc: 4,
    required: true,
    responsibleRole: 'coordenador',
    items: ['ART emitida no CREA', 'Valor recolhido', 'Número da ART registrado'],
  },
  {
    name: 'Contrato de Prestação de Serviços',
    fase: 'kickoff_interno',
    bluepaperDoc: 5,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Contrato assinado por ambas as partes', 'Prazo e condições de pagamento definidos', 'Cópia arquivada'],
  },
  {
    name: 'Cronograma Financeiro',
    fase: 'kickoff_interno',
    bluepaperDoc: 6,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Parcelas definidas por etapa', 'Datas de vencimento acordadas', 'Aprovado pelo cliente'],
  },
  {
    name: 'Ficha de Acompanhamento de Projeto (FAP)',
    fase: 'kickoff_interno',
    bluepaperDoc: 7,
    required: true,
    responsibleRole: 'analista_projetos',
    items: ['FAP criada no sistema', 'Responsáveis definidos', 'Status inicial registrado'],
  },
  {
    name: 'Kit de Boas-Vindas BÈR',
    fase: 'kickoff_interno',
    bluepaperDoc: 8,
    required: false,
    responsibleRole: 'coordenador',
    items: ['Apresentação da empresa enviada', 'Contatos do time compartilhados'],
  },
  {
    name: 'Reunião Interna de Kick-Off',
    fase: 'kickoff_interno',
    bluepaperDoc: 9,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Pauta enviada com 24h de antecedência', 'Equipe convocada', 'Ata gerada e distribuída'],
  },

  // ── kickoff_externo (docs 10–15) ──
  {
    name: 'Reunião de Kick-Off com Cliente',
    fase: 'kickoff_externo',
    bluepaperDoc: 10,
    required: true,
    responsibleRole: 'gestor',
    items: ['Pauta enviada ao cliente com 48h de antecedência', 'Cliente e arquiteto presentes', 'Ata assinada e distribuída'],
  },
  {
    name: 'Ata de Kick-Off Externo',
    fase: 'kickoff_externo',
    bluepaperDoc: 11,
    required: true,
    responsibleRole: 'gestor',
    items: ['Ata elaborada em até 24h', 'Aprovada pelo cliente', 'Arquivada no sistema'],
  },
  {
    name: 'Apresentação do Cronograma ao Cliente',
    fase: 'kickoff_externo',
    bluepaperDoc: 12,
    required: true,
    responsibleRole: 'gestor',
    items: ['Cronograma físico apresentado', 'Marcos de entrega validados', 'Aprovação registrada'],
  },
  {
    name: 'Definição de Frequência de Reuniões',
    fase: 'kickoff_externo',
    bluepaperDoc: 13,
    required: true,
    responsibleRole: 'gestor',
    items: ['Frequência acordada (semanal/quinzenal)', 'Dia e hora fixados', 'Lista de participantes definida'],
  },
  {
    name: 'Alinhamento de Comunicação',
    fase: 'kickoff_externo',
    bluepaperDoc: 14,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Canal preferencial definido (WhatsApp/email)', 'Tempo de resposta acordado', 'Responsáveis por aprovações definidos'],
  },
  {
    name: 'Validação de Escopo Final',
    fase: 'kickoff_externo',
    bluepaperDoc: 15,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Memória de cálculo revisada', 'Especificações confirmadas', 'Alterações documentadas'],
  },

  // ── suprimentos (docs 16–20) ──
  {
    name: 'Pacote de Compras 1 — Estrutura e Impermeabilização',
    fase: 'suprimentos',
    bluepaperDoc: 16,
    required: true,
    responsibleRole: 'comprador',
    items: ['Lista de materiais elaborada', 'Cotações realizadas (mín. 3 fornecedores)', 'Pedido aprovado'],
  },
  {
    name: 'Pacote de Compras 2 — Alvenaria e Revestimentos',
    fase: 'suprimentos',
    bluepaperDoc: 17,
    required: true,
    responsibleRole: 'comprador',
    items: ['Lista de materiais elaborada', 'Cotações realizadas', 'Pedido aprovado'],
  },
  {
    name: 'Pacote de Compras 3 — Instalações',
    fase: 'suprimentos',
    bluepaperDoc: 18,
    required: true,
    responsibleRole: 'comprador',
    items: ['Lista de materiais elaborada', 'Cotações realizadas', 'Pedido aprovado'],
  },
  {
    name: 'Pacote de Compras 4 — Acabamentos',
    fase: 'suprimentos',
    bluepaperDoc: 19,
    required: true,
    responsibleRole: 'comprador',
    items: ['Lista de materiais elaborada', 'Cotações realizadas', 'Pedido aprovado'],
  },
  {
    name: 'Cronograma de Entregas de Materiais',
    fase: 'suprimentos',
    bluepaperDoc: 20,
    required: true,
    responsibleRole: 'comprador',
    items: ['Datas de entrega alinhadas com cronograma', 'Fornecedores notificados', 'Backup identificado para itens críticos'],
  },

  // ── pre_obra (docs 21–27) ──
  {
    name: 'Vistoria de Início de Obra',
    fase: 'pre_obra',
    bluepaperDoc: 21,
    required: true,
    responsibleRole: 'gestor',
    items: ['Fotos do estado atual do imóvel (mín. 20 fotos)', 'Laudo de vistoria assinado pelo cliente', 'Irregularidades documentadas'],
  },
  {
    name: 'Plano de Ataque (Planejamento Executivo)',
    fase: 'pre_obra',
    bluepaperDoc: 22,
    required: true,
    responsibleRole: 'gestor',
    items: ['Sequência de serviços definida', 'Equipes alocadas por frente', 'Recursos disponíveis confirmados'],
  },
  {
    name: 'Cronograma de Metas Semanais',
    fase: 'pre_obra',
    bluepaperDoc: 23,
    required: true,
    responsibleRole: 'gestor',
    items: ['Metas da semana 1 definidas', 'Responsáveis por cada meta', 'Métricas de avanço definidas'],
  },
  {
    name: 'Checklist de Segurança Pré-Obra',
    fase: 'pre_obra',
    bluepaperDoc: 24,
    required: true,
    responsibleRole: 'mst',
    items: ['EPI entregue para toda a equipe', 'Sinalização de obra instalada', 'PPRA/PCMSO atualizados'],
  },
  {
    name: 'Organização do Canteiro de Obras',
    fase: 'pre_obra',
    bluepaperDoc: 25,
    required: true,
    responsibleRole: 'mst',
    items: ['Canteiro limpo e organizado', 'Área de armazenamento definida', 'Banheiros e vestiários disponíveis'],
  },
  {
    name: 'Comunicado de Início de Obra ao Cliente',
    fase: 'pre_obra',
    bluepaperDoc: 26,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Email/mensagem enviado ao cliente', 'Data de início confirmada', 'Acesso à obra acordado'],
  },
  {
    name: 'Definição de Encarregados por Frente',
    fase: 'pre_obra',
    bluepaperDoc: 27,
    required: true,
    responsibleRole: 'gestor',
    items: ['Encarregados nomeados por área', 'Contatos compartilhados com o cliente (se aplicável)', 'Responsabilidades claras'],
  },

  // ── execucao (docs 28–40) ──
  {
    name: 'Check Safety Semanal',
    fase: 'execucao',
    bluepaperDoc: 28,
    required: true,
    responsibleRole: 'mst',
    items: ['Inspeção de EPIs realizada', 'Condições do canteiro avaliadas', 'Não conformidades registradas e tratadas'],
  },
  {
    name: 'FVS — Ficha de Verificação de Serviço',
    fase: 'execucao',
    bluepaperDoc: 29,
    required: true,
    responsibleRole: 'gestor',
    items: ['FVS preenchida para cada serviço concluído', 'Fotos de evidência anexadas', 'Aprovação do coordenador registrada'],
  },
  {
    name: 'Diário de Obra',
    fase: 'execucao',
    bluepaperDoc: 30,
    required: true,
    responsibleRole: 'gestor',
    items: ['Preenchido diariamente', 'Atividades do dia registradas', 'Ocorrências e intercorrências documentadas'],
  },
  {
    name: 'Ata de Reunião Semanal Interna',
    fase: 'execucao',
    bluepaperDoc: 31,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Pauta preparada com antecedência', 'Decisões registradas', 'Ata distribuída em até 24h'],
  },
  {
    name: 'Ata de Reunião Semanal com Cliente',
    fase: 'execucao',
    bluepaperDoc: 32,
    required: true,
    responsibleRole: 'gestor',
    items: ['Cliente convocado com 24h de antecedência', 'Pauta enviada previamente', 'Ata assinada e distribuída'],
  },
  {
    name: 'Comunicado Semanal ao Cliente',
    fase: 'execucao',
    bluepaperDoc: 33,
    required: true,
    responsibleRole: 'gestor',
    items: ['Enviado toda sexta-feira', 'Inclui % de avanço', 'Fotos de destaque anexadas'],
  },
  {
    name: 'Controle de Ponto da Equipe',
    fase: 'execucao',
    bluepaperDoc: 34,
    required: true,
    responsibleRole: 'mst',
    items: ['Check-in e check-out registrados', 'Horas extras documentadas', 'Faltas justificadas'],
  },
  {
    name: 'Controle de Recebimento de Materiais',
    fase: 'execucao',
    bluepaperDoc: 35,
    required: true,
    responsibleRole: 'mst',
    items: ['NF conferida no recebimento', 'Material inspecionado', 'Divergências comunicadas imediatamente'],
  },
  {
    name: 'Relatório Fotográfico Mensal',
    fase: 'execucao',
    bluepaperDoc: 36,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Fotos organizadas por ambiente/frente', 'Comparativo antes/depois', 'Enviado ao cliente até dia 5 do mês seguinte'],
  },
  {
    name: 'Controle de Aditivos',
    fase: 'execucao',
    bluepaperDoc: 37,
    required: false,
    responsibleRole: 'coordenador',
    items: ['Aditivo formalizado por escrito', 'Aprovado pelo cliente antes da execução', 'Impacto em prazo e custo registrado'],
  },
  {
    name: 'Medição de Avanço Físico',
    fase: 'execucao',
    bluepaperDoc: 38,
    required: true,
    responsibleRole: 'gestor',
    items: ['% de avanço calculado por frente', 'Validado pelo coordenador', 'Atualizado no sistema'],
  },
  {
    name: 'Checklist de Qualidade por Ambiente',
    fase: 'execucao',
    bluepaperDoc: 39,
    required: true,
    responsibleRole: 'tst',
    items: ['Inspeção realizada após conclusão de cada ambiente', 'Fotos de conformidade e não conformidade', 'Punch list gerado'],
  },
  {
    name: 'Reunião de Análise Crítica Mensal',
    fase: 'execucao',
    bluepaperDoc: 40,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Desempenho do mês revisado', 'Desvios identificados e plano de ação definido', 'Próximo mês planejado'],
  },

  // ── pendencias (docs 41–43) ──
  {
    name: 'Checklist de Antecipação de Pendências',
    fase: 'pendencias',
    bluepaperDoc: 41,
    required: true,
    responsibleRole: 'gestor',
    items: ['Lista de itens pendentes levantada', 'Priorização por impacto no prazo', 'Responsáveis e prazos definidos'],
  },
  {
    name: 'Termo de Aceite Provisório',
    fase: 'pendencias',
    bluepaperDoc: 42,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Vistoria com cliente realizada', 'Pendências listadas e aceitas pelo cliente', 'Documento assinado'],
  },
  {
    name: 'Controle de Pendências Pós-Entrega Provisória',
    fase: 'pendencias',
    bluepaperDoc: 43,
    required: true,
    responsibleRole: 'gestor',
    items: ['Planilha de pendências criada', 'Prazos de resolução definidos', 'Atualizações semanais enviadas ao cliente'],
  },

  // ── encerramento (docs 44–51) ──
  {
    name: 'As-Built dos Projetos',
    fase: 'encerramento',
    bluepaperDoc: 44,
    required: true,
    responsibleRole: 'analista_projetos',
    items: ['Projetos atualizados com execução real', 'Revisados pelo coordenador', 'Entregues ao cliente em formato digital e físico'],
  },
  {
    name: 'Laudos Técnicos (impermeabilização, estrutural)',
    fase: 'encerramento',
    bluepaperDoc: 45,
    required: true,
    responsibleRole: 'tst',
    items: ['Laudos emitidos por RT competente', 'ARTs de execução arquivadas', 'Cópia entregue ao cliente'],
  },
  {
    name: 'Manuais de Equipamentos e Instalações',
    fase: 'encerramento',
    bluepaperDoc: 46,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Manuais de todos os equipamentos coletados', 'Organizados por sistema (elétrico, hidráulico, etc.)', 'Entregues ao cliente'],
  },
  {
    name: 'Manual do Proprietário BÈR',
    fase: 'encerramento',
    bluepaperDoc: 47,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Manual personalizado gerado', 'Revisado pelo responsável técnico', 'Entregue e explicado ao cliente'],
  },
  {
    name: 'Pasta de Obra Digital',
    fase: 'encerramento',
    bluepaperDoc: 48,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Todos os documentos organizados por categoria', 'Projetos, ARTs, laudos, NFs arquivados', 'Link de acesso compartilhado com cliente'],
  },
  {
    name: 'Vistoria Final com Cliente',
    fase: 'encerramento',
    bluepaperDoc: 49,
    required: true,
    responsibleRole: 'gestor',
    items: ['Vistoria agendada com 5 dias de antecedência', 'Check de todas as pendências', 'Fotos finais do imóvel concluído'],
  },
  {
    name: 'Termo de Entrega e Aceite Definitivo',
    fase: 'encerramento',
    bluepaperDoc: 50,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Documento elaborado', 'Assinado pelo cliente e BÈR', 'Registrado no sistema'],
  },
  {
    name: 'Avaliação de Satisfação do Cliente',
    fase: 'encerramento',
    bluepaperDoc: 51,
    required: true,
    responsibleRole: 'coordenador',
    items: ['Formulário enviado em até 7 dias após entrega', 'Resultado registrado', 'Plano de ação para pontos negativos'],
  },
];

export async function seedBluePaperChecklists() {
  console.log('[Seed] Iniciando seed Blue Paper Checklists (51 documentos)...');

  for (const tpl of BLUEPAPER_TEMPLATES) {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { bluepaperDoc: tpl.bluepaperDoc },
    });

    if (existing) {
      console.log(`  ✓ Doc #${tpl.bluepaperDoc} "${tpl.name}" já existe, pulando.`);
      continue;
    }

    await prisma.checklistTemplate.create({
      data: {
        name: tpl.name,
        type: 'bluepaper',
        segment: 'ambos',
        fase: tpl.fase,
        bluepaperDoc: tpl.bluepaperDoc,
        responsibleRole: tpl.responsibleRole,
        items: {
          create: tpl.items.map((title, idx) => ({
            title,
            order: idx + 1,
            required: tpl.required,
          })),
        },
      },
    });

    console.log(`  + Doc #${tpl.bluepaperDoc} "${tpl.name}" criado.`);
  }

  console.log('[Seed] Blue Paper Checklists seed concluído.');
}

// Run directly if called as script
if (require.main === module) {
  seedBluePaperChecklists()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
