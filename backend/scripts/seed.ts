/**
 * seed.ts — Seed manual de desenvolvimento
 * Usa upsert com update:{} — NÃO sobrescreve password_hash se usuário já existe.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const USERS = [
  { email: 'bruno@ber-engenharia.com.br', name: 'Bruno Di Benedetto', role: 'diretoria', password: 'ber2026' },
  { email: 'luis.nuin@ber-engenharia.com.br', name: 'Luis Nuin', role: 'coordenacao', password: 'ber2026' },
];

async function main() {
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // NÃO atualiza password_hash se já existe
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        isActive: true,
      },
    });
    console.log(`✓ ${u.email} (upsert seguro)`);
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
