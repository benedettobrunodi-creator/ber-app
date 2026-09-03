import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_URL_OVERRIDE } } });

async function main() {
  const obras = await prisma.obra.findMany({
    select: { id: true, name: true, progressPercent: true },
    take: 8,
    orderBy: { updatedAt: 'desc' },
  });
  console.log('Obras encontradas:', obras.length);

  const obraIds = obras.map(o => o.id);
  const ultimosRelatorios = obraIds.length
    ? await prisma.relatorioSemanal.findMany({
        where: { obraId: { in: obraIds } },
        orderBy: [{ obraId: 'asc' }, { numero: 'desc' }],
        distinct: ['obraId'],
        select: { obraId: true, avancoPct: true, numero: true },
      })
    : [];

  const avancoPorObra = new Map(ultimosRelatorios.map(r => [r.obraId, Number(r.avancoPct)]));

  for (const o of obras) {
    const novo = avancoPorObra.has(o.id) ? avancoPorObra.get(o.id) : null;
    console.log(`- ${o.name} | progressPercent(antigo)=${o.progressPercent}% | progressoRelatorio(novo)=${novo === null ? '—' : novo + '%'}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('ERRO:', e); await prisma.$disconnect(); process.exit(1); });
