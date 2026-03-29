'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Plus, X, AlertTriangle, Shield, HardHat, GraduationCap, FileWarning, Check, Clock, Download, Upload } from 'lucide-react';

// --- Types ---

interface APR {
  id: string;
  activityName: string;
  date: string;
  responsible: string;
  risks: { description: string; severity: string; control: string }[];
  status: string;
  creator: { id: string; name: string } | null;
  approver: { id: string; name: string } | null;
  obra?: { id: string; name: string };
  createdAt: string;
}

interface EPI {
  id: string;
  epiName: string;
  epiType: string;
  deliveredAt: string;
  expiresAt: string | null;
  quantity: number;
  caNumber: string | null;
  returnedAt: string | null;
  user: { id: string; name: string };
  obra?: { id: string; name: string };
}

interface IncidentRecord {
  id: string;
  type: string;
  severity: string;
  description: string;
  immediateAction: string | null;
  correctiveAction: string | null;
  occurredAt: string;
  photoUrls: string[];
  status: string;
  reporter: { id: string; name: string } | null;
  injured: { id: string; name: string } | null;
  obra?: { id: string; name: string };
}

interface TrainingRecord {
  id: string;
  trainingName: string;
  provider: string | null;
  nr: string;
  completedAt: string;
  expiresAt: string | null;
  certificateUrl: string | null;
  user: { id: string; name: string };
  obra: { id: string; name: string } | null;
}

interface ObraOption { id: string; name: string }
interface UserOption { id: string; name: string }

// --- Constants ---

type TabKey = 'apr' | 'epi' | 'incidents' | 'trainings';

const SEVERITY_COLORS: Record<string, string> = {
  baixo: 'bg-ber-gray/15 text-ber-gray',
  medio: 'bg-ber-olive/15 text-ber-olive',
  alto: 'bg-amber-100 text-amber-700',
  critico: 'bg-red-100 text-red-700',
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  acidente: 'Acidente',
  quase_acidente: 'Quase Acidente',
  condicao_insegura: 'Condição Insegura',
  ato_inseguro: 'Ato Inseguro',
};

const INCIDENT_SEVERITY: Record<string, string> = {
  leve: 'bg-ber-gray/15 text-ber-gray',
  moderado: 'bg-amber-100 text-amber-700',
  grave: 'bg-red-100 text-red-700',
  fatal: 'bg-red-600 text-white',
};

const INCIDENT_STATUS: Record<string, string> = {
  aberto: 'bg-red-100 text-red-700',
  em_investigacao: 'bg-amber-100 text-amber-700',
  encerrado: 'bg-green-100 text-green-700',
};

const APR_STATUS: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-ber-gray/15 text-ber-gray' },
  aprovada: { label: 'Aprovada', className: 'bg-green-100 text-green-700' },
  encerrada: { label: 'Encerrada', className: 'bg-ber-carbon/10 text-ber-carbon' },
};

const NR_OPTIONS = ['NR-18', 'NR-35', 'NR-06', 'NR-10', 'NR-33', 'outro'];

// --- Helpers ---

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pt-BR');
}

// --- Component ---

