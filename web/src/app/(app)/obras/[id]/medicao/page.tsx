'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, X, ChevronRight, Trash2,
} from 'lucide-react';
import api from '@/lib/api';
import VisaoFinanceiraContrato, { type ConsolidadoData } from '@/components/medicao/VisaoFinanceiraContrato';

interface Obra {
  id: string;
  name: string;
  client: string | null;
  valorContrato: number | string | null;
  prazoPagamentoDias: number;
  retencaoPercentual: number | string;
}

interface Etapa {
  id: string;
  ordem: number;
  nome: string;
  contratoValor: string | number;
  etapaFornecedores: EtapaFornecedor[];
}

interface EtapaFornecedor {
  id: string;
  tipo: 'terceiro_ber_paga' | 'terceiro_fatura_direto' | 'miscelaneos_ber';
  valorContratado: string | number;
  fornecedor: { id: string; razaoSocial: string } | null;
}

interface Medicao {
  id: string;
  numero: number;
  periodoInicio: string;
  periodoFim: string;
  status: 'rascunho' | 'enviada' | 'aprovada' | 'contestada' | 'nf_emitida' | 'paga';
  dataPagamentoPrevista: string | null;
  dataPagamentoRealizado: string | null;
  valorTotalBruto?: number;
  valorTotalLiquido?: number;
  totalPagoDireto?: number;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviada: 'Enviada', aprovada: 'Aprovada',
  contestada: 'Contestada', nf_emitida: 'NF Emitida', paga: 'Paga',
};
const STATUS_COLOR: Record<string, string> = {
  rascunho:   'bg-gray-100 text-gray-700',
  enviada:    'bg-blue-100 text-blue-700',
  aprovada:   'bg-emerald-100 text-emerald-700',
  contestada: 'bg-amber-100 text-amber-700',
  nf_emitida: 'bg-purple-100 text-purple-700',
  paga:       'bg-green-200 text-green-800',
};
const TIPO_LABEL: Record<string, string> = {
  terceiro_ber_paga: 'BER',
  terceiro_fatura_direto: 'Direto',
  miscelaneos_ber: 'Misc',
};
const TIPO_COLOR: Record<string, string> = {
  terceiro_ber_paga: 'text-amber-700',
  terceiro_fatura_direto: 'text-blue-700',
  miscelaneos_ber: 'text-gray-500',
};

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const labelMedicao = (n: number) => n === 1 ? 'Sinal' : `Medição ${String(n).padStart(2, '0')}`;

const errMsg = (err: unknown, fb: string) => {
  const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof m === 'string' ? m : m?.message || fb;
};

