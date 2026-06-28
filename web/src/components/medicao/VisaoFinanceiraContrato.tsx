'use client';

// Compartilhado entre o portal cliente (/cliente/medicao/:token) e o hub
// interno (/obras/:id/medicao). Recebe o payload do endpoint consolidado.

type Status = 'rascunho' | 'enviada' | 'aprovada' | 'contestada' | 'nf_emitida' | 'paga';

export interface ConsolidadoData {
  obra: { id: string; name: string; client: string | null };
  medicoes: Array<{
    id: string; numero: number;
    periodoInicio: string; periodoFim: string;
    status: Status; dataPagamentoRealizado: string | null;
  }>;
  empresas: Array<{
    nome: string;
    tipo: 'principal' | 'terceiro_ber_paga' | 'terceiro_fatura_direto';
    contrato: number;
    pagoTotal: number;
    saldo: number;
    porMedicao: Record<string, number>;
  }>;
  totais: { contrato: number; pago: number; saldo: number; pctPago: number };
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_TAG: Record<ConsolidadoData['empresas'][number]['tipo'], string> = {
  principal: 'Empresa principal (gerenciadora)',
  terceiro_ber_paga: 'Terceiro · BÈR paga',
  terceiro_fatura_direto: 'Terceiro · cliente paga direto',
};
const STATUS_TAG: Record<Status, string> = {
  rascunho: 'rascunho', enviada: 'aguardando aprovação', aprovada: 'aprovada',
  contestada: 'contestada', nf_emitida: 'NF emitida', paga: '✓ paga',
};
const fmtMedDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function VisaoFinanceiraContrato({ data }: { data: ConsolidadoData }) {
  if (!data.empresas.length) return null;
  const totalPorMedicao = (medId: string) =>
    data.empresas.reduce((s, e) => s + (e.porMedicao[medId] ?? 0), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">💰 Visão Financeira do Contrato</h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-4">Pago por medição · contrato e saldo por empresa · total consolidado</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Contrato Total</p>
          <p className="mt-1 text-xl font-black tabular-nums text-gray-900">{fmtBRL(data.totais.contrato)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{data.empresas.length} frente{data.empresas.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-lg bg-green-50/80 border border-green-100 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Pago Acumulado</p>
          <p className="mt-1 text-xl font-black tabular-nums text-green-700">{fmtBRL(data.totais.pago)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{data.totais.pctPago.toFixed(1)}% executado · {data.medicoes.length} medição(ões)</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Saldo a Pagar</p>
          <p className="mt-1 text-xl font-black tabular-nums text-amber-700">{fmtBRL(data.totais.saldo)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{(100 - data.totais.pctPago).toFixed(1)}% restantes</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-md">
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left font-bold uppercase text-[10px] tracking-wide sticky left-0 bg-gray-800 z-10 min-w-[220px]">Empresa</th>
              <th className="px-3 py-2 text-right font-bold uppercase text-[10px] tracking-wide bg-gray-700">Contrato</th>
              {data.medicoes.map(m => (
                <th key={m.id} className="px-3 py-2 text-right font-bold uppercase text-[10px] tracking-wide whitespace-nowrap">
                  <span className="block">Med {String(m.numero).padStart(2, '0')}</span>
                  <span className="block text-[9px] opacity-70">{fmtMedDate(m.periodoFim)}</span>
                  <span className="block text-[8px] mt-0.5">{STATUS_TAG[m.status]}</span>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-bold uppercase text-[10px] tracking-wide bg-emerald-700">Total Pago</th>
              <th className="px-3 py-2 text-right font-bold uppercase text-[10px] tracking-wide bg-amber-700">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.empresas.map(emp => (
              <tr key={emp.nome} className={emp.tipo === 'principal' ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50/40'}>
                <td className={`px-3 py-2 sticky left-0 z-10 ${emp.tipo === 'principal' ? 'bg-gray-50' : 'bg-white'}`}>
                  {emp.tipo === 'principal' && <span className="text-green-700 font-black mr-1">★</span>}
                  <span className="font-medium text-gray-900">{emp.nome}</span>
                  <span className="block text-[10px] text-gray-500 mt-0.5">{TIPO_TAG[emp.tipo]}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums bg-gray-50/40 text-gray-700">{fmtBRL(emp.contrato)}</td>
                {data.medicoes.map(m => {
                  const v = emp.porMedicao[m.id] ?? 0;
                  return (
                    <td key={m.id} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${v === 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                      {v === 0 ? '—' : fmtBRL(v)}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums font-bold bg-emerald-50 text-emerald-800">{fmtBRL(emp.pagoTotal)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold bg-amber-50 text-amber-800">{fmtBRL(emp.saldo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800 bg-gray-50 font-black">
              <td className="px-3 py-3 sticky left-0 z-10 bg-gray-50 uppercase text-[11px] tracking-wide text-gray-900">Total Consolidado</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(data.totais.contrato)}</td>
              {data.medicoes.map(m => (
                <td key={m.id} className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{fmtBRL(totalPorMedicao(m.id))}</td>
              ))}
              <td className="px-3 py-3 text-right tabular-nums bg-emerald-700 text-white text-sm">{fmtBRL(data.totais.pago)}</td>
              <td className="px-3 py-3 text-right tabular-nums bg-amber-700 text-white text-sm">{fmtBRL(data.totais.saldo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
