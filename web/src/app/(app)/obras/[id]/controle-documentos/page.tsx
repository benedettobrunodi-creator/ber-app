'use client';

/**
 * Durante a Obra · Controle de Documentos (31/08/26).
 * Substitui os controles em planilha (colunas fixas REV/DATA + campo
 * "última atualização" solto que desincroniza). Revisão é histórico
 * normalizado — 1 linha por revisão, ilimitado, arquivo por versão; a
 * última revisão é sempre calculada, nunca digitada à parte.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Trash2, Pencil, ChevronDown, ChevronUp, Download, Upload, Archive, ArchiveRestore } from 'lucide-react';
import api from '@/lib/api';
import { confirmar } from '@/lib/confirmar';

const DISCIPLINAS = [
  'Arquitetura', 'Estrutural', 'Instalações Elétricas', 'Hidráulica', 'Ar Condicionado',
  'Combate a Incêndio', 'Detecção e Alarme', 'Cabeamento Estruturado', 'SPK (Sprinklers)',
  'Divisórias', 'Pedras', 'Mobiliário', 'Marcenaria', 'Shop Drawings - Outros', 'Projetos Técnicos - Outros',
  'Comunicação Visual', 'Interiores', 'Paisagismo', 'Projeto Legal', 'Outra',
] as const;

// ─── Setorização (mockup do Bruno, 02/09/26) ───
const SETOR_ARQUITETURA = ['Arquitetura', 'Interiores', 'Paisagismo'];
// Sub-áreas de Projetos Técnicos — cada uma abre a "página" da(s) disciplina(s)
const TECNICOS_SUBS: { label: string; disciplinas: string[] }[] = [
  { label: 'HVAC', disciplinas: ['Ar Condicionado'] },
  { label: 'Elétrica / Cabeamento', disciplinas: ['Instalações Elétricas', 'Cabeamento Estruturado', 'Detecção e Alarme'] },
  { label: 'Civil', disciplinas: ['Estrutural', 'Hidráulica'] },
  { label: 'SPK', disciplinas: ['SPK (Sprinklers)'] },
  { label: 'Incêndio', disciplinas: ['Combate a Incêndio'] },
  { label: 'Outros', disciplinas: ['Projetos Técnicos - Outros'] },
];
const SETOR_TECNICOS = TECNICOS_SUBS.flatMap(s => s.disciplinas);
// Shop Drawings (SDs) — setor próprio (Bruno 02/09)
const SDS_SUBS: { label: string; disciplinas: string[] }[] = [
  { label: 'Divisórias', disciplinas: ['Divisórias'] },
  { label: 'Pedras', disciplinas: ['Pedras'] },
  { label: 'Mobiliário', disciplinas: ['Mobiliário'] },
  { label: 'Marcenaria', disciplinas: ['Marcenaria'] },
  { label: 'Outros', disciplinas: ['Shop Drawings - Outros'] },
];
const SETOR_SDS = SDS_SUBS.flatMap(s => s.disciplinas);
const SETOR_OUTROS: string[] = DISCIPLINAS.filter(d => !SETOR_ARQUITETURA.includes(d) && !SETOR_TECNICOS.includes(d) && !SETOR_SDS.includes(d));
type Setor = 'todos' | 'arquitetura' | 'tecnicos' | 'sds' | 'outros' | 'obsoletos';

const ETAPAS = ['Conceito', 'Anteprojeto (AP)', 'Executivo (EX)', 'Locação (LO)', 'As Built'] as const;

interface Revisao {
  id: string;
  revisao: string;
  data: string;
  createdAt: string;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  observacao: string | null;
}

interface Documento {
  id: string;
  codigo: string;
  titulo: string | null;
  disciplina: string;
  projetista: string | null;
  etapa: string | null;
  obsoleto: boolean;
  createdAt: string;
  revisoes: Revisao[];
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function ultimaRevisao(d: Documento): Revisao | null {
  if (d.revisoes.length === 0) return null;
  return [...d.revisoes].sort((a, b) => b.data.localeCompare(a.data))[0];
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function emptyDocForm() {
  return { codigo: '', titulo: '', disciplina: DISCIPLINAS[0] as string, projetista: '', etapa: '' };
}

/** Espelho do parseNomeArquivo do backend — pré-preenche a tela de conferência. */
function parseNome(filename: string): { codigo: string; revisao: string } {
  const base = filename.replace(/\.[^./\\]+$/, '');
  const m = base.match(/^(.+?)[-_ ]+[Rr](?:ev)?\.?\s*(\d+)$/);
  if (m) return { codigo: m[1].trim(), revisao: `R${m[2].padStart(2, '0')}` };
  return { codigo: base.trim(), revisao: 'R00' };
}

