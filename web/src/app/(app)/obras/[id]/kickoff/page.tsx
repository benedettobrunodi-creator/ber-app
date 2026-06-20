'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Rocket, Save, X, Plus } from 'lucide-react';
import api from '@/lib/api';

interface Participante { nome: string; papel?: string | null }
interface Kickoff {
  id: string;
  dataRealizada: string | null;
  participantes: Participante[];
  pautaCoberta: string | null;
  decisoes: string | null;
  premissas: string | null;
  riscosIniciais: string | null;
}

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function KickoffPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const [obraName, setObraName] = useState('');
  const [data, setData] = useState({
    dataRealizada: '',
    pautaCoberta: '',
    decisoes: '',
    premissas: '',
    riscosIniciais: '',
  });
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [novoPart, setNovoPart] = useState({ nome: '', papel: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function fetchAll() {
    setLoading(true);
    try {
      const [k, obraRes] = await Promise.all([
        api.get<{ data: Kickoff | null }>(`/obras/${obraId}/kickoff`),
        api.get(`/obras/${obraId}`),
      ]);
      setObraName(obraRes.data.data.name);
      const kk = k.data.data;
      if (kk) {
        setData({
          dataRealizada: kk.dataRealizada ? kk.dataRealizada.slice(0, 10) : '',
          pautaCoberta: kk.pautaCoberta ?? '',
          decisoes: kk.decisoes ?? '',
          premissas: kk.premissas ?? '',
          riscosIniciais: kk.riscosIniciais ?? '',
        });
        setParticipantes(kk.participantes || []);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  function addParticipante() {
    if (!novoPart.nome.trim()) return;
    setParticipantes(p => [...p, { nome: novoPart.nome.trim(), papel: novoPart.papel.trim() || null }]);
    setNovoPart({ nome: '', papel: '' });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await api.put(`/obras/${obraId}/kickoff`, {
        dataRealizada: data.dataRealizada || null,
        participantes,
        pautaCoberta: data.pautaCoberta || null,
        decisoes: data.decisoes || null,
        premissas: data.premissas || null,
        riscosIniciais: data.riscosIniciais || null,
      });
      setMsg('✓ Salvo');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Kick-Off</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Rocket size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Kick-Off</h1>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-green-700">{msg}</span>}
          <button onClick={handleSave} disabled={saving || loading} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black disabled:opacity-50">
            <Save size={14} /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : (
        <div className="space-y-5 max-w-3xl">
          <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
            <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide mb-1">Data realizada</label>
            <input type="date" value={data.dataRealizada} onChange={e => setData(p => ({ ...p, dataRealizada: e.target.value }))} className={`${inputCls} max-w-xs`} />
          </div>

          <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-ber-carbon mb-3">Participantes</h2>
            {participantes.length > 0 && (
              <ul className="mb-3 space-y-1">
                {participantes.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-ber-bg/40 rounded border border-ber-gray/15 px-2 py-1">
                    <span><strong>{p.nome}</strong>{p.papel ? ` · ${p.papel}` : ''}</span>
                    <button type="button" onClick={() => setParticipantes(arr => arr.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-600"><X size={11} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-5 gap-2">
              <input value={novoPart.nome} onChange={e => setNovoPart(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className={`${inputCls} col-span-2`} />
              <input value={novoPart.papel} onChange={e => setNovoPart(p => ({ ...p, papel: e.target.value }))} placeholder="Papel" className={`${inputCls} col-span-2`} />
              <button type="button" onClick={addParticipante} className="inline-flex items-center justify-center gap-1 rounded-md border border-ber-gray/30 text-sm text-ber-carbon hover:bg-ber-offwhite"><Plus size={12} /> Add</button>
            </div>
          </div>

          {[
            { key: 'pautaCoberta',   label: 'Pauta coberta',   placeholder: 'O que foi discutido no kick-off.' },
            { key: 'decisoes',       label: 'Decisões',        placeholder: 'Decisões tomadas com cliente / gerenciadora.' },
            { key: 'premissas',      label: 'Premissas',       placeholder: 'Premissas combinadas que sustentam o plano.' },
            { key: 'riscosIniciais', label: 'Riscos iniciais', placeholder: 'Riscos mapeados no início, com mitigação se houver.' },
          ].map(f => (
            <div key={f.key} className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
              <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide mb-1">{f.label}</label>
              <textarea rows={3} value={(data as Record<string, string>)[f.key]}
                onChange={e => setData(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} className={inputCls} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
