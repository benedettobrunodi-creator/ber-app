'use client';

/**
 * Relatório de Recebimento do Imóvel (02/09/26) — vistoria fotográfica.
 * Fluxo: engenheiro despeja as fotos (comprimidas no cliente), organiza por
 * ambiente, legenda com sugestão de IA, e gera o PDF no padrão BÈR.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, FileDown, Loader2, Sparkles, Trash2, X, ChevronLeft, ChevronRight, Plus, Pencil } from 'lucide-react';
import api from '@/lib/api';

interface Foto {
  id: string;
  ambienteId: string | null;
  url: string;
  legenda: string | null;
  patologia: boolean;
  ordem: number;
}
interface Ambiente { id: string; nome: string; ordem: number; fotos: Foto[] }
interface Relatorio {
  id: string;
  status: 'rascunho' | 'concluido';
  dataVistoria: string | null;
  objetivo: string | null;
  responsavel: { id: string; name: string } | null;
  ambientes: Ambiente[];
  fotos: Foto[]; // todas (inclui sem ambiente)
}

/** Comprime a foto no navegador (canvas → JPEG ~1600px) antes do upload. */
async function comprimir(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch { return file; }
}

export default function RecebimentoTab({ obraId }: { obraId: string }) {
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [novoAmbiente, setNovoAmbiente] = useState('');
  const [busyFoto, setBusyFoto] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [revisao, setRevisao] = useState<number | null>(null); // índice na fila de revisão
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/obras/${obraId}/recebimento`);
      setRel(r.data.data);
    } catch (e: any) {
      setErro(e?.response?.data?.error?.message ?? 'Erro ao carregar');
    } finally { setLoading(false); }
  }, [obraId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-ber-gray">Carregando…</p>;
  if (!rel) return <p className="text-sm text-red-600">{erro ?? 'Erro ao carregar o relatório.'}</p>;

  const bloqueado = rel.status === 'concluido';
  const semAmbiente = rel.fotos.filter(f => !f.ambienteId);
  const totalFotos = rel.fotos.length;
  const semLegenda = rel.fotos.filter(f => f.ambienteId && !f.legenda?.trim());
  const filaRevisao = [...semLegenda];

  async function patchRel(body: Record<string, unknown>) {
    try {
      const r = await api.patch(`/recebimento/${rel!.id}`, body);
      setRel(r.data.data);
    } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  }

  async function subirFotos(files: FileList | null) {
    if (!files?.length) return;
    const lista = Array.from(files);
    setErro(null);
    try {
      // lotes de 6 pra não estourar o corpo da requisição
      for (let i = 0; i < lista.length; i += 6) {
        const lote = lista.slice(i, i + 6);
        setUploading(`Enviando ${Math.min(i + lote.length, lista.length)}/${lista.length}…`);
        const fd = new FormData();
        for (const f of lote) {
          const blob = await comprimir(f);
          fd.append('fotos', blob, f.name.replace(/\.[^.]+$/, '') + '.jpg');
        }
        await api.post(`/recebimento/${rel!.id}/fotos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await load();
    } catch (e: any) {
      setErro(e?.response?.data?.error?.message ?? 'Erro no envio das fotos');
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function patchFoto(fotoId: string, body: Record<string, unknown>) {
    try {
      await api.patch(`/recebimento/fotos/${fotoId}`, body);
      setRel(prev => {
        if (!prev) return prev;
        const upd = (f: Foto) => f.id === fotoId ? { ...f, ...body } as Foto : f;
        return {
          ...prev,
          fotos: prev.fotos.map(upd),
          ambientes: prev.ambientes.map(a => ({ ...a, fotos: a.fotos.map(upd) })),
        };
      });
      if (body.ambienteId !== undefined) await load(); // mudou de grupo — recarrega agrupamento
    } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  }

  async function excluirFoto(fotoId: string) {
    if (!confirm('Excluir esta foto?')) return;
    try { await api.delete(`/recebimento/fotos/${fotoId}`); await load(); }
    catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  }

  async function sugerirLegenda(foto: Foto) {
    setBusyFoto(foto.id);
    try {
      const r = await api.post(`/recebimento/fotos/${foto.id}/sugerir-legenda`);
      const { legenda, patologia } = r.data.data;
      await patchFoto(foto.id, { legenda, patologia });
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Sugestão falhou — escreva a legenda manualmente');
    } finally { setBusyFoto(null); }
  }

  async function criarAmbiente() {
    if (!novoAmbiente.trim()) return;
    try {
      await api.post(`/recebimento/${rel!.id}/ambientes`, { nome: novoAmbiente.trim() });
      setNovoAmbiente('');
      await load();
    } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  }

  async function renomearAmbiente(a: Ambiente) {
    const nome = prompt('Nome do ambiente:', a.nome);
    if (!nome?.trim() || nome === a.nome) return;
    try { await api.patch(`/recebimento/ambientes/${a.id}`, { nome }); await load(); }
    catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  }

  async function excluirAmbiente(a: Ambiente) {
    if (!confirm(`Excluir o ambiente "${a.nome}"? As fotos voltam pra "sem ambiente".`)) return;
    try { await api.delete(`/recebimento/ambientes/${a.id}`); await load(); }
    catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  }

  async function gerarPdf() {
    setPdfBusy(true);
    try {
      const r = await api.get(`/recebimento/${rel!.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (e: any) {
      // resposta de erro vem como blob — tenta extrair a mensagem
      try {
        const txt = await (e?.response?.data as Blob)?.text?.();
        const msg = txt ? JSON.parse(txt)?.error?.message : null;
        alert(msg ?? 'Erro ao gerar o PDF');
      } catch { alert('Erro ao gerar o PDF'); }
    } finally { setPdfBusy(false); }
  }

  const selectAmbiente = (foto: Foto) => (
    <select
      value={foto.ambienteId ?? ''}
      disabled={bloqueado}
      onChange={e => patchFoto(foto.id, { ambienteId: e.target.value || null })}
      className="w-full rounded border border-ber-gray/30 bg-white px-1.5 py-1 text-[11px] text-ber-carbon focus:border-ber-teal focus:outline-none disabled:opacity-50"
    >
      <option value="">— sem ambiente —</option>
      {rel.ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
    </select>
  );

  const cardFoto = (foto: Foto, numero: string | null) => (
    <div key={foto.id} className={`rounded-lg border bg-white p-2 ${foto.patologia ? 'border-red-300' : 'border-ber-border'}`}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto.url} alt="" className="h-36 w-full rounded object-cover" loading="lazy" />
        {numero && <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">Foto {numero}</span>}
        {foto.patologia && <span className="absolute right-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">PATOLOGIA</span>}
      </div>
      <input
        defaultValue={foto.legenda ?? ''}
        disabled={bloqueado}
        placeholder="legenda…"
        onBlur={e => { if (e.target.value !== (foto.legenda ?? '')) patchFoto(foto.id, { legenda: e.target.value.trim() }); }}
        className="mt-1.5 w-full border-b border-transparent bg-transparent text-xs text-ber-carbon placeholder:text-ber-gray/50 hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none disabled:opacity-60"
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="flex-1">{selectAmbiente(foto)}</div>
        {!bloqueado && (
          <>
            <button onClick={() => sugerirLegenda(foto)} disabled={busyFoto === foto.id} title="Sugerir legenda com IA"
              className="rounded p-1 text-ber-teal hover:bg-ber-teal/10 disabled:opacity-50">
              {busyFoto === foto.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            </button>
            <label className="flex items-center gap-1 text-[10px] text-ber-gray" title="Marcar como patologia/avaria">
              <input type="checkbox" checked={foto.patologia} onChange={e => patchFoto(foto.id, { patologia: e.target.checked })} className="h-3 w-3 accent-red-500" />
              avaria
            </label>
            <button onClick={() => excluirFoto(foto.id)} title="Excluir foto" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );

  const fotoRevisao = revisao !== null ? filaRevisao[revisao] ?? null : null;

  return (
    <div>
      {/* Cabeçalho / dados gerais */}
      <div className="mb-4 rounded-xl border border-ber-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Relatório de Recebimento do Imóvel</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${bloqueado ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {bloqueado ? 'Concluído ✓' : 'Rascunho'}
              </span>
            </div>
            <p className="mt-1 text-xs text-ber-gray">
              {totalFotos} foto{totalFotos === 1 ? '' : 's'} · {rel.ambientes.length} ambiente{rel.ambientes.length === 1 ? '' : 's'}
              {semLegenda.length > 0 && <span className="text-amber-600"> · {semLegenda.length} sem legenda</span>}
              {semAmbiente.length > 0 && <span className="text-amber-600"> · {semAmbiente.length} sem ambiente</span>}
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-ber-gray">
              Data da vistoria:
              <input type="date" disabled={bloqueado} defaultValue={rel.dataVistoria?.slice(0, 10) ?? ''}
                onBlur={e => { if (e.target.value !== (rel.dataVistoria?.slice(0, 10) ?? '')) patchRel({ dataVistoria: e.target.value || null }); }}
                className="rounded border border-ber-gray/30 px-2 py-1 text-xs text-ber-carbon focus:border-ber-teal focus:outline-none disabled:opacity-50" />
              <span>· RT: {rel.responsavel?.name ?? '—'}</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filaRevisao.length > 0 && !bloqueado && (
              <button onClick={() => setRevisao(0)}
                className="rounded-md border border-ber-teal px-3 py-2 text-xs font-bold text-ber-teal hover:bg-ber-teal/10">
                Revisar legendas ({filaRevisao.length})
              </button>
            )}
            <button onClick={gerarPdf} disabled={pdfBusy}
              className="flex items-center gap-1.5 rounded-md border border-ber-border px-3 py-2 text-xs font-bold text-ber-carbon hover:bg-ber-offwhite disabled:opacity-50">
              {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Gerar PDF
            </button>
            <button onClick={() => patchRel({ status: bloqueado ? 'rascunho' : 'concluido' })}
              className="rounded-md bg-ber-carbon px-3 py-2 text-xs font-bold text-white hover:bg-ber-black">
              {bloqueado ? 'Reabrir' : 'Concluir relatório'}
            </button>
          </div>
        </div>
      </div>

      {erro && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {/* Upload */}
      {!bloqueado && (
        <div className="mb-4">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => subirFotos(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={!!uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ber-gray/30 bg-white px-4 py-6 text-sm font-semibold text-ber-gray hover:border-ber-teal hover:text-ber-teal disabled:opacity-60">
            {uploading ? <><Loader2 size={16} className="animate-spin" /> {uploading}</> : <><Camera size={16} /> Adicionar fotos (pode selecionar várias)</>}
          </button>
        </div>
      )}

      {/* Ambientes */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {rel.ambientes.map((a, i) => (
          <span key={a.id} className="flex items-center gap-1.5 rounded-full border border-ber-border bg-white px-3 py-1 text-xs font-semibold text-ber-carbon">
            <span className="text-[10px] font-bold text-ber-gray/60">{i + 1}.</span> {a.nome}
            <span className="text-[10px] text-ber-gray">({a.fotos.length})</span>
            {!bloqueado && (
              <>
                <button onClick={() => renomearAmbiente(a)} className="text-ber-gray/60 hover:text-ber-carbon"><Pencil size={11} /></button>
                <button onClick={() => excluirAmbiente(a)} className="text-ber-gray/60 hover:text-red-600"><X size={12} /></button>
              </>
            )}
          </span>
        ))}
        {!bloqueado && (
          <span className="flex items-center gap-1">
            <input value={novoAmbiente} onChange={e => setNovoAmbiente(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') criarAmbiente(); }}
              placeholder="novo ambiente (ex: Salão)"
              className="w-44 rounded-full border border-ber-gray/30 bg-white px-3 py-1 text-xs focus:border-ber-teal focus:outline-none" />
            <button onClick={criarAmbiente} className="rounded-full bg-ber-carbon p-1.5 text-white hover:bg-ber-black"><Plus size={12} /></button>
          </span>
        )}
      </div>

      {/* Fotos sem ambiente */}
      {semAmbiente.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-600">Sem ambiente — atribua cada foto ({semAmbiente.length})</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {semAmbiente.map(f => cardFoto(f, null))}
          </div>
        </div>
      )}

      {/* Por ambiente */}
      {rel.ambientes.map((a, ai) => a.fotos.length > 0 && (
        <div key={a.id} className="mb-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ber-gray">{ai + 1}. {a.nome}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {a.fotos.map((f, fi) => cardFoto(f, `${ai + 1}.${fi}`))}
          </div>
        </div>
      ))}

      {totalFotos === 0 && (
        <div className="rounded-lg border-2 border-dashed border-ber-gray/20 p-12 text-center">
          <Camera size={32} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm text-ber-gray/60">Nenhuma foto ainda. Tire as fotos da vistoria e suba todas de uma vez.</p>
        </div>
      )}

      {/* Modo revisão — foto a foto */}
      {fotoRevisao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ber-border px-4 py-3">
              <p className="text-sm font-bold text-ber-carbon">Revisão de legendas — {revisao! + 1} de {filaRevisao.length}</p>
              <button onClick={() => { setRevisao(null); load(); }} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoRevisao.url} alt="" className="max-h-[45dvh] w-full rounded-lg object-contain bg-black/5" />
              <input
                key={fotoRevisao.id}
                defaultValue={fotoRevisao.legenda ?? ''}
                autoFocus
                placeholder="Escreva a legenda desta foto…"
                onBlur={e => { if (e.target.value !== (fotoRevisao.legenda ?? '')) patchFoto(fotoRevisao.id, { legenda: e.target.value.trim() }); }}
                className="mt-3 w-full rounded-lg border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-3">
                <button onClick={() => sugerirLegenda(fotoRevisao)} disabled={busyFoto === fotoRevisao.id}
                  className="flex items-center gap-1.5 rounded-md border border-ber-teal px-3 py-1.5 text-xs font-bold text-ber-teal hover:bg-ber-teal/10 disabled:opacity-50">
                  {busyFoto === fotoRevisao.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Sugerir com IA
                </button>
                <label className="flex items-center gap-1.5 text-xs text-ber-gray">
                  <input type="checkbox" checked={fotoRevisao.patologia} onChange={e => patchFoto(fotoRevisao.id, { patologia: e.target.checked })} className="h-3.5 w-3.5 accent-red-500" />
                  patologia / avaria
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-ber-border px-4 py-3">
              <button onClick={() => setRevisao(v => Math.max(0, (v ?? 0) - 1))} disabled={revisao === 0}
                className="flex items-center gap-1 rounded-md border border-ber-border px-3 py-1.5 text-xs font-semibold text-ber-carbon disabled:opacity-40">
                <ChevronLeft size={14} /> Anterior
              </button>
              {revisao! < filaRevisao.length - 1 ? (
                <button onClick={() => setRevisao(v => (v ?? 0) + 1)}
                  className="flex items-center gap-1 rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-bold text-white">
                  Próxima <ChevronRight size={14} />
                </button>
              ) : (
                <button onClick={() => { setRevisao(null); load(); }}
                  className="rounded-md bg-ber-olive px-3 py-1.5 text-xs font-bold text-white">
                  Concluir revisão ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