interface LoteItem {
  file: File;
  codigo: string;
  revisao: string;
  disciplina: string;
}

export default function ControleDocumentosPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Documento | null>(null);
  const [form, setForm] = useState(emptyDocForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revForms, setRevForms] = useState<Record<string, { revisao: string; data: string; observacao: string; file: File | null }>>({});
  const [savingRev, setSavingRev] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [dragOver, setDragOver] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ criados: number; atualizados: number } | null>(null);
  const bulkInput = useRef<HTMLInputElement | null>(null);
  // Tela de conferência do lote (03/09/26): arquivos escolhidos ficam aqui
  // até o usuário confirmar código/revisão/disciplina de cada um.
  const [lote, setLote] = useState<LoteItem[] | null>(null);
  const [loteProjetista, setLoteProjetista] = useState('');
  // Edição inline de revisão existente (03/09/26)
  const [editRev, setEditRev] = useState<{ id: string; docId: string; revisao: string; data: string; observacao: string } | null>(null);
  const [savingEditRev, setSavingEditRev] = useState(false);
  const [obraNome, setObraNome] = useState('');
  const [setor, setSetor] = useState<Setor>('todos');
  const [subTecnico, setSubTecnico] = useState<string | null>(null); // label da sub-área ativa

  const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';

  async function load() {
    setLoading(true);
    try {
      const [r, obraRes] = await Promise.all([
        api.get(`/obras/${obraId}/controle-documentos`),
        api.get(`/obras/${obraId}`).catch(() => null),
      ]);
      setDocumentos(r.data.data ?? []);
      if (obraRes) setObraNome(obraRes.data.data?.name ?? '');
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [obraId]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // (03/09/26) Botão "Novo documento" foi unificado no fluxo "Inserir arquivos"
  // com tela de conferência — o modal showForm agora só edita documento existente.
  function openEdit(d: Documento) {
    setEditando(d);
    setForm({ codigo: d.codigo, titulo: d.titulo ?? '', disciplina: d.disciplina, projetista: d.projetista ?? '', etapa: d.etapa ?? '' });
    setError('');
    setShowForm(true);
  }

  async function saveDoc() {
    if (!form.codigo.trim()) { setError('Informe o código'); return; }
    setSaving(true);
    setError('');
    const payload = {
      codigo: form.codigo,
      titulo: form.titulo || null,
      disciplina: form.disciplina,
      projetista: form.projetista || null,
      etapa: form.etapa || null,
    };
    try {
      if (editando) {
        const r = await api.patch(`/obras/${obraId}/controle-documentos/${editando.id}`, payload);
        setDocumentos(prev => prev.map(d => d.id === editando.id ? r.data.data : d));
      } else {
        const r = await api.post(`/obras/${obraId}/controle-documentos`, payload);
        setDocumentos(prev => [...prev, r.data.data]);
      }
      setShowForm(false);
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(m || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function updateField(id: string, field: 'codigo' | 'disciplina' | 'etapa' | 'projetista', value: string) {
    try {
      const r = await api.patch(`/obras/${obraId}/controle-documentos/${id}`, { [field]: field === 'etapa' || field === 'projetista' ? (value || null) : value });
      setDocumentos(prev => prev.map(d => d.id === id ? r.data.data : d));
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao salvar');
      load();
    }
  }

  /** Disciplina sugerida pro lote conforme o setor/sub-área aberto na tela. */
  function disciplinaPadrao(): string {
    if (setor === 'arquitetura') return 'Arquitetura';
    if (setor === 'tecnicos') return TECNICOS_SUBS.find(s => s.label === subTecnico)?.disciplinas[0] ?? 'Projetos Técnicos - Outros';
    if (setor === 'sds') return SDS_SUBS.find(s => s.label === subTecnico)?.disciplinas[0] ?? 'Shop Drawings - Outros';
    return 'Outra';
  }

  /** Passo 1 — escolheu/arrastou arquivos: abre a tela de conferência (não sobe ainda). */
  function handleBulkFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setBulkResult(null);
    const padrao = disciplinaPadrao();
    setLote(arr.map(file => {
      const { codigo, revisao } = parseNome(file.name);
      // Código já existe na obra → vai virar revisão nova; herda a disciplina do doc
      const existente = documentos.find(d => d.codigo === codigo);
      return { file, codigo, revisao, disciplina: existente?.disciplina ?? padrao };
    }));
  }

  /** Passo 2 — confirmou a conferência: sobe o lote com os metadados escolhidos. */
  async function enviarLote() {
    if (!lote || lote.length === 0) return;
    for (const item of lote) {
      if (!item.codigo.trim() || !item.revisao.trim()) { alert('Preencha código e revisão de todos os arquivos'); return; }
    }
    const codigos = lote.map(i => i.codigo.trim());
    if (new Set(codigos).size !== codigos.length) { alert('Tem dois arquivos com o mesmo código no lote — ajuste antes de subir'); return; }
    setBulkUploading(true);
    try {
      const fd = new FormData();
      lote.forEach(i => fd.append('files', i.file));
      fd.append('meta', JSON.stringify(lote.map(i => ({
        nome: i.file.name,
        codigo: i.codigo.trim(),
        revisao: i.revisao.trim(),
        disciplina: i.disciplina,
        projetista: loteProjetista.trim() || null,
      }))));
      const r = await api.post(`/obras/${obraId}/controle-documentos/bulk-upload`, fd);
      setDocumentos(r.data.data.documentos);
      setBulkResult({ criados: r.data.data.criados.length, atualizados: r.data.data.atualizados.length });
      setLote(null);
      setLoteProjetista('');
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao subir arquivos');
    } finally {
      setBulkUploading(false);
    }
  }

  async function handleRemoveDoc(id: string) {
    if (!(await confirmar('Excluir este documento e todo o histórico de revisões dele?', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/controle-documentos/${id}`);
      setDocumentos(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      alert(status === 403
        ? 'Você não tem permissão pra excluir documentos — fale com a coordenação.'
        : 'Erro ao excluir');
    }
  }

  async function openNovaRevisao(d: Documento) {
    toggleExpand(d.id);
    if (revForms[d.id]) return;
    let sugestao = '';
    try {
      const r = await api.get(`/obras/${obraId}/controle-documentos/${d.id}/proxima-revisao`);
      sugestao = r.data.data.sugestao;
    } catch {}
    setRevForms(prev => ({ ...prev, [d.id]: { revisao: sugestao, data: new Date().toISOString().slice(0, 10), observacao: '', file: null } }));
  }

  async function saveRevisao(docId: string) {
    const f = revForms[docId];
    if (!f || !f.revisao.trim() || !f.data) { alert('Preencha revisão e data'); return; }
    setSavingRev(docId);
    try {
      const fd = new FormData();
      fd.append('revisao', f.revisao);
      fd.append('data', f.data);
      if (f.observacao) fd.append('observacao', f.observacao);
      if (f.file) fd.append('file', f.file);
      const r = await api.post(`/obras/${obraId}/controle-documentos/${docId}/revisoes`, fd);
      setDocumentos(prev => prev.map(d => d.id === docId ? r.data.data : d));
      setRevForms(prev => { const next = { ...prev }; delete next[docId]; return next; });
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao salvar revisão');
    } finally {
      setSavingRev(null);
    }
  }

  async function saveEditRev() {
    if (!editRev) return;
    if (!editRev.revisao.trim() || !editRev.data) { alert('Preencha revisão e data'); return; }
    setSavingEditRev(true);
    try {
      const r = await api.patch(`/obras/${obraId}/controle-documentos/${editRev.docId}/revisoes/${editRev.id}`, {
        revisao: editRev.revisao.trim(),
        data: editRev.data,
        observacao: editRev.observacao || null,
      });
      setDocumentos(prev => prev.map(d => d.id === editRev.docId ? r.data.data : d));
      setEditRev(null);
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao salvar revisão');
    } finally {
      setSavingEditRev(false);
    }
  }

  async function handleRemoveRevisao(docId: string, revisaoId: string) {
    if (!(await confirmar('Excluir esta revisão?', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/controle-documentos/${docId}/revisoes/${revisaoId}`);
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, revisoes: d.revisoes.filter(r => r.id !== revisaoId) } : d));
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      alert(status === 403
        ? 'Você não tem permissão pra excluir revisões — fale com a coordenação.'
        : 'Erro ao excluir revisão');
    }
  }

  // Documentos visíveis conforme o setor selecionado (obsoletos só no setor deles)
  const visiveis = documentos.filter(d => {
    if (setor === 'obsoletos') return d.obsoleto;
    if (d.obsoleto) return false;
    if (setor === 'todos') return true;
    if (setor === 'arquitetura') return SETOR_ARQUITETURA.includes(d.disciplina);
    if (setor === 'outros') return SETOR_OUTROS.includes(d.disciplina);
    if (setor === 'sds') {
      const sub = SDS_SUBS.find(t => t.label === subTecnico);
      return (sub ? sub.disciplinas : SETOR_SDS).includes(d.disciplina);
    }
    // tecnicos
    const sub = TECNICOS_SUBS.find(t => t.label === subTecnico);
    const conjunto = sub ? sub.disciplinas : SETOR_TECNICOS;
    return conjunto.includes(d.disciplina);
  });
  const obsoletosCount = documentos.filter(d => d.obsoleto).length;

  const grupos = DISCIPLINAS
    .map(disc => ({ disc, docs: visiveis.filter(d => d.disciplina === disc) }))
    .filter(g => g.docs.length > 0);

  async function toggleObsoleto(d: Documento) {
    const marcar = !d.obsoleto;
    if (marcar && !(await confirmar(`Mover "${d.codigo}" para Obsoletos? O desenho sai da lista ativa (dá pra restaurar).`, { titulo: 'Mover para Obsoletos', confirmarLabel: 'Mover' }))) return;
    try {
      const r = await api.patch(`/obras/${obraId}/controle-documentos/${d.id}`, { obsoleto: marcar });
      setDocumentos(prev => prev.map(x => x.id === d.id ? r.data.data : x));
    } catch { alert('Erro ao atualizar'); }
  }

  return (
    <div className="w-full pb-24"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleBulkFiles(e.dataTransfer.files); }}>
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-ber-teal/10 backdrop-blur-[1px]">
          <div className="rounded-2xl border-2 border-dashed border-ber-teal bg-white px-8 py-6 text-lg font-bold text-ber-teal shadow-xl">Solte os arquivos pra inserir</div>
        </div>
      )}
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="flex flex-wrap items-baseline gap-2 text-xl font-bold text-ber-carbon">
          Controle de Documentos
          {obraNome && <span className="rounded-md bg-ber-carbon px-2 py-0.5 text-sm font-bold text-white">{obraNome}</span>}
        </h1>
        <button onClick={() => bulkInput.current?.click()} disabled={bulkUploading}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ber-olive text-ber-carbon rounded-lg px-3.5 py-2 hover:brightness-95 disabled:opacity-60"
          title="Escolha (ou arraste pra página) um ou vários arquivos — você confere código, revisão e disciplina antes de subir">
          <Upload size={15} /> {bulkUploading ? 'Subindo…' : 'Inserir arquivos'}
        </button>
      </div>

      <input ref={bulkInput} type="file" multiple className="hidden"
        onChange={e => { if (e.target.files) handleBulkFiles(e.target.files); e.target.value = ''; }} />

      {/* ─── Setores — faixa escura (pedido Bruno 02/09) ─── */}
      <div className="mb-4 rounded-xl bg-ber-carbon/[0.06] border border-ber-border p-1">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {([
            { key: 'todos', label: 'Todos', count: documentos.filter(d => !d.obsoleto).length },
            { key: 'arquitetura', label: 'Arquitetura', count: documentos.filter(d => !d.obsoleto && SETOR_ARQUITETURA.includes(d.disciplina)).length },
            { key: 'tecnicos', label: 'Projetos Técnicos', count: documentos.filter(d => !d.obsoleto && SETOR_TECNICOS.includes(d.disciplina)).length },
            { key: 'sds', label: 'Shop Drawings (SDs)', count: documentos.filter(d => !d.obsoleto && SETOR_SDS.includes(d.disciplina)).length },
            { key: 'outros', label: 'Outros Documentos', count: documentos.filter(d => !d.obsoleto && SETOR_OUTROS.includes(d.disciplina)).length },
            { key: 'obsoletos', label: 'Obsoletos', count: obsoletosCount },
          ] as { key: Setor; label: string; count: number }[]).map(t => (
            <button key={t.key}
              onClick={() => { setSetor(t.key); setSubTecnico(null); }}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                setor === t.key
                  ? (t.key === 'obsoletos' ? 'bg-white text-ber-amber shadow-sm' : 'bg-white text-ber-carbon shadow-sm')
                  : 'text-ber-gray hover:text-ber-carbon'
              } ${t.key === 'obsoletos' ? 'ml-auto' : ''}`}>
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${setor === t.key ? 'bg-ber-olive/20 text-ber-carbon' : 'bg-ber-gray/15 text-ber-gray'}`}>{t.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Sub-áreas de Shop Drawings */}
      {setor === 'sds' && (
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-1.5">Shop Drawings (SDs)</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSubTecnico(null)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${subTecnico === null ? 'bg-ber-teal text-white' : 'bg-white border border-ber-border text-ber-carbon hover:bg-ber-offwhite'}`}>
              Todas
            </button>
            {SDS_SUBS.map(t => (
              <button key={t.label} onClick={() => setSubTecnico(t.label)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${subTecnico === t.label ? 'bg-ber-teal text-white' : 'bg-white border border-ber-border text-ber-carbon hover:bg-ber-offwhite'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-áreas de Projetos Técnicos */}
      {setor === 'tecnicos' && (
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-1.5">Projetos Técnicos</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSubTecnico(null)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${subTecnico === null ? 'bg-ber-teal text-white' : 'bg-white border border-ber-border text-ber-carbon hover:bg-ber-offwhite'}`}>
              Todas
            </button>
            {TECNICOS_SUBS.map(t => (
              <button key={t.label} onClick={() => setSubTecnico(t.label)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${subTecnico === t.label ? 'bg-ber-teal text-white' : 'bg-white border border-ber-border text-ber-carbon hover:bg-ber-offwhite'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cabeçalho da "página" da disciplina/setor selecionado */}
      {setor !== 'todos' && (
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-base font-bold text-ber-carbon">
            {setor === 'obsoletos' ? 'Obsoletos' : setor === 'arquitetura' ? 'Arquitetura' : setor === 'outros' ? 'Outros Documentos' : setor === 'sds' ? (subTecnico ?? 'Shop Drawings (SDs)') : (subTecnico ?? 'Projetos Técnicos')}
          </h2>
          <span className="text-xs text-ber-gray">{visiveis.length} documento(s)</span>
          {setor === 'obsoletos' && <span className="text-[11px] text-amber-700">desenhos fora de uso — restauráveis</span>}
        </div>
      )}

      {bulkResult && !bulkUploading && (
        <p className="mb-3 text-xs font-semibold text-ber-teal">
          {bulkResult.criados} documento(s) novo(s) · {bulkResult.atualizados} revisão(ões) adicionada(s) a documentos existentes
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="bg-white border border-ber-border rounded-xl p-8 text-center text-sm text-ber-gray">
          {setor === 'obsoletos' ? 'Nenhum documento obsoleto.' : setor === 'todos' ? 'Nenhum documento cadastrado ainda nesta obra.' : 'Nenhum documento neste setor.'}
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(({ disc, docs }) => (
            <div key={disc}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-2">{disc} ({docs.length})</p>
              <div className="space-y-2">
                {docs.map(d => {
                  const ult = ultimaRevisao(d);
                  const isExpanded = expanded.has(d.id);
                  const parado = ult && diasDesde(ult.data) > 90;
                  return (
                    <div key={d.id} className={`bg-ber-card border border-ber-border rounded-xl overflow-hidden border-l-[3px] ${
                      ult ? (parado ? 'border-l-ber-amber' : 'border-l-ber-green') : 'border-l-ber-gray/30'
                    }`}>
                      <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1 cursor-pointer rounded-lg hover:bg-ber-surface/60 transition-colors" onClick={() => toggleExpand(d.id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              defaultValue={d.codigo}
                              onClick={e => e.stopPropagation()}
                              onBlur={e => { if (e.target.value.trim() && e.target.value !== d.codigo) updateField(d.id, 'codigo', e.target.value.trim()); }}
                              className="font-semibold text-ber-carbon text-sm bg-transparent border-b border-transparent hover:border-ber-border focus:border-ber-teal focus:outline-none px-0.5 -mx-0.5"
                              style={{ width: `${Math.max(d.codigo.length, 8)}ch` }}
                            />
                            {ult && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${parado ? 'bg-ber-amber/15 text-ber-amber' : 'bg-ber-green/15 text-ber-green'}`}>
                                {ult.revisao} · {fmtBR(ult.data)}{parado ? ' · parado' : ''}
                              </span>
                            )}
                            {!ult && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ber-gray/10 text-ber-gray">sem revisão</span>}
                            <span className="text-[10px] text-ber-gray/60" title="Data em que o documento entrou no sistema">incluído {fmtBR(d.createdAt)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                            <select value={d.disciplina} onChange={e => updateField(d.id, 'disciplina', e.target.value)}
                              className="text-[11px] bg-ber-surface border border-ber-border rounded px-1.5 py-0.5 text-ber-carbon hover:border-ber-carbon/50 focus:outline-none focus:ring-1 focus:ring-ber-teal">
                              {DISCIPLINAS.map(disc2 => <option key={disc2} value={disc2}>{disc2}</option>)}
                            </select>
                            <select value={d.etapa ?? ''} onChange={e => updateField(d.id, 'etapa', e.target.value)}
                              className="text-[11px] bg-ber-surface border border-ber-border rounded px-1.5 py-0.5 text-ber-carbon hover:border-ber-carbon/50 focus:outline-none focus:ring-1 focus:ring-ber-teal">
                              <option value="">Etapa —</option>
                              {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <input
                              defaultValue={d.projetista ?? ''}
                              placeholder="Projetista"
                              onBlur={e => { if (e.target.value !== (d.projetista ?? '')) updateField(d.id, 'projetista', e.target.value.trim()); }}
                              className="text-xs bg-ber-surface border border-ber-border rounded px-2 py-0.5 text-ber-carbon hover:border-ber-carbon/50 focus:outline-none focus:ring-1 focus:ring-ber-teal w-44"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => openEdit(d)} className="text-ber-gray hover:text-ber-carbon" title="Editar título"><Pencil size={14} /></button>
                          {d.obsoleto ? (
                            <button onClick={() => toggleObsoleto(d)} className="text-amber-600 hover:text-green-600" title="Restaurar (volta pra lista ativa)"><ArchiveRestore size={14} /></button>
                          ) : (
                            <button onClick={() => toggleObsoleto(d)} className="text-ber-gray/40 hover:text-amber-600" title="Mover para Obsoletos"><Archive size={14} /></button>
                          )}
                          <button onClick={() => handleRemoveDoc(d.id)} className="text-ber-gray/40 hover:text-red-500"><Trash2 size={14} /></button>
                          <button onClick={() => toggleExpand(d.id)} className="text-ber-gray hover:text-ber-carbon">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-ber-border bg-ber-surface p-3">
                          {d.revisoes.length > 0 && (
                            <table className="w-full text-xs mb-3">
                              <thead>
                                <tr className="text-ber-gray text-left">
                                  <th className="pb-1.5 font-medium">Revisão</th>
                                  <th className="pb-1.5 font-medium">Data</th>
                                  <th className="pb-1.5 font-medium">Arquivo</th>
                                  <th className="pb-1.5 font-medium">Observação</th>
                                  <th className="pb-1.5 font-medium" title="Quando a revisão entrou no sistema">Incluída em</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...d.revisoes].sort((a, b) => b.data.localeCompare(a.data)).map(r => (
                                  editRev?.id === r.id ? (
                                    <tr key={r.id} className="border-t border-ber-border/60 bg-white">
                                      <td className="py-1.5 pr-2">
                                        <input className="text-xs px-1.5 py-1 border border-ber-border rounded w-16 focus:outline-none focus:ring-1 focus:ring-ber-teal"
                                          value={editRev.revisao} autoFocus
                                          onChange={e => setEditRev(prev => prev && { ...prev, revisao: e.target.value })} />
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        <input type="date" className="text-xs px-1.5 py-1 border border-ber-border rounded focus:outline-none focus:ring-1 focus:ring-ber-teal"
                                          value={editRev.data}
                                          onChange={e => setEditRev(prev => prev && { ...prev, data: e.target.value })} />
                                      </td>
                                      <td className="py-1.5 text-ber-gray">{r.arquivoNome ? r.arquivoNome.slice(0, 24) : '—'}</td>
                                      <td className="py-1.5 pr-2">
                                        <input className="text-xs px-1.5 py-1 border border-ber-border rounded w-full focus:outline-none focus:ring-1 focus:ring-ber-teal"
                                          value={editRev.observacao} placeholder="Observação"
                                          onChange={e => setEditRev(prev => prev && { ...prev, observacao: e.target.value })} />
                                      </td>
                                      <td className="py-1.5 text-ber-gray">{fmtBR(r.createdAt)}</td>
                                      <td className="py-1.5 text-right whitespace-nowrap">
                                        <button onClick={() => setEditRev(null)} className="text-[11px] text-ber-gray hover:text-ber-carbon mr-2">Cancelar</button>
                                        <button onClick={saveEditRev} disabled={savingEditRev}
                                          className="text-[11px] font-semibold text-white bg-ber-carbon rounded px-2 py-0.5 hover:opacity-90 disabled:opacity-50">
                                          {savingEditRev ? 'Salvando…' : 'Salvar'}
                                        </button>
                                      </td>
                                    </tr>
                                  ) : (
                                  <tr key={r.id} className="border-t border-ber-border/60">
                                    <td className="py-1.5 font-semibold text-ber-carbon">{r.revisao}</td>
                                    <td className="py-1.5 text-ber-carbon">{fmtBR(r.data)}</td>
                                    <td className="py-1.5">
                                      {r.arquivoUrl ? (
                                        <a href={r.arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ber-teal hover:text-ber-carbon">
                                          <Download size={12} /> {r.arquivoNome?.slice(0, 24) ?? 'baixar'}
                                        </a>
                                      ) : <span className="text-ber-gray">—</span>}
                                    </td>
                                    <td className="py-1.5 text-ber-gray">{r.observacao ?? '—'}</td>
                                    <td className="py-1.5 text-ber-gray">{fmtBR(r.createdAt)}</td>
                                    <td className="py-1.5 text-right whitespace-nowrap">
                                      <button onClick={() => setEditRev({ id: r.id, docId: d.id, revisao: r.revisao, data: r.data.slice(0, 10), observacao: r.observacao ?? '' })}
                                        className="text-ber-gray/40 hover:text-ber-carbon mr-2" title="Editar revisão"><Pencil size={12} /></button>
                                      <button onClick={() => handleRemoveRevisao(d.id, r.id)} className="text-ber-gray/40 hover:text-red-500"><Trash2 size={12} /></button>
                                    </td>
                                  </tr>
                                  )
                                ))}
                              </tbody>
                            </table>
                          )}

                          {revForms[d.id] ? (
                            <div className="flex items-end gap-2 flex-wrap bg-white border border-ber-border rounded-lg p-2.5">
                              <div>
                                <label className="block text-[10px] text-ber-gray mb-0.5">Revisão</label>
                                <input className="text-sm px-2 py-1.5 border border-ber-border rounded-lg w-20" value={revForms[d.id].revisao}
                                  onChange={e => setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], revisao: e.target.value } }))} />
                              </div>
                              <div>
                                <label className="block text-[10px] text-ber-gray mb-0.5">Data</label>
                                <input type="date" className="text-sm px-2 py-1.5 border border-ber-border rounded-lg" value={revForms[d.id].data}
                                  onChange={e => setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], data: e.target.value } }))} />
                              </div>
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-[10px] text-ber-gray mb-0.5">Observação</label>
                                <input className="text-sm px-2 py-1.5 border border-ber-border rounded-lg w-full" value={revForms[d.id].observacao}
                                  onChange={e => setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], observacao: e.target.value } }))} />
                              </div>
                              <input ref={el => { fileInputs.current[d.id] = el; }} type="file" className="hidden"
                                onChange={e => { const file = e.target.files?.[0] ?? null; setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], file } })); }} />
                              <button type="button" onClick={() => fileInputs.current[d.id]?.click()}
                                className="flex items-center gap-1 text-xs text-ber-teal hover:text-ber-carbon px-2 py-1.5">
                                <Upload size={13} /> {revForms[d.id].file ? revForms[d.id].file!.name.slice(0, 16) : 'Arquivo'}
                              </button>
                              <button onClick={() => setRevForms(prev => { const n = { ...prev }; delete n[d.id]; return n; })}
                                className="text-xs text-ber-gray px-2 py-1.5 hover:text-ber-carbon">Cancelar</button>
                              <button onClick={() => saveRevisao(d.id)} disabled={savingRev === d.id}
                                className="text-xs font-semibold bg-ber-carbon text-white rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50">
                                {savingRev === d.id ? 'Salvando…' : 'Salvar revisão'}
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => openNovaRevisao(d)} className="flex items-center gap-1.5 text-xs font-semibold text-ber-teal hover:text-ber-carbon">
                              <Plus size={13} /> Nova revisão
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Conferência do lote antes de subir (03/09/26) ─── */}
      {lote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ber-border px-5 py-4">
              <div>
                <p className="text-sm font-bold text-ber-carbon">Conferir arquivos antes de subir</p>
                <p className="text-xs text-ber-gray mt-0.5">Código e revisão foram lidos do nome do arquivo — ajuste o que precisar.</p>
              </div>
              <button onClick={() => { setLote(null); setLoteProjetista(''); }} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
            </div>

            <div className="flex items-center gap-3 flex-wrap border-b border-ber-border bg-ber-surface px-5 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ber-gray">Disciplina de todos:</span>
                <select className="text-xs px-2 py-1 border border-ber-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-ber-teal"
                  value="" onChange={e => { const v = e.target.value; if (v) setLote(prev => prev && prev.map(i => documentos.some(dd => dd.codigo === i.codigo.trim()) ? i : { ...i, disciplina: v })); }}>
                  <option value="">aplicar…</option>
                  {DISCIPLINAS.map(disc => <option key={disc} value={disc}>{disc}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ber-gray">Projetista (opcional, lote todo):</span>
                <input className="text-xs px-2 py-1 border border-ber-border rounded bg-white w-40 focus:outline-none focus:ring-1 focus:ring-ber-teal"
                  value={loteProjetista} onChange={e => setLoteProjetista(e.target.value)} placeholder="ex: ArqServices" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ber-gray text-left">
                    <th className="pb-2 font-medium">Arquivo</th>
                    <th className="pb-2 font-medium">Código</th>
                    <th className="pb-2 font-medium">Revisão</th>
                    <th className="pb-2 font-medium">Disciplina</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lote.map((item, idx) => {
                    const existente = documentos.find(dd => dd.codigo === item.codigo.trim());
                    return (
                      <tr key={`${item.file.name}-${idx}`} className="border-t border-ber-border/60 align-middle">
                        <td className="py-2 pr-3 text-ber-gray max-w-[180px] truncate" title={item.file.name}>{item.file.name}</td>
                        <td className="py-2 pr-3">
                          <input className="w-full text-xs px-2 py-1.5 border border-ber-border rounded focus:outline-none focus:ring-1 focus:ring-ber-teal"
                            value={item.codigo}
                            onChange={e => setLote(prev => prev && prev.map((i, j) => j === idx ? { ...i, codigo: e.target.value } : i))} />
                        </td>
                        <td className="py-2 pr-3">
                          <input className="w-16 text-xs px-2 py-1.5 border border-ber-border rounded focus:outline-none focus:ring-1 focus:ring-ber-teal"
                            value={item.revisao}
                            onChange={e => setLote(prev => prev && prev.map((i, j) => j === idx ? { ...i, revisao: e.target.value } : i))} />
                        </td>
                        <td className="py-2 pr-3">
                          {existente ? (
                            <span className="inline-flex items-center rounded-full bg-ber-teal/10 px-2 py-1 text-[10px] font-bold text-ber-teal"
                              title={`Já existe documento ${existente.codigo} nesta obra — este arquivo entra como revisão nova dele`}>
                              nova revisão · {existente.disciplina}
                            </span>
                          ) : (
                            <select className="text-xs px-2 py-1.5 border border-ber-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-ber-teal"
                              value={item.disciplina}
                              onChange={e => setLote(prev => prev && prev.map((i, j) => j === idx ? { ...i, disciplina: e.target.value } : i))}>
                              {DISCIPLINAS.map(disc => <option key={disc} value={disc}>{disc}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <button onClick={() => setLote(prev => { const n = prev?.filter((_, j) => j !== idx) ?? null; return n && n.length > 0 ? n : null; })}
                            className="text-ber-gray/40 hover:text-red-500" title="Tirar este arquivo do lote"><X size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-ber-border px-5 py-4">
              <p className="text-xs text-ber-gray">{lote.length} arquivo(s) · máx. 100MB cada</p>
              <div className="flex gap-2">
                <button onClick={() => { setLote(null); setLoteProjetista(''); }}
                  className="rounded-lg border border-ber-border px-4 py-2 text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
                <button onClick={enviarLote} disabled={bulkUploading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
                  <Upload size={14} /> {bulkUploading ? 'Subindo…' : `Subir ${lote.length} arquivo(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-ber-carbon">{editando ? 'Editar documento' : 'Novo documento'}</p>
              <button onClick={() => setShowForm(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Código *</label>
                <input className={inputCls} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ex: 319-EDW-CV-CD" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Título</label>
                <input className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="ex: Planta de Piso" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Disciplina</label>
                  <select className={inputCls} value={form.disciplina} onChange={e => setForm(f => ({ ...f, disciplina: e.target.value }))}>
                    {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Etapa</label>
                  <select className={inputCls} value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
                    <option value="">—</option>
                    {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Projetista</label>
                <input className={inputCls} value={form.projetista} onChange={e => setForm(f => ({ ...f, projetista: e.target.value }))} />
              </div>
            </div>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-ber-border py-2 text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
              <button onClick={saveDoc} disabled={saving} className="flex-1 rounded-lg bg-ber-carbon py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
