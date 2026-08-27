'use client';

/**
 * Fechamento de Folha por centro de custo (27/08/26).
 * Matriz pessoa × obra × horas + extras, pendências antes de fechar,
 * fechar mês (congela) e export CSV.
 */

import { useCallback, useEffect, useState } from 'react';
import { Lock, Unlock, FileDown, AlertTriangle, CalendarDays } from 'lucide-react';
import api from '@/lib/api';
import HorasTabs from '@/components/HorasTabs';

interface PorObra { obraId: string | null; obraNome: string; minutos: number }
interface UsuarioLinha {
  userId: string; nome: string; porObra: PorObra[];
  totalMinutos: number; minutosExtras: number; diasIncompletos: string[]; minutosSemObra: number;
}
interface Preview {
  competencia: string;
  fechado: { id: string; fechadoEm: string; status: string } | null;
  usuarios: UsuarioLinha[];
  obras: { obraId: string | null; nome: string }[];
  pendencias: { userId: string; nome: string; tipo: string; detalhe: string }[];
}

function h(min: number): string {
  if (!min) return '—';
  return (min / 60).toFixed(1).replace('.', ',');
}
function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FolhaPage() {
  const [competencia, setCompetencia] = useState(mesAtual());
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const r = await api.get<{ data: Preview }>(`/folha/preview?competencia=${competencia}`);
      setData(r.data.data);
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(m || 'Erro ao carregar (verifique sua permissão — folha é financeiro/diretoria)');
      setData(null);
    } finally { setLoading(false); }
  }, [competencia]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true); setErro(null);
    try { await fn(); await load(); }
    catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(m || msg);
    } finally { setBusy(false); }
  }

  async function baixarCsv() {
    try {
      const r = await api.get(`/folha/export?competencia=${competencia}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `folha-${competencia}.csv`; a.click();
    } catch { setErro('Erro ao exportar'); }
  }

  const fechado = data?.fechado?.status === 'fechado';

  return (
    <div className="p-4 md:p-6 w-full max-w-[1500px]">
      <HorasTabs />
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Fechamento de Folha</h1>
          {fechado && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-ber-green text-white">MÊS FECHADO</span>}
          {data?.fechado?.status === 'reaberto' && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-ber-amber text-white">REABERTO</span>}
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="text-sm px-3 py-2 border border-ber-border rounded-lg bg-white focus:outline-none" />
          <button onClick={baixarCsv} disabled={busy || !data} className="inline-flex items-center gap-1.5 text-sm font-semibold border border-ber-border bg-white rounded-lg px-3 py-2 hover:bg-ber-surface disabled:opacity-50">
            <FileDown size={15} /> CSV
          </button>
          {fechado ? (
            <button onClick={() => { if (confirm('Reabrir a competência? (só diretoria)')) run(() => api.post('/folha/reabrir', { competencia }), 'Sem permissão pra reabrir'); }} disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm font-semibold border border-ber-amber text-ber-amber bg-white rounded-lg px-3 py-2 hover:bg-amber-50 disabled:opacity-50">
              <Unlock size={15} /> Reabrir
            </button>
          ) : (
            <button
              onClick={() => {
                const pend = data?.pendencias.length ?? 0;
                const msg = pend > 0 ? `Existem ${pend} pendência(s). Fechar mesmo assim?` : 'Fechar a competência? Os números serão congelados.';
                if (confirm(msg)) run(() => api.post('/folha/fechar', { competencia }), 'Sem permissão pra fechar (diretoria)');
              }}
              disabled={busy || !data}
              className="inline-flex items-center gap-1.5 text-sm font-bold bg-ber-carbon text-white rounded-lg px-3.5 py-2 hover:opacity-90 disabled:opacity-50">
              <Lock size={15} /> Fechar mês
            </button>
          )}
        </div>
      </div>

      {erro && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle size={15} /> {erro}</div>}

      {data && data.pendencias.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-900 mb-1.5">⚠ Pendências antes de fechar ({data.pendencias.length})</p>
          {data.pendencias.map((p, i) => (
            <p key={i} className="text-[12px] text-amber-800">
              • <strong>{p.nome}</strong>: {p.tipo === 'batida_incompleta' ? 'batidas incompletas' : 'horas sem obra'} — {p.detalhe}
              {p.tipo === 'batida_incompleta' && <span className="text-amber-700"> → corrigir no Banco de Horas (Ajustes)</span>}
            </p>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : !data || data.usuarios.length === 0 ? (
        <div className="bg-white border border-ber-border rounded-xl p-10 text-center text-sm text-ber-gray">Nenhuma hora apontada nesta competência.</div>
      ) : (
        <div className="bg-white border border-ber-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ber-gray bg-ber-surface border-b border-ber-border">
                <th className="text-left px-3 py-2.5 font-bold sticky left-0 bg-ber-surface">Colaborador</th>
                {data.obras.map((o) => (
                  <th key={o.obraId ?? 'null'} className="text-right px-3 py-2.5 font-bold whitespace-nowrap max-w-[140px] truncate" title={o.nome}>{o.nome}</th>
                ))}
                <th className="text-right px-3 py-2.5 font-bold bg-ber-card">Total (h)</th>
                <th className="text-right px-3 py-2.5 font-bold text-amber-700">Extras (h)</th>
              </tr>
            </thead>
            <tbody>
              {data.usuarios.map((u) => {
                const porObraMap = new Map(u.porObra.map((po) => [po.obraId, po.minutos]));
                return (
                  <tr key={u.userId} className="border-b border-ber-border/60 last:border-b-0 hover:bg-ber-surface/50">
                    <td className="px-3 py-2.5 font-medium text-ber-carbon whitespace-nowrap sticky left-0 bg-white">
                      {u.nome}
                      {u.diasIncompletos.length > 0 && <span className="ml-1.5 text-red-600" title={`${u.diasIncompletos.length} dia(s) incompletos`}>⚠</span>}
                    </td>
                    {data.obras.map((o) => (
                      <td key={o.obraId ?? 'null'} className="px-3 py-2.5 text-right tabular-nums text-[13px] text-ber-carbon">{h(porObraMap.get(o.obraId) ?? 0)}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold bg-ber-card">{h(u.totalMinutos)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-700">{h(u.minutosExtras)}</td>
                  </tr>
                );
              })}
              <tr className="bg-ber-surface font-bold border-t border-ber-border">
                <td className="px-3 py-2.5 sticky left-0 bg-ber-surface">TOTAL</td>
                {data.obras.map((o) => (
                  <td key={o.obraId ?? 'null'} className="px-3 py-2.5 text-right tabular-nums">
                    {h(data.usuarios.reduce((s, u) => s + (u.porObra.find((po) => po.obraId === o.obraId)?.minutos ?? 0), 0))}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right tabular-nums bg-ber-card">{h(data.usuarios.reduce((s, u) => s + u.totalMinutos, 0))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{h(data.usuarios.reduce((s, u) => s + u.minutosExtras, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-ber-gray mt-3">
        Rateio: cada intervalo de ponto vai pra obra do check-in; ajustes manuais do dia são distribuídos proporcionalmente entre as obras daquele dia.
        Horas em "Sem obra / Interno" = batidas sem obra selecionada. Extras = domingos, feriados e estouro do teto do banco (24h).
      </p>
    </div>
  );
}
