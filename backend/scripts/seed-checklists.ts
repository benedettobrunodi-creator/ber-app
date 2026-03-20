import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    name: 'Vistoria Inicial',
    type: 'vistoria_inicial',
    segment: 'ambos',
    items: [
      { title: 'Condições das paredes (rachaduras, infiltrações)', description: 'Verificar estado geral das paredes, identificar rachaduras, manchas de umidade e infiltrações', order: 1 },
      { title: 'Condições do piso existente', description: 'Avaliar nivelamento, trincas, descolamentos e desgaste do piso', order: 2 },
      { title: 'Instalações elétricas existentes (quadro, pontos)', description: 'Verificar quadro de distribuição, pontos de tomada, interruptores e fiação aparente', order: 3 },
      { title: 'Instalações hidráulicas existentes (pontos, pressão)', description: 'Testar pontos de água, verificar pressão, identificar vazamentos', order: 4 },
      { title: 'Esquadrias existentes (portas, janelas)', description: 'Verificar funcionamento, vedação, ferragens e estado de conservação', order: 5 },
      { title: 'Condições do teto', description: 'Verificar forro, laje, manchas, trincas e infiltrações no teto', order: 6 },
      { title: 'Medições gerais conferidas com projeto', description: 'Conferir medidas do espaço com as indicadas no projeto arquitetônico', order: 7 },
      { title: 'Registro fotográfico do estado inicial', description: 'Fotografar todos os ambientes documentando o estado atual antes da obra', order: 8 },
    ],
  },
  {
    name: 'Qualidade Durante Obra',
    type: 'qualidade',
    segment: 'ambos',
    items: [
      { title: 'Impermeabilização executada (teste de prova d\'água 72h)', description: 'Verificar execução da impermeabilização e resultado do teste de estanqueidade de 72 horas', order: 1 },
      { title: 'Esquadros verificados (paredes, pisos)', description: 'Conferir esquadros de paredes e pisos com esquadro e nível a laser', order: 2 },
      { title: 'Instalações elétricas testadas (fases, neutro, terra)', description: 'Testar todas as fases, neutro e aterramento em cada circuito', order: 3 },
      { title: 'Instalações hidráulicas testadas (pressão, estanqueidade)', description: 'Realizar teste de pressão e verificar estanqueidade de todas as conexões', order: 4 },
      { title: 'Revestimentos nivelados e alinhados', description: 'Verificar nivelamento e alinhamento de todos os revestimentos instalados', order: 5 },
      { title: 'Acabamentos conforme especificação do projeto', description: 'Conferir materiais e acabamentos aplicados com as especificações do memorial descritivo', order: 6 },
      { title: 'Limpeza e proteção dos materiais aplicados', description: 'Verificar se materiais aplicados estão protegidos e área está limpa', order: 7 },
    ],
  },
  {
    name: 'Pré-entrega',
    type: 'pre_entrega',
    segment: 'ambos',
    items: [
      { title: 'Todos os acabamentos concluídos', description: 'Verificar se todos os acabamentos estão instalados e finalizados em todos os ambientes', order: 1 },
      { title: 'Limpeza fina executada', description: 'Confirmar execução da limpeza fina pós-obra em todos os ambientes', order: 2 },
      { title: 'Equipamentos instalados e testados (ar condicionado, automação)', description: 'Verificar instalação e funcionamento de ar condicionado, automação e demais equipamentos', order: 3 },
      { title: 'Documentação pronta (ART, manuais, garantias)', description: 'Reunir e conferir toda documentação: ART/RRT, manuais de equipamentos e termos de garantia', order: 4 },
      { title: 'Fotos finais por ambiente', description: 'Realizar registro fotográfico final de todos os ambientes concluídos', order: 5 },
      { title: 'Lista de pendências mapeada e endereçada', description: 'Listar todas as pendências identificadas com responsáveis e prazos definidos', order: 6 },
    ],
  },
  {
    name: 'Inauguração',
    type: 'inauguracao',
    segment: 'ambos',
    items: [
      { title: 'Pendências da pré-entrega resolvidas', description: 'Confirmar que todas as pendências identificadas na pré-entrega foram solucionadas', order: 1 },
      { title: 'Chaves e acessos entregues', description: 'Entregar todas as chaves, controles de acesso e senhas de sistemas ao cliente', order: 2 },
      { title: 'Manual do proprietário entregue', description: 'Entregar manual com instruções de uso, manutenção e contatos de fornecedores', order: 3 },
      { title: 'Termo de recebimento assinado', description: 'Obter assinatura do cliente no termo de recebimento da obra', order: 4 },
      { title: 'Registro fotográfico da entrega', description: 'Fotografar o momento da entrega e o estado final do imóvel', order: 5 },
    ],
  },
];

async function main() {
  console.log('Seeding checklist templates...');

  for (const tpl of TEMPLATES) {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { type: tpl.type, segment: tpl.segment },
    });

    if (existing) {
      console.log(`  Template "${tpl.name}" already exists, skipping.`);
      continue;
    }

    await prisma.checklistTemplate.create({
      data: {
        name: tpl.name,
        type: tpl.type,
        segment: tpl.segment,
        items: {
          create: tpl.items.map((item) => ({
            title: item.title,
            description: item.description,
            order: item.order,
            required: true,
          })),
        },
      },
    });

    console.log(`  Created template "${tpl.name}" with ${tpl.items.length} items.`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
