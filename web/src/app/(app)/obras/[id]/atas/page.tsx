'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Users, FileSpreadsheet, AlertTriangle, FileDown } from 'lucide-react';
import api from '@/lib/api';
import { confirmar } from '@/lib/confirmar';
import { useBackToObra } from '@/hooks/useBackToObra';
import {
  TopicosTable, sortTopicos, errMsg, fmtDate,
  type AtaCorrida, type Topico, type Atualizacao, type ObraHeader, type Stakeholder,
} from '@/components/atas/topicos-shared';

export default function AtaCorridaPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();

  const [ata, setAta] = useState<AtaCorrida | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Envio da ata aos stakeholders por e-mail, com o PDF anexo (Bruno 10/09)
  async function enviarStakeholders() {
    if (enviando) return;
    if (!(await confirmar('Enviar a ata atualizada (PDF) por e-mail a TODOS os stakeholders com e-mail cadastrado?', { titulo: 'Enviar ata', confirmarLabel: 'Enviar' }))) return;
    setEnviando(true);
    try {
      const r = await api.post(`/obras/${obraId}/atas/enviar`);
      const lista = (r.data.data?.enviados ?? []) as { nome: string; email: string }[];
      const { toast } = await import('@/lib/toast');
      toast(`Ata enviada pra ${lista.length} destinatário(s) ✓`);
    } catch (err) {
      alert(errMsg(err, 'Não consegui enviar a ata.'));
    } finally {
      setEnviando(false);
    }
  }

  async function gerarPdf() {
    setGeneratingPdf(true);
    try {
      const win = window.open('', '_blank'); // aberto SÍNCRONO no toque — iOS não bloqueia
      const res = await api.get(`/obras/${obraId}/atas/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert(errMsg(err, 'Não consegui gerar o PDF da ata.'));
    } finally {
      setGeneratingPdf(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ataRes = await api.get<{ data: AtaCorrida }>(`/obras/${obraId}/atas`);
      setAta(ataRes.data.data);
      setError(null);
    } catch (err) {
      setError(errMsg(err, 'Erro ao carregar ata'));
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => { load(); }, [load]);

  const sortedTopicos = useMemo(() => ata ? sortTopicos(ata.topicos) : [], [ata]);

  // ── Mutations otimistas ────────────────────────────────────────────────

  async function addTopico() {
    try {
      const res = await api.post<{ data: Topico }>(`/obras/${obraId}/atas/topicos`, {});
      setAta(prev => prev ? { ...prev, topicos: [...prev.topicos, res.data.data] } : prev);
    } catch (err) { alert(errMsg(err, 'Erro ao criar tópico')); }
  }

  async function updateTopicoField<K extends keyof Topico>(topicoId: string, field: K, value: Topico[K]) {
    setAta(prev => prev ? {
      ...prev,
      topicos: prev.topicos.map(t => t.id === topicoId ? { ...t, [field]: value } : t),
    } : prev);
    try {
      await api.patch(`/obras/${obraId}/atas/topicos/${topicoId}`, { [field]: value });
    } catch (err) {
      alert(errMsg(err, 'Erro ao salvar'));
      load();
    }
  }

  async function removeTopico(topicoId: string) {
    if (!(await confirmar('Excluir este tópico? O histórico de atualizações também será removido.', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/atas/topicos/${topicoId}`);
      setAta(prev => prev ? {
        ...prev,
        topicos: prev.topicos.filter(t => t.id !== topicoId),
      } : prev);
    } catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  async function addAtualizacao(topicoId: string, data: string, texto: string) {
    try {
      const res = await api.post<{ data: Atualizacao }>(
        `/obras/${obraId}/atas/topicos/${topicoId}/atualizacoes`,
        { data, texto },
      );
      setAta(prev => prev ? {
        ...prev,
        topicos: prev.topicos.map(t => t.id === topicoId
          ? { ...t, atualizacoes: [res.data.data, ...t.atualizacoes] }
          : t,
        ),
      } : prev);
    } catch (err) { alert(errMsg(err, 'Erro ao adicionar atualização')); }
  }

  async function removeAtualizacao(topicoId: string, atualizacaoId: string) {
    if (!(await confirmar('Excluir esta entrada do histórico?', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/atas/atualizacoes/${atualizacaoId}`);
      setAta(prev => prev ? {
        ...prev,
        topicos: prev.topicos.map(t => t.id === topicoId
          ? { ...t, atualizacoes: t.atualizacoes.filter(a => a.id !== atualizacaoId) }
          : t,
        ),
      } : prev);
    } catch (err) { alert(errMsg(err, 'Erro ao excluir atualização')); }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {ata?.obra.name || 'Obra'}
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Atas de Reunião</span>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <FileSpreadsheet size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black text-ber-carbon">Ata Corrida</h1>
        <span className="text-xs text-ber-gray">— Um documento vivo, ordenado por prioridade</span>
        <button
          onClick={gerarPdf}
          disabled={generatingPdf || !ata}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-ber-carbon px-3 py-1.5 text-xs font-medium text-ber-carbon hover:bg-ber-carbon hover:text-white disabled:opacity-50"
        >
          <FileDown size={14} /> {generatingPdf ? 'Gerando…' : 'Gerar PDF'}
        </button>
        <button
          onClick={enviarStakeholders}
          disabled={enviando || !ata}
          className="flex items-center gap-1.5 rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-50"
          title="Envia o PDF da ata por e-mail a todos os stakeholders com e-mail cadastrado"
        >
          ✉ {enviando ? 'Enviando…' : 'Enviar aos stakeholders'}
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : error ? (
        <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 py-8 text-center text-sm text-red-700">{error}</div>
      ) : ata ? (
        <>
          <ObraHeaderBox obra={ata.obra} />
          <StakeholdersBox stakeholders={ata.stakeholders} obraId={obraId} />

          <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Tópicos</h2>
              {ata.stakeholders.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  <AlertTriangle size={12} className="inline mr-1" />
                  Nenhum stakeholder cadastrado — adicione em "Gerenciar" pra poder definir responsáveis.
                </p>
              )}
            </div>
            <button onClick={addTopico}
              className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-1.5 text-xs font-medium text-white hover:bg-ber-black">
              <Plus size={12} /> Novo tópico
            </button>
          </div>

          {sortedTopicos.length === 0 ? (
            <div className="mt-3 rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-ber-gray/40" />
              <p className="text-sm font-medium text-ber-gray">Nenhum tópico ainda.</p>
              <p className="mt-1 text-xs text-ber-gray/60">Clique em "Novo tópico" para começar.</p>
            </div>
          ) : (
            <TopicosTable
              topicos={sortedTopicos}
              stakeholders={ata.stakeholders}
              onUpdateTopico={updateTopicoField}
              onRemoveTopico={removeTopico}
              onAddAtualizacao={addAtualizacao}
              onRemoveAtualizacao={removeAtualizacao}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

// ── Cabeçalho da obra ─────────────────────────────────────────────────────

function ObraHeaderBox({ obra }: { obra: ObraHeader }) {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-ber-gray/10 py-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-ber-gray">{label}</span>
      <span className="text-ber-carbon">{value || <span className="text-ber-gray/50 italic">não informado</span>}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ber-gray">Obra</h2>
      <Row label="Nome" value={obra.name} />
      <Row label="Cliente" value={obra.client} />
      <Row label="Endereço" value={obra.address} />
      <Row label="Arquitetura" value={obra.arquiteturaEscritorio} />
      <Row label="Gerenciadora" value={obra.gerenciadora} />
      <Row label="Área (m²)" value={obra.areaM2 ? `${obra.areaM2.toLocaleString('pt-BR')} m²` : null} />
      <Row label="Data Início" value={fmtDate(obra.dataInicioObra)} />
      <Row label="Data Fim" value={fmtDate(obra.dataFimObra)} />
    </div>
  );
}

// ── Stakeholders ──────────────────────────────────────────────────────────

function StakeholdersBox({ stakeholders, obraId }: { stakeholders: Stakeholder[]; obraId: string }) {
  return (
    <div className="mt-4 rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ber-gray flex items-center gap-2">
          <Users size={14} /> Stakeholders ({stakeholders.length})
        </h2>
        <Link href={`/obras/${obraId}/stakeholders`}
          className="text-xs font-medium text-ber-teal hover:underline">
          Gerenciar
        </Link>
      </div>
      {stakeholders.length === 0 ? (
        <p className="text-xs italic text-ber-gray">Nenhum stakeholder cadastrado. Use o link "Gerenciar" para adicionar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-ber-gray/15 text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-ber-gray">
                <th className="py-1.5 pr-3">Nome</th>
                <th className="py-1.5 pr-3">Empresa</th>
                <th className="py-1.5 pr-3">Função</th>
                <th className="py-1.5 pr-3">Email</th>
                <th className="py-1.5 pr-3">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {stakeholders.map(s => (
                <tr key={s.id} className="border-b border-ber-gray/5">
                  <td className="py-1.5 pr-3 font-medium text-ber-carbon">{s.nome}</td>
                  <td className="py-1.5 pr-3 text-ber-carbon">{s.empresa}</td>
                  <td className="py-1.5 pr-3 text-ber-gray">{s.funcao || '—'}</td>
                  <td className="py-1.5 pr-3 text-ber-gray">{s.email || '—'}</td>
                  <td className="py-1.5 pr-3 text-ber-gray">{s.telefone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tabela de tópicos ────────────────────────────────────────────────────
