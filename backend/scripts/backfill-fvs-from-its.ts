/**
 * Backfill: regenerate FvsTemplate items from every published IT that has
 * fvsCode + non-empty steps. Idempotente — itens com source_it_code = IT.code
 * são substituídos; FVSs já instanciadas (ObraFvs) não são afetadas.
 *
 * Uso:  npx tsx scripts/backfill-fvs-from-its.ts
 */
import { PrismaClient } from '@prisma/client';
import { syncFvsTemplateFromIT } from '../src/modules/instrucoes/service';

const prisma = new PrismaClient();

async function main() {
  const its = await prisma.instrucaoTecnica.findMany({
    where: { status: 'publicada', fvsCode: { not: null } },
    select: { id: true, code: true, title: true, discipline: true, fvsCode: true, steps: true },
  });

  let synced = 0;
  let skipped = 0;
  for (const it of its) {
    const steps = Array.isArray(it.steps) ? it.steps : [];
    if (steps.length === 0) { skipped++; continue; }
    await syncFvsTemplateFromIT(it as any);
    synced++;
    console.log(`  ✓ ${it.code} → ${it.fvsCode} (${steps.length} steps)`);
  }

  console.log(`\nBackfill done: ${synced} synced, ${skipped} skipped (no steps)`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
