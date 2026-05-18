/**
 * grant-crm-marco.ts
 * Define role "comercial" para o Marco Venturi, dando acesso completo ao CRM.
 *
 * Run: npx tsx scripts/grant-crm-marco.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { contains: 'Marco', mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });

  if (users.length === 0) {
    console.log('Nenhum usuário ativo com nome "Marco" encontrado.');
    return;
  }

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'comercial' },
    });
    console.log(`✓ ${user.name} (${user.email}) — role atualizado: ${user.role} → comercial`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
