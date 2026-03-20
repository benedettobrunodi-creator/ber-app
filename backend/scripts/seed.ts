import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'bruno@ber-engenharia.com.br';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário ${email} já existe (id: ${existing.id}). Pulando.`);
    return;
  }

  const passwordHash = await bcrypt.hash('ber2026', 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Bruno Di Benedetto',
      passwordHash,
      role: 'diretoria',
    },
  });

  console.log(`Usuário admin criado: ${user.name} (${user.email}) — id: ${user.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
