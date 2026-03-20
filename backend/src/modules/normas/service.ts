import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

// ─── Internal library search ───────────────────────────────────────────────

export async function listNormas(filters?: { discipline?: string; search?: string }) {
  const where: any = {};

  if (filters?.discipline) {
    where.discipline = filters.discipline;
  }

  if (filters?.search) {
    const term = filters.search;
    where.OR = [
      { code: { contains: term, mode: 'insensitive' } },
      { title: { contains: term, mode: 'insensitive' } },
      { summary: { contains: term, mode: 'insensitive' } },
    ];
  }

  return prisma.normaTecnica.findMany({
    where,
    orderBy: [{ discipline: 'asc' }, { code: 'asc' }],
  });
}

export async function getById(id: string) {
  const norma = await prisma.normaTecnica.findUnique({ where: { id } });
  if (!norma) throw AppError.notFound('Norma técnica');
  return norma;
}

// ─── External search ───────────────────────────────────────────────────────

interface ExternalResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export async function searchExternal(query: string): Promise<ExternalResult[]> {
  const results: ExternalResult[] = [];

  // Try Google Custom Search API if configured
  const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const googleCx = process.env.GOOGLE_SEARCH_CX;

  if (googleApiKey && googleCx) {
    try {
      const searchQuery = `${query} site:abnt.org.br OR site:ibape.org.br OR site:gov.br/trabalho-e-emprego`;
      const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleApiKey)}&cx=${encodeURIComponent(googleCx)}&q=${encodeURIComponent(searchQuery)}&num=10`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json() as { items?: { title?: string; link?: string; snippet?: string }[] };
        if (data.items) {
          for (const item of data.items) {
            results.push({
              title: item.title || '',
              url: item.link || '',
              snippet: item.snippet || '',
              source: extractSource(item.link || ''),
            });
          }
        }
        return results;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: search internal database with broader matching and return as external results
  const internalResults = await prisma.normaTecnica.findMany({
    where: {
      OR: [
        { code: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
        { discipline: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { code: 'asc' },
    take: 20,
  });

  for (const norma of internalResults) {
    results.push({
      title: `${norma.code} — ${norma.title}`,
      url: norma.url || '',
      snippet: norma.summary || '',
      source: norma.source,
    });
  }

  return results;
}

function extractSource(url: string): string {
  if (url.includes('abnt.org.br')) return 'ABNT';
  if (url.includes('ibape.org.br')) return 'IBAPE';
  if (url.includes('gov.br')) return 'Gov.br';
  if (url.includes('caixa.gov.br')) return 'SINAPI';
  return 'Web';
}
