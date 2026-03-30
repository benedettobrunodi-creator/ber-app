-- seed-users.sql
-- Insere usuários iniciais APENAS se não existirem.
-- ON CONFLICT (email) DO NOTHING garante que senha alterada pelo usuário é preservada.
-- Roda via: npx prisma db execute --file prisma/seed-users.sql --schema prisma/schema.prisma
--
-- Hash abaixo = bcrypt('ber2026', salt=10)
-- Para gerar novo: node -e "require('bcryptjs').hash('senha',10).then(console.log)"

INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Bruno Di Benedetto',
  'bruno@ber-engenharia.com.br',
  '$2a$10$w0HCCFLSVhDE.FLfxc/gK.Q5apnF2FlBAMD880Z74CsFgI6s1LFvu',
  'diretoria',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Luis Nuin',
  'luis.nuin@ber-engenharia.com.br',
  '$2a$10$w0HCCFLSVhDE.FLfxc/gK.Q5apnF2FlBAMD880Z74CsFgI6s1LFvu',
  'coordenacao',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
