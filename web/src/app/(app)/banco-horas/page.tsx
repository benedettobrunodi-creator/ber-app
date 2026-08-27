'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timer, Plus, X, CalendarClock, Wallet, PartyPopper, Pencil, PlayCircle } from 'lucide-react';
import api from '@/lib/api';
import HorasTabs from '@/components/HorasTabs';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';

/* ─── Types ─── */
interface PainelRow {
  userId: string; nome: string; saldoMinutos: number; saldoHoras: number;
  loteMaisAntigo: string | null; expiraEm: string | null; idadeDias: number;
  cor: 'verde' | 'amarelo' | 'laranja' | 'vermelho';
}
interface Feriado { id: string; data: string; nome: string; tipo: string; ativo: boolean }
interface Ajuste {
  id: string; data: string; minutosOriginais: number | null; minutosAjustados: number; motivo: string;
  user: { id: string; name: string }; ajustadoPor: { id: string; name: string };
}
interface Extra {
  id: string; data: string; minutos: number; motivo: string; pago: boolean;
  user: { id: string; name: string };
}
interface Lote {
  id: string; data: string; minutosCredito: number; minutosConsumidos: number;
  dataExpiracao: string; status: string;
}

const COR_META: Record<string, { label: string; cls: string }> = {
  verde: { label: 'Ok', cls: 'bg-green-100 text-green-700' },
  amarelo: { label: '~3 meses', cls: 'bg-yellow-100 text-yellow-700' },
  laranja: { label: '~5 meses — planeje', cls: 'bg-orange-100 text-orange-700' },
  vermelho: { label: 'Urgente (perto de vencer/teto)', cls: 'bg-red-100 text-red-700' },
};
const MOTIVO_EXTRA_LABEL: Record<string, string> = {
  domingo: 'Domingo', feriado: 'Feriado', teto_banco_atingido: 'Teto do banco atingido',
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
const fmtHoras = (min: number) => `${Math.round((min / 60) * 10) / 10}h`;
const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

const TABS = ['painel', 'feriados', 'ajustes', 'extras'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { painel: 'Painel', feriados: 'Feriados', ajustes: 'Ajustes', extras: 'Horas Extras' };

export default function BancoHorasPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canView = user ? getUserPermissions(user).bancoHoras === true : false;
  useEffect(() => { if (user && !canView) router.replace('/'); }, [user, canView, router]);

  const [tab, setTab] = useState<Tab>('painel');
  const [painel, setPainel] = useState<PainelRow[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const [showConsumir, setShowConsumir] = useState<PainelRow | null>(null);
  const [showLotes, setShowLotes] = useState<PainelRow | null>(null);
  const [showFeriadoForm, setShowFeriadoForm] = useState(false);
  const [showAjusteForm, setShowAjusteForm] = useState<false | { userId?: string }>(false);
  const [showProcessar, setShowProcessar] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
    Promise.all([
      api.get<{ data: PainelRow[] }>('/banco-horas/painel'),
      api.get<{ data: Feriado[] }>('/banco-horas/feriados'),
      api.get<{ data: Ajuste[] }>(`/banco-horas/ajustes?startDate=${inicioMes}&endDate=${fimMes}`),
      api.get<{ data: Extra[] }>('/banco-horas/extras?pago=false'),
      api.get<{ data: { id: string; name: string }[] }>('/users/responsaveis'),
    ]).then(([p, f, a, e, u]) => {
      setPainel(p.data.data);
      setFeriados(f.data.data);
      setAjustes(a.data.data);
      setExtras(e.data.data);
      setUsers(u.data.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteFeriado(id: string) {
    if (!confirm('Remover este feriado?')) return;
    try { await api.delete(`/banco-horas/feriados/${id}`); load(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  async function handleMarcarPago(id: string, pago: boolean) {
    try { await api.patch(`/banco-horas/extras/${id}`, { pago }); load(); }
    catch (err) { alert(errMsg(err, 'Erro ao atualizar')); }
  }

  if (!user || !canView) return null;

  return (
    <div className="p-4 md:p-6">
      <HorasTabs />
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Timer size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Banco de Horas</h1>
        </div>
        <button onClick={() => setShowProcessar(true)} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <PlayCircle size={14} /> Processar período
        </button>
      </div>

      <div className="mb-5 flex gap-1 border-b border-ber-gray/20">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === t ? 'border-ber-teal text-ber-carbon' : 'border-transparent text-ber-gray hover:text-ber-carbon'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : tab === 'painel' ? (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left">Colaborador</th>
                <th className="px-3 py-3 text-center">Saldo</th>
                <th className="px-3 py-3 text-center">Crédito mais antigo</th>
                <th className="px-3 py-3 text-center">Expira em</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 w-40"></th>
              </tr>
            </thead>
            <tbody>
              {painel.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-ber-gray">Nenhum saldo em aberto — ninguém acumulando banco de horas agora.</td></tr>
              ) : painel.map((r) => (
                <tr key={r.userId} className="border-t border-ber-gray/10 hover:bg-ber-bg/40">
                  <td className="px-3 py-2.5 font-medium text-ber-carbon">{r.nome}</td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-ber-carbon">{r.saldoHoras}h</td>
                  <td className="px-3 py-2.5 text-center text-xs text-ber-gray">{fmtDate(r.loteMaisAntigo)} ({r.idadeDias}d)</td>
                  <td className="px-3 py-2.5 text-center text-xs text-ber-gray">{fmtDate(r.expiraEm)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR_META[r.cor].cls}`}>{COR_META[r.cor].label}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setShowAjusteForm({ userId: r.userId })} title="Corrigir horas trabalhadas deste colaborador" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                      <button onClick={() => setShowLotes(r)} title="Ver lotes" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><CalendarClock size={14} /></button>
                      <button onClick={() => setShowConsumir(r)} title="Registrar compensação" className="flex items-center gap-1 rounded bg-ber-teal/10 px-2 py-1 text-[11px] font-semibold text-ber-teal hover:bg-ber-teal/20"><Wallet size={12} /> Compensar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'feriados' ? (
        <div>
          <div className="mb-3 flex justify-end">
            <button onClick={() => setShowFeriadoForm(true)} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
              <Plus size={14} /> Novo feriado
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-ber-carbon text-xs text-white">
                <tr>
                  <th className="px-3 py-3 text-left">Data</th>
                  <th className="px-3 py-3 text-left">Nome</th>
                  <th className="px-3 py-3 text-left">Tipo</th>
                  <th className="px-3 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {feriados.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-sm text-ber-gray">Nenhum feriado cadastrado.</td></tr>
                ) : feriados.map((f) => (
                  <tr key={f.id} className="border-t border-ber-gray/10">
                    <td className="px-3 py-2.5">{fmtDate(f.data)}</td>
                    <td className="px-3 py-2.5 font-medium text-ber-carbon">{f.nome}</td>
                    <td className="px-3 py-2.5 capitalize text-ber-gray">{f.tipo}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => handleDeleteFeriado(f.id)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'ajustes' ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-ber-gray">Ajustes do mês atual — corrige um dia em que o ponto ficou errado ou não foi batido.</p>
            <button onClick={() => setShowAjusteForm({})} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
              <Pencil size={14} /> Corrigir dia
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-ber-carbon text-xs text-white">
                <tr>
                  <th className="px-3 py-3 text-left">Data</th>
                  <th className="px-3 py-3 text-left">Colaborador</th>
                  <th className="px-3 py-3 text-center">Original</th>
                  <th className="px-3 py-3 text-center">Ajustado</th>
                  <th className="px-3 py-3 text-left">Motivo</th>
                  <th className="px-3 py-3 text-left">Por</th>
                </tr>
              </thead>
              <tbody>
                {ajustes.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-ber-gray">Nenhum ajuste neste mês.</td></tr>
                ) : ajustes.map((a) => (
                  <tr key={a.id} className="border-t border-ber-gray/10">
                    <td className="px-3 py-2.5">{fmtDate(a.data)}</td>
                    <td className="px-3 py-2.5 font-medium text-ber-carbon">{a.user.name}</td>
                    <td className="px-3 py-2.5 text-center text-ber-gray">{a.minutosOriginais != null ? fmtHoras(a.minutosOriginais) : '—'}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-ber-carbon">{fmtHoras(a.minutosAjustados)}</td>
                    <td className="px-3 py-2.5 text-ber-gray">{a.motivo}</td>
                    <td className="px-3 py-2.5 text-xs text-ber-gray">{a.ajustadoPor.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left">Data</th>
                <th className="px-3 py-3 text-left">Colaborador</th>
                <th className="px-3 py-3 text-center">Horas</th>
                <th className="px-3 py-3 text-left">Motivo</th>
                <th className="px-3 py-3 text-center">Pago</th>
              </tr>
            </thead>
            <tbody>
              {extras.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-ber-gray">Nenhuma hora extra pendente de pagamento.</td></tr>
              ) : extras.map((e) => (
                <tr key={e.id} className="border-t border-ber-gray/10">
                  <td className="px-3 py-2.5">{fmtDate(e.data)}</td>
                  <td className="px-3 py-2.5 font-medium text-ber-carbon">{e.user.name}</td>
                  <td className="px-3 py-2.5 text-center font-semibold">{fmtHoras(e.minutos)}</td>
                  <td className="px-3 py-2.5 text-ber-gray">
                    <span className="inline-flex items-center gap-1">{e.motivo !== 'domingo' && e.motivo !== 'feriado' ? null : <PartyPopper size={12} />} {MOTIVO_EXTRA_LABEL[e.motivo] ?? e.motivo}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => handleMarcarPago(e.id, true)} className="rounded bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-100">Marcar pago</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showConsumir && (
        <ConsumirModal row={showConsumir} onClose={() => setShowConsumir(null)} onSaved={() => { setShowConsumir(null); load(); }} />
      )}
      {showLotes && (
        <LotesModal row={showLotes} onClose={() => setShowLotes(null)} />
      )}
      {showFeriadoForm && (
        <FeriadoModal onClose={() => setShowFeriadoForm(false)} onSaved={() => { setShowFeriadoForm(false); load(); }} />
      )}
      {showAjusteForm && (
        <AjusteModal users={users} initialUserId={showAjusteForm.userId} onClose={() => setShowAjusteForm(false)} onSaved={() => { setShowAjusteForm(false); load(); }} />
      )}
      {showProcessar && (
        <ProcessarModal onClose={() => setShowProcessar(false)} onSaved={() => { setShowProcessar(false); load(); }} />
      )}
    </div>
  );
}

/* ─── Modals ─── */
const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>{children}</div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConsumirModal({ row, onClose, onSaved }: { row: PainelRow; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const minutos = Math.round(Number(horas) * 60);
    if (!minutos || minutos <= 0) { setError('Informe as horas.'); return; }
    setSaving(true);
    try {
      await api.post('/banco-horas/consumir', { userId: row.userId, data, minutos, motivo: motivo.trim() || null });
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao registrar')); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Compensar — ${row.nome}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 px-6 py-5">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <p className="text-xs text-ber-gray">Saldo disponível: <b className="text-ber-carbon">{row.saldoHoras}h</b> — o débito abate sempre o crédito mais antigo primeiro.</p>
        <Field label="Data da folga/compensação"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} required /></Field>
        <Field label="Horas a debitar"><input type="number" step="0.5" min="0" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Ex: 4" className={inputCls} required /></Field>
        <Field label="Motivo / observação"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: saiu 4h mais cedo" className={inputCls} /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Salvando…' : 'Registrar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function LotesModal({ row, onClose }: { row: PainelRow; onClose: () => void }) {
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  useEffect(() => { api.get<{ data: Lote[] }>(`/banco-horas/lotes/${row.userId}`).then((r) => setLotes(r.data.data)); }, [row.userId]);
  return (
    <Modal title={`Lotes de crédito — ${row.nome}`} onClose={onClose}>
      <div className="px-6 py-5">
        {lotes === null ? (
          <p className="text-sm text-ber-gray">Carregando…</p>
        ) : lotes.length === 0 ? (
          <p className="text-sm text-ber-gray">Nenhum lote registrado.</p>
        ) : (
          <div className="space-y-2">
            {lotes.map((l) => (
              <div key={l.id} className="rounded-lg border border-ber-gray/15 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ber-carbon">{fmtDate(l.data)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${l.status === 'consumido' ? 'bg-ber-gray/20 text-ber-gray' : l.status === 'expirado' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{l.status}</span>
                </div>
                <p className="mt-1 text-xs text-ber-gray">{fmtHoras(l.minutosCredito)} creditado · {fmtHoras(l.minutosConsumidos)} consumido · expira {fmtDate(l.dataExpiracao)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function FeriadoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('nacional');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !nome.trim()) { setError('Preencha data e nome.'); return; }
    setSaving(true);
    try {
      await api.post('/banco-horas/feriados', { data, nome: nome.trim(), tipo });
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Novo Feriado" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 px-6 py-5">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} required /></Field>
        <Field label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Independência" className={inputCls} required /></Field>
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            <option value="nacional">Nacional</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
          </select>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AjusteModal({ users, initialUserId, onClose, onSaved }: { users: { id: string; name: string }[]; initialUserId?: string; onClose: () => void; onSaved: () => void }) {
  const [userId, setUserId] = useState(initialUserId || '');
  const [trocarColaborador, setTrocarColaborador] = useState(!initialUserId);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState('');
  const [motivo, setMotivo] = useState('');
  const [obraId, setObraId] = useState('');
  const [obras, setObras] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ minutosTrabalhados: number; incompleto: boolean } | null>(null);
  const nomeInicial = users.find((u) => u.id === initialUserId)?.name;

  useEffect(() => {
    setPreview(null);
    if (!userId || !data) return;
    api.get(`/banco-horas/dia?userId=${userId}&data=${data}`).then((r) => setPreview(r.data.data)).catch(() => {});
  }, [userId, data]);

  useEffect(() => {
    api.get('/time-entries/obras-disponiveis').then((r) => setObras(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) { setError('Selecione o colaborador.'); return; }
    if (!motivo.trim()) { setError('Informe o motivo do ajuste.'); return; }
    const minutosAjustados = Math.round(Number(horas) * 60);
    if (Number.isNaN(minutosAjustados) || minutosAjustados < 0) { setError('Informe as horas trabalhadas naquele dia.'); return; }
    setSaving(true);
    try {
      await api.post('/banco-horas/ajustes', { userId, data, minutosAjustados, motivo: motivo.trim(), obraId: obraId || null });
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Corrigir dia de ponto" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 px-6 py-5">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {trocarColaborador ? (
          <Field label="Colaborador">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls} required autoFocus={!initialUserId}>
              <option value="">Selecione…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Colaborador">
            <div className="mt-1 flex items-center justify-between rounded-md border border-ber-gray/30 bg-ber-bg px-3 py-2 text-sm">
              <span className="font-medium text-ber-carbon">{nomeInicial}</span>
              <button type="button" onClick={() => setTrocarColaborador(true)} className="text-xs font-semibold text-ber-teal hover:underline">trocar</button>
            </div>
          </Field>
        )}
        <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} required /></Field>
        {preview && (
          <p className="rounded-lg bg-ber-bg px-3 py-2 text-xs text-ber-gray">
            Ponto bruto hoje: <b className="text-ber-carbon">{fmtHoras(preview.minutosTrabalhados)}</b>
            {preview.incompleto && <span className="ml-1 text-amber-600 font-semibold">— batida incompleta</span>}
          </p>
        )}
        <Field label="Horas trabalhadas (corrigido)"><input type="number" step="0.5" min="0" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Ex: 8" className={inputCls} required autoFocus={!!initialUserId} /></Field>
        <Field label="Centro de custo (obra) — opcional">
          <select value={obraId} onChange={(e) => setObraId(e.target.value)} className={inputCls}>
            <option value="">Rateio automático pelas batidas do dia</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Motivo"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: esqueceu de bater o checkout" className={inputCls} required /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar ajuste'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProcessarModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(inicioMes);
  const [endDate, setEndDate] = useState(fimMes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ totalDias: number; totalUsuarios: number; processados: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await api.post('/banco-horas/processar', { startDate, endDate });
      setResult(r.data.data);
    } catch (err) { setError(errMsg(err, 'Erro ao processar')); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Processar período" onClose={onClose}>
      <div className="space-y-4 px-6 py-5">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <p className="text-xs text-ber-gray">Recalcula o banco de horas e as horas extras de todos os colaboradores no período (baseado no ponto + ajustes já feitos). Faça os ajustes de correção ANTES de processar.</p>
        {result ? (
          <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">
            Processado: {result.processados} dias-pessoa ({result.totalDias} dias × {result.totalUsuarios} colaboradores).
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="De"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} required /></Field>
              <Field label="Até"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} required /></Field>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Processando…' : 'Processar'}</button>
            </div>
          </form>
        )}
        {result && (
          <div className="flex justify-end pt-2">
            <button onClick={onSaved} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black">Fechar</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
