import cron from 'node-cron';
import { prisma } from '../config/database';
import { syncFromAgendor } from '../modules/proposals/service';
import { syncObraFromTrello } from './trello';

export function startScheduler() {
  // Agendor sync — a cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Agendor sync iniciado...');
    try {
      const result = await syncFromAgendor();
      console.log(`[Scheduler] Agendor sync concluído — ${result.created} criados, ${result.updated} atualizados (${result.elapsed})`);
    } catch (err) {
      console.error('[Scheduler] Agendor sync falhou:', (err as Error).message);
    }
  });

  // Trello sync — a cada 1 hora
  cron.schedule('0 * * * *', async () => {
    const obras = await prisma.obra.findMany({
      where: { trelloBoardId: { not: null } },
      select: { id: true, name: true, trelloBoardId: true },
    });

    console.log(`[Scheduler] Trello sync iniciado — ${obras.length} obras`);

    for (const obra of obras) {
      try {
        const result = await syncObraFromTrello(obra.id, obra.trelloBoardId!);
        console.log(`[Scheduler] Trello sync "${obra.name}" — ${result.created} criados, ${result.skipped} pulados`);
      } catch (err) {
        console.error(`[Scheduler] Trello sync "${obra.name}" falhou:`, (err as Error).message);
      }
    }

    console.log('[Scheduler] Trello sync concluído');
  });

  console.log('[Scheduler] Jobs registrados — Agendor (*/30min), Trello (*/1h)');
}
