'use client';

/**
 * FornecedorInput — campo de fornecedor ligado ao cadastro único
 * (/v1/fornecedores, tabela fornecedores_cadastro). Bruno 22/09/26.
 *
 * Comportamento:
 *  - digita → sugestões do cadastro (dropdown);
 *  - seleciona → onSave(nome, id);
 *  - confirma texto que não existe → consulta o backend: se houver similar,
 *    pergunta "é o mesmo que X?" (Usar X · Cadastrar novo); se não houver,
 *    cadastra direto. Nada é criado sem uma escolha explícita quando há
 *    similar — pedido do Bruno (msg 13412).
 */

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

interface FornecedorRef { id: string; nome: string }

interface Props {
  value: string;
  /** Chamado quando o fornecedor é resolvido (selecionado/cadastrado). */
  onSave: (nome: string, fornecedorId: string | null) => void;
  /** Opcional: chamado a cada tecla (pra telas com auto-save de texto). */
  onTexto?: (texto: string) => void;
  placeholder?: string;
  className?: string;
}

export default function FornecedorInput({ value, onSave, onTexto, placeholder = 'Fornecedor…', className = '' }: Props) {
  const [texto, setTexto] = useState(value);
  const [sugestoes, setSugestoes] = useState<FornecedorRef[]>([]);
  const [aberto, setAberto] = useState(false);
  const [similares, setSimilares] = useState<FornecedorRef[] | null>(null);
  const [pendente, setPendente] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTexto(value); }, [value]);

  // fecha dropdown/painel clicando fora
  useEffect(() => {
    function fora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setAberto(false);
        setSimilares(null);
      }
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  function buscar(q: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const r = await api.get<{ data: FornecedorRef[] }>('/fornecedores', { params: { q } });
        setSugestoes(r.data.data);
        setAberto(true);
      } catch { /* silencioso — dropdown só não abre */ }
    }, 250);
  }

  function selecionar(f: FornecedorRef) {
    setTexto(f.nome);
    setAberto(false);
    setSimilares(null);
    onSave(f.nome, f.id);
  }

  /** Confirmação do texto digitado (Enter ou botão). */
  async function confirmarTexto(forcarNovo = false) {
    const nome = texto.trim();
    if (!nome) { onSave('', null); return; }
    if (nome === value && !forcarNovo) return; // nada mudou
    setPendente(true);
    try {
      const r = await api.post<{ data: {
        criado: boolean;
        fornecedor?: FornecedorRef;
        jaExistente?: FornecedorRef;
        similares?: FornecedorRef[];
      } }>('/fornecedores', { nome, confirmarSimilar: forcarNovo });
      const d = r.data.data;
      if (d.criado && d.fornecedor) {
        toast(`Fornecedor "${d.fornecedor.nome}" cadastrado.`);
        selecionar(d.fornecedor);
      } else if (d.jaExistente) {
        selecionar(d.jaExistente); // nome idêntico — usa o que já existe
      } else if (d.similares && d.similares.length > 0) {
        setSimilares(d.similares); // pergunta antes de criar
        setAberto(false);
      }
    } catch {
      toast('Erro ao salvar fornecedor', 'erro');
    } finally {
      setPendente(false);
    }
  }

  return (
    <div ref={raiz} className="relative">
      <input
        type="text"
        value={texto}
        placeholder={placeholder}
        className={className}
        onChange={(e) => { setTexto(e.target.value); onTexto?.(e.target.value); setSimilares(null); if (e.target.value.trim().length >= 2) buscar(e.target.value); else setAberto(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarTexto(); } }}
        onBlur={() => {
          // Blur salva o TEXTO (sem cadastrar nada) quando a tela não salva a
          // cada tecla (sem onTexto) — igual ao comportamento de inline-edit
          // antigo. Cadastro/similar só via Enter ou clique no dropdown.
          if (!onTexto && !similares && texto.trim() !== value.trim()) onSave(texto.trim(), null);
        }}
      />

      {aberto && sugestoes.length > 0 && !similares && (
        <div className="absolute z-30 mt-1 w-full min-w-52 max-h-48 overflow-y-auto rounded-lg border border-ber-border bg-white shadow-lg">
          {sugestoes.map((f) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selecionar(f); }}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-ber-bg/60 truncate"
              title={f.nome}
            >
              {f.nome}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); confirmarTexto(); }}
            className="block w-full px-3 py-1.5 text-left text-xs text-ber-teal border-t border-ber-border/60 hover:bg-ber-bg/60"
          >
            {pendente ? '…' : `Usar "${texto.trim()}" (cadastrar se não existir)`}
          </button>
        </div>
      )}

      {similares && (
        <div className="absolute z-30 mt-1 w-full min-w-64 rounded-lg border border-amber-300 bg-amber-50 shadow-lg p-2.5">
          <p className="text-xs font-semibold text-amber-900 mb-1.5">Já existe parecido — é o mesmo?</p>
          {similares.map((f) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selecionar(f); }}
              className="block w-full rounded-md bg-white border border-amber-200 px-2.5 py-1.5 text-left text-sm mb-1 hover:border-ber-olive truncate"
              title={`Usar "${f.nome}"`}
            >
              Usar <span className="font-semibold">{f.nome}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={pendente}
            onMouseDown={(e) => { e.preventDefault(); confirmarTexto(true); }}
            className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-amber-900 underline"
          >
            {pendente ? '…' : `Não — cadastrar "${texto.trim()}" como fornecedor novo`}
          </button>
        </div>
      )}
    </div>
  );
}
