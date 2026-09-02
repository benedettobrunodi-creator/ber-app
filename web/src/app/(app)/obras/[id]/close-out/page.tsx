'use client';

/**
 * Pós-Obra · Close Out (etapa 3, 27/08/26) — checklist de documentos da obra
 * que compila o Manual do Proprietário. Anexar arquivo marca como recebido.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Upload, CheckCircle2, FileText, Trash2, BookOpen, X, ListChecks } from 'lucide-react';
import api from '@/lib/api';

interface CloseOutItem {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  fornecedor: string | null;
  status: 'pendente' | 'recebido';
  arquivoUrl: string | null;
  arquivoNome: string | null;
  validade: string | null;
}

const CATEGORIAS: Record<string, string> = {
  asbuilt: 'Projetos As-Built',
  art_licencas: 'ART/RRT e Licenças',
  manuais: 'Manuais e NFs de Equipamentos',
  garantias: 'Garantias',
  acabamentos: 'Especificações de Acabamentos',
  contatos: 'Contatos de Manutenção',
  fotos_finais: 'Fotos Finais',
  laudos: 'Laudos e Testes',
  outros: 'Outros',
};

export default function CloseOutPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [itens, setItens] = useState<CloseOutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // confirm() nativo é bloqueado em PWA/webview mobile (delete "não fazia nada"
  // — reporte do Bruno 02/09/26); usamos modal próprio.
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; titulo: string } | null>(null);
  const uploadInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const [fCat, setFCat] = useState('outros');
  const [fTitulo, setFTitulo] = useState('');
  const [fForn, setFForn] = useState('');
  const [fValidade, setFValidade] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ data: CloseOutItem[] }>(`/obras/${obraId}/close-out`);
      setItens(r.data.data);
      setErro(null);
    } catch {
      setErro('Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [obraId]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true); setErro(null);
    try { await fn(); await load(); }
    catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(m || msg);
    } finally { setBusy(false); }
  }

  const grupos = useMemo(() => {
    const m = new Map<string, CloseOutItem[]>();
    for (const cat of Object.keys(CATEGORIAS)) m.set(cat, []);
    for (const i of itens) (m.get(i.categoria) ?? m.get('outros')!).push(i);
    return [...m.entries()].filter(([, arr]) => arr.length > 0);
  }, [itens]);

  const recebidos = itens.filter((i) => i.status === 'recebido').length;
  const pct = itens.length ? Math.round((recebidos / itens.length) * 100) : 0;
  const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';

  return (
    <div className="w-full max-w-[1200px] pb-24">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-ber-carbon">Close Out</h1>
        <div className="flex gap-2">
          <Link
            href={`/obras/${obraId}/close-out/manual`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold border border-ber-border rounded-lg px-3 py-2 hover:bg-white"
          >
            <BookOpen size={15} /> Manual do Proprietário
          </Link>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ber-carbon text-white rounded-lg px-3.5 py-2 hover:opacity-90">
            <Plus size={16} /> Item
          </button>
        </div>
      </div>

      {itens.length > 0 && (
        <div className="bg-white border border-ber-border rounded-xl px-4 py-3 mb-4">
          <div className="flex justify-between text-xs text-ber-gray mb-1.5">
            <span>Documentação recebida</span>
            <span className="font-bold text-ber-carbon">{recebidos}/{itens.length} · {pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-ber-surface overflow-hidden">
            <div className="h-full rounded-full bg-ber-green transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {erro && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</div>}

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : itens.length === 0 ? (
        <div className="bg-white border border-ber-border rounded-xl p-8 text-center">
          <ListChecks size={36} className="mx-auto text-ber-teal mb-3" />
          <p className="text-sm text-ber-gray mb-4">Nenhum item ainda. Comece pelo checklist padrão da BÈR — as-built, ART/RRT, manuais, garantias, acabamentos, contatos, fotos e laudos.</p>
          <button
            disabled={busy}
            onClick={() => run(() => api.post(`/obras/${obraId}/close-out/aplicar-padrao`), 'Erro ao aplicar checklist')}
            className="text-sm font-bold bg-ber-carbon text-white rounded-lg px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Aplicando…' : 'Aplicar checklist padrão'}
          </button>
        </div>
      ) : (
        grupos.map(([cat, arr]) => (
          <div key={cat} className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ber-teal mb-1.5">{CATEGORIAS[cat]}</p>
            <div className="bg-white border border-ber-border rounded-xl overflow-hidden">
              {arr.map((item, idx) => (
                <div key={item.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${idx < arr.length - 1 ? 'border-b border-ber-border/60' : ''}`}>
                  <div className="min-w-0 flex items-start gap-2.5">
                    {item.status === 'recebido'
                      ? <CheckCircle2 size={18} className="text-ber-green shrink-0 mt-0.5" />
                      : <span className="w-[18px] h-[18px] rounded-full border-2 border-ber-border shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className={`text-sm ${item.status === 'recebido' ? 'text-ber-gray' : 'text-ber-carbon font-medium'}`}>{item.titulo}</p>
                      <p className="text-[11px] text-ber-gray">
                        {item.fornecedor ? `${item.fornecedor} · ` : ''}
                        {item.validade ? `validade ${item.validade.slice(0, 10).split('-').reverse().join('/')} · ` : ''}
                        {item.arquivoUrl && item.arquivoNome && (
                          <a href={item.arquivoUrl} target="_blank" rel="noopener noreferrer" className="text-ber-teal font-semibold hover:underline inline-flex items-center gap-0.5">
                            <FileText size={11} /> {item.arquivoNome.slice(0, 28)}
                          </a>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      disabled={busy}
                      onClick={() => uploadInputs.current[item.id]?.click()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-ber-border hover:bg-ber-surface disabled:opacity-50"
                    >
                      <Upload size={12} /> {item.arquivoUrl ? 'Trocar' : 'Anexar'}
                    </button>
                    <input
                      ref={(el) => { uploadInputs.current[item.id] = el; }}
                      type="file" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) run(async () => {
                          const fd = new FormData();
                          fd.append('file', f);
                          await api.post(`/obras/${obraId}/close-out/${item.id}/arquivo`, fd);
                        }, 'Erro no upload');
                        e.target.value = '';
                      }}
                    />
                    {item.status === 'pendente' ? (
                      <button disabled={busy} onClick={() => run(() => api.patch(`/obras/${obraId}/close-out/${item.id}`, { status: 'recebido' }), 'Erro')} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-ber-green text-white hover:opacity-90 disabled:opacity-50">
                        ✓ Recebido
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => run(() => api.patch(`/obras/${obraId}/close-out/${item.id}`, { status: 'pendente' }), 'Erro')} className="text-[11px] px-2 py-1.5 rounded-lg text-ber-gray hover:bg-ber-surface disabled:opacity-50">
                        desfazer
                      </button>
                    )}
                    <button disabled={busy} onClick={() => setConfirmDelete({ id: item.id, titulo: item.titulo })} className="text-ber-gray hover:text-red-600 p-1 disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {itens.length > 0 && (
        <button
          disabled={busy}
          onClick={() => run(() => api.post(`/obras/${obraId}/close-out/aplicar-padrao`), 'Erro')}
          className="text-xs text-ber-gray hover:text-ber-carbon underline disabled:opacity-50"
        >
          Completar com itens do checklist padrão que faltam
        </button>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => !busy && setShowForm(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-ber-carbon">Novo item</h2>
              <button onClick={() => setShowForm(false)} disabled={busy} className="text-ber-gray hover:text-ber-carbon"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={inputCls}>
                {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder="Título do documento" className={inputCls} />
              <input value={fForn} onChange={(e) => setFForn(e.target.value)} placeholder="Fornecedor (opcional)" className={inputCls} />
              <label className="block text-[11px] font-semibold text-ber-gray">
                Validade (garantias)
                <input type="date" value={fValidade} onChange={(e) => setFValidade(e.target.value)} className={`${inputCls} mt-1`} />
              </label>
              <button
                disabled={busy || !fTitulo.trim()}
                onClick={() => run(async () => {
                  await api.post(`/obras/${obraId}/close-out`, {
                    categoria: fCat, titulo: fTitulo.trim(),
                    fornecedor: fForn.trim() || undefined,
                    validade: fValidade || undefined,
                  });
                  setShowForm(false); setFTitulo(''); setFForn(''); setFValidade('');
                }, 'Erro ao criar')}
                className="w-full bg-ber-carbon text-white font-bold text-sm py-3 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Salvando…' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white p-6">
            <h2 className="text-base font-bold text-ber-carbon">Excluir item?</h2>
            <p className="mt-2 text-sm text-ber-gray">O item <strong>"{confirmDelete.titulo}"</strong> será excluído do close out. Essa ação não pode ser desfeita.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={busy}
                className="flex-1 rounded-md border border-ber-gray/30 px-4 py-2 text-sm font-medium text-ber-carbon hover:bg-ber-offwhite disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={async () => { const alvo = confirmDelete; setConfirmDelete(null); await run(() => api.delete(`/obras/${obraId}/close-out/${alvo.id}`), 'Erro ao excluir'); }}
                disabled={busy}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
