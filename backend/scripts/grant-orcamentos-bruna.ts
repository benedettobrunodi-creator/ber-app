/**
 * grant-orcamentos-bruna.ts
 * Concede permissão ao módulo "Esteira de Orçamentos" para a Bruna,
 * preservando quaisquer permissões customizadas que ela já tenha.
 *
 * Run: npx tsx scripts/grant-orcamentos-bruna.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { contains: 'Bruna', mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true, email: true, role: true, permissions: true },
  });

  if (users.length === 0) {
    console.log('Nenhum usuário ativo com nome "Bruna" encontrado.');
    return;
  }

  for (const user of users) {
    const current = (user.permissions as Record<string, boolean>) ?? {};
    const updated = { ...current, orcamentos: true };

    await prisma.user.update({
      where: { id: user.id },
      data: { permissions: updated },
    });

    console.log(`✓ ${user.name} (${user.email}) — role: ${user.role} — permissão "orcamentos" concedida`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
