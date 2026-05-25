#!/usr/bin/env node
/**
 * Setup BÈR App MCP — faz login, cria API key e configura ~/.claude/settings.json
 * Uso: node mcp/setup.mjs <email> <senha>
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const API_URL = 'https://ber-app-production.up.railway.app/v1';
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const MCP_SCRIPT = join(homedir(), 'ber-app', 'mcp', 'dist', 'index.js');

const [,, email, password] = process.argv;
if (!email || !password) {
  console.error('Uso: node mcp/setup.mjs <email> <senha>');
  process.exit(1);
}

async function post(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json.data;
}

console.log('🔐 Fazendo login…');
const auth = await post('/auth/login', { email, password });
const token = auth.accessToken;
console.log(`✅ Logado como ${auth.user?.name ?? email}`);

console.log('🔑 Criando API key…');
const keyData = await post('/api-keys', { name: 'Claude Code — Local' }, token);
const apiKey = keyData.key;
console.log(`✅ Chave criada: ${apiKey.slice(0, 12)}…`);

console.log('⚙️  Configurando ~/.claude/settings.json…');
const settings = existsSync(SETTINGS_PATH)
  ? JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
  : {};

settings.mcpServers = {
  ...(settings.mcpServers ?? {}),
  'ber-app': {
    command: 'node',
    args: [MCP_SCRIPT],
    env: {
      BER_API_URL: API_URL,
      BER_API_KEY: apiKey,
    },
  },
};

writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
console.log('✅ settings.json atualizado!');
console.log('');
console.log('🚀 Pronto! Reinicie o Claude Code para ativar as ferramentas BÈR App.');
console.log('   Ferramentas disponíveis: list_orcamentos, get_orcamento, create_orcamento,');
console.log('   update_orcamento, get_pipeline_orcamentos, list_obras, get_obra, list_users');
