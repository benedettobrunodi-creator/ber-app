/**
 * FVS Auto-Provisioning
 * Instancia TODOS os 23 templates FVS para uma obra automaticamente.
 * etapa_id permanece null — vinculação a etapa é opcional/manual.
 */
import { prisma } from '../../config/database';

/**
 * Cria todos os templates FVS faltantes para uma obra.
 * Idempotente: pula templates já existentes.
 */
export async function autoProvisionFvs(obraId: string): Promise<{ created: number; skipped: number }> {
  const templates = await prisma.fvsTemplate.findMany({
    include: { items: { orderBy: { ordem: 'asc' } } },
    orderBy: { code: 'asc' },
  });

  const existing = await prisma.obraFvs.findMany({
    where: { obraId },
    select: { templateId: true },
  });
  const existingTemplateIds = new Set(existing.map(f => f.templateId));

  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    if (existingTemplateIds.has(template.id)) { skipped++; continue; }

    await prisma.obraFvs.create({
      data: {
        obraId,
        templateId: template.id,
        status: 'pendente',
        items: {
          create: template.items.map(item => ({
            templateItemId: item.id,
            momento: item.momento,
            checked: false,
            na: false,
          })),
        },
      },
    });
    created++;
  }

  console.log(`[FVS AutoProvision] obra=${obraId} created=${created} skipped=${skipped}`);
  return { created, skipped };
}
