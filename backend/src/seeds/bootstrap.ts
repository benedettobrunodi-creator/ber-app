/**
 * bootstrap.ts — Seed de usuários iniciais (seguro para redeploy)
 * Autor: Linux (BER Engenharia)
 *
 * Roda no startup do app via app.ts.
 * Usa upsert com update:{} — NÃO sobrescreve password_hash se o usuário já existe.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';

const INITIAL_USERS = [
  {
    email: 'bruno@ber-engenharia.com.br',
    name: 'Bruno Di Benedetto',
    role: 'diretoria',
    defaultPassword: 'ber2026',
  },
  {
    email: 'luis.nuin@ber-engenharia.com.br',
    name: 'Luis Nuin',
    role: 'coordenacao',
    defaultPassword: 'ber2026',
  },
];

export async function bootstrapUsers(): Promise<void> {
  for (const u of INITIAL_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });

    if (existing) {
      // Usuário já existe — não tocar no password_hash
      console.log(`[bootstrap] Usuário ${u.email} já existe — preservando senha.`);
      continue;
    }

    // Usuário não existe — criar com senha padrão
    const passwordHash = await bcrypt.hash(u.defaultPassword, 10);
    await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        isActive: true,
      },
    });
    console.log(`[bootstrap] Usuário ${u.email} criado.`);
  }
}
