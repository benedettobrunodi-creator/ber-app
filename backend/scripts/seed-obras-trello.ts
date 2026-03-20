import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

import { getBoards, syncObraFromTrello } from '../src/services/trello';

const prisma = new PrismaClient();

const BOARD_FILTER = 'Obra |';
const PROTECTED_OBRA_NAMES = ['Escritorio Corporativo Paulista'];

async function cleanup() {
  // Delete obras that don't match the filter and aren't protected
  const allObras = await prisma.obra.findMany({
    select: { id: true, name: true, _count: { select: { tasks: true } } },
  });

  const toDelete = allObras.filter(
    (o) => !o.name.includes(BOARD_FILTER) && !PROTECTED_OBRA_NAMES.includes(o.name)
  );

  if (toDelete.length === 0) {
    console.log('Nenhuma obra para limpar.');
    return;
  }

  console.log(`Limpando ${toDelete.length} obras que não contêm "${BOARD_FILTER}":`);
  for (const obra of toDelete) {
    // Tasks are cascade-deleted via Prisma relation
    await prisma.obraTask.deleteMany({ where: { obraId: obra.id } });
    await prisma.obra.delete({ where: { id: obra.id } });
    console.log(`  [DEL] "${obra.name}" (${obra._count.tasks} tarefas removidas)`);
  }
  console.log('');
}

async function seed() {
  const bruno = await prisma.user.findUnique({
    where: { email: 'bruno@ber-engenharia.com.br' },
    select: { id: true, name: true },
  });

  if (!bruno) {
    console.error('Usuário bruno@ber-engenharia.com.br não encontrado. Rode seed.ts primeiro.');
    process.exit(1);
  }

  console.log(`Coordenador: ${bruno.name} (${bruno.id})`);
  console.log('');

  const allBoards = await getBoards();
  const boards = allBoards.filter((b) => b.name.includes(BOARD_FILTER));

  console.log(`Boards no Trello: ${allBoards.length} total, ${boards.length} com "${BOARD_FILTER}"`);
  console.log(boards.map((b) => `  - ${b.name} (${b.id})`).join('\n'));
  console.log('');

  let obrasCreated = 0;
  let obrasSkipped = 0;
  const results: { obra: string; tasks: number; skipped: number }[] = [];

  for (const board of boards) {
    const existing = await prisma.obra.findFirst({
      where: { name: board.name },
      select: { id: true, trelloBoardId: true },
    });

    let obraId: string;

    if (existing) {
      obraId = existing.id;
      obrasSkipped++;
      console.log(`[SKIP] Obra "${board.name}" já existe (id: ${obraId})`);

      if (!existing.trelloBoardId) {
        await prisma.obra.update({
          where: { id: obraId },
          data: { trelloBoardId: board.id },
        });
        console.log(`  → trelloBoardId atualizado para ${board.id}`);
      }
    } else {
      const obra = await prisma.obra.create({
        data: {
          name: board.name,
          status: 'em_andamento',
          coordinatorId: bruno.id,
          trelloBoardId: board.id,
        },
      });
      obraId = obra.id;
      obrasCreated++;
      console.log(`[NEW] Obra "${board.name}" criada (id: ${obraId})`);
    }

    console.log(`  → Sincronizando tarefas do board ${board.id}...`);
    const syncResult = await syncObraFromTrello(obraId, board.id);
    results.push({ obra: board.name, tasks: syncResult.created, skipped: syncResult.skipped });
    console.log(`  → ${syncResult.created} tarefas criadas, ${syncResult.skipped} já existiam`);
    console.log('');
  }

  console.log('═══════════════════════════════════════');
  console.log('RESUMO');
  console.log('═══════════════════════════════════════');
  console.log(`Obras criadas: ${obrasCreated}`);
  console.log(`Obras já existentes: ${obrasSkipped}`);
  console.log('');
  console.log('Tarefas por obra:');
  for (const r of results) {
    console.log(`  ${r.obra}: ${r.tasks} criadas, ${r.skipped} já existiam`);
  }
  console.log(`Total de tarefas importadas: ${results.reduce((s, r) => s + r.tasks, 0)}`);
}

async function main() {
  await cleanup();
  await seed();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