export default function SegurancaPage() {
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabKey>('apr');
  const [obras, setObras] = useState<ObraOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedObraId, setSelectedObraId] = useState('');

  // APR state
  const [aprs, setAprs] = useState<APR[]>([]);
  const [loadingAprs, setLoadingAprs] = useState(false);
  const [aprModalOpen, setAprModalOpen] = useState(false);
  const [aprForm, setAprForm] = useState({ activityName: '', date: '', responsible: '' });
  const [aprRisks, setAprRisks] = useState<{ description: string; severity: string; control: string }[]>([]);
  const [submittingApr, setSubmittingApr] = useState(false);

  // EPI state
  const [epis, setEpis] = useState<EPI[]>([]);
  const [loadingEpis, setLoadingEpis] = useState(false);
  const [epiModalOpen, setEpiModalOpen] = useState(false);
  const [epiForm, setEpiForm] = useState({ userId: '', epiName: '', epiType: '', caNumber: '', deliveredAt: '', expiresAt: '', quantity: 1 });
  const [submittingEpi, setSubmittingEpi] = useState(false);

  // Incidents state
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ type: 'acidente', severity: 'leve', description: '', immediateAction: '', correctiveAction: '', occurredAt: '', injuredUserId: '' });
  const [incidentPhotos, setIncidentPhotos] = useState<string[]>([]);
  const [uploadingIncidentPhoto, setUploadingIncidentPhoto] = useState(false);
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // Trainings state
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [loadingTrainings, setLoadingTrainings] = useState(false);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [trainingForm, setTrainingForm] = useState({ userId: '', trainingName: '', provider: '', nr: 'NR-18', completedAt: '', expiresAt: '', certificateUrl: '' });
  const [submittingTraining, setSubmittingTraining] = useState(false);
  const [nrFilter, setNrFilter] = useState('');

  // --- Fetch obras & users on mount ---

  useEffect(() => {
    async function load() {
      try {
        const [obrasRes, usersRes] = await Promise.all([
          api.get('/obras', { params: { limit: 100 } }),
          api.get('/users', { params: { limit: 100 } }),
        ]);
        setObras(obrasRes.data.data.map((o: ObraOption) => ({ id: o.id, name: o.name })));
        setUsers(usersRes.data.data.map((u: UserOption) => ({ id: u.id, name: u.name })));
      } catch {
        /* interceptor */
      }
    }
    load();
  }, []);

  // --- Tab data fetching ---

  useEffect(() => {
    if (activeTab === 'trainings') {
      fetchTrainings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!selectedObraId) return;
    if (activeTab === 'apr') fetchAprs();
    else if (activeTab === 'epi') fetchEpis();
    else if (activeTab === 'incidents') fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObraId, activeTab]);

  // --- Fetch functions ---

  async function fetchAprs() {
    setLoadingAprs(true);
    try {
      const res = await api.get(`/obras/${selectedObraId}/apr`);
      setAprs(res.data.data ?? res.data);
    } catch {
      /* interceptor */
    } finally {
      setLoadingAprs(false);
    }
  }

  async function fetchEpis() {
    setLoadingEpis(true);
    try {
      const res = await api.get(`/obras/${selectedObraId}/epi`);
      setEpis(res.data.data ?? res.data);
    } catch {
      /* interceptor */
    } finally {
      setLoadingEpis(false);
    }
  }

  async function fetchIncidents() {
    setLoadingIncidents(true);
    try {
      const res = await api.get(`/obras/${selectedObraId}/incidents`);
      setIncidents(res.data.data ?? res.data);
    } catch {
      /* interceptor */
    } finally {
      setLoadingIncidents(false);
    }
  }

  async function fetchTrainings() {
    setLoadingTrainings(true);
    try {
      const res = await api.get('/trainings');
      setTrainings(res.data.data ?? res.data);
    } catch {
      /* interceptor */
    } finally {
      setLoadingTrainings(false);
    }
  }

  // --- APR handlers ---

  function openAprModal() {
    setAprForm({ activityName: '', date: '', responsible: '' });
    setAprRisks([{ description: '', severity: 'baixo', control: '' }]);
    setAprModalOpen(true);
  }

  async function handleSubmitApr(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingApr(true);
    try {
      await api.post(`/obras/${selectedObraId}/apr`, {
        activityName: aprForm.activityName,
        date: aprForm.date,
        responsible: aprForm.responsible,
        risks: aprRisks.filter((r) => r.description),
      });
      setAprModalOpen(false);
      fetchAprs();
    } catch {
      /* interceptor */
    } finally {
      setSubmittingApr(false);
    }
  }

  // --- EPI handlers ---

  function openEpiModal() {
    setEpiForm({ userId: '', epiName: '', epiType: '', caNumber: '', deliveredAt: '', expiresAt: '', quantity: 1 });
    setEpiModalOpen(true);
  }

  async function handleSubmitEpi(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingEpi(true);
    try {
      await api.post(`/obras/${selectedObraId}/epi`, {
        userId: epiForm.userId,
        epiName: epiForm.epiName,
        epiType: epiForm.epiType,
        caNumber: epiForm.caNumber || undefined,
        deliveredAt: epiForm.deliveredAt,
        expiresAt: epiForm.expiresAt || undefined,
        quantity: epiForm.quantity,
      });
      setEpiModalOpen(false);
      fetchEpis();
    } catch {
      /* interceptor */
    } finally {
      setSubmittingEpi(false);
    }
  }

  function getEpiStatus(epi: EPI): { label: string; className: string } {
    if (epi.returnedAt) return { label: 'Devolvido', className: 'bg-ber-gray/15 text-ber-gray' };
    if (!epi.expiresAt) return { label: 'Válido', className: 'bg-green-100 text-green-700' };
    const now = new Date();
    const expires = new Date(epi.expiresAt);
    const in30d = new Date();
    in30d.setDate(in30d.getDate() + 30);
    if (expires < now) return { label: 'Vencido', className: 'bg-red-100 text-red-700 border border-red-300' };
    if (expires < in30d) return { label: 'Vencendo', className: 'bg-amber-100 text-amber-700 border border-amber-300' };
    return { label: 'Válido', className: 'bg-green-100 text-green-700' };
  }

  // --- Incident handlers ---

  function openIncidentModal() {
    setIncidentForm({ type: 'acidente', severity: 'leve', description: '', immediateAction: '', correctiveAction: '', occurredAt: '', injuredUserId: '' });
    setIncidentPhotos([]);
    setIncidentModalOpen(true);
  }

  async function handleSubmitIncident(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingIncident(true);
    try {
      await api.post(`/obras/${selectedObraId}/incidents`, {
        type: incidentForm.type,
        severity: incidentForm.severity,
        description: incidentForm.description,
        immediateAction: incidentForm.immediateAction || undefined,
        correctiveAction: incidentForm.correctiveAction || undefined,
        occurredAt: incidentForm.occurredAt,
        injuredUserId: incidentForm.injuredUserId || undefined,
        photoUrls: incidentPhotos.length ? incidentPhotos : undefined,
      });
      setIncidentModalOpen(false);
      fetchIncidents();
    } catch {
      /* interceptor */
    } finally {
      setSubmittingIncident(false);
    }
  }

  async function handleIncidentPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingIncidentPhoto(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const res = await api.post('/uploads', formData);
        setIncidentPhotos((prev) => [...prev, res.data.data.url]);
      }
    } catch {
      /* interceptor */
    } finally {
      setUploadingIncidentPhoto(false);
      e.target.value = '';
    }
  }

  // --- Training handlers ---

  function openTrainingModal() {
    setTrainingForm({ userId: '', trainingName: '', provider: '', nr: 'NR-18', completedAt: '', expiresAt: '', certificateUrl: '' });
    setTrainingModalOpen(true);
  }

  async function handleSubmitTraining(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingTraining(true);
    try {
      await api.post('/trainings', {
        userId: trainingForm.userId,
        trainingName: trainingForm.trainingName,
        provider: trainingForm.provider || undefined,
        nr: trainingForm.nr,
        completedAt: trainingForm.completedAt,
        expiresAt: trainingForm.expiresAt || undefined,
        certificateUrl: trainingForm.certificateUrl || undefined,
      });
      setTrainingModalOpen(false);
      fetchTrainings();
    } catch {
      /* interceptor */
    } finally {
      setSubmittingTraining(false);
    }
  }

  function getTrainingStatus(t: TrainingRecord): { label: string; className: string } {
    if (!t.expiresAt) return { label: 'Permanente', className: 'bg-ber-gray/15 text-ber-gray' };
    const now = new Date();
    const expires = new Date(t.expiresAt);
    const in30d = new Date();
    in30d.setDate(in30d.getDate() + 30);
    if (expires < now) return { label: 'Vencido', className: 'bg-red-100 text-red-700' };
    if (expires < in30d) return { label: 'Vencendo', className: 'bg-amber-100 text-amber-700' };
    return { label: 'Válido', className: 'bg-green-100 text-green-700' };
  }

  // --- Export ---

  const [exporting, setExporting] = useState(false);

  async function handleExport(tipo: string) {
    setExporting(true);
    try {
      const res = await api.get('/seguranca/export', { params: { tipo }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `seguranca_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      /* interceptor */
    } finally {
      setExporting(false);
    }
  }

  // --- Filtered trainings ---

  const filteredTrainings = nrFilter ? trainings.filter((t) => t.nr === nrFilter) : trainings;

  // --- Tabs config ---

  const tabs: { key: TabKey; label: string; icon: typeof Shield }[] = [
    { key: 'apr', label: 'APR', icon: FileWarning },
    { key: 'epi', label: 'EPI', icon: HardHat },
    { key: 'incidents', label: 'Incidentes', icon: AlertTriangle },
    { key: 'trainings', label: 'Treinamentos', icon: GraduationCap },
  ];

  // --- Obra selector component ---

  function ObraSelector() {
    return (
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-ber-carbon">Obra</label>
        <select
          value={selectedObraId}
          onChange={(e) => setSelectedObraId(e.target.value)}
          className="rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
        >
          <option value="">Selecione uma obra</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    );
  }

  // --- Render ---

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Segurança do Trabalho</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport(activeTab === 'incidents' ? 'incidentes' : activeTab === 'trainings' ? 'treinamentos' : activeTab)}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-ber-gray/30 px-3 py-2 text-sm font-medium text-ber-carbon transition-colors hover:bg-white disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
          {activeTab === 'apr' && selectedObraId && (
            <button onClick={openAprModal} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90">
              <Plus size={16} /> Nova APR
            </button>
          )}
          {activeTab === 'epi' && selectedObraId && (
            <button onClick={openEpiModal} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90">
              <Plus size={16} /> Registrar Entrega
            </button>
          )}
          {activeTab === 'incidents' && selectedObraId && (
            <button onClick={openIncidentModal} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90">
              <Plus size={16} /> Registrar Incidente
            </button>
          )}
          {activeTab === 'trainings' && (
            <button onClick={openTrainingModal} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90">
              <Plus size={16} /> Registrar Treinamento
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="mt-6 flex gap-6 border-b border-ber-gray/20">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'border-ber-olive text-ber-carbon'
                : 'border-transparent text-ber-gray hover:text-ber-carbon'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">

        {/* ===== APR TAB ===== */}
        {activeTab === 'apr' && (
          <>
            <ObraSelector />
            {!selectedObraId ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Shield size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">Selecione uma obra para ver as APRs</p>
              </div>
            ) : loadingAprs ? (
              <div className="py-12 text-center text-sm text-ber-gray">Carregando...</div>
            ) : aprs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <FileWarning size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">Nenhuma APR encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ber-gray/10 text-xs font-semibold uppercase text-ber-gray">
                      <th className="px-6 py-4">Atividade</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Responsável</th>
                      <th className="px-6 py-4">Riscos</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aprs.map((apr) => {
                      const st = APR_STATUS[apr.status] ?? { label: apr.status, className: 'bg-ber-gray/15 text-ber-gray' };
                      return (
                        <tr key={apr.id} className="border-b border-ber-gray/5 last:border-0">
                          <td className="px-6 py-4 font-medium text-ber-carbon">{apr.activityName}</td>
                          <td className="px-6 py-4 text-ber-gray">{formatDate(apr.date)}</td>
                          <td className="px-6 py-4 text-ber-gray">{apr.responsible}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-full bg-ber-carbon/10 px-2.5 py-0.5 text-xs font-semibold text-ber-carbon">
                              {apr.risks?.length ?? 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ===== EPI TAB ===== */}
        {activeTab === 'epi' && (
          <>
            <ObraSelector />
            {!selectedObraId ? (
              <div className="flex flex-col items-center py-16 text-center">
                <HardHat size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">Selecione uma obra para ver os EPIs</p>
              </div>
            ) : loadingEpis ? (
              <div className="py-12 text-center text-sm text-ber-gray">Carregando...</div>
            ) : epis.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <HardHat size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">Nenhum EPI registrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ber-gray/10 text-xs font-semibold uppercase text-ber-gray">
                      <th className="px-6 py-4">Colaborador</th>
                      <th className="px-6 py-4">EPI</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">CA</th>
                      <th className="px-6 py-4">Entrega</th>
                      <th className="px-6 py-4">Validade</th>
                      <th className="px-6 py-4">Qtd</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epis.map((epi) => {
                      const st = getEpiStatus(epi);
                      return (
                        <tr key={epi.id} className="border-b border-ber-gray/5 last:border-0">
                          <td className="px-6 py-4 font-medium text-ber-carbon">{epi.user?.name ?? '--'}</td>
                          <td className="px-6 py-4 text-ber-gray">{epi.epiName}</td>
                          <td className="px-6 py-4 text-ber-gray">{epi.epiType}</td>
                          <td className="px-6 py-4 text-ber-gray">{epi.caNumber ?? '--'}</td>
                          <td className="px-6 py-4 text-ber-gray">{formatDate(epi.deliveredAt)}</td>
                          <td className="px-6 py-4 text-ber-gray">{formatDate(epi.expiresAt)}</td>
                          <td className="px-6 py-4 text-ber-gray">{epi.quantity}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ===== INCIDENTS TAB ===== */}
        {activeTab === 'incidents' && (
          <>
            <ObraSelector />
            {!selectedObraId ? (
              <div className="flex flex-col items-center py-16 text-center">
                <AlertTriangle size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">Selecione uma obra para ver os incidentes</p>
              </div>
            ) : loadingIncidents ? (
              <div className="py-12 text-center text-sm text-ber-gray">Carregando...</div>
            ) : incidents.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <AlertTriangle size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">Nenhum incidente registrado</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {incidents.map((inc) => {
                  const isGrave = inc.severity === 'grave' || inc.severity === 'fatal';
                  return (
                    <div key={inc.id} className={`rounded-lg bg-white p-5 shadow-sm ${isGrave ? 'border-l-4 border-l-red-500' : ''}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${INCIDENT_SEVERITY[inc.severity] ?? 'bg-ber-gray/15 text-ber-gray'}`}>
                          {inc.severity}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-ber-carbon/10 px-2.5 py-0.5 text-xs font-semibold text-ber-carbon">
                          {INCIDENT_TYPE_LABELS[inc.type] ?? inc.type}
                        </span>
                        <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${INCIDENT_STATUS[inc.status] ?? 'bg-ber-gray/15 text-ber-gray'}`}>
                          {inc.status === 'em_investigacao' ? 'Em Investigação' : inc.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-ber-carbon line-clamp-3">{inc.description}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-ber-gray">
                        <span>{formatDate(inc.occurredAt)}</span>
                        <span>{inc.reporter?.name ?? '--'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== TRAININGS TAB ===== */}
        {activeTab === 'trainings' && (
          <>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-ber-carbon">Filtrar por NR</label>
              <select
                value={nrFilter}
                onChange={(e) => setNrFilter(e.target.value)}
                className="rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive"
              >
                <option value="">Todas</option>
                {NR_OPTIONS.map((nr) => (
                  <option key={nr} value={nr}>{nr}</option>
                ))}
              </select>
            </div>
            {loadingTrainings ? (
              <div className="py-12 text-center text-sm text-ber-gray">Carregando...</div>
            ) : filteredTrainings.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <GraduationCap size={48} className="text-ber-gray/40" />
                <p className="mt-4 text-sm font-medium text-ber-gray">Nenhum treinamento encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ber-gray/10 text-xs font-semibold uppercase text-ber-gray">
                      <th className="px-6 py-4">Colaborador</th>
                      <th className="px-6 py-4">Treinamento</th>
                      <th className="px-6 py-4">NR</th>
                      <th className="px-6 py-4">Fornecedor</th>
                      <th className="px-6 py-4">Conclusão</th>
                      <th className="px-6 py-4">Validade</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrainings.map((t) => {
                      const st = getTrainingStatus(t);
                      return (
                        <tr key={t.id} className="border-b border-ber-gray/5 last:border-0">
                          <td className="px-6 py-4 font-medium text-ber-carbon">{t.user?.name ?? '--'}</td>
                          <td className="px-6 py-4 text-ber-gray">{t.trainingName}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-full bg-ber-olive/15 px-2.5 py-0.5 text-xs font-semibold text-ber-olive">
                              {t.nr}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-ber-gray">{t.provider ?? '--'}</td>
                          <td className="px-6 py-4 text-ber-gray">{formatDate(t.completedAt)}</td>
                          <td className="px-6 py-4 text-ber-gray">{formatDate(t.expiresAt)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== APR MODAL ===== */}
      {aprModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ber-carbon">Nova APR</h2>
              <button onClick={() => setAprModalOpen(false)} className="rounded p-1 text-ber-gray transition-colors hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitApr} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Atividade</label>
                <input type="text" value={aprForm.activityName} onChange={(e) => setAprForm({ ...aprForm, activityName: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Data</label>
                  <input type="date" value={aprForm.date} onChange={(e) => setAprForm({ ...aprForm, date: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Responsável</label>
                  <input type="text" value={aprForm.responsible} onChange={(e) => setAprForm({ ...aprForm, responsible: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
              </div>

              {/* Risks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ber-carbon">Riscos</label>
                  <button type="button" onClick={() => setAprRisks([...aprRisks, { description: '', severity: 'baixo', control: '' }])} className="flex items-center gap-1 text-xs font-semibold text-ber-olive hover:underline">
                    <Plus size={14} /> Adicionar Risco
                  </button>
                </div>
                <div className="space-y-3">
                  {aprRisks.map((risk, idx) => (
                    <div key={idx} className="flex gap-2 items-start rounded-lg border border-ber-gray/10 p-3">
                      <div className="flex-1 space-y-2">
                        <input type="text" placeholder="Descrição do risco" value={risk.description} onChange={(e) => { const r = [...aprRisks]; r[idx].description = e.target.value; setAprRisks(r); }} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                        <div className="flex gap-2">
                          <select value={risk.severity} onChange={(e) => { const r = [...aprRisks]; r[idx].severity = e.target.value; setAprRisks(r); }} className="rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                            <option value="baixo">Baixo</option>
                            <option value="medio">Médio</option>
                            <option value="alto">Alto</option>
                            <option value="critico">Crítico</option>
                          </select>
                          <input type="text" placeholder="Medida de controle" value={risk.control} onChange={(e) => { const r = [...aprRisks]; r[idx].control = e.target.value; setAprRisks(r); }} className="flex-1 rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                        </div>
                      </div>
                      {aprRisks.length > 1 && (
                        <button type="button" onClick={() => setAprRisks(aprRisks.filter((_, i) => i !== idx))} className="mt-1 rounded p-1 text-ber-gray hover:text-red-500">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAprModalOpen(false)} className="rounded-lg border border-ber-gray/20 px-4 py-2 text-sm font-semibold text-ber-gray transition-colors hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={submittingApr} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50">
                  {submittingApr ? 'Salvando...' : 'Criar APR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== EPI MODAL ===== */}
      {epiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ber-carbon">Registrar Entrega de EPI</h2>
              <button onClick={() => setEpiModalOpen(false)} className="rounded p-1 text-ber-gray transition-colors hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitEpi} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Colaborador</label>
                <select value={epiForm.userId} onChange={(e) => setEpiForm({ ...epiForm, userId: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                  <option value="">Selecione</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Nome do EPI</label>
                  <input type="text" value={epiForm.epiName} onChange={(e) => setEpiForm({ ...epiForm, epiName: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Tipo</label>
                  <input type="text" value={epiForm.epiType} onChange={(e) => setEpiForm({ ...epiForm, epiType: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Número CA</label>
                <input type="text" value={epiForm.caNumber} onChange={(e) => setEpiForm({ ...epiForm, caNumber: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Data de Entrega</label>
                  <input type="date" value={epiForm.deliveredAt} onChange={(e) => setEpiForm({ ...epiForm, deliveredAt: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Validade</label>
                  <input type="date" value={epiForm.expiresAt} onChange={(e) => setEpiForm({ ...epiForm, expiresAt: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Quantidade</label>
                <input type="number" min={1} value={epiForm.quantity} onChange={(e) => setEpiForm({ ...epiForm, quantity: parseInt(e.target.value) || 1 })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEpiModalOpen(false)} className="rounded-lg border border-ber-gray/20 px-4 py-2 text-sm font-semibold text-ber-gray transition-colors hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={submittingEpi} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50">
                  {submittingEpi ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== INCIDENT MODAL ===== */}
      {incidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ber-carbon">Registrar Incidente</h2>
              <button onClick={() => setIncidentModalOpen(false)} className="rounded p-1 text-ber-gray transition-colors hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitIncident} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Tipo</label>
                  <select value={incidentForm.type} onChange={(e) => setIncidentForm({ ...incidentForm, type: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                    <option value="acidente">Acidente</option>
                    <option value="quase_acidente">Quase Acidente</option>
                    <option value="condicao_insegura">Condição Insegura</option>
                    <option value="ato_inseguro">Ato Inseguro</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Severidade</label>
                  <select value={incidentForm.severity} onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                    <option value="leve">Leve</option>
                    <option value="moderado">Moderado</option>
                    <option value="grave">Grave</option>
                    <option value="fatal">Fatal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Descrição</label>
                <textarea value={incidentForm.description} onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })} required rows={3} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Ação Imediata</label>
                <textarea value={incidentForm.immediateAction} onChange={(e) => setIncidentForm({ ...incidentForm, immediateAction: e.target.value })} rows={2} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Ação Corretiva</label>
                <textarea value={incidentForm.correctiveAction} onChange={(e) => setIncidentForm({ ...incidentForm, correctiveAction: e.target.value })} rows={2} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Data da Ocorrência</label>
                  <input type="date" value={incidentForm.occurredAt} onChange={(e) => setIncidentForm({ ...incidentForm, occurredAt: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Acidentado</label>
                  <select value={incidentForm.injuredUserId} onChange={(e) => setIncidentForm({ ...incidentForm, injuredUserId: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                    <option value="">Nenhum</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Fotos</label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ber-gray/30 px-3 py-2 text-sm text-ber-gray transition-colors hover:border-ber-olive hover:text-ber-olive ${uploadingIncidentPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={16} />
                  {uploadingIncidentPhoto ? 'Enviando...' : 'Selecionar fotos'}
                  <input type="file" accept="image/*" capture="environment" multiple onChange={handleIncidentPhotoUpload} className="hidden" />
                </label>
                {incidentPhotos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {incidentPhotos.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded border object-cover" />
                        <button type="button" onClick={() => setIncidentPhotos((prev) => prev.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIncidentModalOpen(false)} className="rounded-lg border border-ber-gray/20 px-4 py-2 text-sm font-semibold text-ber-gray transition-colors hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={submittingIncident} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50">
                  {submittingIncident ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== TRAINING MODAL ===== */}
      {trainingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ber-carbon">Registrar Treinamento</h2>
              <button onClick={() => setTrainingModalOpen(false)} className="rounded p-1 text-ber-gray transition-colors hover:text-ber-carbon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitTraining} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Colaborador</label>
                <select value={trainingForm.userId} onChange={(e) => setTrainingForm({ ...trainingForm, userId: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                  <option value="">Selecione</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">Nome do Treinamento</label>
                <input type="text" value={trainingForm.trainingName} onChange={(e) => setTrainingForm({ ...trainingForm, trainingName: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">NR</label>
                  <select value={trainingForm.nr} onChange={(e) => setTrainingForm({ ...trainingForm, nr: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                    {NR_OPTIONS.map((nr) => (
                      <option key={nr} value={nr}>{nr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Fornecedor</label>
                  <input type="text" value={trainingForm.provider} onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Data de Conclusão</label>
                  <input type="date" value={trainingForm.completedAt} onChange={(e) => setTrainingForm({ ...trainingForm, completedAt: e.target.value })} required className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ber-carbon">Validade</label>
                  <input type="date" value={trainingForm.expiresAt} onChange={(e) => setTrainingForm({ ...trainingForm, expiresAt: e.target.value })} className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ber-carbon">URL do Certificado</label>
                <input type="text" value={trainingForm.certificateUrl} onChange={(e) => setTrainingForm({ ...trainingForm, certificateUrl: e.target.value })} placeholder="https://..." className="w-full rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setTrainingModalOpen(false)} className="rounded-lg border border-ber-gray/20 px-4 py-2 text-sm font-semibold text-ber-gray transition-colors hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={submittingTraining} className="flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50">
                  {submittingTraining ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
