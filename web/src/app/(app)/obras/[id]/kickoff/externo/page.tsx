'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, FileDown, Plus, Presentation, X } from 'lucide-react';
import api from '@/lib/api';

// Kickoff EXTERNO — form do PMO (estrutura do kickoff Segura AI, Bruno 10/09/26).
// Template default vem do backend já com o time herdado do kickoff interno.
// Autosave com debounce; exporta PPT e PDF no layout institucional BÈR.

interface Pessoa { papel: string; nome: string; contato: string }
interface Item { titulo: string; descricao: string }
interface BlocoTecnico { titulo: string; topicos: Item[] }
interface Conteudo {
  dataReuniao: string | null;
  nomeCliente: string;
  time: { ativo: boolean; ladoBer: Pessoa[]; backOffice: Pessoa[]; ladoCliente: Pessoa[] };
  escopo: { ativo: boolean; texto: string };
  responsabilidades: { ativo: boolean; cliente: string[]; ber: string[] };
  aprovacoes: { ativo: boolean; intro: string; itens: Item[] };
  comunicacao: { ativo: boolean; blocos: Item[] };
  projetosAprovacoes: { ativo: boolean; etapas: Item[] };
  periodoObras: { ativo: boolean; texto: string; observacao: string };
  registros: { ativo: boolean; blocos: Item[] };
  logistica: { ativo: boolean; titulo: string; texto: string };
  tecnicos: { ativo: boolean; blocos: BlocoTecnico[] };
  condominio: { ativo: boolean; texto: string };
  encerramento: string;
}

const inputCls = 'w-full text-sm px-2.5 py-1.5 border border-ber-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-ber-teal';
const areaCls = inputCls + ' min-h-[70px] resize-y';

