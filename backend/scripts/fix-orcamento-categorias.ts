/**
 * fix-orcamento-categorias.ts
 * Corrige categoria de orçamentos que estão com status enviado/aguardando/aprovado
 * mas ainda com categoria = EM_ANDAMENTO (antes do fix em categoriaFromStatus).
 *
 * Run: npx tsx scripts/fix-orcamento-categorias.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ENVIADO / AGUARDANDO / APROVADO → SEM_ACAO
  const pipeline = await prisma.orcamento.updateMany({
    where: {
      status: { in: ['ENVIADO', 'AGUARDANDO', 'APROVADO', 'ENTREGUE', 'DECLINADO', 'NO_GO'] },
      categoria: 'EM_ANDAMENTO',
    },
    data: { categoria: 'SEM_ACAO' },
  });

  // PRODUZIR → A_INICIAR
  const produzir = await prisma.orcamento.updateMany({
    where: { status: 'PRODUZIR', categoria: 'EM_ANDAMENTO' },
    data: { categoria: 'A_INICIAR' },
  });

  console.log(`Corrigidos: ${pipeline.count} → SEM_ACAO, ${produzir.count} → A_INICIAR`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
