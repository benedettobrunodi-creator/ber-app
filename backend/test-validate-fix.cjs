const { z } = require('zod');
const OBRA_STATUSES = ['planejamento', 'em_andamento', 'pausada', 'concluida', 'cancelada'];

const updateObraSchema = z.object({
  name: z.string().min(2).optional(),
  client: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(OBRA_STATUSES).optional(),
  startDate: z.string().datetime().optional().nullable(),
  expectedEndDate: z.string().datetime().optional().nullable(),
  dataInicioObra: z.string().optional().nullable(),
  dataFimObra: z.string().optional().nullable(),
  valorContrato: z.number().positive().optional().nullable(),
  arquiteturaEscritorio: z.string().optional().nullable(),
  gerenciadora: z.string().optional().nullable(),
  areaM2: z.number().positive().optional().nullable(),
});

const body = {
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

const r = updateObraSchema.safeParse(body);
console.log(r.success ? 'FIX OK: schema agora aceita nulls' : JSON.stringify(r.error.errors, null, 2));