export default function KickoffExternoPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [c, setC] = useState<Conteudo | null>(null);
  const [obraNome, setObraNome] = useState('');
  const [salvo, setSalvo] = useState<'salvo' | 'salvando' | 'pendente' | null>(null);
  const [gerando, setGerando] = useState<'pdf' | 'pptx' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get(`/obras/${obraId}/kickoff/externo`).then(r => {
      setC(r.data.data.conteudo);
      setObraNome(r.data.data.obra.name);
    }).catch(() => alert('Erro ao carregar o kickoff externo'));
  }, [obraId]);

  const persist = useCallback(async (conteudo: Conteudo) => {
    setSalvo('salvando');
    try {
      await api.put(`/obras/${obraId}/kickoff/externo`, { conteudo });
      setSalvo('salvo');
    } catch { setSalvo('pendente'); }
  }, [obraId]);

  /** muda o estado e agenda o autosave (1.2s depois da última digitação) */
  function mudar(fn: (prev: Conteudo) => Conteudo) {
    setC(prev => {
      if (!prev) return prev;
      const novo = fn(structuredClone(prev));
      setSalvo('pendente');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(novo), 1200);
      return novo;
    });
  }

  async function exportar(tipo: 'pdf' | 'pptx') {
    if (!c) return;
    setGerando(tipo);
    try {
      if (timer.current) { clearTimeout(timer.current); await persist(c); }
      const r = await api.get(`/obras/${obraId}/kickoff/externo/${tipo}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kickoff Externo - ${c.nomeCliente || obraNome}.${tipo === 'pdf' ? 'pdf' : 'pptx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Erro ao gerar o arquivo'); }
    finally { setGerando(null); }
  }

  if (!c) return <div className="p-6 text-sm text-ber-gray">Carregando…</div>;

  const Secao = ({ titulo, ativo, onToggle, children }: { titulo: string; ativo: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <div className={`rounded-xl border bg-white p-4 ${ativo ? 'border-ber-border' : 'border-dashed border-ber-border opacity-60'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-ber-carbon">{titulo}</h2>
        <label className="flex items-center gap-1.5 text-xs text-ber-gray cursor-pointer">
          <input type="checkbox" checked={ativo} onChange={onToggle} className="accent-[#5A7A7A]" />
          entra no documento
        </label>
      </div>
      {ativo && children}
    </div>
  );

  const ListaPessoas = ({ rotulo, lista, set }: { rotulo: string; lista: Pessoa[]; set: (l: Pessoa[]) => void }) => (
    <div className="mb-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ber-gray mb-1.5">{rotulo}</p>
      {lista.map((p, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
          <input className={inputCls} value={p.papel} placeholder="Papel" onChange={e => { const l = [...lista]; l[i] = { ...p, papel: e.target.value }; set(l); }} />
          <input className={inputCls} value={p.nome} placeholder="Nome" onChange={e => { const l = [...lista]; l[i] = { ...p, nome: e.target.value }; set(l); }} />
          <input className={inputCls} value={p.contato} placeholder="E-mail / telefone" onChange={e => { const l = [...lista]; l[i] = { ...p, contato: e.target.value }; set(l); }} />
          <button onClick={() => set(lista.filter((_, j) => j !== i))} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
        </div>
      ))}
      <button onClick={() => set([...lista, { papel: '', nome: '', contato: '' }])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-ber-teal hover:underline"><Plus size={12} /> adicionar</button>
    </div>
  );

  const ListaItens = ({ lista, set, phTitulo = 'Título', phDesc = 'Descrição' }: { lista: Item[]; set: (l: Item[]) => void; phTitulo?: string; phDesc?: string }) => (
    <div>
      {lista.map((it, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-[1fr_2fr_auto] gap-1.5">
          <input className={inputCls} value={it.titulo} placeholder={phTitulo} onChange={e => { const l = [...lista]; l[i] = { ...it, titulo: e.target.value }; set(l); }} />
          <input className={inputCls} value={it.descricao} placeholder={phDesc} onChange={e => { const l = [...lista]; l[i] = { ...it, descricao: e.target.value }; set(l); }} />
          <button onClick={() => set(lista.filter((_, j) => j !== i))} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
        </div>
      ))}
      <button onClick={() => set([...lista, { titulo: '', descricao: '' }])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-ber-teal hover:underline"><Plus size={12} /> adicionar item</button>
    </div>
  );

  const ListaTexto = ({ rotulo, lista, set }: { rotulo: string; lista: string[]; set: (l: string[]) => void }) => (
    <div className="flex-1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ber-gray mb-1.5">{rotulo}</p>
      {lista.map((t, i) => (
        <div key={i} className="mb-1.5 flex gap-1.5">
          <input className={inputCls} value={t} onChange={e => { const l = [...lista]; l[i] = e.target.value; set(l); }} />
          <button onClick={() => set(lista.filter((_, j) => j !== i))} className="text-ber-gray/40 hover:text-red-500"><X size={14} /></button>
        </div>
      ))}
      <button onClick={() => set([...lista, ''])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-ber-teal hover:underline"><Plus size={12} /> adicionar</button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}/kickoff`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> Kickoff
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Externo</span>
      </div>

      <div className="mb-5 flex items-center gap-2 flex-wrap">
        <Building2 size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black text-ber-carbon">Kickoff Externo</h1>
        <span className="text-xs text-ber-gray">
          {salvo === 'salvando' ? 'salvando…' : salvo === 'salvo' ? '✓ salvo' : salvo === 'pendente' ? 'alterações não salvas…' : ''}
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => exportar('pptx')} disabled={!!gerando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black disabled:opacity-50">
            <Presentation size={14} /> {gerando === 'pptx' ? 'Gerando…' : 'Gerar PPT'}
          </button>
          <button onClick={() => exportar('pdf')} disabled={!!gerando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ber-carbon px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-carbon hover:text-white disabled:opacity-50">
            <FileDown size={14} /> {gerando === 'pdf' ? 'Gerando…' : 'Gerar PDF'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* capa */}
        <div className="rounded-xl border border-ber-border bg-white p-4">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-ber-carbon">Capa</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ber-gray mb-1">Nome do cliente / projeto</p>
              <input className={inputCls} value={c.nomeCliente} onChange={e => mudar(p => ({ ...p, nomeCliente: e.target.value }))} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ber-gray mb-1">Data da reunião</p>
              <input type="date" className={inputCls} value={c.dataReuniao ?? ''} onChange={e => mudar(p => ({ ...p, dataReuniao: e.target.value || null }))} />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ber-gray">Endereço sai automático do cadastro da obra. A pauta é montada sozinha com as seções ativas.</p>
        </div>

        <Secao titulo="Time" ativo={c.time.ativo} onToggle={() => mudar(p => ({ ...p, time: { ...p.time, ativo: !p.time.ativo } }))}>
          <ListaPessoas rotulo="Lado BÈR" lista={c.time.ladoBer} set={l => mudar(p => ({ ...p, time: { ...p.time, ladoBer: l } }))} />
          <ListaPessoas rotulo="Back office" lista={c.time.backOffice} set={l => mudar(p => ({ ...p, time: { ...p.time, backOffice: l } }))} />
          <ListaPessoas rotulo={`Lado ${c.nomeCliente || 'cliente'}`} lista={c.time.ladoCliente} set={l => mudar(p => ({ ...p, time: { ...p.time, ladoCliente: l } }))} />
        </Secao>

        <Secao titulo="Escopo de trabalho" ativo={c.escopo.ativo} onToggle={() => mudar(p => ({ ...p, escopo: { ...p.escopo, ativo: !p.escopo.ativo } }))}>
          <textarea className={areaCls} value={c.escopo.texto} placeholder="Ex: Retrofit completo do conjunto 141 — implantação do novo escritório conforme projeto aprovado, do canteiro à entrega."
            onChange={e => mudar(p => ({ ...p, escopo: { ...p.escopo, texto: e.target.value } }))} />
        </Secao>

        <Secao titulo="Responsabilidades" ativo={c.responsabilidades.ativo} onToggle={() => mudar(p => ({ ...p, responsabilidades: { ...p.responsabilidades, ativo: !p.responsabilidades.ativo } }))}>
          <div className="flex gap-4 flex-col md:flex-row">
            <ListaTexto rotulo={`Lado ${c.nomeCliente || 'cliente'}`} lista={c.responsabilidades.cliente} set={l => mudar(p => ({ ...p, responsabilidades: { ...p.responsabilidades, cliente: l } }))} />
            <ListaTexto rotulo="Lado BÈR" lista={c.responsabilidades.ber} set={l => mudar(p => ({ ...p, responsabilidades: { ...p.responsabilidades, ber: l } }))} />
          </div>
        </Secao>

        <Secao titulo="Aprovações e decisões" ativo={c.aprovacoes.ativo} onToggle={() => mudar(p => ({ ...p, aprovacoes: { ...p.aprovacoes, ativo: !p.aprovacoes.ativo } }))}>
          <input className={inputCls + ' mb-2'} value={c.aprovacoes.intro} onChange={e => mudar(p => ({ ...p, aprovacoes: { ...p.aprovacoes, intro: e.target.value } }))} />
          <ListaItens lista={c.aprovacoes.itens} set={l => mudar(p => ({ ...p, aprovacoes: { ...p.aprovacoes, itens: l } }))} />
        </Secao>

        <Secao titulo="Fluxo de comunicação" ativo={c.comunicacao.ativo} onToggle={() => mudar(p => ({ ...p, comunicacao: { ...p.comunicacao, ativo: !p.comunicacao.ativo } }))}>
          <ListaItens lista={c.comunicacao.blocos} set={l => mudar(p => ({ ...p, comunicacao: { ...p.comunicacao, blocos: l } }))} />
        </Secao>

        <Secao titulo="Projetos — aprovações" ativo={c.projetosAprovacoes.ativo} onToggle={() => mudar(p => ({ ...p, projetosAprovacoes: { ...p.projetosAprovacoes, ativo: !p.projetosAprovacoes.ativo } }))}>
          <ListaItens lista={c.projetosAprovacoes.etapas} set={l => mudar(p => ({ ...p, projetosAprovacoes: { ...p.projetosAprovacoes, etapas: l } }))} phTitulo="Etapa" />
        </Secao>

        <Secao titulo="Período de obras" ativo={c.periodoObras.ativo} onToggle={() => mudar(p => ({ ...p, periodoObras: { ...p.periodoObras, ativo: !p.periodoObras.ativo } }))}>
          <div className="grid gap-2">
            <input className={inputCls} value={c.periodoObras.texto} placeholder="Ex: Segunda a sexta" onChange={e => mudar(p => ({ ...p, periodoObras: { ...p.periodoObras, texto: e.target.value } }))} />
            <input className={inputCls} value={c.periodoObras.observacao} placeholder="Ex: 4 horas diárias de obra, conforme regras do edifício" onChange={e => mudar(p => ({ ...p, periodoObras: { ...p.periodoObras, observacao: e.target.value } }))} />
          </div>
        </Secao>

        <Secao titulo="Registros e documentos de obra" ativo={c.registros.ativo} onToggle={() => mudar(p => ({ ...p, registros: { ...p.registros, ativo: !p.registros.ativo } }))}>
          <ListaItens lista={c.registros.blocos} set={l => mudar(p => ({ ...p, registros: { ...p.registros, blocos: l } }))} />
        </Secao>

        <Secao titulo="Logística / Estacionamento" ativo={c.logistica.ativo} onToggle={() => mudar(p => ({ ...p, logistica: { ...p.logistica, ativo: !p.logistica.ativo } }))}>
          <input className={inputCls + ' mb-2'} value={c.logistica.titulo} onChange={e => mudar(p => ({ ...p, logistica: { ...p.logistica, titulo: e.target.value } }))} />
          <textarea className={areaCls} value={c.logistica.texto} onChange={e => mudar(p => ({ ...p, logistica: { ...p.logistica, texto: e.target.value } }))} />
        </Secao>

        <Secao titulo="Assuntos técnicos de obra" ativo={c.tecnicos.ativo} onToggle={() => mudar(p => ({ ...p, tecnicos: { ...p.tecnicos, ativo: !p.tecnicos.ativo } }))}>
          {c.tecnicos.blocos.map((b, i) => (
            <div key={i} className="mb-3 rounded-lg border border-ber-border bg-ber-surface/40 p-3">
              <div className="mb-2 flex gap-1.5">
                <input className={inputCls + ' font-semibold'} value={b.titulo} placeholder="Tema (ex: Ar-condicionado)"
                  onChange={e => mudar(p => { p.tecnicos.blocos[i].titulo = e.target.value; return p; })} />
                <button onClick={() => mudar(p => { p.tecnicos.blocos.splice(i, 1); return p; })} className="text-ber-gray/40 hover:text-red-500"><X size={15} /></button>
              </div>
              <ListaItens lista={b.topicos} set={l => mudar(p => { p.tecnicos.blocos[i].topicos = l; return p; })} phTitulo="Tópico" phDesc="Detalhe / decisão a alinhar" />
            </div>
          ))}
          <button onClick={() => mudar(p => { p.tecnicos.blocos.push({ titulo: '', topicos: [] }); return p; })}
            className="inline-flex items-center gap-1 rounded-lg border border-ber-border px-2.5 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-surface"><Plus size={13} /> adicionar tema técnico</button>
        </Secao>

        <Secao titulo="Interface com o condomínio" ativo={c.condominio.ativo} onToggle={() => mudar(p => ({ ...p, condominio: { ...p.condominio, ativo: !p.condominio.ativo } }))}>
          <textarea className={areaCls} value={c.condominio.texto} onChange={e => mudar(p => ({ ...p, condominio: { ...p.condominio, texto: e.target.value } }))} />
        </Secao>

        <div className="rounded-xl border border-ber-border bg-white p-4">
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-ber-carbon">Encerramento</h2>
          <input className={inputCls} value={c.encerramento} onChange={e => mudar(p => ({ ...p, encerramento: e.target.value }))} />
        </div>
      </div>
    </div>
  );
}
