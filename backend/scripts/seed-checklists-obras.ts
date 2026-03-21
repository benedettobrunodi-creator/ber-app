import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.checklistTemplate.findMany({
    include: { items: { orderBy: { order: 'asc' } } },
  });

  if (templates.length === 0) {
    console.log('Nenhum template de checklist encontrado. Rode o seed de templates primeiro.');
    return;
  }

  console.log(`${templates.length} templates encontrados: ${templates.map((t) => t.name).join(', ')}`);

  const obras = await prisma.obra.findMany({
    select: { id: true, name: true, coordinatorId: true },
  });

  let created = 0;
  let skipped = 0;

  for (const obra of obras) {
    const existing = await prisma.checklist.count({ where: { obraId: obra.id } });

    if (existing > 0) {
      console.log(`  [skip] ${obra.name} — já tem ${existing} checklist(s)`);
      skipped++;
      continue;
    }

    for (const template of templates) {
      await prisma.checklist.create({
        data: {
          obraId: obra.id,
          templateId: template.id,
          type: template.type,
          segment: template.segment,
          createdBy: obra.coordinatorId,
          items: {
            create: template.items.map((item) => ({
              templateItemId: item.id,
              title: item.title,
              description: item.description,
              required: item.required,
              order: item.order,
            })),
          },
        },
      });
    }

    console.log(`  [ok] ${obra.name} — ${templates.length} checklists criados`);
    created++;
  }

  console.log(`\nResumo: ${created} obras populadas, ${skipped} obras já tinham checklists.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
