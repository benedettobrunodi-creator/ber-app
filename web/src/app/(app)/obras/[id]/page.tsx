'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Plus, Calendar, User, ChevronDown, RefreshCw, X, ClipboardCheck, Tent, ListOrdered, Play, Send, Check, XCircle, Lock, Clock, Pencil, ChevronUp, Trash2, Snowflake, Package, Camera, Image as ImageIcon } from 'lucide-react';

type ObraStatus = 'planejamento' | 'em_andamento' | 'pausada' | 'concluida';
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface ObraDetail {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  status: ObraStatus;
  progressPercent: number;
  startDate: string | null;
  expectedEndDate: string | null;
  trelloBoardId: string | null;
  coordinator: { id: string; name: string; avatarUrl: string | null } | null;
  members: { user: { id: string; name: string; role: string; avatarUrl: string | null }; joinedAt: string }[];
  _count: { tasks: number; photos: number };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  creator: { id: string; name: string } | null;
}

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

interface ChecklistSummary {
  id: string;
  type: string;
  segment: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  creator: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
  items: { answer: string | null; required: boolean }[];
  _count: { items: number };
}

interface ChecklistTemplate {
  id: string;
  name: string;
  type: string;
  segment: string;
  items: { id: string; title: string }[];
}

const STATUS_CONFIG: Record<ObraStatus, { label: string; badge: string; selectBorder: string }> = {
  planejamento: { label: 'Planejamento', badge: 'bg-ber-gray/15 text-ber-gray', selectBorder: 'border-ber-gray focus:ring-ber-gray' },
  em_andamento: { label: 'Em andamento', badge: 'bg-ber-teal/15 text-ber-teal', selectBorder: 'border-ber-teal focus:ring-ber-teal' },
  pausada: { label: 'Pausada', badge: 'bg-amber-100 text-amber-700', selectBorder: 'border-amber-400 focus:ring-amber-400' },
  concluida: { label: 'Concluída', badge: 'bg-ber-olive/15 text-ber-olive', selectBorder: 'border-ber-olive focus:ring-ber-olive' },
};

const CAN_CHANGE_STATUS = ['diretoria', 'coordenacao'];

const KANBAN_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'A fazer' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'review', label: 'Revisão' },
  { key: 'done', label: 'Concluído' },
];

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-red-400',
  medium: 'border-l-ber-olive',
  low: 'border-l-ber-gray',
};

const PRIORITY_LABEL: Record<TaskPriority, { text: string; className: string }> = {
  urgent: { text: 'Urgente', className: 'text-red-600' },
  high: { text: 'Alta', className: 'text-red-500' },
  medium: { text: 'Média', className: 'text-ber-olive' },
  low: { text: 'Baixa', className: 'text-ber-gray' },
};

type TabKey = 'kanban' | 'fotos' | 'equipe' | 'checklists' | 'canteiro' | 'sequenciamento' | 'recebimentos';

interface Recebimento {
  id: string;
  fornecedor: string;
  material: string;
  quantidade: number;
  unidade: string;
  numeroNF: string | null;
  dataNF: string | null;
  dataEntrega: string;
  condicao: string;
  observacao: string | null;
  fotosMaterial: string[];
  fotoNF: string | null;
  createdAt: string;
  registrador: { id: string; name: string } | null;
}

const CONDICAO_CONFIG: Record<string, { label: string; className: string }> = {
  aprovado: { label: 'Aprovado', className: 'bg-ber-olive/15 text-ber-olive' },
  aprovado_com_ressalva: { label: 'Com ressalva', className: 'bg-amber-100 text-amber-700' },
  reprovado: { label: 'Reprovado', className: 'bg-red-100 text-red-600' },
};

interface CanteiroSummary {
  id: string;
  weekStart: string;
  status: string;
  createdAt: string;
  creator: { id: string; name: string } | null;
  approver: { id: string; name: string } | null;
  approvedAt: string | null;
  items: { answer: string | null; required: boolean }[];
  _count: { items: number };
}

interface SeqEtapa {
  id: string;
  templateEtapaId: string | null;
  name: string;
  discipline: string;
  order: number;
  estimatedDays: number;
  dependsOn: string[];
  startDate: string | null;
  endDate: string | null;
  estimatedEndDate: string | null;
  status: string;
  gestorNotes: string | null;
  coordenadorNotes: string | null;
  submitter: { id: string; name: string } | null;
  submittedAt: string | null;
  approver: { id: string; name: string } | null;
  approvedAt: string | null;
  rejecter: { id: string; name: string } | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  evidenciaDescricao: string | null;
  evidenciaFotos: string[];
  evidenciaRegistradaEm: string | null;
}

interface Sequenciamento {
  id: string;
  frozenAt: string | null;
  template: { id: string; name: string; segment: string } | null;
  creator: { id: string; name: string } | null;
  etapas: SeqEtapa[];
}

interface SeqTemplate {
  id: string;
  name: string;
  segment: string;
  etapas: { id: string; name: string; discipline: string; order: number }[];
}

const DISCIPLINE_COLORS: Record<string, string> = {
  estrutura: 'bg-gray-100 text-gray-700',
  hidraulica: 'bg-blue-100 text-blue-700',
  eletrica: 'bg-amber-100 text-amber-700',
  alvenaria: 'bg-red-100 text-red-600',
  ar_condicionado: 'bg-cyan-100 text-cyan-700',
  impermeabilizacao: 'bg-teal-100 text-teal-700',
  revestimento: 'bg-purple-100 text-purple-700',
  marcenaria: 'bg-red-100 text-red-600',
  vidros: 'bg-blue-100 text-blue-700',
  acabamento: 'bg-ber-olive/15 text-ber-olive',
  limpeza: 'bg-gray-100 text-gray-600',
  outro: 'bg-gray-100 text-gray-600',
};

const DISCIPLINE_LABELS: Record<string, string> = {
  estrutura: 'Estrutura',
  hidraulica: 'Hidráulica',
  eletrica: 'Elétrica',
  alvenaria: 'Alvenaria',
  ar_condicionado: 'Ar Condicionado',
  impermeabilizacao: 'Impermeabilização',
  revestimento: 'Revestimento',
  marcenaria: 'Marcenaria',
  vidros: 'Vidros',
  acabamento: 'Acabamento',
  limpeza: 'Limpeza',
  outro: 'Outro',
};

const ETAPA_STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Check }> = {
  nao_iniciada: { label: 'Não iniciada', className: 'bg-gray-100 text-gray-500', icon: Clock },
  em_andamento: { label: 'Em andamento', className: 'bg-teal-100 text-teal-700 animate-pulse', icon: Play },
  aguardando_aprovacao: { label: 'Aguardando aprovação', className: 'bg-amber-100 text-amber-700', icon: Send },
  aprovada: { label: 'Aprovada', className: 'bg-ber-olive/15 text-ber-olive', icon: Check },
  bloqueada: { label: 'Bloqueada', className: 'bg-red-100 text-red-600', icon: Lock },
};

