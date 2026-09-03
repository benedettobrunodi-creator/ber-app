'use client';

/**
 * Pós-Obra · Manual do Proprietário digital (03/09/26).
 * Preenche-se tudo aqui (dados, fotos, anexos) e o sistema gera o PDF
 * formatado no modelo BER_Manual (parte 2). 3 camadas:
 *  - AUTO: projetos ← Controle de Documentos · ficha técnica ← obra ·
 *    fornecedores ← contratações (sugestão com 1 clique)
 *  - BIBLIOTECA: checklist de materiais → seções "Usar e manter" do PDF
 *  - POR OBRA: capa, galeria, memorial de acabamentos, mobiliário, anexos
 */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Upload, BookOpen, Download } from 'lucide-react';
import api from '@/lib/api';

interface ItemGaleria { url: string; legenda?: string | null }
interface ItemAcabamento { grupo: string; nome: string; cor?: string | null; tipo?: string | null; fornecedor?: string | null }
interface ItemMobiliario { nome: string; medida?: string | null; descricao?: string | null }
interface ItemFornecedor { categoria: string; nome: string; telefone?: string | null; email?: string | null; endereco?: string | null }
interface ItemEquipe { papel: string; nome: string; email?: string | null }
interface ItemAnexo { tipo: string; nome: string; url: string }

interface Manual {
  fotoCapaUrl: string | null;
  dataEntrega: string | null;
  urlOnline: string | null;
  canalAssistencia: string | null;
  textoBemVindos: string | null;
  materiais: string[];
  galeria: ItemGaleria[];
  acabamentos: ItemAcabamento[];
  mobiliario: ItemMobiliario[];
  fornecedores: ItemFornecedor[];
  equipe: ItemEquipe[];
  anexos: ItemAnexo[];
}

interface BibItem { key: string; label: string; grupo: string }
interface AutoData {
  obra: { name: string; client: string | null; address: string | null; areaM2: number | null; dataFimObra: string | null };
  projetos: { codigo: string; disciplina: string; revisao: string }[];
  fornecedoresSugestao: { categoria: string; nome: string }[];
}

async function comprimirFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const MAX = 2000;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
}

const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';
const cardCls = 'rounded-xl border border-ber-border bg-white p-4';
const secTitle = 'text-sm font-bold text-ber-carbon';
const secHint = 'mt-0.5 text-xs text-ber-gray';

