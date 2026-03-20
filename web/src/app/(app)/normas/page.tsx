'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Search, ExternalLink, BookOpen, Globe } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const DISCIPLINE_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'hidraulica', label: 'Hidráulica' },
  { value: 'estrutura', label: 'Estrutura' },
  { value: 'impermeabilizacao', label: 'Impermeabilização' },
  { value: 'revestimento', label: 'Revestimento' },
  { value: 'acabamento', label: 'Acabamento' },
  { value: 'seguranca', label: 'Segurança' },
];

const DISCIPLINE_COLORS: Record<string, string> = {
  estrutura: 'bg-gray-100 text-gray-700',
  hidraulica: 'bg-blue-100 text-blue-700',
  eletrica: 'bg-amber-100 text-amber-700',
  impermeabilizacao: 'bg-teal-100 text-teal-700',
  revestimento: 'bg-purple-100 text-purple-700',
  acabamento: 'bg-ber-olive/15 text-ber-olive',
  seguranca: 'bg-red-100 text-red-600',
};

const DISCIPLINE_LABELS: Record<string, string> = {
  estrutura: 'Estrutura',
  hidraulica: 'Hidráulica',
  eletrica: 'Elétrica',
  impermeabilizacao: 'Impermeabilização',
  revestimento: 'Revestimento',
  acabamento: 'Acabamento',
  seguranca: 'Segurança',
};

const SOURCE_COLORS: Record<string, string> = {
  abnt: 'bg-blue-50 text-blue-700',
  sinapi: 'bg-green-50 text-green-700',
  interno: 'bg-ber-gray/10 text-ber-gray',
};

const SOURCE_LABELS: Record<string, string> = {
  abnt: 'ABNT', sinapi: 'SINAPI', interno: 'Interno',
  ABNT: 'ABNT', IBAPE: 'IBAPE', 'Gov.br': 'Gov.br', Web: 'Web',
};

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Norma {
  id: string;
  code: string;
  title: string;
  discipline: string;
  summary: string | null;
  source: string;
  url: string | null;
}

interface ExternalResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NormasPage() {
  const [normas, setNormas] = useState<Norma[]>([]);
  const [loadingNormas, setLoadingNormas] = useState(true);
  const [normaSearch, setNormaSearch] = useState('');
  const [normaDiscipline, setNormaDiscipline] = useState('');
  const [externalQuery, setExternalQuery] = useState('');
  const [externalResults, setExternalResults] = useState<ExternalResult[]>([]);
  const [searchingExternal, setSearchingExternal] = useState(false);
  const [hasSearchedExternal, setHasSearchedExternal] = useState(false);

  const fetchNormas = useCallback(async () => {
    setLoadingNormas(true);
    try {
      const params: Record<string, string> = {};
      if (normaDiscipline) params.discipline = normaDiscipline;
      if (normaSearch) params.search = normaSearch;
      const res = await api.get('/normas', { params });
      setNormas(res.data.data);
    } catch {} finally { setLoadingNormas(false); }
  }, [normaDiscipline, normaSearch]);

  useEffect(() => {
    const timeout = setTimeout(fetchNormas, 300);
    return () => clearTimeout(timeout);
  }, [fetchNormas]);

  async function handleExternalSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!externalQuery.trim()) return;
    setSearchingExternal(true);
    setHasSearchedExternal(true);
    try {
      const res = await api.get('/normas/search-external', { params: { q: externalQuery } });
      setExternalResults(res.data.data);
    } catch { setExternalResults([]); }
    finally { setSearchingExternal(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-ber-carbon">Normas Técnicas</h1>
      <p className="mt-1 text-sm text-ber-gray">
        Biblioteca de normas e regulamentos técnicos
      </p>

      {/* Search bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ber-gray" />
          <input type="text" value={normaSearch} onChange={(e) => setNormaSearch(e.target.value)}
            placeholder="Buscar por código, título ou conteúdo..."
            className="w-full rounded-lg border border-ber-gray/20 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DISCIPLINE_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setNormaDiscipline(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${normaDiscipline === f.value ? 'bg-ber-carbon text-white' : 'bg-white text-ber-gray shadow-sm hover:bg-ber-offwhite'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Normas list */}
      <div className="mt-6">
        {loadingNormas ? (
          <p className="py-12 text-center text-sm text-ber-gray">Carregando normas...</p>
        ) : normas.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <BookOpen size={40} className="mb-3 text-ber-gray/30" />
            <p className="text-sm text-ber-gray">Nenhuma norma encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {normas.map((norma) => {
              const discColor = DISCIPLINE_COLORS[norma.discipline] || 'bg-gray-100 text-gray-600';
              const discLabel = DISCIPLINE_LABELS[norma.discipline] || norma.discipline;
              const srcColor = SOURCE_COLORS[norma.source] || SOURCE_COLORS.interno;
              const srcLabel = SOURCE_LABELS[norma.source] || norma.source;
              return (
                <div key={norma.id} className="rounded-lg bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-ber-carbon">{norma.code}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${discColor}`}>{discLabel}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${srcColor}`}>{srcLabel}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-ber-carbon">{norma.title}</p>
                      {norma.summary && <p className="mt-2 text-xs leading-relaxed text-ber-gray line-clamp-3">{norma.summary}</p>}
                    </div>
                    {norma.url && (
                      <a href={norma.url} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 rounded-md border border-ber-gray/20 p-2 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-teal" title="Abrir fonte externa">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* External search */}
      <div className="mt-10 border-t border-ber-gray/15 pt-8">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-ber-teal" />
          <h2 className="text-lg font-black text-ber-carbon">Busca Externa</h2>
        </div>
        <p className="mt-1 text-sm text-ber-gray">Pesquise normas ABNT, IBAPE e regulamentações em fontes externas</p>
        <form onSubmit={handleExternalSearch} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ber-gray" />
            <input type="text" value={externalQuery} onChange={(e) => setExternalQuery(e.target.value)}
              placeholder="Ex: impermeabilização laje, instalação elétrica residencial..."
              className="w-full rounded-lg border border-ber-gray/20 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
          </div>
          <button type="submit" disabled={searchingExternal || !externalQuery.trim()}
            className="rounded-lg bg-ber-carbon px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50">
            {searchingExternal ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
        {hasSearchedExternal && (
          <div className="mt-4">
            {searchingExternal ? (
              <p className="py-8 text-center text-sm text-ber-gray">Pesquisando fontes externas...</p>
            ) : externalResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-ber-gray">Nenhum resultado encontrado.</p>
            ) : (
              <div className="space-y-2">
                {externalResults.map((result, idx) => (
                  <a key={idx} href={result.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                    <ExternalLink size={14} className="mt-0.5 shrink-0 text-ber-teal" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ber-carbon">{result.title}</p>
                        <span className="rounded-full bg-ber-teal/10 px-2 py-0.5 text-[10px] font-semibold text-ber-teal">
                          {SOURCE_LABELS[result.source] || result.source}
                        </span>
                      </div>
                      {result.snippet && <p className="mt-1 text-xs text-ber-gray line-clamp-2">{result.snippet}</p>}
                      {result.url && <p className="mt-1 truncate text-[10px] text-ber-teal/60">{result.url}</p>}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