const CANTEIRO_STATUS: Record<string, { label: string; className: string }> = {
  em_andamento: { label: 'Em andamento', className: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-700' },
  reprovado: { label: 'Reprovado', className: 'bg-red-100 text-red-700' },
};

const CHECKLIST_TYPE_LABELS: Record<string, string> = {
  vistoria_inicial: 'Vistoria Inicial',
  qualidade: 'Qualidade',
  pre_entrega: 'Pré-entrega',
  inauguracao: 'Inauguração',
};

const CHECKLIST_TYPE_COLORS: Record<string, string> = {
  vistoria_inicial: 'bg-ber-teal/15 text-ber-teal',
  qualidade: 'bg-ber-olive/15 text-ber-olive',
  pre_entrega: 'bg-amber-100 text-amber-700',
  inauguracao: 'bg-ber-carbon/10 text-ber-carbon',
};

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function ObraDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [obra, setObra] = useState<ObraDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const initialTab = (searchParams.get('tab') as TabKey) || 'kanban';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', assignedTo: '', priority: 'medium' as TaskPriority, dueDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Trello state
  const [showTrelloModal, setShowTrelloModal] = useState(false);
  const [trelloBoards, setTrelloBoards] = useState<TrelloBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; skipped: number } | null>(null);

  // Checklists state
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [showNewChecklistModal, setShowNewChecklistModal] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [creatingChecklist, setCreatingChecklist] = useState(false);

  // Canteiro state
  const [canteiroChecklists, setCanteiroChecklists] = useState<CanteiroSummary[]>([]);
  const [loadingCanteiro, setLoadingCanteiro] = useState(false);
  const [creatingCanteiro, setCreatingCanteiro] = useState(false);

  // Sequenciamento state
  const [sequenciamento, setSequenciamento] = useState<Sequenciamento | null>(null);
  const [loadingSeq, setLoadingSeq] = useState(false);
  const [seqTemplates, setSeqTemplates] = useState<SeqTemplate[]>([]);
  const [showSeqModal, setShowSeqModal] = useState(false);
  const [loadingSeqTemplates, setLoadingSeqTemplates] = useState(false);
  const [selectedSeqTemplate, setSelectedSeqTemplate] = useState('');
  const [creatingSeq, setCreatingSeq] = useState(false);
  const [etapaAction, setEtapaAction] = useState<{ id: string; type: 'start' | 'submit' | 'approve' | 'reject' } | null>(null);
  const [etapaNotes, setEtapaNotes] = useState('');
  const [etapaSubmitting, setEtapaSubmitting] = useState(false);
  const [evidenciaDescricao, setEvidenciaDescricao] = useState('');
  const [evidenciaFotos, setEvidenciaFotos] = useState<string[]>([]);
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);

  // Recebimentos state
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [loadingRecebimentos, setLoadingRecebimentos] = useState(false);
  const [showRecebimentoForm, setShowRecebimentoForm] = useState(false);
  const [recebimentoDetail, setRecebimentoDetail] = useState<Recebimento | null>(null);
  const [submittingRecebimento, setSubmittingRecebimento] = useState(false);
  const [newRecebimento, setNewRecebimento] = useState({
    fornecedor: '', material: '', quantidade: '', unidade: 'un',
    numeroNF: '', dataNF: '', dataEntrega: '',
    condicao: 'aprovado', observacao: '', fotosMaterial: [] as string[], fotoNF: '',
  });

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editingEtapaId, setEditingEtapaId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDays, setEditDays] = useState(0);
  const [showAddEtapa, setShowAddEtapa] = useState(false);
  const [newEtapaName, setNewEtapaName] = useState('');
  const [newEtapaDiscipline, setNewEtapaDiscipline] = useState('outro');
  const [newEtapaDays, setNewEtapaDays] = useState(1);
  const [newEtapaOrder, setNewEtapaOrder] = useState(1);
  const [freezing, setFreezing] = useState(false);
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [removingEtapaId, setRemovingEtapaId] = useState<string | null>(null);

  const canChangeStatus = user?.role ? CAN_CHANGE_STATUS.includes(user.role) : false;

  async function fetchChecklists() {
    setLoadingChecklists(true);
    try {
      const res = await api.get(`/obras/${params.id}/checklists`);
      setChecklists(res.data.data);
    } catch {} finally { setLoadingChecklists(false); }
  }

  async function fetchCanteiro() {
    setLoadingCanteiro(true);
    try {
      const res = await api.get(`/obras/${params.id}/canteiro`);
      setCanteiroChecklists(res.data.data);
    } catch {} finally { setLoadingCanteiro(false); }
  }

  async function fetchSeq() {
    setLoadingSeq(true);
    try {
      const res = await api.get(`/obras/${params.id}/sequenciamento`);
      setSequenciamento(res.data.data);
    } catch { setSequenciamento(null); }
    finally { setLoadingSeq(false); }
  }

  async function fetchRecebimentos() {
    setLoadingRecebimentos(true);
    try {
      const res = await api.get(`/obras/${params.id}/recebimentos`);
      setRecebimentos(res.data.data);
    } catch {} finally { setLoadingRecebimentos(false); }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const [obraRes, tasksRes, checklistsRes, canteiroRes, seqRes, recebimentosRes] = await Promise.all([
        api.get(`/obras/${params.id}`),
        api.get(`/obras/${params.id}/tasks`, { params: { limit: 200 } }),
        api.get(`/obras/${params.id}/checklists`),
        api.get(`/obras/${params.id}/canteiro`),
        api.get(`/obras/${params.id}/sequenciamento`).catch(() => ({ data: { data: null } })),
        api.get(`/obras/${params.id}/recebimentos`),
      ]);
      setObra(obraRes.data.data);
      setTasks(tasksRes.data.data);
      setChecklists(checklistsRes.data.data);
      setCanteiroChecklists(canteiroRes.data.data);
      setSequenciamento(seqRes.data.data);
      setRecebimentos(recebimentosRes.data.data);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        title: newTask.title,
        priority: newTask.priority,
      };
      if (newTask.assignedTo) body.assignedTo = newTask.assignedTo;
      if (newTask.dueDate) body.dueDate = new Date(newTask.dueDate).toISOString();
      await api.post(`/obras/${params.id}/tasks`, body);
      setNewTask({ title: '', assignedTo: '', priority: 'medium', dueDate: '' });
      setShowTaskForm(false);
      fetchData();
    } catch {
      /* handled */
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: ObraStatus) {
    if (!obra || newStatus === obra.status) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/obras/${params.id}`, { status: newStatus });
      setObra((prev) => prev ? { ...prev, status: newStatus } : prev);
    } catch {
      /* handled by interceptor */
    } finally {
      setUpdatingStatus(false);
    }
  }

  // ─── Trello ────────────────────────────────────────────────────────────────

  async function openTrelloModal() {
    setShowTrelloModal(true);
    setLoadingBoards(true);
    setSelectedBoard('');
    setSyncResult(null);
    try {
      const res = await api.get('/obras/trello/boards');
      setTrelloBoards(res.data.data);
    } catch {
      /* handled */
    } finally {
      setLoadingBoards(false);
    }
  }

  async function handleTrelloSync(boardId: string) {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post(`/obras/${params.id}/trello/sync`, { boardId });
      setSyncResult({ created: res.data.data.created, skipped: res.data.data.skipped });
      setObra((prev) => prev ? { ...prev, trelloBoardId: boardId } : prev);
      // Reload tasks
      const tasksRes = await api.get(`/obras/${params.id}/tasks`, { params: { limit: 200 } });
      setTasks(tasksRes.data.data);
      // Also reload obra for updated _count
      const obraRes = await api.get(`/obras/${params.id}`);
      setObra(obraRes.data.data);
    } catch {
      /* handled */
    } finally {
      setSyncing(false);
    }
  }

  async function handleResync() {
    if (!obra?.trelloBoardId) return;
    await handleTrelloSync(obra.trelloBoardId);
  }

  // ─── Canteiro ───────────────────────────────────────────────────────────

  async function handleCreateCanteiro() {
    setCreatingCanteiro(true);
    try {
      const res = await api.post(`/obras/${params.id}/canteiro`);
      router.push(`/obras/${params.id}/canteiro/${res.data.data.id}`);
    } catch {} finally { setCreatingCanteiro(false); }
  }

  // ─── Checklists ──────────────────────────────────────────────────────────

  async function openNewChecklistModal() {
    setShowNewChecklistModal(true);
    setLoadingTemplates(true);
    setSelectedTemplate('');
    try {
      const res = await api.get('/checklist-templates');
      setTemplates(res.data.data);
    } catch {} finally { setLoadingTemplates(false); }
  }

  async function handleCreateChecklist() {
    if (!selectedTemplate) return;
    setCreatingChecklist(true);
    try {
      await api.post(`/obras/${params.id}/checklists`, { templateId: selectedTemplate });
      setShowNewChecklistModal(false);
      fetchChecklists();
    } catch {} finally { setCreatingChecklist(false); }
  }

  // ─── Sequenciamento ──────────────────────────────────────────────────────

  async function openSeqModal() {
    setShowSeqModal(true);
    setLoadingSeqTemplates(true);
    setSelectedSeqTemplate('');
    try {
      const res = await api.get('/sequenciamento-templates');
      setSeqTemplates(res.data.data);
    } catch {} finally { setLoadingSeqTemplates(false); }
  }

  async function handleCreateSeq() {
    if (!selectedSeqTemplate) return;
    setCreatingSeq(true);
    try {
      const res = await api.post(`/obras/${params.id}/sequenciamento`, { templateId: selectedSeqTemplate });
      setSequenciamento(res.data.data);
      setShowSeqModal(false);
    } catch {} finally { setCreatingSeq(false); }
  }

  async function handleEvidenciaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingEvidencia(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setEvidenciaFotos((prev) => [...prev, res.data.data.url]);
      }
    } catch {} finally {
      setUploadingEvidencia(false);
      e.target.value = '';
    }
  }

  async function handleEtapaAction() {
    if (!etapaAction) return;
    setEtapaSubmitting(true);
    try {
      const { id, type } = etapaAction;
      const body: Record<string, any> = {};
      if (type === 'start') body.gestorNotes = etapaNotes;
      if (type === 'submit') {
        body.gestorNotes = etapaNotes;
        if (evidenciaDescricao.trim()) body.evidenciaDescricao = evidenciaDescricao;
        if (evidenciaFotos.length > 0) body.evidenciaFotos = evidenciaFotos;
      }
      if (type === 'approve') body.coordenadorNotes = etapaNotes;
      if (type === 'reject') {
        body.rejectionReason = etapaNotes;
      }
      await api.patch(`/obras/${params.id}/etapas/${id}/${type}`, body);
      setEtapaAction(null);
      setEtapaNotes('');
      setEvidenciaDescricao('');
      setEvidenciaFotos([]);
      fetchSeq();
    } catch {} finally { setEtapaSubmitting(false); }
  }

  function getBlockingEtapas(etapa: SeqEtapa): string[] {
    if (!sequenciamento || etapa.dependsOn.length === 0) return [];
    return sequenciamento.etapas
      .filter((e) => etapa.dependsOn.includes(e.templateEtapaId ?? '') && e.status !== 'aprovada')
      .map((e) => e.name);
  }

  // ─── Edit mode helpers ────────────────────────────────────────────────────

  const canEdit = sequenciamento && !sequenciamento.frozenAt &&
    sequenciamento.etapas.every((e) => e.status === 'nao_iniciada');
  const isFrozen = !!sequenciamento?.frozenAt;

  function startEditingEtapa(etapa: SeqEtapa) {
    setEditingEtapaId(etapa.id);
    setEditName(etapa.name);
    setEditDays(etapa.estimatedDays);
  }

  async function saveEtapaEdit() {
    if (!editingEtapaId) return;
    try {
      await api.put(`/obras/${params.id}/etapas/${editingEtapaId}`, {
        name: editName,
        estimatedDays: editDays,
      });
      setEditingEtapaId(null);
      fetchSeq();
    } catch {}
  }

  async function handleMoveEtapa(etapaId: string, direction: 'up' | 'down') {
    if (!sequenciamento) return;
    const ids = sequenciamento.etapas.map((e) => e.id);
    const idx = ids.indexOf(etapaId);
    if (direction === 'up' && idx > 0) {
      [ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
    } else if (direction === 'down' && idx < ids.length - 1) {
      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    } else return;
    try {
      const res = await api.put(`/obras/${params.id}/sequenciamento/reorder`, { etapaIds: ids });
      setSequenciamento(res.data.data);
    } catch {}
  }

  async function handleAddEtapa() {
    if (!newEtapaName.trim()) return;
    try {
      const res = await api.post(`/obras/${params.id}/sequenciamento/etapas`, {
        name: newEtapaName,
        discipline: newEtapaDiscipline,
        estimatedDays: newEtapaDays,
        order: newEtapaOrder,
      });
      setSequenciamento(res.data.data);
      setShowAddEtapa(false);
      setNewEtapaName('');
      setNewEtapaDiscipline('outro');
      setNewEtapaDays(1);
    } catch {}
  }

  async function handleRemoveEtapa(etapaId: string) {
    try {
      const res = await api.delete(`/obras/${params.id}/etapas/${etapaId}`);
      setSequenciamento(res.data.data);
      setRemovingEtapaId(null);
    } catch {}
  }

  async function handleFreeze() {
    setFreezing(true);
    try {
      const res = await api.post(`/obras/${params.id}/sequenciamento/freeze`);
      setSequenciamento(res.data.data);
      setEditMode(false);
      setConfirmFreeze(false);
    } catch {} finally { setFreezing(false); }
  }

  // ─── Recebimentos ──────────────────────────────────────────────────────────

  async function handleCreateRecebimento(e: React.FormEvent) {
    e.preventDefault();
    if (!newRecebimento.fornecedor.trim() || !newRecebimento.material.trim()) return;
    setSubmittingRecebimento(true);
    try {
      await api.post(`/obras/${params.id}/recebimentos`, {
        fornecedor: newRecebimento.fornecedor,
        material: newRecebimento.material,
        quantidade: parseFloat(newRecebimento.quantidade),
        unidade: newRecebimento.unidade,
        numeroNF: newRecebimento.numeroNF || undefined,
        dataNF: newRecebimento.dataNF || undefined,
        dataEntrega: newRecebimento.dataEntrega,
        condicao: newRecebimento.condicao,
        observacao: newRecebimento.observacao || undefined,
        fotosMaterial: newRecebimento.fotosMaterial,
        fotoNF: newRecebimento.fotoNF || undefined,
      });
      setNewRecebimento({ fornecedor: '', material: '', quantidade: '', unidade: 'un', numeroNF: '', dataNF: '', dataEntrega: '', condicao: 'aprovado', observacao: '', fotosMaterial: [], fotoNF: '' });
      setShowRecebimentoForm(false);
      fetchRecebimentos();
    } catch {} finally { setSubmittingRecebimento(false); }
  }

  async function handleRecebimentoUpload(e: React.ChangeEvent<HTMLInputElement>, field: 'fotosMaterial' | 'fotoNF') {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/uploads', formData);
      const url = res.data.data.url;
      if (field === 'fotoNF') {
        setNewRecebimento((p) => ({ ...p, fotoNF: url }));
      } else {
        setNewRecebimento((p) => ({ ...p, fotosMaterial: [...p.fotosMaterial, url] }));
      }
    } catch {}
  }

  const isGestor = user?.role ? ['gestor', 'coordenacao', 'diretoria'].includes(user.role) : false;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-sm text-ber-gray">Carregando...</div>;
  }

  if (!obra) {
    return <div className="text-sm text-ber-gray">Obra não encontrada.</div>;
  }

  const statusCfg = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'kanban', label: `Kanban (${obra._count.tasks})` },
    { key: 'fotos', label: `Fotos (${obra._count.photos})` },
    { key: 'equipe', label: `Equipe (${obra.members.length})` },
    { key: 'checklists', label: `Checklists (${checklists.length})` },
    { key: 'canteiro', label: `Canteiro (${canteiroChecklists.length})` },
    { key: 'sequenciamento', label: `Sequenciamento${sequenciamento ? ` (${sequenciamento.etapas.filter(e => e.status === 'aprovada').length}/${sequenciamento.etapas.length})` : ''}` },
    { key: 'recebimentos', label: `Recebimentos (${recebimentos.length})` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/obras')}
          className="rounded p-1.5 text-ber-gray transition-colors hover:bg-white hover:text-ber-carbon"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-ber-carbon">{obra.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity ${statusCfg.badge} ${updatingStatus ? 'animate-pulse opacity-60' : ''}`}>
              {updatingStatus ? 'Salvando...' : statusCfg.label}
            </span>
            {canChangeStatus && (
              <div className="relative">
                <select
                  value={obra.status}
                  disabled={updatingStatus}
                  onChange={(e) => handleStatusChange(e.target.value as ObraStatus)}
                  className={`appearance-none rounded-md border py-1 pl-3 pr-7 text-xs font-medium focus:ring-1 focus:outline-none disabled:opacity-50 ${statusCfg.selectBorder}`}
                >
                  <option value="planejamento">Planejamento</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="pausada">Pausada</option>
                  <option value="concluida">Concluída</option>
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ber-gray" />
              </div>
            )}
          </div>
          {obra.client && (
            <p className="mt-0.5 text-sm text-ber-gray">{obra.client}</p>
          )}
        </div>

        {/* Trello button */}
        {obra.trelloBoardId ? (
          <button
            onClick={handleResync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm font-medium text-ber-carbon transition-colors hover:bg-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Trello'}
          </button>
        ) : (
          <button
            onClick={openTrelloModal}
            className="flex items-center gap-2 rounded-md border border-ber-teal px-3 py-1.5 text-sm font-medium text-ber-teal transition-colors hover:bg-ber-teal hover:text-white"
          >
            Vincular Trello
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-ber-gray/20">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-ber-olive text-ber-carbon'
                : 'text-ber-gray hover:text-ber-carbon'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'kanban' && (
          <div>
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="flex items-center gap-2 rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
              >
                <Plus size={14} />
                Nova Tarefa
              </button>
            </div>

            {/* New task form */}
            {showTaskForm && (
              <form onSubmit={handleCreateTask} className="mb-6 rounded-lg border border-ber-gray/20 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Título da tarefa"
                    value={newTask.title}
                    onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                    className="col-span-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none sm:col-span-2"
                    required
                  />
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
                    className="rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))}
                      className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-md bg-ber-olive px-4 py-1.5 text-sm font-semibold text-ber-black transition-colors hover:bg-ber-olive/80 disabled:opacity-50"
                    >
                      Criar
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Kanban board */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {KANBAN_COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.key);
                return (
                  <div key={col.key} className="rounded-lg bg-white/60 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-ber-gray">
                        {col.label}
                      </h3>
                      <span className="rounded-full bg-ber-gray/10 px-2 py-0.5 text-xs font-semibold text-ber-gray">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((task) => {
                        const pCfg = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL.medium;
                        return (
                          <div
                            key={task.id}
                            className={`rounded-md border-l-[3px] bg-white p-3 shadow-sm ${PRIORITY_STYLE[task.priority]}`}
                          >
                            <p className="text-sm font-medium text-ber-carbon">{task.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ber-gray">
                              <span className={`font-semibold ${pCfg.className}`}>
                                {pCfg.text}
                              </span>
                              {task.assignee && (
                                <span className="flex items-center gap-1">
                                  <User size={10} />
                                  {task.assignee.name.split(' ')[0]}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar size={10} />
                                  {formatDate(task.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {colTasks.length === 0 && (
                        <p className="py-4 text-center text-xs text-ber-gray/50">
                          Sem tarefas
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'fotos' && (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-ber-gray">Galeria de fotos em desenvolvimento.</p>
          </div>
        )}

        {activeTab === 'equipe' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {obra.members.length === 0 ? (
              <p className="col-span-full py-12 text-center text-sm text-ber-gray">
                Nenhum membro na equipe desta obra.
              </p>
            ) : (
              obra.members.map((m) => (
                <div
                  key={m.user.id}
                  className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ber-teal text-sm font-bold text-white uppercase">
                    {m.user.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ber-carbon">{m.user.name}</p>
                    <p className="text-xs text-ber-gray">{m.user.role}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'checklists' && (
          <div>
            <div className="mb-4 flex justify-end">
              <button
                onClick={openNewChecklistModal}
                className="flex items-center gap-2 rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
              >
                <Plus size={14} />
                Novo Checklist
              </button>
            </div>

            {loadingChecklists ? (
              <p className="py-12 text-center text-sm text-ber-gray">Carregando checklists...</p>
            ) : checklists.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <ClipboardCheck size={40} className="mb-3 text-ber-gray/30" />
                <p className="text-sm text-ber-gray">Nenhum checklist criado para esta obra.</p>
                <button
                  onClick={openNewChecklistModal}
                  className="mt-3 text-sm font-medium text-ber-teal hover:underline"
                >
                  Criar primeiro checklist
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {checklists.map((checklist) => {
                  const totalItems = checklist._count.items;
                  const answeredItems = checklist.items.filter((i) => i.answer !== null).length;
                  const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;
                  const typeLabel = CHECKLIST_TYPE_LABELS[checklist.type] || checklist.type;
                  const typeColor = CHECKLIST_TYPE_COLORS[checklist.type] || 'bg-ber-gray/10 text-ber-gray';

                  return (
                    <button
                      key={checklist.id}
                      onClick={() => router.push(`/obras/${params.id}/checklists/${checklist.id}`)}
                      className="rounded-lg bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeColor}`}>
                          {typeLabel}
                        </span>
                        <span className="rounded-full bg-ber-gray/10 px-2 py-0.5 text-xs font-medium text-ber-gray">
                          {checklist.segment}
                        </span>
                        <span
                          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                            checklist.status === 'concluido'
                              ? 'bg-green-100 text-green-700'
                              : 'border border-ber-olive/40 text-ber-olive'
                          }`}
                        >
                          {checklist.status === 'concluido' ? 'Concluído' : 'Em andamento'}
                        </span>
                      </div>

                      {checklist.template && (
                        <p className="mb-2 text-sm font-semibold text-ber-carbon">
                          {checklist.template.name}
                        </p>
                      )}

                      <div className="mb-1 flex items-center justify-between text-xs text-ber-gray">
                        <span>{answeredItems}/{totalItems} itens</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ber-gray/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress === 100 ? 'bg-green-500' : 'bg-ber-teal'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ber-gray">
                        {checklist.creator && (
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {checklist.creator.name.split(' ')[0]}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(checklist.createdAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'canteiro' && (
          <div>
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleCreateCanteiro}
                disabled={creatingCanteiro}
                className="flex items-center gap-2 rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
              >
                <Plus size={14} />
                {creatingCanteiro ? 'Criando...' : 'Iniciar Checklist da Semana'}
              </button>
            </div>

            {loadingCanteiro ? (
              <p className="py-12 text-center text-sm text-ber-gray">Carregando canteiro...</p>
            ) : canteiroChecklists.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Tent size={40} className="mb-3 text-ber-gray/30" />
                <p className="text-sm text-ber-gray">Nenhum checklist de canteiro criado para esta obra.</p>
                <button
                  onClick={handleCreateCanteiro}
                  disabled={creatingCanteiro}
                  className="mt-3 text-sm font-medium text-ber-teal hover:underline disabled:opacity-50"
                >
                  Iniciar primeiro checklist da semana
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {canteiroChecklists.map((cl) => {
                  const totalItems = cl._count.items;
                  const answeredItems = cl.items.filter((i) => i.answer !== null).length;
                  const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;
                  const statusCfg = CANTEIRO_STATUS[cl.status] || CANTEIRO_STATUS.em_andamento;
                  const weekDate = new Date(cl.weekStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

                  return (
                    <button
                      key={cl.id}
                      onClick={() => router.push(`/obras/${params.id}/canteiro/${cl.id}`)}
                      className="rounded-lg bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-ber-carbon">
                          Semana de {weekDate}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </div>

                      <div className="mb-1 flex items-center justify-between text-xs text-ber-gray">
                        <span>{answeredItems}/{totalItems} itens</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ber-gray/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress === 100 ? 'bg-green-500' : 'bg-ber-olive'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ber-gray">
                        {cl.creator && (
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {cl.creator.name.split(' ')[0]}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(cl.createdAt)}
                        </span>
                        {cl.approver && cl.approvedAt && (
                          <span className="text-xs text-ber-gray">
                            Aprovado por {cl.approver.name.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sequenciamento' && (
          <div>
            {!sequenciamento ? (
              <div className="flex flex-col items-center py-12 text-center">
                <ListOrdered size={40} className="mb-3 text-ber-gray/30" />
                <p className="text-sm text-ber-gray">Nenhum sequenciamento definido para esta obra.</p>
                <button
                  onClick={openSeqModal}
                  className="mt-3 flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
                >
                  <Plus size={14} />
                  Iniciar Sequenciamento
                </button>
              </div>
            ) : (
              <div>
                {/* Header bar with progress + edit/freeze controls */}
                {(() => {
                  const total = sequenciamento.etapas.length;
                  const approved = sequenciamento.etapas.filter((e) => e.status === 'aprovada').length;
                  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
                  const isGestor = user?.role === 'gestor' || user?.role === 'coordenacao' || user?.role === 'diretoria';
                  return (
                    <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ber-carbon">
                            Progresso — {sequenciamento.template?.name ?? 'Sequenciamento'}
                          </span>
                          {isFrozen && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                              <Snowflake size={11} />
                              Confirmado em {new Date(sequenciamento.frozenAt!).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ber-olive">{approved}/{total} etapas aprovadas ({pct}%)</span>
                          {canEdit && isGestor && !editMode && (
                            <button
                              onClick={() => setEditMode(true)}
                              className="ml-2 flex items-center gap-1 rounded-md border border-ber-gray/30 px-2.5 py-1 text-xs font-medium text-ber-carbon transition-colors hover:bg-ber-offwhite"
                            >
                              <Pencil size={12} /> Editar Sequenciamento
                            </button>
                          )}
                          {editMode && (
                            <>
                              <button
                                onClick={() => { setShowAddEtapa(true); setNewEtapaOrder(sequenciamento.etapas.length + 1); }}
                                className="ml-2 flex items-center gap-1 rounded-md bg-ber-teal px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-ber-teal/80"
                              >
                                <Plus size={12} /> Adicionar Etapa
                              </button>
                              <button
                                onClick={() => setConfirmFreeze(true)}
                                className="flex items-center gap-1 rounded-md bg-ber-carbon px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-ber-black"
                              >
                                <Snowflake size={12} /> Confirmar e Congelar
                              </button>
                              <button
                                onClick={() => { setEditMode(false); setEditingEtapaId(null); }}
                                className="rounded-md px-2.5 py-1 text-xs font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ber-gray/10">
                        <div
                          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-ber-olive'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Etapas list */}
                <div className="space-y-2">
                  {sequenciamento.etapas.map((etapa, idx) => {
                    const statusCfg = ETAPA_STATUS_CONFIG[etapa.status] || ETAPA_STATUS_CONFIG.nao_iniciada;
                    const StatusIcon = statusCfg.icon;
                    const discColor = DISCIPLINE_COLORS[etapa.discipline] || DISCIPLINE_COLORS.outro;
                    const discLabel = DISCIPLINE_LABELS[etapa.discipline] || etapa.discipline;
                    const blocking = getBlockingEtapas(etapa);
                    const isBlocked = etapa.status === 'nao_iniciada' && blocking.length > 0;
                    const isGestor = user?.role === 'gestor' || user?.role === 'coordenacao' || user?.role === 'diretoria';
                    const isCoord = user?.role === 'coordenacao' || user?.role === 'diretoria';
                    const isEditing = editMode && editingEtapaId === etapa.id;

                    return (
                      <div
                        key={etapa.id}
                        className={`rounded-lg bg-white p-4 shadow-sm ${isBlocked && !editMode ? 'border border-red-200 opacity-60' : ''} ${editMode ? 'border border-dashed border-ber-gray/30' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Number + reorder */}
                          <div className="flex flex-col items-center gap-0.5">
                            {editMode && (
                              <button
                                onClick={() => handleMoveEtapa(etapa.id, 'up')}
                                disabled={idx === 0}
                                className="rounded p-0.5 text-ber-gray transition-colors hover:bg-ber-offwhite disabled:opacity-20"
                              >
                                <ChevronUp size={14} />
                              </button>
                            )}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ber-carbon/5 text-sm font-bold text-ber-carbon">
                              {idx + 1}
                            </div>
                            {editMode && (
                              <button
                                onClick={() => handleMoveEtapa(etapa.id, 'down')}
                                disabled={idx === sequenciamento.etapas.length - 1}
                                className="rounded p-0.5 text-ber-gray transition-colors hover:bg-ber-offwhite disabled:opacity-20"
                              >
                                <ChevronDown size={14} />
                              </button>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              /* Inline edit form */
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="flex-1 rounded-md border border-ber-gray/30 px-2 py-1 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                                />
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={editDays}
                                    onChange={(e) => setEditDays(parseInt(e.target.value) || 0)}
                                    className="w-16 rounded-md border border-ber-gray/30 px-2 py-1 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                                  />
                                  <span className="text-xs text-ber-gray">dias</span>
                                </div>
                                <button
                                  onClick={saveEtapaEdit}
                                  className="rounded-md bg-ber-olive px-2.5 py-1 text-xs font-semibold text-ber-black transition-colors hover:bg-ber-olive/80"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setEditingEtapaId(null)}
                                  className="rounded-md px-2.5 py-1 text-xs text-ber-gray transition-colors hover:bg-ber-offwhite"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-ber-carbon">{etapa.name}</p>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${discColor}`}>
                                    {discLabel}
                                  </span>
                                  <span className="text-[10px] text-ber-gray">{etapa.estimatedDays}d estimados</span>
                                </div>

                                {!editMode && (
                                  <>
                                    {/* Status badge */}
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusCfg.className}`}>
                                        <StatusIcon size={12} />
                                        {statusCfg.label}
                                      </span>
                                      {etapa.startDate && (
                                        <span className="text-xs text-ber-gray">
                                          Início: {new Date(etapa.startDate).toLocaleDateString('pt-BR')}
                                        </span>
                                      )}
                                      {etapa.estimatedEndDate && etapa.status === 'em_andamento' && (
                                        <span className="text-xs text-ber-gray">
                                          Previsão: {new Date(etapa.estimatedEndDate).toLocaleDateString('pt-BR')}
                                        </span>
                                      )}
                                      {etapa.endDate && (
                                        <span className="text-xs text-ber-olive font-medium">
                                          Concluída: {new Date(etapa.endDate).toLocaleDateString('pt-BR')}
                                        </span>
                                      )}
                                    </div>

                                    {isBlocked && (
                                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                                        <Lock size={11} />
                                        Aguardando: {blocking.join(', ')}
                                      </p>
                                    )}

                                    {etapa.rejectionReason && (
                                      <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                                        <strong>Rejeitada:</strong> {etapa.rejectionReason}
                                        {etapa.rejecter && <span className="text-red-500"> — {etapa.rejecter.name}</span>}
                                      </div>
                                    )}

                                    {etapa.gestorNotes && (
                                      <p className="mt-1.5 text-xs text-ber-gray">
                                        <strong>Gestor:</strong> {etapa.gestorNotes}
                                      </p>
                                    )}
                                    {etapa.coordenadorNotes && (
                                      <p className="mt-1 text-xs text-ber-gray">
                                        <strong>Coordenador:</strong> {etapa.coordenadorNotes}
                                      </p>
                                    )}

                                    {/* Evidencias */}
                                    {(etapa.evidenciaDescricao || etapa.evidenciaFotos.length > 0) && (
                                      <div className="mt-2 rounded-md bg-ber-offwhite p-2.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ber-gray mb-1.5">
                                          <ImageIcon size={10} />
                                          Evidencia
                                          {etapa.evidenciaRegistradaEm && (
                                            <span className="font-normal normal-case ml-1">
                                              — {new Date(etapa.evidenciaRegistradaEm).toLocaleDateString('pt-BR')}
                                            </span>
                                          )}
                                        </div>
                                        {etapa.evidenciaDescricao && (
                                          <p className="text-xs text-ber-carbon mb-1.5">{etapa.evidenciaDescricao}</p>
                                        )}
                                        {etapa.evidenciaFotos.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {etapa.evidenciaFotos.map((url, i) => (
                                              <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block h-14 w-14 overflow-hidden rounded border border-ber-gray/15 hover:opacity-80 transition"
                                              >
                                                <img src={url} alt={`Evidencia ${i + 1}`} className="h-full w-full object-cover" />
                                              </a>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 gap-1.5">
                            {editMode && !isEditing && (
                              <>
                                <button
                                  onClick={() => startEditingEtapa(etapa)}
                                  className="rounded p-1.5 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
                                  title="Editar"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => setRemovingEtapaId(etapa.id)}
                                  className="rounded p-1.5 text-ber-gray transition-colors hover:bg-red-50 hover:text-red-500"
                                  title="Remover"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                            {!editMode && (
                              <>
                                {etapa.status === 'nao_iniciada' && !isBlocked && isGestor && isFrozen && (
                                  <button
                                    onClick={() => { setEtapaAction({ id: etapa.id, type: 'start' }); setEtapaNotes(''); }}
                                    className="flex items-center gap-1 rounded-md bg-ber-teal px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ber-teal/80"
                                  >
                                    <Play size={12} /> Iniciar
                                  </button>
                                )}
                                {etapa.status === 'em_andamento' && isGestor && (
                                  <button
                                    onClick={() => { setEtapaAction({ id: etapa.id, type: 'submit' }); setEtapaNotes(''); setEvidenciaDescricao(''); setEvidenciaFotos([]); }}
                                    className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
                                  >
                                    <Send size={12} /> Enviar para Aprovação
                                  </button>
                                )}
                                {etapa.status === 'aguardando_aprovacao' && isCoord && (
                                  <>
                                    <button
                                      onClick={() => { setEtapaAction({ id: etapa.id, type: 'approve' }); setEtapaNotes(''); }}
                                      className="flex items-center gap-1 rounded-md bg-ber-olive px-2.5 py-1.5 text-xs font-semibold text-ber-black transition-colors hover:bg-ber-olive/80"
                                    >
                                      <Check size={12} /> Aprovar
                                    </button>
                                    <button
                                      onClick={() => { setEtapaAction({ id: etapa.id, type: 'reject' }); setEtapaNotes(''); }}
                                      className="flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
                                    >
                                      <XCircle size={12} /> Rejeitar
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Confirm Freeze Modal ─── */}
      {confirmFreeze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="px-6 py-5">
              <div className="mb-3 flex items-center gap-2">
                <Snowflake size={20} className="text-blue-600" />
                <h2 className="text-lg font-black text-ber-carbon">Congelar Sequenciamento?</h2>
              </div>
              <p className="text-sm text-ber-gray">
                Após congelar, não será mais possível editar, reordenar, adicionar ou remover etapas.
                As etapas poderão então ser iniciadas e seguir o fluxo de aprovação.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmFreeze(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleFreeze}
                  disabled={freezing}
                  className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
                >
                  <Snowflake size={14} />
                  {freezing ? 'Congelando...' : 'Confirmar e Congelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Remove Etapa Modal ─── */}
      {removingEtapaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="px-6 py-5">
              <h2 className="mb-2 text-lg font-black text-ber-carbon">Remover Etapa?</h2>
              <p className="text-sm text-ber-gray">
                A etapa &quot;{sequenciamento?.etapas.find((e) => e.id === removingEtapaId)?.name}&quot; será removida permanentemente.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setRemovingEtapaId(null)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleRemoveEtapa(removingEtapaId)}
                  className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Etapa Modal ─── */}
      {showAddEtapa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
              <h2 className="text-lg font-black text-ber-carbon">Adicionar Etapa</h2>
              <button
                onClick={() => setShowAddEtapa(false)}
                className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              <div>
                <label className="block text-sm font-medium text-ber-carbon">Nome da etapa *</label>
                <input
                  type="text"
                  value={newEtapaName}
                  onChange={(e) => setNewEtapaName(e.target.value)}
                  placeholder="Ex: Pintura externa"
                  className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ber-carbon">Disciplina</label>
                <select
                  value={newEtapaDiscipline}
                  onChange={(e) => setNewEtapaDiscipline(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                >
                  {Object.entries(DISCIPLINE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ber-carbon">Duração estimada (dias)</label>
                  <input
                    type="number"
                    min={0}
                    value={newEtapaDays}
                    onChange={(e) => setNewEtapaDays(parseInt(e.target.value) || 0)}
                    className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ber-carbon">Posição</label>
                  <input
                    type="number"
                    min={1}
                    max={(sequenciamento?.etapas.length ?? 0) + 1}
                    value={newEtapaOrder}
                    onChange={(e) => setNewEtapaOrder(parseInt(e.target.value) || 1)}
                    className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddEtapa(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddEtapa}
                  disabled={!newEtapaName.trim()}
                  className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Etapa Action Modal ─── */}
      {etapaAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
              <h2 className="text-lg font-black text-ber-carbon">
                {etapaAction.type === 'start' && 'Iniciar Etapa'}
                {etapaAction.type === 'submit' && 'Enviar para Aprovação'}
                {etapaAction.type === 'approve' && 'Aprovar Etapa'}
                {etapaAction.type === 'reject' && 'Rejeitar Etapa'}
              </h2>
              <button
                onClick={() => setEtapaAction(null)}
                className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Evidence fields — only for submit */}
              {etapaAction.type === 'submit' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ber-carbon">
                      Descricao da evidencia
                    </label>
                    <textarea
                      value={evidenciaDescricao}
                      onChange={(e) => setEvidenciaDescricao(e.target.value)}
                      rows={3}
                      placeholder="Descreva o que foi executado nesta etapa..."
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ber-carbon">
                      Fotos de evidencia
                    </label>
                    {evidenciaFotos.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {evidenciaFotos.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded border border-ber-gray/15 object-cover" />
                            <button
                              type="button"
                              onClick={() => setEvidenciaFotos((prev) => prev.filter((_, j) => j !== i))}
                              className="absolute -right-1.5 -top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px]"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ber-gray/20 px-3 py-2 text-xs font-medium text-ber-carbon transition hover:bg-ber-offwhite">
                      <Camera size={14} />
                      {uploadingEvidencia ? 'Enviando...' : 'Adicionar fotos'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        onChange={handleEvidenciaUpload}
                        disabled={uploadingEvidencia}
                        className="hidden"
                      />
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-ber-carbon">
                  {etapaAction.type === 'reject' ? 'Motivo da rejeicao *' : 'Observacoes' + (etapaAction.type === 'submit' ? ' *' : ' (opcional)')}
                </label>
                <textarea
                  value={etapaNotes}
                  onChange={(e) => setEtapaNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    etapaAction.type === 'reject'
                      ? 'Descreva o motivo da rejeição...'
                      : 'Adicione observações...'
                  }
                  className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEtapaAction(null)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEtapaAction}
                  disabled={
                    etapaSubmitting ||
                    (etapaAction.type === 'submit' && !etapaNotes.trim()) ||
                    (etapaAction.type === 'reject' && !etapaNotes.trim())
                  }
                  className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
                >
                  {etapaSubmitting ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sequenciamento Template Modal ─── */}
      {showSeqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
              <h2 className="text-lg font-black text-ber-carbon">Iniciar Sequenciamento</h2>
              <button
                onClick={() => setShowSeqModal(false)}
                className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              {loadingSeqTemplates ? (
                <p className="py-8 text-center text-sm text-ber-gray">Buscando templates...</p>
              ) : seqTemplates.length === 0 ? (
                <p className="py-8 text-center text-sm text-ber-gray">Nenhum template encontrado.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-ber-gray">Selecione o tipo de obra:</p>
                  <div className="space-y-1.5">
                    {seqTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setSelectedSeqTemplate(tpl.id)}
                        className={`w-full rounded-md px-4 py-3 text-left transition-colors ${
                          selectedSeqTemplate === tpl.id
                            ? 'bg-ber-teal text-white'
                            : 'bg-ber-offwhite/50 text-ber-carbon hover:bg-ber-offwhite'
                        }`}
                      >
                        <p className="text-sm font-medium">{tpl.name}</p>
                        <p className={`mt-0.5 text-xs ${selectedSeqTemplate === tpl.id ? 'text-white/70' : 'text-ber-gray'}`}>
                          {tpl.segment} — {tpl.etapas.length} etapas
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      onClick={() => setShowSeqModal(false)}
                      className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateSeq}
                      disabled={!selectedSeqTemplate || creatingSeq}
                      className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
                    >
                      <ListOrdered size={14} />
                      {creatingSeq ? 'Criando...' : 'Criar Sequenciamento'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

        {/* ─── Recebimentos Tab ─── */}
        {activeTab === 'recebimentos' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Recebimento de Materiais</h3>
              {isGestor && (
                <button
                  onClick={() => setShowRecebimentoForm(true)}
                  className="flex items-center gap-2 rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
                >
                  <Plus size={14} />
                  Registrar Recebimento
                </button>
              )}
            </div>

            {loadingRecebimentos ? (
              <p className="text-sm text-ber-gray">Carregando...</p>
            ) : recebimentos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ber-gray/30 py-12 text-center">
                <Package size={32} className="mx-auto text-ber-gray/40" />
                <p className="mt-2 text-sm text-ber-gray">Nenhum recebimento registrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recebimentos.map((rec) => {
                  const cond = CONDICAO_CONFIG[rec.condicao] ?? CONDICAO_CONFIG.aprovado;
                  return (
                    <button
                      key={rec.id}
                      onClick={() => setRecebimentoDetail(rec)}
                      className="flex w-full items-center gap-4 rounded-lg border border-ber-gray/15 bg-white px-4 py-3 text-left transition-colors hover:border-ber-teal/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-ber-carbon">{rec.material}</p>
                        <p className="truncate text-xs text-ber-gray">{rec.fornecedor}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-ber-carbon">{rec.quantidade} {rec.unidade}</p>
                        <p className="text-xs text-ber-gray">{formatDate(rec.dataEntrega)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cond.className}`}>
                        {cond.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Detail overlay */}
            {recebimentoDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
                    <h2 className="text-lg font-black text-ber-carbon">Detalhes do Recebimento</h2>
                    <button onClick={() => setRecebimentoDetail(null)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-ber-gray">Material</p><p className="text-sm font-medium">{recebimentoDetail.material}</p></div>
                      <div><p className="text-xs text-ber-gray">Fornecedor</p><p className="text-sm font-medium">{recebimentoDetail.fornecedor}</p></div>
                      <div><p className="text-xs text-ber-gray">Quantidade</p><p className="text-sm font-medium">{recebimentoDetail.quantidade} {recebimentoDetail.unidade}</p></div>
                      <div><p className="text-xs text-ber-gray">Condição</p><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${(CONDICAO_CONFIG[recebimentoDetail.condicao] ?? CONDICAO_CONFIG.aprovado).className}`}>{(CONDICAO_CONFIG[recebimentoDetail.condicao] ?? CONDICAO_CONFIG.aprovado).label}</span></div>
                      <div><p className="text-xs text-ber-gray">Data Entrega</p><p className="text-sm font-medium">{formatDate(recebimentoDetail.dataEntrega)}</p></div>
                      <div><p className="text-xs text-ber-gray">NF</p><p className="text-sm font-medium">{recebimentoDetail.numeroNF || '--'}{recebimentoDetail.dataNF ? ` (${formatDate(recebimentoDetail.dataNF)})` : ''}</p></div>
                      <div className="col-span-2"><p className="text-xs text-ber-gray">Registrado por</p><p className="text-sm font-medium">{recebimentoDetail.registrador?.name ?? '--'} em {formatDate(recebimentoDetail.createdAt)}</p></div>
                    </div>
                    {recebimentoDetail.observacao && (
                      <div><p className="text-xs text-ber-gray">Observação</p><p className="text-sm">{recebimentoDetail.observacao}</p></div>
                    )}
                    {recebimentoDetail.fotoNF && (
                      <div><p className="text-xs text-ber-gray mb-1">Foto NF</p><img src={recebimentoDetail.fotoNF} alt="NF" className="h-32 rounded border object-cover" /></div>
                    )}
                    {recebimentoDetail.fotosMaterial.length > 0 && (
                      <div>
                        <p className="text-xs text-ber-gray mb-1">Fotos do Material</p>
                        <div className="flex gap-2 flex-wrap">
                          {recebimentoDetail.fotosMaterial.map((url, i) => (
                            <img key={i} src={url} alt={`Material ${i + 1}`} className="h-24 rounded border object-cover" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Registration modal */}
            {showRecebimentoForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
                    <h2 className="text-lg font-black text-ber-carbon">Registrar Recebimento</h2>
                    <button onClick={() => setShowRecebimentoForm(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
                  </div>
                  <form onSubmit={handleCreateRecebimento} className="px-6 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-ber-gray">Material *</label>
                        <input type="text" required value={newRecebimento.material} onChange={(e) => setNewRecebimento((p) => ({ ...p, material: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-ber-gray">Fornecedor *</label>
                        <input type="text" required value={newRecebimento.fornecedor} onChange={(e) => setNewRecebimento((p) => ({ ...p, fornecedor: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Quantidade *</label>
                        <input type="number" step="0.01" required value={newRecebimento.quantidade} onChange={(e) => setNewRecebimento((p) => ({ ...p, quantidade: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Unidade *</label>
                        <select value={newRecebimento.unidade} onChange={(e) => setNewRecebimento((p) => ({ ...p, unidade: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none">
                          <option value="un">Unidade</option>
                          <option value="m">Metro</option>
                          <option value="m²">m²</option>
                          <option value="m³">m³</option>
                          <option value="kg">kg</option>
                          <option value="L">Litro</option>
                          <option value="cx">Caixa</option>
                          <option value="pc">Peça</option>
                          <option value="sc">Saco</option>
                          <option value="rl">Rolo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Data Entrega *</label>
                        <input type="date" required value={newRecebimento.dataEntrega} onChange={(e) => setNewRecebimento((p) => ({ ...p, dataEntrega: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Condição *</label>
                        <select value={newRecebimento.condicao} onChange={(e) => setNewRecebimento((p) => ({ ...p, condicao: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none">
                          <option value="aprovado">Aprovado</option>
                          <option value="aprovado_com_ressalva">Aprovado com ressalva</option>
                          <option value="reprovado">Reprovado</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Nº NF</label>
                        <input type="text" value={newRecebimento.numeroNF} onChange={(e) => setNewRecebimento((p) => ({ ...p, numeroNF: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Data NF</label>
                        <input type="date" value={newRecebimento.dataNF} onChange={(e) => setNewRecebimento((p) => ({ ...p, dataNF: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-ber-gray">Observação</label>
                        <textarea rows={2} value={newRecebimento.observacao} onChange={(e) => setNewRecebimento((p) => ({ ...p, observacao: e.target.value }))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Foto NF</label>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => handleRecebimentoUpload(e, 'fotoNF')} className="mt-1 w-full text-xs" />
                        {newRecebimento.fotoNF && <img src={newRecebimento.fotoNF} alt="NF" className="mt-1 h-16 rounded border object-cover" />}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Fotos Material</label>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => handleRecebimentoUpload(e, 'fotosMaterial')} className="mt-1 w-full text-xs" />
                        {newRecebimento.fotosMaterial.length > 0 && (
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {newRecebimento.fotosMaterial.map((url, i) => (
                              <img key={i} src={url} alt={`Material ${i + 1}`} className="h-12 rounded border object-cover" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                      <button type="button" onClick={() => setShowRecebimentoForm(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite">Cancelar</button>
                      <button type="submit" disabled={submittingRecebimento} className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50">
                        <Package size={14} />
                        {submittingRecebimento ? 'Salvando...' : 'Registrar'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      {/* ─── Trello Board Picker Modal ─── */}
      {showTrelloModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
              <h2 className="text-lg font-black text-ber-carbon">Vincular Board do Trello</h2>
              <button
                onClick={() => setShowTrelloModal(false)}
                className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              {loadingBoards ? (
                <p className="py-8 text-center text-sm text-ber-gray">Buscando boards...</p>
              ) : trelloBoards.length === 0 ? (
                <p className="py-8 text-center text-sm text-ber-gray">
                  Nenhum board encontrado no Trello.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-ber-gray">
                    Selecione o board correspondente a esta obra:
                  </p>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {trelloBoards.map((board) => (
                      <button
                        key={board.id}
                        onClick={() => setSelectedBoard(board.id)}
                        className={`w-full rounded-md px-4 py-3 text-left text-sm font-medium transition-colors ${
                          selectedBoard === board.id
                            ? 'bg-ber-teal text-white'
                            : 'bg-ber-offwhite/50 text-ber-carbon hover:bg-ber-offwhite'
                        }`}
                      >
                        {board.name}
                      </button>
                    ))}
                  </div>

                  {syncResult && (
                    <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
                      Sync concluído: {syncResult.created} tarefas criadas, {syncResult.skipped} já existiam.
                    </div>
                  )}

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowTrelloModal(false)}
                      className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                    >
                      {syncResult ? 'Fechar' : 'Cancelar'}
                    </button>
                    {!syncResult && (
                      <button
                        onClick={() => handleTrelloSync(selectedBoard)}
                        disabled={!selectedBoard || syncing}
                        className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Vincular e Sincronizar'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── New Checklist Modal ─── */}
      {showNewChecklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
              <h2 className="text-lg font-black text-ber-carbon">Novo Checklist</h2>
              <button
                onClick={() => setShowNewChecklistModal(false)}
                className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              {loadingTemplates ? (
                <p className="py-8 text-center text-sm text-ber-gray">Buscando templates...</p>
              ) : templates.length === 0 ? (
                <p className="py-8 text-center text-sm text-ber-gray">
                  Nenhum template de checklist encontrado.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-ber-gray">
                    Selecione um template para criar o checklist:
                  </p>
                  <div className="max-h-80 space-y-1.5 overflow-y-auto">
                    {Object.entries(
                      templates.reduce<Record<string, ChecklistTemplate[]>>((acc, tpl) => {
                        const group = CHECKLIST_TYPE_LABELS[tpl.type] || tpl.type;
                        if (!acc[group]) acc[group] = [];
                        acc[group].push(tpl);
                        return acc;
                      }, {})
                    ).map(([group, tpls]) => (
                      <div key={group}>
                        <p className="mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-ber-gray first:mt-0">
                          {group}
                        </p>
                        {tpls.map((tpl) => (
                          <button
                            key={tpl.id}
                            onClick={() => setSelectedTemplate(tpl.id)}
                            className={`w-full rounded-md px-4 py-3 text-left transition-colors ${
                              selectedTemplate === tpl.id
                                ? 'bg-ber-teal text-white'
                                : 'bg-ber-offwhite/50 text-ber-carbon hover:bg-ber-offwhite'
                            }`}
                          >
                            <p className="text-sm font-medium">{tpl.name}</p>
                            <p className={`mt-0.5 text-xs ${selectedTemplate === tpl.id ? 'text-white/70' : 'text-ber-gray'}`}>
                              {tpl.segment} &middot; {tpl.items.length} itens
                            </p>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowNewChecklistModal(false)}
                      className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateChecklist}
                      disabled={!selectedTemplate || creatingChecklist}
                      className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
                    >
                      <ClipboardCheck size={14} />
                      {creatingChecklist ? 'Criando...' : 'Criar Checklist'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
