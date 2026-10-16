'use client';

/**
 * Ficha de Cadastro da oportunidade (padrão Talita, 16/10/26).
 * Tela própria (modal cheio) — de propósito FORA do drawer de criar/editar,
 * que o Bruno pediu pra manter leve. Obrigatória (essenciais) pra mover a
 * oportunidade de Lead pra Qualificação; o backend valida de novo.
 * Essenciais: obra, endereço, modalidade, metragem (m²) e entregáveis.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { Oportunidade, FichaCadastro } from '../types';

const ENTREGAVEIS: { key: string; label: string }[] = [
  { key: 'planilha_cliente', label: 'Planilha Orçamentária — modelo cliente' },
  { key: 'planilha_ber', label: 'Planilha Orçamentária — modelo BÈR' },
  { key: 'cronograma_fisico_financeiro', label: 'Cronograma Físico-financeiro' },
  { key: 'proposta_tecnica', label: 'Proposta Técnica' },
  { key: 'proposta_comercial', label: 'Proposta Comercial' },
];

const MODALIDADES: { key: 'D&B' | 'D&B_TECNICO' | 'GC'; label: string }[] = [
  { key: 'D&B', label: 'D&B' },
  { key: 'D&B_TECNICO', label: 'D&B Técnico' },
  { key: 'GC', label: 'GC' },
];

function Campo({ label, children, essencial }: { label: string; children: React.ReactNode; essencial?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">
        {label}{essencial && <span className="text-ber-red"> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal';

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ber-border bg-ber-surface/40 p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-ber-gray">{titulo}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function FichaCadastroModal({ op, onClose, onSaved }: {
  op: Oportunidade;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<FichaCadastro>({ ...(op.ficha ?? {}) });
  const [metragem, setMetragem] = useState(op.metragemM2 != null ? String(op.metragemM2) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof FichaCadastro, v: unknown) => setF((prev) => ({ ...prev, [k]: v }));
  const entregaveis = f.entregaveis ?? [];
  const toggleEntregavel = (key: string) =>
    set('entregaveis', entregaveis.includes(key) ? entregaveis.filter((e) => e !== key) : [...entregaveis, key]);

  const essenciais = [
    !!f.obra?.trim(),
    !!f.enderecoObra?.trim(),
    !!f.modalidade,
    !!metragem && Number(metragem) > 0,
    entregaveis.length > 0,
  ];
  const completos = essenciais.filter(Boolean).length;

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    try {
      await api.patch(`/crm/oportunidades/${op.id}`, {
        ficha: f,
        metragemM2: metragem && Number(metragem) > 0 ? Number(metragem) : null,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? e?.message ?? 'Erro ao salvar a ficha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full md:max-w-3xl max-h-[92vh] rounded-t-2xl md:rounded-2xl flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-ber-border px-5 py-4">
          <div>
            <p className="font-bold text-ber-carbon">Ficha de Cadastro</p>
            <p className="text-xs text-ber-gray mt-0.5 truncate max-w-[60vw] md:max-w-md">{op.titulo}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${completos === 5 ? 'bg-ber-green/10 text-ber-green' : 'bg-amber-100 text-amber-700'}`}>
              {completos}/5 essenciais
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ber-surface text-ber-gray"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Bloco titulo="Obra & Local">
            <Campo label="Obra (descrição)" essencial>
              <textarea rows={2} className={inputCls} value={f.obra ?? ''} onChange={(e) => set('obra', e.target.value)}
                placeholder="Ex: Reforma de interiores e caixilharia para cliente Ancoradouro" />
            </Campo>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Campo label="Endereço da obra" essencial>
                <input className={inputCls} value={f.enderecoObra ?? ''} onChange={(e) => set('enderecoObra', e.target.value)} placeholder="Ex: Ed. Itália" />
              </Campo>
              <Campo label="Metragem (m²)" essencial>
                <input type="number" min="0" step="0.01" className={inputCls} value={metragem} onChange={(e) => setMetragem(e.target.value)} placeholder="m²" />
              </Campo>
              <Campo label="Contato ou gerenciadora">
                <input className={inputCls} value={f.contatoGerenciadora ?? ''} onChange={(e) => set('contatoGerenciadora', e.target.value)} />
              </Campo>
              <Campo label="Arquitetura">
                <input className={inputCls} value={f.arquitetura ?? ''} onChange={(e) => set('arquitetura', e.target.value)} placeholder="Ex: Pitá — Paula Mantovaneli" />
              </Campo>
            </div>
          </Bloco>

          <Bloco titulo="Processo">
            <Campo label="Modalidade" essencial>
              <div className="mt-1 flex flex-wrap gap-2">
                {MODALIDADES.map((m) => (
                  <button key={m.key} type="button" onClick={() => set('modalidade', m.key)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${f.modalidade === m.key ? 'border-ber-teal bg-ber-teal text-white' : 'border-ber-border bg-white text-ber-carbon hover:bg-ber-surface'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </Campo>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Campo label="Reserva técnica">
                <input className={inputCls} value={f.reservaTecnica ?? ''} onChange={(e) => set('reservaTecnica', e.target.value)} placeholder="Ex: 5%" />
              </Campo>
              <Campo label="Concorrentes">
                <input className={inputCls} value={f.concorrentes ?? ''} onChange={(e) => set('concorrentes', e.target.value)} placeholder="Ex: não sabemos ainda" />
              </Campo>
            </div>
            <Campo label="Prazos do processo">
              <textarea rows={2} className={inputCls} value={f.prazosProcesso ?? ''} onChange={(e) => set('prazosProcesso', e.target.value)}
                placeholder="Ex: expectativa de prazo de obra: 60 dias" />
            </Campo>
            <Campo label="Horário de trabalho liberado pelo condomínio">
              <input className={inputCls} value={f.horarioCondominio ?? ''} onChange={(e) => set('horarioCondominio', e.target.value)} placeholder="Ex: solicitar Manual do Condomínio" />
            </Campo>
          </Bloco>

          <Bloco titulo="Condições comerciais">
            <Campo label="Modalidade de contratação">
              <input className={inputCls} value={f.modalidadeContratacao ?? ''} onChange={(e) => set('modalidadeContratacao', e.target.value)}
                placeholder="Ex: Empreitada Parcial — Faturamento direto 70% | 30% BÈR" />
            </Campo>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Campo label="Forma de pagamento">
                <input className={inputCls} value={f.formaPagamento ?? ''} onChange={(e) => set('formaPagamento', e.target.value)} placeholder="Ex: a combinar" />
              </Campo>
              <Campo label="Validade da proposta">
                <input className={inputCls} value={f.validadeProposta ?? ''} onChange={(e) => set('validadeProposta', e.target.value)} placeholder="Ex: padrão BÈR" />
              </Campo>
            </div>
            <Campo label="Seguro">
              <input className={inputCls} value={f.seguro ?? ''} onChange={(e) => set('seguro', e.target.value)}
                placeholder="Ex: Risco de Engenharia, Incêndio e RC Cruzada, a confirmar" />
            </Campo>
          </Bloco>

          <Bloco titulo="Escopo & informações">
            <Campo label="Escopo">
              <textarea rows={3} className={inputCls} value={f.escopo ?? ''} onChange={(e) => set('escopo', e.target.value)}
                placeholder="Ex: conforme BOD e projetos. Incluir projetos técnicos no nosso guarda-chuva (elétrica, ar condicionado, cabeamento, incêndio, hidráulica)." />
            </Campo>
            <Campo label="Informações gerais">
              <textarea rows={2} className={inputCls} value={f.informacoesGerais ?? ''} onChange={(e) => set('informacoesGerais', e.target.value)} />
            </Campo>
            <Campo label="Arquivos recebidos">
              <textarea rows={2} className={inputCls} value={f.arquivosRecebidos ?? ''} onChange={(e) => set('arquivosRecebidos', e.target.value)}
                placeholder="Ex: RFI em anexo — IMPORTANTE verificar a RFI com informações adicionais" />
            </Campo>
          </Bloco>

          <Bloco titulo="Entregáveis">
            <div className="space-y-1.5">
              {ENTREGAVEIS.map((ent) => (
                <label key={ent.key} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ber-surface cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-ber-teal" checked={entregaveis.includes(ent.key)} onChange={() => toggleEntregavel(ent.key)} />
                  <span className="text-sm text-ber-carbon">{ent.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-ber-gray">Pelo menos um entregável é obrigatório pra qualificar.</p>
          </Bloco>
        </div>

        <div className="border-t border-ber-border px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ber-gray">
            {completos === 5
              ? 'Ficha completa — a oportunidade pode ir pra Qualificação.'
              : 'Essenciais: obra, endereço, modalidade, metragem e entregáveis.'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {err && <span className="text-xs text-ber-red max-w-[220px] truncate" title={err}>{err}</span>}
            <button onClick={onClose} className="rounded-lg border border-ber-border px-3 py-2 text-sm text-ber-carbon hover:bg-ber-surface">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-ber-teal px-4 py-2 text-sm font-semibold text-white hover:bg-ber-teal/90 disabled:opacity-50">
              {saving ? 'Salvando…' : 'Salvar ficha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
