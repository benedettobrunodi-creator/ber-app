/**
 * Auto-provisionamento do Passo a Passo da Obra.
 *
 * Instancia todos os templates cadastrados para uma obra — hoje as 6 fases
 * do Controle de Coordenação (PP1..PP6). Genérico de propósito: se os
 * templates mudarem, o provisionamento acompanha sem alteração aqui.
 *
 * etapa_id permanece null — as fases valem para a obra inteira.
 */
import { prisma } from '../../config/database';

/**
 * Cria as fases faltantes para uma obra.
 * Idempotente: pula o que já existe.
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

  console.log(`[PassoAPasso AutoProvision] obra=${obraId} created=${created} skipped=${skipped}`);
  return { created, skipped };
}
