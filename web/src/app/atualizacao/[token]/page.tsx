'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

const CLIMA_LABEL: Record<string, string> = {
  sol: 'Ensolarado',
  parcialmente_nublado: 'Parcialmente nublado',
  nublado: 'Nublado',
  chuva: 'Chuva',
  tempestade: 'Tempestade',
};

const CONDICAO_LABEL: Record<string, string> = {
  normal: 'Normal',
  parcial: 'Parcial',
  interrompido: 'Interrompido',
};

const CLIMA_ICON: Record<string, string> = {
  sol: '☀️',
  parcialmente_nublado: '⛅',
  nublado: '☁️',
  chuva: '🌧️',
  tempestade: '⛈️',
};

const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  parcial: 'Parcial',
};

const STATUS_COLOR: Record<string, string> = {
  em_andamento: 'bg-blue-100 text-blue-800',
  concluida: 'bg-green-100 text-green-800',
  parcial: 'bg-amber-100 text-amber-800',
};

const OCORRENCIA_TIPO_LABEL: Record<string, string> = {
  incidente: 'Incidente',
  imprevisto: 'Imprevisto',
  atraso: 'Atraso',
  qualidade: 'Qualidade',
  seguranca: 'Segurança',
  outro: 'Outro',
};

const VISITA_TIPO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  fiscalizacao: 'Fiscalização',
  fornecedor: 'Fornecedor',
  projetista: 'Projetista',
  outro: 'Outro',
};

interface Foto {
  id: string;
  fileUrl: string;
  legenda: string | null;
  ordem: number;
}

interface Atividade {
  descricao: string;
  status: string;
}

interface Ocorrencia {
  tipo: string;
  descricao: string;
}

interface Visita {
  tipo: string;
  nome: string | null;
  observacao: string | null;
}

interface DiarioPublico {
  obraNome: string;
  clienteNome: string | null;
  data: string;
  clima: string | null;
  condicaoTrabalho: string | null;
  avancoDia: number | null;
  observacoesCliente: string | null;
  totalEfetivos: number;
  fotos: Foto[];
  atividades: Atividade[];
  ocorrencias: Ocorrencia[];
  visitas: Visita[];
}

export default function AtualizacaoPage() {
  const { token } = useParams<{ token: string }>();
  const [diario, setDiario] = useState<DiarioPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fotoIdx, setFotoIdx] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/diario/publico/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then((j) => setDiario(j.data))
      .catch(() => setError('Atualização não encontrada ou ainda não disponível.'));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <BerLogo />
        <p className="mt-8 text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!diario) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50">
        <BerLogo />
        <p className="mt-6 text-xs text-gray-400 animate-pulse">Carregando…</p>
      </div>
    );
  }

  const dataFmt = new Date(diario.data).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const fotos = diario.fotos;

  return (
    <div className="min-h-dvh bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 pt-safe pt-4 pb-4">
        <BerLogo />
        <h1 className="mt-3 text-lg font-bold text-gray-900 leading-tight">{diario.obraNome}</h1>
        {diario.clienteNome && (
          <p className="text-sm text-gray-500">{diario.clienteNome}</p>
        )}
        <p className="mt-1 text-sm text-gray-400 capitalize">{dataFmt}</p>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-5 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          {diario.totalEfetivos > 0 && (
            <KpiCard
              icon="👷"
              label="Profissionais"
              value={String(diario.totalEfetivos)}
            />
          )}
          {diario.avancoDia != null && (
            <KpiCard
              icon="📈"
              label="Avanço do dia"
              value={`${diario.avancoDia}%`}
            />
          )}
          {diario.clima && (
            <KpiCard
              icon={CLIMA_ICON[diario.clima] ?? '🌤️'}
              label="Clima"
              value={CLIMA_LABEL[diario.clima] ?? diario.clima}
            />
          )}
          {diario.condicaoTrabalho && (
            <KpiCard
              icon="🏗️"
              label="Condição"
              value={CONDICAO_LABEL[diario.condicaoTrabalho] ?? diario.condicaoTrabalho}
            />
          )}
        </div>

        {/* Avanço bar */}
        {diario.avancoDia != null && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-2">Progresso do dia</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${diario.avancoDia}%` }}
                />
              </div>
              <span className="text-sm font-bold text-green-700 w-10 text-right">
                {diario.avancoDia}%
              </span>
            </div>
          </div>
        )}

        {/* Fotos carrossel */}
        {fotos.length > 0 && (
          <section>
            <SectionTitle>Fotos</SectionTitle>
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotos[fotoIdx].fileUrl}
                alt={fotos[fotoIdx].legenda ?? `Foto ${fotoIdx + 1}`}
                className="w-full h-full object-cover"
              />
              {fotos.length > 1 && (
                <>
                  <button
                    aria-label="Foto anterior"
                    onClick={() => setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg"
                  >
                    ‹
                  </button>
                  <button
                    aria-label="Próxima foto"
                    onClick={() => setFotoIdx((i) => (i + 1) % fotos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {fotos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setFotoIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === fotoIdx ? 'bg-white scale-125' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {fotos[fotoIdx].legenda && (
              <p className="mt-2 text-xs text-gray-500 text-center px-2">{fotos[fotoIdx].legenda}</p>
            )}
            {fotos.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {fotos.map((f, i) => (
                  <button
                    key={f.id}
                    onClick={() => setFotoIdx(i)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${i === fotoIdx ? 'border-green-500' : 'border-transparent'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.fileUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Atividades */}
        {diario.atividades.length > 0 && (
          <section>
            <SectionTitle>Atividades</SectionTitle>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
              {diario.atividades.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                  <p className="text-sm text-gray-800 flex-1">{a.descricao}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Observações */}
        {diario.observacoesCliente && (
          <section>
            <SectionTitle>Observações</SectionTitle>
            <div className="bg-white rounded-2xl shadow-sm px-4 py-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{diario.observacoesCliente}</p>
            </div>
          </section>
        )}

        {/* Ocorrências */}
        {diario.ocorrencias.length > 0 && (
          <section>
            <SectionTitle>Ocorrências</SectionTitle>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
              {diario.ocorrencias.map((o, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-xs font-semibold text-amber-600 mb-0.5">
                    {OCORRENCIA_TIPO_LABEL[o.tipo] ?? o.tipo}
                  </p>
                  <p className="text-sm text-gray-700">{o.descricao}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Visitas */}
        {diario.visitas.length > 0 && (
          <section>
            <SectionTitle>Visitas</SectionTitle>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
              {diario.visitas.map((v, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">
                    {VISITA_TIPO_LABEL[v.tipo] ?? v.tipo}
                    {v.nome ? ` — ${v.nome}` : ''}
                  </p>
                  {v.observacao && (
                    <p className="text-sm text-gray-700">{v.observacao}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-4">
          <p className="text-xs text-gray-300">Atualização enviada por BÈR Engenharia</p>
        </footer>
      </main>
    </div>
  );
}

function BerLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
        <span className="text-white text-xs font-bold tracking-tight">BÈR</span>
      </div>
      <span className="text-sm font-semibold text-gray-700">BÈR Engenharia</span>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
      {children}
    </h2>
  );
}
