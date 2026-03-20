import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    name: 'Corporativo',
    segment: 'corporativo',
    etapas: [
      { name: 'Vistoria inicial e projeto executivo', discipline: 'estrutura', estimatedDays: 7, order: 1, dependsOn: [] },
      { name: 'Demolições e preparação', discipline: 'alvenaria', estimatedDays: 5, order: 2, dependsOn: [1] },
      { name: 'Instalações hidráulicas brutas', discipline: 'hidraulica', estimatedDays: 10, order: 3, dependsOn: [2] },
      { name: 'Instalações elétricas brutas', discipline: 'eletrica', estimatedDays: 10, order: 4, dependsOn: [2] },
      { name: 'Instalações de ar condicionado', discipline: 'ar_condicionado', estimatedDays: 8, order: 5, dependsOn: [2] },
      { name: 'Alvenaria e divisórias', discipline: 'alvenaria', estimatedDays: 12, order: 6, dependsOn: [3, 4, 5] },
      { name: 'Impermeabilização', discipline: 'impermeabilizacao', estimatedDays: 5, order: 7, dependsOn: [6] },
      { name: 'Revestimentos e pisos', discipline: 'revestimento', estimatedDays: 15, order: 8, dependsOn: [7] },
      { name: 'Forro e teto', discipline: 'acabamento', estimatedDays: 8, order: 9, dependsOn: [6] },
      { name: 'Marcenaria e mobiliário', discipline: 'marcenaria', estimatedDays: 12, order: 10, dependsOn: [8, 9] },
      { name: 'Vidros e esquadrias', discipline: 'vidros', estimatedDays: 5, order: 11, dependsOn: [8] },
      { name: 'Acabamentos finais', discipline: 'acabamento', estimatedDays: 8, order: 12, dependsOn: [10, 11] },
      { name: 'Instalações de dados e telecom', discipline: 'eletrica', estimatedDays: 5, order: 13, dependsOn: [9] },
      { name: 'Limpeza técnica', discipline: 'limpeza', estimatedDays: 3, order: 14, dependsOn: [12, 13] },
      { name: 'Vistoria pré-entrega e testes', discipline: 'outro', estimatedDays: 3, order: 15, dependsOn: [14] },
    ],
  },
  {
    name: 'Residencial',
    segment: 'residencial',
    etapas: [
      { name: 'Vistoria inicial', discipline: 'estrutura', estimatedDays: 3, order: 1, dependsOn: [] },
      { name: 'Demolições', discipline: 'alvenaria', estimatedDays: 4, order: 2, dependsOn: [1] },
      { name: 'Impermeabilização', discipline: 'impermeabilizacao', estimatedDays: 5, order: 3, dependsOn: [2] },
      { name: 'Instalações hidráulicas', discipline: 'hidraulica', estimatedDays: 8, order: 4, dependsOn: [3] },
      { name: 'Instalações elétricas', discipline: 'eletrica', estimatedDays: 8, order: 5, dependsOn: [3] },
      { name: 'Alvenaria', discipline: 'alvenaria', estimatedDays: 10, order: 6, dependsOn: [4, 5] },
      { name: 'Revestimentos', discipline: 'revestimento', estimatedDays: 12, order: 7, dependsOn: [6] },
      { name: 'Marcenaria', discipline: 'marcenaria', estimatedDays: 10, order: 8, dependsOn: [7] },
      { name: 'Vidros e esquadrias', discipline: 'vidros', estimatedDays: 4, order: 9, dependsOn: [7] },
      { name: 'Acabamentos', discipline: 'acabamento', estimatedDays: 7, order: 10, dependsOn: [8, 9] },
      { name: 'Limpeza', discipline: 'limpeza', estimatedDays: 2, order: 11, dependsOn: [10] },
      { name: 'Vistoria final', discipline: 'outro', estimatedDays: 2, order: 12, dependsOn: [11] },
    ],
  },
];

async function main() {
  console.log('Seeding sequenciamento templates...');

  for (const tpl of TEMPLATES) {
    const existing = await prisma.sequenciamentoTemplate.findFirst({
      where: { name: tpl.name, segment: tpl.segment },
    });

    if (existing) {
      console.log(`  Template "${tpl.name}" already exists, skipping.`);
      continue;
    }

    // Create template first to get IDs for dependsOn mapping
    const created = await prisma.sequenciamentoTemplate.create({
      data: {
        name: tpl.name,
        segment: tpl.segment,
      },
    });

    // Create etapas and build order→id map for dependsOn resolution
    const orderToId: Record<number, string> = {};

    for (const etapa of tpl.etapas) {
      const createdEtapa = await prisma.sequenciamentoEtapa.create({
        data: {
          templateId: created.id,
          name: etapa.name,
          discipline: etapa.discipline,
          estimatedDays: etapa.estimatedDays,
          order: etapa.order,
          dependsOn: [], // Will update after all etapas are created
        },
      });
      orderToId[etapa.order] = createdEtapa.id;
    }

    // Now update dependsOn with actual IDs
    for (const etapa of tpl.etapas) {
      if (etapa.dependsOn.length > 0) {
        const dependsOnIds = etapa.dependsOn.map((order) => orderToId[order]);
        await prisma.sequenciamentoEtapa.update({
          where: { id: orderToId[etapa.order] },
          data: { dependsOn: dependsOnIds },
        });
      }
    }

    console.log(`  Created template "${tpl.name}" (${tpl.segment}) with ${tpl.etapas.length} etapas.`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
