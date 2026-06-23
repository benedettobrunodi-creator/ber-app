const { z } = require('zod');
const OBRA_STATUSES = ['planejamento', 'em_andamento', 'pausada', 'concluida', 'cancelada'];

const updateObraSchema = z.object({
  name: z.string().min(2).optional(),
  client: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(OBRA_STATUSES).optional(),
  startDate: z.string().datetime().optional().nullable(),
  expectedEndDate: z.string().datetime().optional().nullable(),
  actualEndDate: z.string().datetime().optional().nullable(),
  progressPercent: z.number().min(0).max(100).optional(),
  coordinatorId: z.string().uuid().optional(),
  dataInicioProjeto: z.string().optional().nullable(),
  dataFimProjeto: z.string().optional().nullable(),
  dataInicioObra: z.string().optional().nullable(),
  dataFimObra: z.string().optional().nullable(),
  valorContrato: z.number().positive().optional().nullable(),
  situacaoAtual: z.string().optional().nullable(),
  arquiteturaEscritorio: z.string().optional().nullable(),
  gerenciadora: z.string().optional().nullable(),
  areaM2: z.number().positive().optional().nullable(),
});

// Test 1: client null (frontend sends null when empty)
const body1 = {
  client: null,
  address: null,
  arquiteturaEscritorio: null,
  gerenciadora: null,
  startDate: '2026-06-21T03:00:00.000Z',
  expectedEndDate: '2026-07-30T03:00:00.000Z',
  dataInicioObra: null,
  dataFimObra: null,
  areaM2: null,
  valorContrato: null,
};

const r1 = updateObraSchema.safeParse(body1);
console.log('TEST 1 — fields with null when empty:');
console.log(r1.success ? '✓ valid' : JSON.stringify(r1.error.errors, null, 2));
console.log();

// Test 2: filled normal
const body2 = {
  client: 'ITX',
  address: 'Rua X',
  startDate: '2026-06-21T03:00:00.000Z',
  dataInicioObra: '2026-06-21',
};

const r2 = updateObraSchema.safeParse(body2);
console.log('TEST 2 — partial filled:');
console.log(r2.success ? '✓ valid' : JSON.stringify(r2.error.errors, null, 2));
