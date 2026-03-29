/**
 * FVS Auto-Provisioning
 * Cria automaticamente FVS para etapas de um sequenciamento,
 * matcheando a disciplina da etapa com o template FVS.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapa de palavras-chave de disciplina → code do template FVS
const DISCIPLINE_MAP: Record<string, string[]> = {
  'elétrica':       ['FVS_3A', 'FVS_3B'],
  'eletrica':       ['FVS_3A', 'FVS_3B'],
  'electrical':     ['FVS_3A', 'FVS_3B'],
  'cabeamento':     ['FVS_4'],
  'dados':          ['FVS_4'],
  'network':        ['FVS_4'],
  'hidráulica':     ['FVS_5'],
  'hidraulica':     ['FVS_5'],
  'plumbing':       ['FVS_5'],
  'sprinkler':      ['FVS_6'],
  'sdai':           ['FVS_7'],
  'detecção':       ['FVS_7'],
  'incêndio':       ['FVS_7'],
  'hvac':           ['FVS_8'],
  'ar condicionado':['FVS_8'],
  'climatização':   ['FVS_8'],
  'drywall':        ['FVS_9'],
  'vedação':        ['FVS_9'],
  'forro':          ['FVS_10'],
  'impermeabilização': ['FVS_11'],
  'impermeab':      ['FVS_11'],
  'revestimento':   ['FVS_12'],
  'piso':           ['FVS_12'],
  'pintura':        ['FVS_13'],
  'marcenaria':     ['FVS_14'],
  'pedras':         ['FVS_15'],
  'bancadas':       ['FVS_15'],
  'vidros':         ['FVS_16'],
  'esquadrias':     ['FVS_16'],
  'divisórias':     ['FVS_17'],
  'divisorias':     ['FVS_17'],
  'limpeza':        ['FVS_18'],
  'mobilização':    ['FVS_0'],
  'mobilizacao':    ['FVS_0'],
  'canteiro':       ['FVS_0'],
  'demolição':      ['FVS_1'],
  'demolicao':      ['FVS_1'],
  'vistoria':       ['FVS_2'],
  'marcações':      ['FVS_2B'],
  'marcacoes':      ['FVS_2B'],
  'layout':         ['FVS_2B'],
};

/**
 * Para uma lista de etapas, detecta qual template FVS corresponde
 * baseado na disciplina/nome da etapa.
 */
function detectTemplateCodes(etapaName: string, etapaDiscipline: string | null): string[] {
  const haystack = `${etapaName} ${etapaDiscipline ?? ''}`.toLowerCase();
  const codes = new Set<string>();
  for (const [keyword, fvsCodes] of Object.entries(DISCIPLINE_MAP)) {
    if (haystack.includes(keyword.toLowerCase())) {
      fvsCodes.forEach(c => codes.add(c));
    }
  }
  return [...codes];
}

/**
 * Provisiona FVS automaticamente para todas as etapas de uma obra.
 * Pula etapas que já têm FVS ou para as quais não há template matching.
 * Retorna o número de FVS criadas.
 */
export async function autoProvisionFvs(obraId: string): Promise<{ created: number; skipped: number }> {
  // Buscar todas as etapas da obra
  const etapas = await prisma.obraEtapa.findMany({
    where: { obraId },
  });

  // Buscar FVS já existentes para esta obra
  const existingFvs = await prisma.obraFvs.findMany({
    where: { obraId },
    select: { etapaId: true },
  });
  const existingEtapaIds = new Set(existingFvs.map(f => f.etapaId).filter(Boolean));

  // Buscar todos os templates
  const templates = await prisma.fvsTemplate.findMany({
    include: { items: { orderBy: { ordem: 'asc' } } },
  });
  const templatesByCode = new Map(templates.map(t => [t.code, t]));

  let created = 0;
  let skipped = 0;

  for (const etapa of etapas) {
    // Skip se já tem FVS
    if (existingEtapaIds.has(etapa.id)) { skipped++; continue; }

    const codes = detectTemplateCodes(etapa.name, etapa.discipline);
    if (codes.length === 0) { skipped++; continue; }

    // Usar o primeiro template que fizer match
    const template = templatesByCode.get(codes[0]);
    if (!template) { skipped++; continue; }

    await prisma.obraFvs.create({
      data: {
        obraId,
        etapaId: etapa.id,
        templateId: template.id,
        status: 'pendente',
        items: {
          create: template.items.map(item => ({
            templateItemId: item.id,
            momento: item.momento,
            checked: false,
            na: false,
          })),
        },
      },
    });
    created++;
  }

  console.log(`[FVS AutoProvision] obra=${obraId} created=${created} skipped=${skipped}`);
  return { created, skipped };
}

export { prisma as fvsPrisma };
