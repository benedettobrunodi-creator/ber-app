'use client';

/**
 * Minhas NFs (bloco 4 — 27/08/26). Colaborador PJ envia a NF da competência
 * FECHADA (número + valor + arquivo). Antes do fechamento a tela fica
 * bloqueada. Status: enviada → validada → paga (rejeitada permite reenvio).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Receipt, Lock, Upload, AlertTriangle, CheckCircle2, Clock3, XCircle, FileText } from 'lucide-react';
import api from '@/lib/api';
import HorasTabs from '@/components/HorasTabs';

interface Nf {
  id: string;
  numero: string;
  valorCentavos: number;
  arquivoUrl: string;
  observacoes: string | null;
  status: 'enviada' | 'validada' | 'paga' | 'rejeitada';
  motivoRejeicao: string | null;
  createdAt: string;
}
interface MinhaNf {
  competencia: string;
  isPj: boolean;
  liberada: boolean;
  horas: { minutosNormais: number; minutosExtras: number; minutosDesconto: number } | null;
  nf: Nf | null;
}

const STATUS_UI: Record<Nf['status'], { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  enviada: { label: 'Enviada — aguardando validação', cls: 'bg-ber-amber text-white', icon: Clock3 },
  validada: { label: 'Validada — em pagamento', cls: 'bg-ber-teal text-white', icon: CheckCircle2 },
  paga: { label: 'Paga', cls: 'bg-ber-green text-white', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada — reenvie', cls: 'bg-ber-red text-white', icon: XCircle },
};

function h(min: number): string { return (min / 60).toFixed(1).replace('.', ','); }
function brl(centavos: number): string { return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function mesAnterior(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function NfsPage() {
  const [competencia, setCompetencia] = useState(mesAnterior());
  const [data, setData] = useState<MinhaNf | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [numero, setNumero] = useState('');
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const r = await api.get<{ data: MinhaNf }>(`/nfs/minhas?competencia=${competencia}`);
      setData(r.data.data);
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(m || 'Erro ao carregar'); setData(null);
    } finally { setLoading(false); }
  }, [competencia]);
  useEffect(() => { load(); }, [load]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setErro('Anexe o arquivo da NF (PDF ou XML)'); return; }
    setBusy(true); setErro(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('competencia', competencia);
      fd.append('numero', numero);
      fd.append('valor', valor);
      if (obs) fd.append('observacoes', obs);
      await api.post('/nfs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNumero(''); setValor(''); setObs('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(m || 'Erro ao enviar NF');
    } finally { setBusy(false); }
  }

  const podeEnviar = data?.liberada && data?.isPj && (!data.nf || data.nf.status === 'rejeitada' || data.nf.status === 'enviada');

  return (
    <div className="p-4 md:p-6 w-full max-w-[900px]">
      <HorasTabs />
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Receipt size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Minhas NFs</h1>
        </div>
        <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
          className="text-sm px-3 py-2 border border-ber-border rounded-lg bg-white focus:outline-none" />
      </div>

      {erro && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle size={15} /> {erro}</div>}

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : !data ? null : !data.isPj ? (
        <div className="bg-white border border-ber-border rounded-xl p-10 text-center">
          <p className="text-sm font-semibold text-ber-carbon">Seu cadastro não está marcado como PJ.</p>
          <p className="text-xs text-ber-gray mt-1">Se você emite NF, fale com o financeiro pra ajustar seu cadastro.</p>
        </div>
      ) : !data.liberada ? (
        <div className="bg-white border border-ber-border rounded-xl p-10 text-center">
          <Lock size={28} className="mx-auto text-ber-gray mb-3" />
          <p className="text-sm font-semibold text-ber-carbon">Aguardando fechamento do mês</p>
          <p className="text-xs text-ber-gray mt-1 max-w-md mx-auto">
            Quando o financeiro fechar a competência, você recebe um e-mail com o resumo das suas horas e esta tela libera o envio da NF no valor combinado.
          </p>
        </div>
      ) : (
        <>
          {data.horas && (data.horas.minutosNormais + data.horas.minutosExtras + data.horas.minutosDesconto > 0) && (
            <div className="mb-4 bg-white border border-ber-border rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray mb-2">Suas horas fechadas — {competencia.split('-').reverse().join('/')}</p>
              <div className="flex gap-6 flex-wrap text-sm">
                <span><strong className="text-lg font-black">{h(data.horas.minutosNormais)}h</strong> <span className="text-ber-gray text-xs">normais</span></span>
                {data.horas.minutosExtras > 0 && <span className="text-amber-700"><strong className="text-lg font-black">{h(data.horas.minutosExtras)}h</strong> <span className="text-xs">extras a pagar</span></span>}
                {data.horas.minutosDesconto > 0 && <span className="text-red-700"><strong className="text-lg font-black">-{h(data.horas.minutosDesconto)}h</strong> <span className="text-xs">desconto</span></span>}
              </div>
            </div>
          )}

          {data.nf && (
            <div className="mb-4 bg-white border border-ber-border rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-ber-teal" />
                  <div>
                    <p className="text-sm font-bold text-ber-carbon">NF {data.nf.numero} · {brl(data.nf.valorCentavos)}</p>
                    <a href={data.nf.arquivoUrl} target="_blank" rel="noreferrer" className="text-xs text-ber-teal underline">ver arquivo</a>
                  </div>
                </div>
                {(() => { const ui = STATUS_UI[data.nf.status]; const Icon = ui.icon; return (
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${ui.cls}`}><Icon size={12} /> {ui.label}</span>
                ); })()}
              </div>
              {data.nf.status === 'rejeitada' && data.nf.motivoRejeicao && (
                <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Motivo: {data.nf.motivoRejeicao}</p>
              )}
            </div>
          )}

          {podeEnviar && (
            <form onSubmit={enviar} className="bg-white border border-ber-border rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray">{data.nf ? 'Reenviar / corrigir NF' : 'Enviar NF da competência'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ber-carbon mb-1">Número da NF *</label>
                  <input value={numero} onChange={(e) => setNumero(e.target.value)} required
                    className="w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:border-ber-olive" placeholder="ex: 000123" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ber-carbon mb-1">Valor (R$) *</label>
                  <input value={valor} onChange={(e) => setValor(e.target.value)} required inputMode="decimal"
                    className="w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:border-ber-olive" placeholder="ex: 8500,00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ber-carbon mb-1">Arquivo da NF (PDF ou XML) *</label>
                <input ref={fileRef} type="file" accept=".pdf,.xml,application/pdf,text/xml" required
                  className="w-full text-sm text-ber-gray file:mr-3 file:rounded-lg file:border-0 file:bg-ber-surface file:px-3 file:py-2 file:text-xs file:font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ber-carbon mb-1">Observações</label>
                <input value={obs} onChange={(e) => setObs(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:border-ber-olive" placeholder="opcional" />
              </div>
              <button type="submit" disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm font-bold bg-ber-carbon text-white rounded-lg px-4 py-2.5 hover:opacity-90 disabled:opacity-50">
                <Upload size={15} /> {busy ? 'Enviando…' : 'Enviar NF'}
              </button>
            </form>
          )}
        </>
      )}

      <p className="text-[11px] text-ber-gray mt-4">
        Emita a NF no valor combinado após o fechamento do mês. O financeiro valida e marca o pagamento — o status aparece aqui.
      </p>
    </div>
  );
}
