import { z } from 'zod';

// Estado é intencionalmente livre (array/objeto genérico) — o simulador
// evolui os campos de cada obra/premissa no front sem exigir migração
// de schema toda vez. Só validamos a forma geral (array + objeto).
export const updateStateSchema = z.object({
  obras: z.array(z.record(z.string(), z.any())),
  premissas: z.record(z.string(), z.any()),
});

export type UpdateStateInput = z.infer<typeof updateStateSchema>;