export default function ManualProprietarioPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [manual, setManual] = useState<Manual | null>(null);
  const [bib, setBib] = useState<BibItem[]>([]);
  const [auto, setAuto] = useState<AutoData | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const capaInput = useRef<HTMLInputElement | null>(null);
  const galeriaInput = useRef<HTMLInputElement | null>(null);
  const anexoInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get(`/obras/${obraId}/close-out/manual-proprietario`).then(r => {
      const d = r.data.data;
      const m = d.manual;
      setManual({
        fotoCapaUrl: m.fotoCapaUrl ?? null,
        dataEntrega: m.dataEntrega ? String(m.dataEntrega).slice(0, 10) : null,
        urlOnline: m.urlOnline ?? null,
        canalAssistencia: m.canalAssistencia ?? null,
        textoBemVindos: m.textoBemVindos ?? null,
        materiais: m.materiais ?? [],
        galeria: m.galeria ?? [],
        acabamentos: m.acabamentos ?? [],
        mobiliario: m.mobiliario ?? [],
        fornecedores: m.fornecedores ?? [],
        equipe: m.equipe ?? [],
        anexos: m.anexos ?? [],
      });
      setBib(d.biblioteca ?? []);
      setAuto(d.auto ?? null);
    }).catch(() => alert('Erro ao carregar o manual'));
  }, [obraId]);

  async function salvar() {
    if (!manual) return;
    setSaving(true);
    try {
      await api.put(`/obras/${obraId}/close-out/manual-proprietario`, manual);
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function uploadArquivo(file: File, comprimir: boolean): Promise<string | null> {
    try {
      const fd = new FormData();
      if (comprimir && file.type.startsWith('image/')) {
        const blob = await comprimirFoto(file);
        fd.append('file', blob, file.name.replace(/\.[^.]+$/, '.jpg'));
      } else {
        fd.append('file', file);
      }
      const r = await api.post(`/obras/${obraId}/close-out/manual-proprietario/arquivo`, fd);
      return r.data.data.url as string;
    } catch { return null; }
  }

  function upd<K extends keyof Manual>(key: K, value: Manual[K]) {
    setManual(prev => prev ? { ...prev, [key]: value } : prev);
  }

  if (!manual) return <div className="p-6 text-sm text-ber-gray">Carregando…</div>;

  const grupos = Array.from(new Set(bib.map(b => b.grupo)));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-44">
      <Link href={`/obras/${obraId}/close-out`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Close Out
      </Link>

      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="flex items-baseline gap-2 text-xl font-bold text-ber-carbon">
          <BookOpen size={20} className="text-ber-teal self-center" /> Manual do Proprietário
          {auto && <span className="rounded-md bg-ber-carbon px-2 py-0.5 text-sm font-bold text-white">{auto.obra.name}</span>}
        </h1>
      </div>

      <div className="space-y-5">
        {/* Auto-preenchido */}
        {auto && (
          <div className="rounded-xl border border-ber-teal/30 bg-ber-teal/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ber-teal">O sistema preenche sozinho</p>
            <div className="mt-2 grid gap-1 text-sm text-ber-carbon md:grid-cols-2">
              <p>Ficha técnica: <span className="text-ber-gray">{auto.obra.name}{auto.obra.client ? ` · ${auto.obra.client}` : ''}{auto.obra.areaM2 ? ` · ${auto.obra.areaM2} m²` : ''}</span></p>
              <p>Projetos entregues: <span className="font-semibold">{auto.projetos.length} desenho(s)</span> <span className="text-ber-gray">← Controle de Documentos (revisão atual de cada um)</span></p>
            </div>
            {auto.obra.address && <p className="mt-1 text-xs text-ber-gray">{auto.obra.address}</p>}
          </div>
        )}

        {/* Capa & entrega */}
        <div className={cardCls}>
          <p className={secTitle}>Capa e entrega</p>
          <div className="mt-3 grid gap-4 md:grid-cols-[200px_1fr]">
            <div>
              <button type="button" onClick={() => capaInput.current?.click()} disabled={uploading}
                className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-ber-border bg-ber-surface text-xs text-ber-gray hover:border-ber-teal">
                {manual.fotoCapaUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={manual.fotoCapaUrl} alt="Capa" className="h-full w-full object-cover" />
                  : <span className="px-3 text-center">Foto de capa<br />(clique pra escolher)</span>}
              </button>
              <input ref={capaInput} type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setUploading(true);
                  const url = await uploadArquivo(f, true);
                  setUploading(false);
                  if (url) upd('fotoCapaUrl', url); else alert('Falha no upload');
                }} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Data de entrega</label>
                <input type="date" className={inputCls} value={manual.dataEntrega ?? ''}
                  onChange={e => upd('dataEntrega', e.target.value || null)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Canal de assistência (WhatsApp/e-mail)</label>
                <input className={inputCls} value={manual.canalAssistencia ?? ''} placeholder="ex: assistencia@ber-engenharia.com.br"
                  onChange={e => upd('canalAssistencia', e.target.value || null)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Link da versão online (QR da capa)</label>
                <input className={inputCls} value={manual.urlOnline ?? ''} placeholder="https://…"
                  onChange={e => upd('urlOnline', e.target.value || null)} />
              </div>
            </div>
          </div>
        </div>

        {/* Materiais da obra */}
        <div className={cardCls}>
          <p className={secTitle}>Materiais da obra ({manual.materiais.length} marcados)</p>
          <p className={secHint}>Marque o que existe nesta obra — o PDF monta as seções "Usar e manter" só do que estiver marcado.</p>
          {grupos.map(g => (
            <div key={g} className="mt-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ber-gray">{g}</p>
              <div className="flex flex-wrap gap-1.5">
                {bib.filter(b => b.grupo === g).map(b => {
                  const on = manual.materiais.includes(b.key);
                  return (
                    <button key={b.key} type="button"
                      onClick={() => upd('materiais', on ? manual.materiais.filter(k => k !== b.key) : [...manual.materiais, b.key])}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        on ? 'border-ber-teal bg-ber-teal text-white' : 'border-ber-border bg-white text-ber-carbon hover:bg-ber-surface'
                      }`}>
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Galeria */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <p className={secTitle}>Galeria da obra ({manual.galeria.length})</p>
              <p className={secHint}>Fotos da entrega com legenda — viram a seção 1.1 do manual.</p>
            </div>
            <button type="button" onClick={() => galeriaInput.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
              <Upload size={13} /> {uploading ? 'Subindo…' : 'Adicionar fotos'}
            </button>
            <input ref={galeriaInput} type="file" accept="image/*" multiple className="hidden"
              onChange={async e => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length === 0) return;
                setUploading(true);
                const novas: ItemGaleria[] = [];
                for (const f of files) {
                  const url = await uploadArquivo(f, true);
                  if (url) novas.push({ url, legenda: '' });
                }
                setUploading(false);
                upd('galeria', [...manual.galeria, ...novas]);
              }} />
          </div>
          {manual.galeria.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              {manual.galeria.map((g, i) => (
                <div key={`${g.url}-${i}`} className="overflow-hidden rounded-lg border border-ber-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt="" className="h-28 w-full object-cover" />
                  <div className="flex items-center gap-1 p-1.5">
                    <input className="w-full rounded border border-ber-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ber-teal"
                      placeholder="Legenda" value={g.legenda ?? ''}
                      onChange={e => upd('galeria', manual.galeria.map((x, j) => j === i ? { ...x, legenda: e.target.value } : x))} />
                    <button onClick={() => upd('galeria', manual.galeria.filter((_, j) => j !== i))}
                      className="text-ber-gray/50 hover:text-red-500"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Memorial de acabamentos */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <p className={secTitle}>Memorial · materiais e acabamentos ({manual.acabamentos.length})</p>
              <p className={secHint}>Cards com material, cor e fornecedor — seção 4.2 do manual.</p>
            </div>
            <button type="button"
              onClick={() => upd('acabamentos', [...manual.acabamentos, { grupo: 'Pisos', nome: '', cor: '#CCCCCC', tipo: '', fornecedor: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-ber-border px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-surface">
              <Plus size={13} /> Adicionar
            </button>
          </div>
          {manual.acabamentos.length > 0 && (
            <div className="mt-3 space-y-2">
              {manual.acabamentos.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-ber-surface p-2">
                  <input type="color" value={a.cor ?? '#CCCCCC'} title="Cor do material"
                    onChange={e => upd('acabamentos', manual.acabamentos.map((x, j) => j === i ? { ...x, cor: e.target.value } : x))}
                    className="h-9 w-9 cursor-pointer rounded border border-ber-border bg-white p-0.5" />
                  <input className="w-32 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Grupo (ex: Pisos)"
                    value={a.grupo} onChange={e => upd('acabamentos', manual.acabamentos.map((x, j) => j === i ? { ...x, grupo: e.target.value } : x))} />
                  <input className="min-w-[140px] flex-1 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Nome (ex: Cânion Verde)"
                    value={a.nome} onChange={e => upd('acabamentos', manual.acabamentos.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <input className="w-40 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Tipo (ex: Tinta acrílica)"
                    value={a.tipo ?? ''} onChange={e => upd('acabamentos', manual.acabamentos.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))} />
                  <input className="w-36 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Fornecedor"
                    value={a.fornecedor ?? ''} onChange={e => upd('acabamentos', manual.acabamentos.map((x, j) => j === i ? { ...x, fornecedor: e.target.value } : x))} />
                  <button onClick={() => upd('acabamentos', manual.acabamentos.filter((_, j) => j !== i))}
                    className="text-ber-gray/50 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobiliário */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <p className={secTitle}>Mobiliário ({manual.mobiliario.length})</p>
              <p className={secHint}>Peças especificadas na obra — cards da seção 4.2.</p>
            </div>
            <button type="button" onClick={() => upd('mobiliario', [...manual.mobiliario, { nome: '', medida: '', descricao: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-ber-border px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-surface">
              <Plus size={13} /> Adicionar
            </button>
          </div>
          {manual.mobiliario.length > 0 && (
            <div className="mt-3 space-y-2">
              {manual.mobiliario.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-ber-surface p-2">
                  <input className="min-w-[160px] flex-1 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Peça (ex: Mesa Volle reunião)"
                    value={m.nome} onChange={e => upd('mobiliario', manual.mobiliario.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <input className="w-32 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Medida (mm)"
                    value={m.medida ?? ''} onChange={e => upd('mobiliario', manual.mobiliario.map((x, j) => j === i ? { ...x, medida: e.target.value } : x))} />
                  <input className="min-w-[160px] flex-1 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Acabamento/descrição"
                    value={m.descricao ?? ''} onChange={e => upd('mobiliario', manual.mobiliario.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} />
                  <button onClick={() => upd('mobiliario', manual.mobiliario.filter((_, j) => j !== i))}
                    className="text-ber-gray/50 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fornecedores */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className={secTitle}>Fornecedores da obra ({manual.fornecedores.length})</p>
              <p className={secHint}>Diretório de assistência técnica — seção 6.1.</p>
            </div>
            <div className="flex gap-2">
              {auto && auto.fornecedoresSugestao.length > 0 && (
                <button type="button"
                  onClick={() => {
                    const nomes = new Set(manual.fornecedores.map(f => f.nome.toLowerCase()));
                    const novos = auto.fornecedoresSugestao.filter(s => !nomes.has(s.nome.toLowerCase()));
                    upd('fornecedores', [...manual.fornecedores, ...novos]);
                  }}
                  className="rounded-lg bg-ber-teal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                  Puxar das contratações ({auto.fornecedoresSugestao.length})
                </button>
              )}
              <button type="button" onClick={() => upd('fornecedores', [...manual.fornecedores, { categoria: '', nome: '', telefone: '', email: '', endereco: '' }])}
                className="inline-flex items-center gap-1 rounded-lg border border-ber-border px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-surface">
                <Plus size={13} /> Adicionar
              </button>
            </div>
          </div>
          {manual.fornecedores.length > 0 && (
            <div className="mt-3 space-y-2">
              {manual.fornecedores.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-ber-surface p-2">
                  <input className="w-40 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Categoria (ex: Drywall e gesso)"
                    value={f.categoria} onChange={e => upd('fornecedores', manual.fornecedores.map((x, j) => j === i ? { ...x, categoria: e.target.value } : x))} />
                  <input className="min-w-[140px] flex-1 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Nome"
                    value={f.nome} onChange={e => upd('fornecedores', manual.fornecedores.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <input className="w-32 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Telefone"
                    value={f.telefone ?? ''} onChange={e => upd('fornecedores', manual.fornecedores.map((x, j) => j === i ? { ...x, telefone: e.target.value } : x))} />
                  <input className="w-44 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="E-mail"
                    value={f.email ?? ''} onChange={e => upd('fornecedores', manual.fornecedores.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                  <input className="min-w-[160px] flex-1 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Endereço"
                    value={f.endereco ?? ''} onChange={e => upd('fornecedores', manual.fornecedores.map((x, j) => j === i ? { ...x, endereco: e.target.value } : x))} />
                  <button onClick={() => upd('fornecedores', manual.fornecedores.filter((_, j) => j !== i))}
                    className="text-ber-gray/50 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equipe de execução */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <p className={secTitle}>Equipe de execução ({manual.equipe.length})</p>
              <p className={secHint}>Papéis e nomes da ficha técnica (1.3) — diretor de obras, PMO, gestor…</p>
            </div>
            <button type="button" onClick={() => upd('equipe', [...manual.equipe, { papel: '', nome: '', email: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-ber-border px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-surface">
              <Plus size={13} /> Adicionar
            </button>
          </div>
          {manual.equipe.length > 0 && (
            <div className="mt-3 space-y-2">
              {manual.equipe.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-ber-surface p-2">
                  <input className="w-48 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Papel (ex: Gestor de obra)"
                    value={p.papel} onChange={e => upd('equipe', manual.equipe.map((x, j) => j === i ? { ...x, papel: e.target.value } : x))} />
                  <input className="min-w-[140px] flex-1 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="Nome"
                    value={p.nome} onChange={e => upd('equipe', manual.equipe.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <input className="w-56 rounded border border-ber-border px-2 py-1.5 text-xs" placeholder="E-mail (opcional)"
                    value={p.email ?? ''} onChange={e => upd('equipe', manual.equipe.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                  <button onClick={() => upd('equipe', manual.equipe.filter((_, j) => j !== i))}
                    className="text-ber-gray/50 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anexos */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <p className={secTitle}>Documentos técnicos ({manual.anexos.length})</p>
              <p className={secHint}>ART, RRT e outros — seção 2.1 (entram na versão digital do manual).</p>
            </div>
            <button type="button" onClick={() => anexoInput.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
              <Upload size={13} /> {uploading ? 'Subindo…' : 'Anexar arquivo'}
            </button>
            <input ref={anexoInput} type="file" multiple className="hidden"
              onChange={async e => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length === 0) return;
                setUploading(true);
                const novos: ItemAnexo[] = [];
                for (const f of files) {
                  const url = await uploadArquivo(f, false);
                  if (url) novos.push({ tipo: /rrt/i.test(f.name) ? 'RRT' : /art/i.test(f.name) ? 'ART' : 'Outro', nome: f.name, url });
                }
                setUploading(false);
                upd('anexos', [...manual.anexos, ...novos]);
              }} />
          </div>
          {manual.anexos.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {manual.anexos.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-ber-surface px-3 py-2 text-xs">
                  <select className="rounded border border-ber-border bg-white px-1.5 py-1"
                    value={a.tipo} onChange={e => upd('anexos', manual.anexos.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))}>
                    {['ART', 'RRT', 'Laudo', 'Outro'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-ber-teal hover:underline inline-flex items-center gap-1">
                    <Download size={12} /> {a.nome}
                  </a>
                  <button onClick={() => upd('anexos', manual.anexos.filter((_, j) => j !== i))}
                    className="text-ber-gray/50 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barra de salvar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ber-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <p className="text-xs text-ber-gray">
            {savedAt ? `Salvo às ${savedAt}` : 'Alterações não salvas ainda'}
            <span className="hidden md:inline"> · o PDF formatado (modelo Poatek) é a próxima etapa</span>
          </p>
          <button onClick={salvar} disabled={saving}
            className="rounded-lg bg-ber-olive px-5 py-2 text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar manual'}
          </button>
        </div>
      </div>
    </div>
  );
}