export default function MedicaoHubPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const router = useRouter();

  const [obra, setObra] = useState<Obra | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [consolidado, setConsolidado] = useState<ConsolidadoData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showNovaEtapa, setShowNovaEtapa] = useState(false);
  const [showNovaMedicao, setShowNovaMedicao] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [o, e, m, c] = await Promise.all([
        api.get<{ data: Obra }>(`/obras/${obraId}`),
        api.get<{ data: Etapa[] }>(`/obras/${obraId}/medicao-etapas`),
        api.get<{ data: Medicao[] }>(`/obras/${obraId}/medicoes`),
        api.get<{ data: ConsolidadoData }>(`/obras/${obraId}/medicoes/consolidado`).catch(() => null),
      ]);
      setObra(o.data.data);
      setEtapas(e.data.data);
      setMedicoes(m.data.data);
      setConsolidado(c?.data?.data ?? null);
    } finally { setLoading(false); }
  }, [obraId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const contratoTotal = obra?.valorContrato != null ? Number(obra.valorContrato) : 0;

  // KPIs financeiros (usa líquido = bruto - pagamentos diretos)
  const recebido = medicoes.filter(m => m.status === 'paga').reduce((acc, m) => acc + (m.valorTotalLiquido ?? 0), 0);
  const aReceber = medicoes.filter(m => ['enviada', 'aprovada', 'nf_emitida'].includes(m.status))
    .reduce((acc, m) => acc + (m.valorTotalLiquido ?? 0), 0);
  const naoMedido = Math.max(0, contratoTotal - recebido - aReceber);
  const pctRecebido = contratoTotal > 0 ? (recebido / contratoTotal) * 100 : 0;
  const pctAReceber = contratoTotal > 0 ? (aReceber / contratoTotal) * 100 : 0;
  const pctMedido = pctRecebido + pctAReceber;

  if (loading || !obra) {
    return <div className="p-6 text-sm text-ber-gray">Carregando…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obra.name}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Medição</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-ber-carbon">Medição financeira</h1>
        <button onClick={fetchAll} className="text-xs text-ber-gray hover:text-ber-carbon">⟳ Atualizar</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Valor do contrato" value={fmtBRL(contratoTotal)} />
        <Kpi label="Recebido" value={fmtBRL(recebido)} accent="green" />
        <Kpi label="A receber" value={fmtBRL(aReceber)} accent="blue" />
        <Kpi label="Saldo a medir" value={fmtBRL(naoMedido)} />
      </div>

      {/* Barra de progresso financeiro */}
      {contratoTotal > 0 && (recebido > 0 || aReceber > 0) && (
        <div className="mb-5 rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-ber-carbon">Progresso financeiro</p>
            <p className="text-xs text-ber-gray">{fmtBRL(recebido + aReceber)} de {fmtBRL(contratoTotal)} medidos ({pctMedido.toFixed(1)}%)</p>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden flex">
            <div style={{ width: `${pctRecebido}%` }} className="bg-emerald-500" />
            <div style={{ width: `${pctAReceber}%` }} className="bg-blue-500" />
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-ber-gray">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Recebido</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> A receber</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Não medido</span>
          </div>
        </div>
      )}

      {/* Visão Financeira do Contrato — empresa principal + terceiros */}
      {consolidado && consolidado.empresas.length > 0 && (
        <div className="mb-6">
          <VisaoFinanceiraContrato data={consolidado} />
        </div>
      )}

      {/* Medições */}
      <div className="mb-6 rounded-xl border border-ber-gray/15 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-sm font-bold text-ber-carbon">Medições ({medicoes.length})</h2>
          <button onClick={() => setShowNovaMedicao(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black">
            <Plus size={13} /> Nova medição
          </button>
        </div>

        {medicoes.length === 0 ? (
          <p className="text-sm text-ber-gray/50 italic py-6 text-center">Nenhuma medição cadastrada. Clica "Nova medição" pra começar.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ber-gray border-b border-ber-gray/10">
                <th className="py-2 pr-3">Nº</th>
                <th className="py-2 pr-3">Período</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Previsão</th>
                <th className="py-2 pr-3 text-right">Pago em</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {medicoes.map(m => (
                <tr key={m.id} className="border-b border-ber-gray/5 hover:bg-ber-bg/30 group">
                  <td className="py-2.5 pr-3 font-medium">{labelMedicao(m.numero)}</td>
                  <td className="py-2.5 pr-3 text-ber-gray">{fmtDate(m.periodoInicio)} – {fmtDate(m.periodoFim)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{m.valorTotalLiquido != null ? fmtBRL(m.valorTotalLiquido) : '—'}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium ${STATUS_COLOR[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-ber-gray text-xs">{fmtDate(m.dataPagamentoPrevista)}</td>
                  <td className="py-2.5 pr-3 text-right text-ber-gray text-xs">{fmtDate(m.dataPagamentoRealizado)}</td>
                  <td className="py-2.5 pr-2 text-right">
                    <Link href={`/obras/${obraId}/medicao/${m.id}`}
                      className="inline-flex items-center gap-1 text-ber-teal hover:underline text-xs">
                      Abrir <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Etapas */}
      <div className="rounded-xl border border-ber-gray/15 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-sm font-bold text-ber-carbon">Etapas do contrato ({etapas.length})</h2>
          <button onClick={() => setShowNovaEtapa(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black">
            <Plus size={13} /> Nova etapa
          </button>
        </div>

        {etapas.length === 0 ? (
          <p className="text-sm text-ber-gray/50 italic py-6 text-center">Nenhuma etapa cadastrada. Crie a primeira etapa do contrato.</p>
        ) : (
          <div className="space-y-2">
            {etapas.map(e => (
              <EtapaCard key={e.id} etapa={e} onChange={fetchAll} />
            ))}
          </div>
        )}
      </div>

      {showNovaEtapa && (
        <NovaEtapaModal obraId={obraId} ordemSugerida={etapas.length + 1}
          onClose={() => setShowNovaEtapa(false)} onSaved={() => { setShowNovaEtapa(false); fetchAll(); }} />
      )}

      {showNovaMedicao && (
        <NovaMedicaoModal obraId={obraId} numeroSugerido={medicoes.length + 1}
          onClose={() => setShowNovaMedicao(false)}
          onSaved={(m) => { setShowNovaMedicao(false); router.push(`/obras/${obraId}/medicao/${m.id}`); }} />
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'blue' }) {
  const color = accent === 'green' ? 'text-emerald-700' : accent === 'blue' ? 'text-blue-700' : 'text-ber-carbon';
  return (
    <div className="rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-black tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function EtapaCard({ etapa, onChange }: { etapa: Etapa; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const somaContratada = etapa.etapaFornecedores.reduce((acc, f) => acc + Number(f.valorContratado), 0);
  const saldo = Number(etapa.contratoValor) - somaContratada;

  async function handleDeleteEtapa() {
    if (!confirm(`Excluir etapa ${etapa.ordem}. ${etapa.nome}? Fornecedores vinculados serão removidos.`)) return;
    try { await api.delete(`/medicao-etapas/${etapa.id}`); onChange(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  async function handleDeleteFornecedor(efId: string, nome: string) {
    if (!confirm(`Remover ${nome} da etapa?`)) return;
    try { await api.delete(`/medicao-etapa-fornecedores/${efId}`); onChange(); }
    catch (err) { alert(errMsg(err, 'Erro ao remover')); }
  }

  return (
    <div className="rounded-lg border border-ber-gray/15 bg-ber-bg/20">
      <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-ber-bg/40 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <span className="text-xs text-ber-gray w-6">{etapa.ordem}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ber-carbon truncate">{etapa.nome}</p>
          <p className="text-[11px] text-ber-gray">
            {etapa.etapaFornecedores.length} fornecedor(es) · saldo: {fmtBRL(saldo)}
          </p>
        </div>
        <span className="text-sm tabular-nums text-ber-gray shrink-0">{fmtBRL(Number(etapa.contratoValor))}</span>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteEtapa(); }}
          className="opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded p-1 text-ber-gray">
          <Trash2 size={13} />
        </button>
      </div>
      {expanded && (
        <div className="px-4 py-2 border-t border-ber-gray/10 bg-white">
          {etapa.etapaFornecedores.length === 0 ? (
            <p className="text-xs text-ber-gray/60 italic py-2">Nenhum fornecedor.</p>
          ) : (
            <ul className="space-y-1">
              {etapa.etapaFornecedores.map(f => (
                <li key={f.id} className="flex items-center gap-3 text-sm py-1 group/row">
                  <span className="text-ber-gray text-xs">└─</span>
                  <span className="flex-1 text-ber-carbon truncate">{f.fornecedor?.razaoSocial ?? 'BER Engenharia'}</span>
                  <span className={`text-[10px] font-medium ${TIPO_COLOR[f.tipo] ?? 'text-gray-500'}`}>{TIPO_LABEL[f.tipo] ?? f.tipo}</span>
                  <span className="text-xs tabular-nums text-ber-gray">{fmtBRL(Number(f.valorContratado))}</span>
                  <button onClick={() => handleDeleteFornecedor(f.id, f.fornecedor?.razaoSocial ?? '?')}
                    className="opacity-0 group-hover/row:opacity-100 hover:bg-red-50 hover:text-red-600 rounded p-1 text-ber-gray">
                    <X size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!showForm && saldo > 0.005 && (
            <button onClick={() => setShowForm(true)}
              className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline">
              + Adicionar fornecedor (saldo: {fmtBRL(saldo)})
            </button>
          )}
          {showForm && (
            <NovoFornecedorInline
              etapaId={etapa.id}
              saldo={saldo}
              onClose={() => setShowForm(false)}
              onSaved={() => { setShowForm(false); onChange(); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function NovoFornecedorInline({ etapaId, saldo, onClose, onSaved }: { etapaId: string; saldo: number; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'terceiro_ber_paga' | 'terceiro_fatura_direto' | 'miscelaneos_ber'>('terceiro_ber_paga');
  const [valor, setValor] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const valorNum = Number(valor.replace(',', '.'));
    if (!nome.trim() || isNaN(valorNum) || valorNum <= 0) return;
    if (valorNum > saldo + 0.005) { alert(`Valor excede o saldo (${fmtBRL(saldo)})`); return; }
    setSaving(true);
    try {
      await api.post(`/medicao-etapas/${etapaId}/fornecedores`, { razaoSocial: nome.trim(), tipo, valorContratado: valorNum });
      onSaved();
    } catch (err) { alert(errMsg(err, 'Erro ao adicionar')); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="mt-2 grid grid-cols-[2fr_130px_1fr_auto_auto] gap-2 items-center bg-amber-50/40 rounded p-2">
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do fornecedor" autoFocus
        className="px-2 py-1.5 border border-ber-gray/30 rounded text-xs" disabled={saving} />
      <select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}
        className="px-2 py-1.5 border border-ber-gray/30 rounded text-xs bg-white" disabled={saving}>
        <option value="terceiro_ber_paga">BER paga</option>
        <option value="terceiro_fatura_direto">Fatura direto</option>
        <option value="miscelaneos_ber">Miscelâneos BER</option>
      </select>
      <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder="R$ contratado"
        className="px-2 py-1.5 border border-ber-gray/30 rounded text-xs text-right" disabled={saving} />
      <button type="button" onClick={onClose} className="text-xs text-ber-gray hover:text-ber-carbon px-2">Cancelar</button>
      <button type="submit" disabled={saving} className="text-xs bg-ber-carbon text-white rounded px-3 py-1.5 hover:bg-ber-black disabled:opacity-50">
        {saving ? '…' : 'Adicionar'}
      </button>
    </form>
  );
}

function NovaEtapaModal({ obraId, ordemSugerida, onClose, onSaved }: { obraId: string; ordemSugerida: number; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [ordem, setOrdem] = useState(String(ordemSugerida));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const valorNum = Number(valor.replace(',', '.'));
    if (!nome.trim() || isNaN(valorNum) || valorNum <= 0) return;
    setSaving(true);
    try {
      await api.post(`/obras/${obraId}/medicao-etapas`, { ordem: Number(ordem), nome: nome.trim(), contratoValor: valorNum });
      onSaved();
    } catch (err) { alert(errMsg(err, 'Erro ao criar etapa')); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Nova etapa" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Ordem">
          <input type="number" min={1} value={ordem} onChange={e => setOrdem(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Nome *">
          <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Ex: Revestimentos e Pisos" required autoFocus />
        </Field>
        <Field label="Valor do contrato (R$) *">
          <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" className={inputCls} placeholder="Ex: 38540.86" required />
        </Field>
        <ModalActions onClose={onClose} saving={saving} label="Criar etapa" />
      </form>
    </Modal>
  );
}

function NovaMedicaoModal({ obraId, numeroSugerido, onClose, onSaved }: { obraId: string; numeroSugerido: number; onClose: () => void; onSaved: (m: { id: string }) => void }) {
  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 15).toISOString().slice(0, 10);
  const [numero, setNumero] = useState(String(numeroSugerido));
  const [inicio, setInicio] = useState(inicioPadrao);
  const [fim, setFim] = useState(fimPadrao);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.post(`/obras/${obraId}/medicoes`, {
        numero: Number(numero),
        periodoInicio: inicio,
        periodoFim: fim,
      });
      onSaved(res.data.data);
    } catch (err) { alert(errMsg(err, 'Erro ao criar medição')); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Nova medição" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Número (Sinal = 1)">
          <input type="number" min={1} value={numero} onChange={e => setNumero(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início do período *">
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Fim do período *">
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} className={inputCls} required />
          </Field>
        </div>
        <ModalActions onClose={onClose} saving={saving} label="Criar medição" />
      </form>
    </Modal>
  );
}

// ─── Modal helpers ───────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-5 py-3">
          <h2 className="text-base font-black text-ber-carbon">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={16} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
      <button type="submit" disabled={saving} className="rounded bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
        {saving ? 'Salvando…' : label}
      </button>
    </div>
  );
}

const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
