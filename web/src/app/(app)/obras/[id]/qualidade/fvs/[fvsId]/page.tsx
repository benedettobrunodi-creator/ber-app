'use client';

/**
 * FVS por atividade (03/09/26) — preenchimento da Ficha de Verificação de
 * Serviço. Itens = critérios de qualidade da IT. Conforme / Não conforme / N/A;
 * NC e N/A exigem justificativa; foto obrigatória em Conforme/Não conforme
 * (regra "foto pra tudo" do Bruno).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

interface FvsItem {
  id: string;
  ordem: number;
  texto: string;
  resposta: 'conforme' | 'nao_conforme' | 'na' | null;
  observacao: string | null;
  fotoUrl: string | null;
}

interface Fvs {
  id: string;
  itCode: string | null;
  titulo: string;
  trecho: string | null;
  status: string;
  prazo: string | null;
  preenchidoPor: { name: string } | null;
  preenchidoEm: string | null;
  itens: FvsItem[];
  obra: { id: string; name: string };
}

async function comprimirFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82));
}

type Resp = 'conforme' | 'nao_conforme' | 'na';

export default function FvsPage() {
  const { id: obraId, fvsId } = useParams<{ id: string; fvsId: string }>();
  const router = useRouter();
  const [fvs, setFvs] = useState<Fvs | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Resp>>({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<Record<string, File>>({});
  const [fotosOk, setFotosOk] = useState<Record<string, boolean>>({}); // já tinha foto no servidor
  const [trecho, setTrecho] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get(`/obras/${obraId}/qualidade/fvs/${fvsId}`).then(r => {
      const f: Fvs = r.data.data;
      setFvs(f);
      setTrecho(f.trecho ?? '');
      const rs: Record<string, Resp> = {};
      const os: Record<string, string> = {};
      const fo: Record<string, boolean> = {};
      for (const item of f.itens) {
        if (item.resposta) rs[item.id] = item.resposta;
        if (item.observacao) os[item.id] = item.observacao;
        if (item.fotoUrl) fo[item.id] = true;
      }
      setRespostas(rs);
      setObs(os);
      setFotosOk(fo);
    }).catch(() => alert('Erro ao carregar a ficha'));
  }, [obraId, fvsId]);

  const total = fvs?.itens.length ?? 0;
  const respondidos = Object.keys(respostas).length;
  const semJust = useMemo(() =>
    Object.entries(respostas).filter(([k, r]) => (r === 'nao_conforme' || r === 'na') && !(obs[k] ?? '').trim()).length,
  [respostas, obs]);
  const semFoto = useMemo(() =>
    Object.entries(respostas).filter(([k, r]) => (r === 'conforme' || r === 'nao_conforme') && !fotos[k] && !fotosOk[k]).length,
  [respostas, fotos, fotosOk]);

  async function concluir() {
    if (respondidos < total) { alert(`Responda todos os ${total} critérios (faltam ${total - respondidos})`); return; }
    if (semJust > 0) { alert(`${semJust} item(ns) "Não conforme"/"N/A" sem justificativa`); return; }
    if (semFoto > 0) { alert(`${semFoto} item(ns) sem foto de evidência`); return; }
    setSalvando(true);
    try {
      await api.patch(`/obras/${obraId}/qualidade/fvs/${fvsId}`, {
        respostas: Object.entries(respostas).map(([itemId, resposta]) => ({
          itemId, resposta, observacao: (obs[itemId] ?? '').trim() || null,
        })),
        trecho: trecho.trim() || null,
      });
      let falhas = 0;
      for (const [itemId, file] of Object.entries(fotos)) {
        try {
          const blob = await comprimirFoto(file);
          const fd = new FormData();
          fd.append('file', blob, `fvs-${itemId}.jpg`);
          await api.post(`/obras/${obraId}/qualidade/fvs-itens/${itemId}/foto`, fd);
        } catch { falhas++; }
      }
      if (falhas > 0) alert(`Ficha salva, mas ${falhas} foto(s) falharam — reabra pra reenviar`);
      router.push(`/obras/${obraId}/qualidade`);
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao salvar a ficha');
    } finally {
      setSalvando(false);
    }
  }

  if (!fvs) return <div className="p-6 text-sm text-ber-gray">Carregando…</div>;

  const concluida = fvs.status === 'preenchida';

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Link href={`/obras/${obraId}/qualidade`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Qualidade
      </Link>

      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray">Ficha de Verificação de Serviço</p>
        <h1 className="text-xl font-bold text-ber-carbon">{fvs.itCode ? `${fvs.itCode} · ` : ''}{fvs.titulo}</h1>
        <p className="mt-0.5 text-xs text-ber-gray">
          {fvs.obra.name}
          {fvs.prazo && !concluida && <> · prazo {new Date(fvs.prazo).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</>}
          {concluida && fvs.preenchidoPor && <> · preenchida por {fvs.preenchidoPor.name}</>}
        </p>
        {fvs.itCode && (
          <Link href={`/instrucoes?it=${fvs.itCode}`} target="_blank" className="mt-1 inline-block text-xs text-ber-teal hover:underline">
            abrir a IT (como executar) ↗
          </Link>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-ber-border bg-white p-4">
        <label className="mb-1 block text-xs font-medium text-ber-carbon">Ambiente / trecho verificado</label>
        <input className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal"
          placeholder="ex: 3º andar — salas 301 a 305" value={trecho} onChange={e => setTrecho(e.target.value)} />
      </div>

      <div className="rounded-xl border border-ber-border bg-white overflow-hidden mb-4">
        <div className="border-b border-ber-border bg-ber-surface px-4 py-2.5">
          <p className="text-sm font-bold text-ber-carbon">Critérios de qualidade ({respondidos}/{total})</p>
        </div>
        <div className="divide-y divide-ber-border/60">
          {fvs.itens.map(item => {
            const r = respostas[item.id];
            return (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-sm text-ber-carbon flex-1 min-w-[200px]">{item.texto}</p>
                  <div className="flex rounded-lg border border-ber-border overflow-hidden shrink-0">
                    {([['conforme', 'Conforme'], ['nao_conforme', 'Não conf.'], ['na', 'N/A']] as [Resp, string][]).map(([opt, label]) => (
                      <button key={opt}
                        onClick={() => !concluida && setRespostas(prev => {
                          const next = { ...prev };
                          if (next[item.id] === opt) delete next[item.id]; else next[item.id] = opt;
                          return next;
                        })}
                        className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          r === opt
                            ? opt === 'conforme' ? 'bg-ber-green text-white' : opt === 'nao_conforme' ? 'bg-red-600 text-white' : 'bg-ber-gray text-white'
                            : 'bg-white text-ber-gray hover:bg-ber-surface'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {(r === 'nao_conforme' || r === 'na') && (
                  <input
                    className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      r === 'nao_conforme' ? 'border-red-200 bg-red-50/50 focus:ring-red-400' : 'border-ber-border bg-ber-surface focus:ring-ber-teal'
                    }`}
                    placeholder={r === 'nao_conforme' ? 'O que está fora do critério? (obrigatório)' : 'Por que não se aplica? (obrigatório)'}
                    value={obs[item.id] ?? ''} disabled={concluida}
                    onChange={e => setObs(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                )}
                {(r === 'conforme' || r === 'nao_conforme') && !concluida && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      fotos[item.id] || fotosOk[item.id] ? 'border-ber-green/40 text-ber-green bg-ber-green/5' : 'border-amber-400 text-amber-700 bg-amber-50'
                    }`}>
                      📷 {fotos[item.id] || fotosOk[item.id] ? 'Foto anexada ✓' : 'Tirar foto (obrigatória)'}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setFotos(prev => ({ ...prev, [item.id]: f }));
                          e.target.value = '';
                        }} />
                    </label>
                  </div>
                )}
                {concluida && item.fotoUrl && (
                  <a href={item.fotoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-ber-teal hover:underline">ver foto</a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!concluida && (
        <button onClick={concluir} disabled={salvando}
          className="w-full rounded-lg bg-ber-olive py-3 text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
          {salvando ? 'Salvando…' : `Concluir ficha (${respondidos}/${total})`}
        </button>
      )}
    </div>
  );
}
