import jwt from 'jsonwebtoken';
const token = jwt.sign(
  { userId: '9107c544-0a90-4f3b-aad3-55fd5dbe4965', email: 'bruno@ber-engenharia.com.br', role: 'diretoria' },
  'ber-app-dev-jwt-secret-2026',
  { expiresIn: '1h' },
);
console.log(token);
