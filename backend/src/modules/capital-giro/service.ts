import { prisma } from '../../config/database';
import type { UpdateStateInput } from './types';

// Mesmos defaults do protótipo original (app.js) — usados só na primeira
// vez, pra a tela não abrir vazia antes de qualquer obra ser cadastrada.
const DEFAULT_PREM = {
  juros: 2.8, imposto: 17, adm: 10, savings: 8, agio: 70, ret: 10,
  forn: 30, receb: 60, metaAnual: 70_000_000, estruturaPct: 6, backofficeMes: 500_000,
};
const SEED_OBRAS = [
  {
    id: 'exemplo', nome: 'Obra Exemplo', contrato: 3_000_000, agio: 40, mod: 143_000,
    fornMat: 558_000, budget: 701_000, imposto: 11.5, savings: 10, adm: 10, ret: 0,
    juros: 2.8, comissao: 3.87, duracao: 4, inicioMes: '2026-08', sinal: 20,
    prazoSinal: 0, formaReceb: 'prazo', prazoReceb: 30, fornTipo: 'prazo', fornDias: 15,
  },
];

/** Singleton — sempre a linha mais antiga; cria com os defaults se ainda não existe. */
export async function getState() {
  const existing = await prisma.capitalGiroState.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return { obras: existing.obras, premissas: existing.premissas };

  const created = await prisma.capitalGiroState.create({
    data: { obras: SEED_OBRAS, premissas: DEFAULT_PREM },
  });
  return { obras: created.obras, premissas: created.premissas };
}

export async function updateState(input: UpdateStateInput) {
  const existing = await prisma.capitalGiroState.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) {
    const updated = await prisma.capitalGiroState.update({
      where: { id: existing.id },
      data: { obras: input.obras, premissas: input.premissas },
    });
    return { obras: updated.obras, premissas: updated.premissas };
  }
  const created = await prisma.capitalGiroState.create({
    data: { obras: input.obras, premissas: input.premissas },
  });
  return { obras: created.obras, premissas: created.premissas };
}
