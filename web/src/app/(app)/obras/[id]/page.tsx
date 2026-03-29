'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Plus, Calendar, User, ChevronDown, RefreshCw, X, ClipboardCheck, Tent, ListOrdered, Play, Send, Check, XCircle, Lock, Clock, Pencil, ChevronUp, Trash2, Snowflake, Package, Camera, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import CockpitBlock from '@/components/obras/CockpitBlock';

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

type TabKey = 'cockpit' | 'kanban' | 'fotos' | 'equipe' | 'checklists' | 'canteiro' | 'sequenciamento' | 'recebimentos';

interface TouchpointSummary {
  id: string;
  type: string;
  title: string;
  occurredAt: string;
  nextAction: string | null;
  nextActionDue: string | null;
  status: string;
}

interface Photo {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: string;
}

interface PunchListItem {
  id: string;
  descricao: string;
  status: 'aberto' | 'resolvido';
  resolvedAt: string | null;
  responsible: { id: string; name: string } | null;
}

interface PunchList {
  id: string;
  type: 'interno' | 'cliente';
  status: 'pendente' | 'em_andamento' | 'concluido';
  createdAt: string;
  creator: { id: string; name: string } | null;
  items: PunchListItem[];
}

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
  const initialTab = (searchParams.get('tab') as TabKey) || 'cockpit';
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

  // Cockpit extra state
  const [touchpoints, setTouchpoints] = useState<TouchpointSummary[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [punchLists, setPunchLists] = useState<PunchList[]>([]);
  // Sequenciamento accordion + edit requests
  const [expandedEtapaId, setExpandedEtapaId] = useState<string | null>(null);
  const [editReqModal, setEditReqModal] = useState<{ etapaId: string; etapaName: string } | null>(null);
  const [editReqMotivo, setEditReqMotivo] = useState('');
  const [sendingEditReq, setSendingEditReq] = useState(false);
  const [editReqSent, setEditReqSent] = useState<Set<string>>(new Set());
  const [unlockedEtapas, setUnlockedEtapas] = useState<Map<string, Date>>(new Map()); // etapaId -> unlockedUntil
  const [pendingEditReqs, setPendingEditReqs] = useState<{id:string;etapa:{id:string;name:string};requester:{id:string;name:string};motivo:string|null;createdAt:string}[]>([]);
  const [resolvingReqId, setResolvingReqId] = useState<string | null>(null);

  // Cockpit drag-and-drop order
  const DEFAULT_BLOCK_ORDER = ['progresso', 'timeline', 'tasks', 'sequenciamento', 'touchpoint', 'checklists', 'equipe', 'punchlist', 'fotos', 'medicoes'];
  const storageKey = `cockpit-order-${params.id}-${typeof window !== 'undefined' ? (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : '') : ''}`;
  const [blockOrder, setBlockOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_BLOCK_ORDER;
    try {
      const saved = localStorage.getItem(`cockpit-order-${params.id}`);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length === DEFAULT_BLOCK_ORDER.length) return parsed;
    } catch {}
    return DEFAULT_BLOCK_ORDER;
  });
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlockOrder(prev => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      localStorage.setItem(`cockpit-order-${params.id}`, JSON.stringify(next));
      return next;
    });
  }
  function resetBlockOrder() {
    setBlockOrder(DEFAULT_BLOCK_ORDER);
    localStorage.removeItem(`cockpit-order-${params.id}`);
  }

  // Touchpoint modal state
  const [showTPModal, setShowTPModal] = useState(false);
  const [showTPHistory, setShowTPHistory] = useState(false);
  const [savingTP, setSavingTP] = useState(false);
  const [newTP, setNewTP] = useState({
    type: 'reuniao_semanal',
    occurredAt: new Date().toISOString().slice(0, 16),
    summary: '',
    nextAction: '',
    nextActionDue: '',
  });

  const [creatingPL, setCreatingPL] = useState<'interno' | 'cliente' | null>(null);
  const [showPLModal, setShowPLModal] = useState<PunchList | null>(null);
  const [newPLItem, setNewPLItem] = useState('');
  const [addingPLItem, setAddingPLItem] = useState(false);

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

  // Equipe state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberRole, setMemberRole] = useState('membro');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

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
      const [obraRes, tasksRes, checklistsRes, canteiroRes, seqRes, recebimentosRes, touchpointsRes, photosRes] = await Promise.all([
        api.get(`/obras/${params.id}`),
        api.get(`/obras/${params.id}/tasks`, { params: { limit: 200 } }),
        api.get(`/obras/${params.id}/checklists`),
        api.get(`/obras/${params.id}/canteiro`),
        api.get(`/obras/${params.id}/sequenciamento`).catch(() => ({ data: { data: null } })),
        api.get(`/obras/${params.id}/recebimentos`),
        api.get(`/obras/${params.id}/touchpoints`, { params: { limit: 5 } }).catch(() => ({ data: { data: [] } })),
        api.get(`/obras/${params.id}/photos`, { params: { limit: 3 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setObra(obraRes.data.data);
      setTasks(tasksRes.data.data);
      setChecklists(checklistsRes.data.data);
      setCanteiroChecklists(canteiroRes.data.data);
      setSequenciamento(seqRes.data.data);
      setRecebimentos(recebimentosRes.data.data);
      setTouchpoints(touchpointsRes.data.data ?? []);
      setRecentPhotos(photosRes.data.data ?? []);
      const plRes = await api.get(`/obras/${params.id}/punch-lists`).catch(() => ({ data: { data: [] } }));
      setPunchLists(plRes.data.data ?? []);
      const pendingReqRes = await api.get(`/obras/${params.id}/edit-requests/pending`).catch(() => ({ data: { data: [] } }));
      setPendingEditReqs(pendingReqRes.data.data ?? []);
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

  // ─── Equipe ──────────────────────────────────────────────────────────────

  async function openAddMemberModal() {
    setShowAddMemberModal(true);
    setUserSearch('');
    setSelectedUserId('');
    setMemberRole('membro');
    if (allUsers.length) return;
    setLoadingUsers(true);
    try {
      const res = await api.get('/users', { params: { limit: 200 } });
      setAllUsers(res.data.data ?? res.data);
    } catch {} finally { setLoadingUsers(false); }
  }

  async function handleAddMember() {
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      await api.post(`/obras/${params.id}/members`, { userId: selectedUserId, role: memberRole });
      setShowAddMemberModal(false);
      fetchData();
    } catch {} finally { setAddingMember(false); }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingMemberId(userId);
    try {
      await api.delete(`/obras/${params.id}/members/${userId}`);
      fetchData();
    } catch {} finally { setRemovingMemberId(null); }
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
    { key: 'cockpit', label: '🎛 Cockpit' },
    { key: 'sequenciamento', label: `Sequenciamento${sequenciamento ? ` (${sequenciamento.etapas.filter(e => e.status === 'aprovada').length}/${sequenciamento.etapas.length})` : ''}` },
    { key: 'kanban', label: `Kanban (${obra._count.tasks})` },
    { key: 'checklists', label: `Checklists (${checklists.length})` },
    { key: 'fotos', label: `Fotos (${obra._count.photos})` },
    { key: 'recebimentos', label: `Recebimentos (${recebimentos.length})` },
    { key: 'equipe', label: `Equipe (${obra.members.length})` },
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
        {activeTab === 'cockpit' && (() => {
          const now = new Date();
          const start = obra.startDate ? new Date(obra.startDate) : null;
          const end = obra.expectedEndDate ? new Date(obra.expectedEndDate) : null;
          const totalDays = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) : null;
          const elapsed = start ? Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000)) : null;
          const remaining = end ? Math.round((end.getTime() - now.getTime()) / 86400000) : null;
          const timelinePct = totalDays && elapsed !== null ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : null;
          const taskDone = tasks.filter(t => t.status === 'done').length;
          const taskInProgress = tasks.filter(t => t.status === 'in_progress').length;
          const taskTodo = tasks.filter(t => t.status === 'todo').length;
          const taskOverdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done').length;
          const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
          const topOverdue = tasks
            .filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done')
            .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2) || new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
            .slice(0, 5)
            .map(t => ({ ...t, daysLate: Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 86400000) }));
          const lastTouchpoint = touchpoints[0] ?? null;
          const FASE_LABELS: Record<string, string> = { kickoff_interno: 'Kickoff Interno', kickoff_externo: 'Kickoff Externo', suprimentos: 'Suprimentos', pre_obra: 'Pré-Obra', execucao: 'Execução', pendencias: 'Pendências', encerramento: 'Encerramento' };
          const FASE_COLORS: Record<string, string> = { kickoff_interno: 'bg-gray-100 text-gray-600', kickoff_externo: 'bg-blue-100 text-blue-700', suprimentos: 'bg-orange-100 text-orange-700', pre_obra: 'bg-amber-100 text-amber-700', execucao: 'bg-ber-teal/15 text-ber-teal', pendencias: 'bg-red-100 text-red-600', encerramento: 'bg-ber-olive/15 text-ber-olive' };
          const fase = (obra as any).fase as string | undefined;
          const faseLabel = fase ? (FASE_LABELS[fase] ?? fase) : null;
          const faseBadge = fase ? (FASE_COLORS[fase] ?? 'bg-gray-100 text-gray-600') : null;
          const criticalItems = checklists.filter(c => c.items.filter(i => i.required && i.answer === null).length > 0).slice(0, 5).map(c => ({ id: c.id, checklistName: c.template?.name ?? c.type, itemCount: c.items.filter(i => i.required && i.answer === null).length }));
          const TOUCHPOINT_LABELS: Record<string, string> = { kickoff_externo: 'Kick-Off Externo', reuniao_semanal: 'Reunião Semanal', comunicado_semanal: 'Comunicado Semanal', extra_aditivo: 'Extra/Aditivo', aceite_provisorio: 'Aceite Provisório', aceite_definitivo: 'Aceite Definitivo', visita_informal: 'Visita Informal' };
          const plInterno = punchLists.find(p => p.type === 'interno');
          const plCliente = punchLists.find(p => p.type === 'cliente');
          const daysToEnd = remaining;
          const isDeliveryDay = daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 1;
          const isPrePunchList = daysToEnd !== null && daysToEnd > 1 && daysToEnd <= 7;

          async function handleCreatePL(type: 'interno' | 'cliente') {
            setCreatingPL(type);
            try {
              const res = await api.post(`/obras/${params.id}/punch-lists`, { type });
              setPunchLists(prev => [...prev, res.data.data]);
              setShowPLModal(res.data.data);
            } catch {} finally { setCreatingPL(null); }
          }
          async function handleToggleItem(plId: string, itemId: string, current: 'aberto' | 'resolvido') {
            const newStatus = current === 'aberto' ? 'resolvido' : 'aberto';
            try {
              await api.patch(`/punch-list-items/${itemId}`, { status: newStatus });
              setPunchLists(prev => prev.map(pl => pl.id === plId ? { ...pl, items: pl.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i) } : pl));
              if (showPLModal?.id === plId) setShowPLModal(prev => prev ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i) } : prev);
            } catch {}
          }
          async function handleAddPLItem(pl: PunchList) {
            if (!newPLItem.trim()) return;
            setAddingPLItem(true);
            try {
              const res = await api.post(`/punch-lists/${pl.id}/items`, { descricao: newPLItem.trim() });
              setPunchLists(prev => prev.map(p => p.id === pl.id ? { ...p, items: [...p.items, res.data.data] } : p));
              setShowPLModal(prev => prev?.id === pl.id ? { ...prev, items: [...prev.items, res.data.data] } : prev);
              setNewPLItem('');
            } catch {} finally { setAddingPLItem(false); }
          }

          function PLCard({ pl, label, colorClass }: { pl: PunchList; label: string; colorClass: string }) {
            const total = pl.items.length; const resolved = pl.items.filter(i => i.status === 'resolvido').length; const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
            return (
              <div className={`rounded-lg border p-3 ${colorClass}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ber-carbon">{label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pl.status === 'concluido' ? 'bg-green-100 text-green-700' : pl.status === 'em_andamento' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{pl.status === 'concluido' ? '✅ Concluído' : pl.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}</span>
                </div>
                {total > 0 && (<><div className="mt-2 flex justify-between text-xs text-ber-gray"><span>{resolved}/{total} resolvidos</span><span>{pct}%</span></div><div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/60"><div className="h-full rounded-full bg-ber-olive" style={{ width: `${pct}%` }} /></div></>)}
                <button onClick={() => setShowPLModal(pl)} className="mt-2 text-xs font-medium text-ber-teal hover:underline">{total === 0 ? 'Adicionar itens →' : 'Ver itens →'}</button>
              </div>
            );
          }

          // ── block definitions ─────────────────────────────────────────────
          const blocks: Record<string, React.ReactNode> = {
            progresso: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Progresso Geral</h3>{faseLabel && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${faseBadge}`}>{faseLabel}</span>}</div>
                <div className="mt-4 flex items-end gap-3"><span className="text-5xl font-black text-ber-carbon">{obra.progressPercent}</span><span className="mb-1.5 text-2xl font-bold text-ber-gray">%</span></div>
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-ber-offwhite"><div className="h-full rounded-full transition-all" style={{ width: `${obra.progressPercent}%`, background: 'linear-gradient(90deg,#B5B820,#8a8c10)' }} /></div>
                {timelinePct !== null && <p className="mt-2 text-xs text-ber-gray">Cronograma: <span className={`font-semibold ${obra.progressPercent < timelinePct ? 'text-red-500' : 'text-ber-olive'}`}>{obra.progressPercent >= timelinePct ? '▲ Adiantado' : '▼ Atrasado'} ({timelinePct}% decorrido)</span></p>}
              </div>
            ),
            timeline: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Linha do Tempo</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-ber-gray">Início</p><p className="mt-0.5 text-sm font-bold text-ber-carbon">{start ? start.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '--'}</p></div>
                  <div><p className="text-xs text-ber-gray">Prazo Final</p><p className={`mt-0.5 text-sm font-bold ${remaining !== null && remaining < 0 ? 'text-red-500' : 'text-ber-carbon'}`}>{end ? end.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '--'}</p></div>
                  <div><p className="text-xs text-ber-gray">Dias Decorridos</p><p className="mt-0.5 text-2xl font-black text-ber-carbon">{elapsed ?? '--'}</p></div>
                  <div><p className="text-xs text-ber-gray">Dias Restantes</p><p className={`mt-0.5 text-2xl font-black ${remaining !== null && remaining < 0 ? 'text-red-500' : remaining !== null && remaining < 14 ? 'text-amber-500' : 'text-ber-carbon'}`}>{remaining !== null ? (remaining < 0 ? `${Math.abs(remaining)}d atraso` : remaining) : '--'}</p></div>
                </div>
                {timelinePct !== null && <div className="mt-4"><div className="relative h-2 w-full overflow-hidden rounded-full bg-ber-offwhite"><div className="h-full rounded-full bg-ber-carbon/20" style={{width:`${timelinePct}%`}}/><div className="absolute top-0 h-full rounded-full" style={{width:`${obra.progressPercent}%`,background:'linear-gradient(90deg,#B5B820,#8a8c10)',opacity:0.85}}/></div><div className="mt-1 flex justify-between text-[10px] text-ber-gray"><span>Início</span><span>Hoje ({timelinePct}%)</span><span>Prazo</span></div></div>}
              </div>
            ),
            tasks: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Tarefas</h3>{taskOverdue > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">⚠ {taskOverdue} atrasada{taskOverdue > 1 ? 's' : ''}</span>}</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-green-50 p-3"><p className="text-3xl font-black text-green-600">{taskDone}</p><p className="mt-1 text-xs font-medium text-green-700">Concluídas</p></div>
                  <div className="rounded-lg bg-amber-50 p-3"><p className="text-3xl font-black text-amber-500">{taskInProgress}</p><p className="mt-1 text-xs font-medium text-amber-600">Em andamento</p></div>
                  <div className="rounded-lg bg-gray-50 p-3"><p className="text-3xl font-black text-gray-400">{taskTodo}</p><p className="mt-1 text-xs font-medium text-gray-500">Pendentes</p></div>
                </div>
                {topOverdue.length > 0 && <ul className="mt-4 space-y-1.5">{topOverdue.map(t => <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-red-700">{t.title}</p>{t.assignee && <p className="text-[10px] text-red-400">{t.assignee.name.split(' ')[0]}</p>}</div><span className="shrink-0 rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700 whitespace-nowrap">+{t.daysLate}d</span></li>)}</ul>}
                <button onClick={() => setActiveTab('kanban')} className="mt-3 text-xs font-medium text-ber-teal hover:underline">Ver Kanban completo →</button>
              </div>
            ),
            equipe: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Equipe Alocada</h3>
                {obra.members.length === 0 ? <p className="mt-4 text-sm text-ber-gray">Nenhum membro alocado.</p> : <div className="mt-4 flex flex-wrap gap-3">{obra.members.map(m => <div key={m.user.id} className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ber-teal text-sm font-bold text-white">{m.user.name.charAt(0)}</div><div><p className="text-xs font-semibold text-ber-carbon">{m.user.name.split(' ')[0]}</p><p className="text-[10px] text-ber-gray capitalize">{m.user.role}</p></div></div>)}</div>}
                {obra.coordinator && <div className="mt-3 border-t border-ber-offwhite pt-3 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-ber-carbon text-xs font-bold text-white">{obra.coordinator.name.charAt(0)}</div><div><p className="text-xs font-semibold text-ber-carbon">{obra.coordinator.name}</p><p className="text-[10px] text-ber-gray">Coordenador</p></div></div>}
              </div>
            ),
            touchpoint: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Touchpoints com Cliente</h3>
                  <button onClick={() => { setNewTP({ type: 'reuniao_semanal', occurredAt: new Date().toISOString().slice(0,16), summary: '', nextAction: '', nextActionDue: '' }); setShowTPModal(true); }} className="flex items-center gap-1 rounded-md bg-ber-teal/10 px-2.5 py-1 text-xs font-semibold text-ber-teal hover:bg-ber-teal/20"><Plus size={12} /> Registrar</button>
                </div>
                {!lastTouchpoint ? <p className="mt-4 text-sm italic text-ber-gray/60">Nenhum touchpoint registrado.</p> : (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2"><span className="rounded-full bg-ber-teal/10 px-2.5 py-0.5 text-xs font-semibold text-ber-teal">{TOUCHPOINT_LABELS[lastTouchpoint.type] ?? lastTouchpoint.type}</span><span className="text-xs text-ber-gray">{new Date(lastTouchpoint.occurredAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
                    <p className="text-sm font-medium text-ber-carbon">{lastTouchpoint.title}</p>
                    {lastTouchpoint.nextAction && <div className={`rounded-lg p-3 ${lastTouchpoint.nextActionDue && new Date(lastTouchpoint.nextActionDue) < now ? 'bg-red-50' : 'bg-amber-50'}`}><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Próxima ação</p><p className="mt-0.5 text-sm text-ber-carbon">{lastTouchpoint.nextAction}</p>{lastTouchpoint.nextActionDue && <p className={`mt-0.5 text-xs font-semibold ${new Date(lastTouchpoint.nextActionDue) < now ? 'text-red-600' : 'text-amber-600'}`}>Prazo: {new Date(lastTouchpoint.nextActionDue).toLocaleDateString('pt-BR')}{new Date(lastTouchpoint.nextActionDue) < now ? ' ⚠ VENCIDO' : ''}</p>}</div>}
                    <button onClick={() => setShowTPHistory(true)} className="text-xs font-medium text-ber-teal hover:underline">Ver histórico ({touchpoints.length}) →</button>
                  </div>
                )}
              </div>
            ),
            checklists: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Checklists Críticos</h3><button onClick={() => setActiveTab('checklists')} className="text-xs font-medium text-ber-teal hover:underline">Ver todos →</button></div>
                {criticalItems.length === 0 ? <div className="mt-4 flex items-center gap-2 text-sm text-ber-olive font-medium"><span>✅</span> Sem pendências críticas</div> : <ul className="mt-3 space-y-2">{criticalItems.map(item => <li key={item.id} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2"><p className="text-xs font-medium text-ber-carbon truncate flex-1 mr-2">{item.checklistName}</p><span className="shrink-0 rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">{item.itemCount}p</span></li>)}</ul>}
              </div>
            ),
            fotos: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Últimas Fotos</h3><button onClick={() => setActiveTab('fotos')} className="text-xs font-medium text-ber-teal hover:underline">Ver galeria →</button></div>
                {recentPhotos.length === 0 ? <div className="mt-4 flex h-24 items-center justify-center rounded-lg bg-ber-offwhite"><p className="text-sm text-ber-gray/50">Sem fotos</p></div> : <div className="mt-3 grid grid-cols-3 gap-2">{recentPhotos.map(photo => <a key={photo.id} href={photo.imageUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-ber-offwhite hover:opacity-80"><img src={photo.thumbnailUrl ?? photo.imageUrl} alt={photo.caption ?? 'Foto'} className="h-full w-full object-cover" /></a>)}</div>}
                <p className="mt-2 text-right text-xs text-ber-gray">{obra._count.photos} foto{obra._count.photos !== 1 ? 's' : ''}</p>
              </div>
            ),
            medicoes: (
              <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Medições / Recebimentos</h3>
                {recebimentos.length === 0 ? <p className="mt-4 text-sm italic text-ber-gray/60">Nenhuma medição registrada.</p> : <div className="mt-3 space-y-2"><div><p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">Último Recebimento</p><div className="mt-1 rounded-lg bg-ber-offwhite/60 p-3"><p className="text-sm font-semibold text-ber-carbon">{recebimentos[0].material}</p><p className="text-xs text-ber-gray">{recebimentos[0].fornecedor} · {new Date(recebimentos[0].dataEntrega).toLocaleDateString('pt-BR')}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${(CONDICAO_CONFIG[recebimentos[0].condicao] ?? CONDICAO_CONFIG.aprovado).className}`}>{(CONDICAO_CONFIG[recebimentos[0].condicao] ?? CONDICAO_CONFIG.aprovado).label}</span></div></div><div className="flex items-center justify-between text-xs text-ber-gray"><span>{recebimentos.length} recebimento{recebimentos.length !== 1 ? 's' : ''}</span><button onClick={() => setActiveTab('recebimentos')} className="font-medium text-ber-teal hover:underline">Ver todos →</button></div></div>}
              </div>
            ),
            sequenciamento: (() => {
              const seq = sequenciamento;
              if (!seq) return (
                <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Sequenciamento</h3>
                  <p className="mt-3 text-sm italic text-ber-gray/60">Sem sequenciamento definido.</p>
                  <button onClick={() => setActiveTab('sequenciamento')} className="mt-2 text-xs font-medium text-ber-teal hover:underline">Iniciar →</button>
                </div>
              );
              const isCoordOrDir = user?.role === 'coordenacao' || user?.role === 'diretoria';
              const isGestorOrAbove = ['gestor','coordenacao','diretoria'].includes(user?.role ?? '');
              const isFrozenCockpit = !!seq.frozenAt;
              const total = seq.etapas.length;
              const approved = seq.etapas.filter(e => e.status === 'aprovada').length;
              const pct = total > 0 ? Math.round((approved/total)*100) : 0;

              async function sendEditReq(etapaId: string, motivo: string) {
                setSendingEditReq(true);
                try {
                  await api.post(`/obras/${params.id}/sequenciamento/etapas/${etapaId}/edit-request`, { motivo });
                  setEditReqSent(prev => new Set([...prev, etapaId]));
                  setEditReqModal(null);
                } catch {} finally { setSendingEditReq(false); }
              }

              async function resolveReq(reqId: string, action: 'approve' | 'reject', rejectionReason?: string) {
                setResolvingReqId(reqId);
                try {
                  const res = await api.patch(`/sequenciamento/edit-requests/${reqId}`, { action, rejectionReason });
                  if (action === 'approve') {
                    const unlockedUntil = new Date(res.data.data.unlockedUntil);
                    setUnlockedEtapas(prev => new Map([...prev, [res.data.data.etapaId, unlockedUntil]]));
                  }
                  setPendingEditReqs(prev => prev.filter(r => r.id !== reqId));
                  fetchData();
                } catch {} finally { setResolvingReqId(null); }
              }

              return (
                <div className="h-full rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Sequenciamento</h3>
                    <div className="flex items-center gap-2">
                      {pendingEditReqs.length > 0 && isCoordOrDir && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {pendingEditReqs.length} solicit.
                        </span>
                      )}
                      <button onClick={() => setActiveTab('sequenciamento')} className="text-xs font-medium text-ber-teal hover:underline">Ver completo →</button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-ber-gray"><span>{approved}/{total} aprovadas</span><span className="font-bold text-ber-olive">{pct}%</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-ber-offwhite"><div className="h-full rounded-full bg-ber-olive transition-all" style={{width:`${pct}%`}} /></div>
                  </div>

                  {/* Pending edit requests for coord/dir */}
                  {isCoordOrDir && pendingEditReqs.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Solicitações de edição pendentes</p>
                      {pendingEditReqs.map(req => (
                        <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-ber-carbon">{req.etapa.name}</p>
                            <p className="text-[10px] text-ber-gray">{req.requester.name}{req.motivo ? ` — ${req.motivo}` : ''}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button disabled={resolvingReqId === req.id} onClick={() => resolveReq(req.id, 'approve')} className="rounded bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-green-600 disabled:opacity-50">✓</button>
                            <button disabled={resolvingReqId === req.id} onClick={() => resolveReq(req.id, 'reject')} className="rounded bg-red-400 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-500 disabled:opacity-50">✗</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Etapas accordion */}
                  <div className="mt-3 space-y-1">
                    {seq.etapas.slice(0,8).map((etapa, idx) => {
                      const ETAPA_STATUS_MAP: Record<string,{label:string;cls:string}> = {
                        nao_iniciada: {label:'Não iniciada', cls:'bg-gray-100 text-gray-500'},
                        em_andamento: {label:'Em andamento', cls:'bg-blue-100 text-blue-700'},
                        aguardando_aprovacao: {label:'Aguard. aprovação', cls:'bg-amber-100 text-amber-700'},
                        concluida: {label:'Concluída', cls:'bg-ber-teal/10 text-ber-teal'},
                        aprovada: {label:'Aprovada', cls:'bg-green-100 text-green-700'},
                      };
                      const sCfg = ETAPA_STATUS_MAP[etapa.status] ?? ETAPA_STATUS_MAP.nao_iniciada;
                      const isExpandedCock = expandedEtapaId === `cockpit-${etapa.id}`;
                      const isLocked = ['concluida','aprovada'].includes(etapa.status);
                      const unlockExpiry = unlockedEtapas.get(etapa.id);
                      const isUnlocked = unlockExpiry && unlockExpiry > new Date();
                      const hasPendingReq = editReqSent.has(etapa.id) || pendingEditReqs.some(r => r.etapa.id === etapa.id);
                      const blocking = etapa.dependencies?.filter((depId: string) => {
                        const dep = seq.etapas.find(e => e.id === depId);
                        return dep && dep.status !== 'aprovada';
                      }) ?? [];
                      const isBlocked = etapa.status === 'nao_iniciada' && blocking.length > 0;
                      return (
                        <div key={etapa.id} className="rounded-lg border border-ber-offwhite">
                          <button
                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-ber-offwhite/60 transition-colors"
                            onClick={() => setExpandedEtapaId(isExpandedCock ? null : `cockpit-${etapa.id}`)}
                          >
                            <span className="w-5 shrink-0 text-center text-[11px] font-bold text-ber-gray/60">{idx+1}</span>
                            <span className="flex-1 text-xs font-medium text-ber-carbon truncate">{etapa.name}</span>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${sCfg.cls}`}>{sCfg.label}</span>
                            <ChevronDown size={13} className={`shrink-0 text-ber-gray/40 transition-transform ${isExpandedCock ? 'rotate-180' : ''}`} />
                          </button>

                          {isExpandedCock && (
                            <div className="border-t border-ber-offwhite px-3 pb-3 pt-2 space-y-2">
                              {/* Dates */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-ber-gray">Início: </span><span className="font-medium text-ber-carbon">{etapa.startDate ? new Date(etapa.startDate).toLocaleDateString('pt-BR') : '—'}</span></div>
                                <div><span className="text-ber-gray">Conclusão: </span><span className="font-medium text-ber-carbon">{etapa.endDate ? new Date(etapa.endDate).toLocaleDateString('pt-BR') : '—'}</span></div>
                              </div>
                              {/* Actions */}
                              <div className="flex flex-wrap gap-1.5">
                                {isGestorOrAbove && etapa.status === 'nao_iniciada' && !isBlocked && isFrozenCockpit && (
                                  <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'start' }); setEtapaNotes(''); }} className="flex items-center gap-1 rounded-md bg-ber-teal px-2 py-1 text-[11px] font-semibold text-white hover:bg-ber-teal/80"><Play size={10} /> Iniciar</button>
                                )}
                                {isGestorOrAbove && etapa.status === 'em_andamento' && (
                                  <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'submit' }); setEtapaNotes(''); setEvidenciaDescricao(''); setEvidenciaFotos([]); }} className="flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"><Send size={10} /> Enviar p/ Aprovação</button>
                                )}
                                {isCoordOrDir && etapa.status === 'aguardando_aprovacao' && (
                                  <>
                                    <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'approve' }); setEtapaNotes(''); }} className="flex items-center gap-1 rounded-md bg-green-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-green-600"><Check size={10} /> Aprovar</button>
                                    <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'reject' }); setEtapaNotes(''); }} className="flex items-center gap-1 rounded-md bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600"><XCircle size={10} /> Rejeitar</button>
                                  </>
                                )}
                                {isLocked && !isUnlocked && (
                                  hasPendingReq
                                    ? <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600">⏳ Aguardando aprovação</span>
                                    : <button onClick={() => { setEditReqModal({ etapaId: etapa.id, etapaName: etapa.name }); setEditReqMotivo(''); }} className="flex items-center gap-1 rounded-md border border-ber-gray/30 px-2 py-1 text-[11px] font-medium text-ber-gray hover:bg-ber-offwhite">🔒 Solicitar edição</button>
                                )}
                                {isLocked && isUnlocked && (
                                  <span className="rounded-md bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-600">🔓 Edição liberada</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {seq.etapas.length > 8 && (
                      <button onClick={() => setActiveTab('sequenciamento')} className="mt-1 w-full text-center text-xs font-medium text-ber-teal hover:underline">
                        +{seq.etapas.length - 8} etapas — ver completo →
                      </button>
                    )}
                  </div>
                </div>
              );
            })(),
            punchlist: (
              <div className="rounded-xl border border-ber-offwhite bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ber-gray">Pendências / Punch List</h3>
                {isDeliveryDay && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2"><span>🔴</span><p className="text-sm font-bold text-red-700">Punch List com Cliente — hoje é dia da entrega!</p></div>}
                {isPrePunchList && !isDeliveryDay && <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2"><span>⚠️</span><p className="text-sm font-semibold text-amber-700">Faltam {daysToEnd} dia{daysToEnd !== 1 ? 's' : ''} — iniciar Punch List Interno agora</p></div>}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ber-gray">Interno (pré-entrega)</p>{plInterno ? <PLCard pl={plInterno} label="Punch List Interno" colorClass="border-amber-200 bg-amber-50/50" /> : <button onClick={() => handleCreatePL('interno')} disabled={creatingPL === 'interno'} className="w-full rounded-lg border border-dashed border-amber-300 py-3 text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50">{creatingPL === 'interno' ? 'Criando...' : '+ Criar Punch List Interno'}</button>}</div>
                  <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ber-gray">Com cliente (entrega)</p>{plCliente ? <PLCard pl={plCliente} label="Punch List com Cliente" colorClass="border-red-200 bg-red-50/50" /> : <button onClick={() => handleCreatePL('cliente')} disabled={creatingPL === 'cliente'} className="w-full rounded-lg border border-dashed border-red-300 py-3 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">{creatingPL === 'cliente' ? 'Criando...' : '+ Criar Punch List com Cliente'}</button>}</div>
                </div>
              </div>
            ),
          };

          return (
            <div>
              {/* Toolbar */}
              <div className="mb-4 flex justify-end">
                <button onClick={resetBlockOrder} className="flex items-center gap-1.5 rounded-md border border-ber-gray/30 bg-white px-3 py-1.5 text-xs font-medium text-ber-gray transition-colors hover:bg-ber-offwhite">
                  <RotateCcw size={12} /> Resetar layout
                </button>
              </div>

              {/* Sortable grid */}
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blockOrder} strategy={rectSortingStrategy}>
                  <div className="flex flex-col gap-4">
                    {blockOrder.map(id => (
                      <CockpitBlock key={id} id={id}>
                        {blocks[id]}
                      </CockpitBlock>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* ── Touchpoint modals ── */}
              {showTPModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowTPModal(false)}>
                  <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-ber-offwhite px-5 py-4"><h2 className="font-bold text-ber-carbon">Registrar Touchpoint</h2><button onClick={() => setShowTPModal(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button></div>
                    <div className="space-y-3 px-5 py-4">
                      <div><label className="text-xs font-medium text-ber-gray">Tipo *</label><select value={newTP.type} onChange={e => setNewTP(p => ({...p, type: e.target.value}))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"><option value="kickoff_externo">Kick-Off Externo</option><option value="reuniao_semanal">Reunião Semanal</option><option value="comunicado_semanal">Comunicado Semanal</option><option value="extra_aditivo">Extra / Aditivo</option><option value="aceite_provisorio">Aceite Provisório</option><option value="aceite_definitivo">Aceite Definitivo</option><option value="visita_informal">Visita Informal</option></select></div>
                      <div><label className="text-xs font-medium text-ber-gray">Data e hora *</label><input type="datetime-local" value={newTP.occurredAt} onChange={e => setNewTP(p => ({...p, occurredAt: e.target.value}))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" /></div>
                      <div><label className="text-xs font-medium text-ber-gray">Resumo</label><textarea rows={3} value={newTP.summary} onChange={e => setNewTP(p => ({...p, summary: e.target.value}))} placeholder="Principais pontos abordados..." className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" /></div>
                      <div><label className="text-xs font-medium text-ber-gray">Próxima ação</label><input type="text" value={newTP.nextAction} onChange={e => setNewTP(p => ({...p, nextAction: e.target.value}))} placeholder="O que precisa acontecer..." className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" /></div>
                      <div><label className="text-xs font-medium text-ber-gray">Prazo</label><input type="date" value={newTP.nextActionDue} onChange={e => setNewTP(p => ({...p, nextActionDue: e.target.value}))} className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" /></div>
                      <div className="flex justify-end gap-3 pt-1">
                        <button onClick={() => setShowTPModal(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
                        <button disabled={savingTP || !newTP.occurredAt} onClick={async () => { setSavingTP(true); try { const label = TOUCHPOINT_LABELS[newTP.type] ?? newTP.type; const res = await api.post(`/obras/${params.id}/touchpoints`, { type: newTP.type, title: label, occurredAt: new Date(newTP.occurredAt).toISOString(), summary: newTP.summary || undefined, nextAction: newTP.nextAction || undefined, nextActionDue: newTP.nextActionDue ? new Date(newTP.nextActionDue).toISOString() : undefined }); setTouchpoints(prev => [res.data.data, ...prev]); setShowTPModal(false); } catch {} finally { setSavingTP(false); } }} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{savingTP ? 'Salvando...' : 'Salvar'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {showTPHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowTPHistory(false)}>
                  <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-ber-offwhite px-5 py-4"><h2 className="font-bold text-ber-carbon">Histórico de Touchpoints</h2><button onClick={() => setShowTPHistory(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button></div>
                    <div className="max-h-[60vh] overflow-y-auto px-5 py-3 space-y-3">
                      {touchpoints.length === 0 && <p className="py-6 text-center text-sm text-ber-gray/60">Nenhum touchpoint.</p>}
                      {touchpoints.map(tp => <div key={tp.id} className="rounded-lg border border-ber-offwhite p-3"><div className="flex items-center gap-2"><span className="rounded-full bg-ber-teal/10 px-2.5 py-0.5 text-xs font-semibold text-ber-teal">{TOUCHPOINT_LABELS[tp.type] ?? tp.type}</span><span className="text-xs text-ber-gray">{new Date(tp.occurredAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</span></div><p className="mt-1.5 text-sm font-medium text-ber-carbon">{tp.title}</p>{tp.nextAction && <p className="mt-1 text-xs text-ber-gray">→ {tp.nextAction}{tp.nextActionDue && <span className="ml-1 font-semibold text-amber-600">({new Date(tp.nextActionDue).toLocaleDateString('pt-BR')})</span>}</p>}</div>)}
                    </div>
                    <div className="border-t border-ber-offwhite px-5 py-3 text-right"><button onClick={() => { setShowTPHistory(false); setNewTP({ type: 'reuniao_semanal', occurredAt: new Date().toISOString().slice(0,16), summary: '', nextAction: '', nextActionDue: '' }); setShowTPModal(true); }} className="text-sm font-medium text-ber-teal hover:underline">+ Registrar novo</button></div>
                  </div>
                </div>
              )}

              {/* ── Edit Request modal ── */}
              {editReqModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setEditReqModal(null)}>
                  <div className="w-full max-w-sm rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-ber-offwhite px-5 py-4">
                      <h2 className="font-bold text-ber-carbon">Solicitar Edição</h2>
                      <button onClick={() => setEditReqModal(null)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        <p className="font-bold">🔒 Etapa com acesso restrito</p>
                        <p className="mt-1">A etapa <strong>{editReqModal.etapaName}</strong> está {sequenciamento?.etapas.find(e => e.id === editReqModal.etapaId)?.status}. Para editar, é necessária aprovação do coordenador ou diretoria.</p>
                        <p className="mt-1">Após aprovação, você terá <strong>30 minutos</strong> para realizar as edições.</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ber-gray">Motivo da solicitação</label>
                        <textarea rows={3} value={editReqMotivo} onChange={e => setEditReqMotivo(e.target.value)} placeholder="Explique por que precisa editar esta etapa..." className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                      </div>
                      <div className="flex justify-end gap-3 pt-1">
                        <button onClick={() => setEditReqModal(null)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
                        <button
                          disabled={sendingEditReq}
                          onClick={() => { if (editReqModal) { const { etapaId } = editReqModal; sendingEditReq || (async () => { setSendingEditReq(true); try { await api.post(`/obras/${params.id}/sequenciamento/etapas/${etapaId}/edit-request`, { motivo: editReqMotivo || undefined }); setEditReqSent(prev => new Set([...prev, etapaId])); setEditReqModal(null); } catch {} finally { setSendingEditReq(false); } })(); }}}
                          className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50"
                        >
                          {sendingEditReq ? 'Enviando...' : 'Enviar solicitação'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Punch List modal ── */}
              {showPLModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowPLModal(null)}>
                  <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-ber-offwhite px-5 py-4"><h2 className="font-bold text-ber-carbon">Punch List {showPLModal.type === 'interno' ? 'Interno' : 'com Cliente'}</h2><button onClick={() => setShowPLModal(null)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button></div>
                    <div className="max-h-80 overflow-y-auto px-5 py-3 space-y-2">
                      {showPLModal.items.length === 0 && <p className="py-4 text-center text-sm text-ber-gray/60">Nenhum item. Adicione abaixo.</p>}
                      {showPLModal.items.map(item => <div key={item.id} className="flex items-start gap-3"><button onClick={() => handleToggleItem(showPLModal.id, item.id, item.status)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${item.status === 'resolvido' ? 'border-ber-olive bg-ber-olive text-white' : 'border-ber-gray/40'}`}>{item.status === 'resolvido' && <Check size={12} />}</button><div className="flex-1 min-w-0"><p className={`text-sm ${item.status === 'resolvido' ? 'line-through text-ber-gray/50' : 'text-ber-carbon'}`}>{item.descricao}</p>{item.responsible && <p className="text-[10px] text-ber-gray">{item.responsible.name}</p>}</div></div>)}
                    </div>
                    <div className="border-t border-ber-offwhite px-5 py-3"><div className="flex gap-2"><input type="text" value={newPLItem} onChange={e => setNewPLItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPLItem(showPLModal)} placeholder="Nova pendência..." className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" /><button onClick={() => handleAddPLItem(showPLModal)} disabled={addingPLItem || !newPLItem.trim()} className="rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{addingPLItem ? '...' : 'Add'}</button></div></div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">
                Equipe Alocada ({obra.members.length})
              </h3>
              <button
                onClick={openAddMemberModal}
                className="flex items-center gap-2 rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
              >
                <Plus size={14} /> Adicionar membro
              </button>
            </div>

            {obra.members.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <User size={40} className="text-ber-gray/30" />
                <p className="mt-3 text-sm text-ber-gray">Nenhum membro alocado nesta obra.</p>
                <button onClick={openAddMemberModal} className="mt-2 text-sm font-medium text-ber-teal hover:underline">
                  Adicionar primeiro membro
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {obra.members.map((m) => (
                  <div key={m.user.id} className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ber-teal text-sm font-bold text-white uppercase">
                      {m.user.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ber-carbon">{m.user.name}</p>
                      <p className="text-xs text-ber-gray capitalize">{m.user.role}</p>
                    </div>
                    {canChangeStatus && (
                      <button
                        onClick={() => handleRemoveMember(m.user.id)}
                        disabled={removingMemberId === m.user.id}
                        className="shrink-0 rounded p-1.5 text-ber-gray/40 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        title="Remover membro"
                      >
                        {removingMemberId === m.user.id ? <span className="text-xs">...</span> : <X size={15} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Member Modal */}
            {showAddMemberModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-ber-offwhite px-5 py-4">
                    <h2 className="font-bold text-ber-carbon">Adicionar Membro</h2>
                    <button onClick={() => setShowAddMemberModal(false)} className="text-ber-gray hover:text-ber-carbon">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {/* Search */}
                    <div>
                      <label className="text-xs font-medium text-ber-gray">Buscar colaborador</label>
                      <input
                        type="text"
                        autoFocus
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Nome ou email..."
                        className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                      />
                    </div>

                    {/* User list */}
                    <div className="max-h-52 overflow-y-auto space-y-1 rounded-md border border-ber-gray/20 p-1">
                      {loadingUsers ? (
                        <p className="py-4 text-center text-xs text-ber-gray">Carregando...</p>
                      ) : (() => {
                        const already = new Set(obra.members.map(m => m.user.id));
                        const filtered = allUsers.filter(u =>
                          !already.has(u.id) &&
                          (userSearch === '' ||
                            u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(userSearch.toLowerCase()))
                        );
                        if (!filtered.length) return (
                          <p className="py-4 text-center text-xs text-ber-gray">
                            {userSearch ? 'Nenhum resultado.' : 'Todos os usuários já estão na equipe.'}
                          </p>
                        );
                        return filtered.map(u => (
                          <button
                            key={u.id}
                            onClick={() => setSelectedUserId(u.id)}
                            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${selectedUserId === u.id ? 'bg-ber-teal text-white' : 'hover:bg-ber-offwhite'}`}
                          >
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selectedUserId === u.id ? 'bg-white/20 text-white' : 'bg-ber-teal/10 text-ber-teal'}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{u.name}</p>
                              <p className={`truncate text-[10px] ${selectedUserId === u.id ? 'text-white/70' : 'text-ber-gray'}`}>{u.email}</p>
                            </div>
                          </button>
                        ));
                      })()}
                    </div>

                    {/* Role */}
                    <div>
                      <label className="text-xs font-medium text-ber-gray">Função nesta obra</label>
                      <select
                        value={memberRole}
                        onChange={e => setMemberRole(e.target.value)}
                        className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
                      >
                        <option value="gestor">Gestor de Obra</option>
                        <option value="membro">Mestre de Obras</option>
                        <option value="coordenador">Comprador</option>
                        <option value="membro">Analista</option>
                        <option value="membro">Campo</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                      <button onClick={() => setShowAddMemberModal(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddMember}
                        disabled={!selectedUserId || addingMember}
                        className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50"
                      >
                        <Plus size={14} />
                        {addingMember ? 'Adicionando...' : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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

                    const isExpanded = expandedEtapaId === etapa.id;

                    return (
                      <div
                        key={etapa.id}
                        className={`rounded-lg bg-white shadow-sm ${isBlocked && !editMode ? 'border border-red-200 opacity-60' : ''} ${editMode ? 'border border-dashed border-ber-gray/30' : 'border border-transparent'}`}
                      >
                        {/* Clickable header row */}
                        <div
                          className={`flex cursor-pointer items-start gap-3 p-4 ${!editMode ? 'hover:bg-ber-offwhite/50 transition-colors' : ''}`}
                          onClick={() => !editMode && setExpandedEtapaId(isExpanded ? null : etapa.id)}
                        >
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
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${discColor}`}>{discLabel}</span>
                                  <span className="text-[10px] text-ber-gray">{etapa.estimatedDays}d</span>
                                  {!editMode && (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCfg.className}`}>
                                      <StatusIcon size={10} /> {statusCfg.label}
                                    </span>
                                  )}
                                </div>

                              </>
                            )}
                          </div>

                          {/* Edit-mode action buttons */}
                          <div className="flex shrink-0 gap-1.5">
                            {editMode && !isEditing && (
                              <>
                                <button onClick={() => startEditingEtapa(etapa)} className="rounded p-1.5 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon" title="Editar"><Pencil size={14} /></button>
                                <button onClick={() => setRemovingEtapaId(etapa.id)} className="rounded p-1.5 text-ber-gray transition-colors hover:bg-red-50 hover:text-red-500" title="Remover"><Trash2 size={14} /></button>
                              </>
                            )}
                            {/* Chevron toggle (view mode only) */}
                            {!editMode && (
                              <span className="ml-1 shrink-0 text-ber-gray/50 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                <ChevronDown size={16} />
                              </span>
                            )}
                          </div>
                        </div>{/* end header row */}

                        {/* Expand panel */}
                        {!editMode && isExpanded && (
                          <div className="border-t border-ber-offwhite px-4 pb-4 pt-3 space-y-3">
                            {/* Status + change */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.className}`}>
                                <StatusIcon size={12} /> {statusCfg.label}
                              </span>
                              {isGestor && etapa.status === 'nao_iniciada' && !isBlocked && isFrozen && (
                                <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'start' }); setEtapaNotes(''); }} className="flex items-center gap-1 rounded-md bg-ber-teal px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-ber-teal/80"><Play size={12} /> Iniciar</button>
                              )}
                              {isGestor && etapa.status === 'em_andamento' && (
                                <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'submit' }); setEtapaNotes(''); setEvidenciaDescricao(''); setEvidenciaFotos([]); }} className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"><Send size={12} /> Enviar p/ Aprovação</button>
                              )}
                              {isCoord && etapa.status === 'aguardando_aprovacao' && (
                                <>
                                  <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'approve' }); setEtapaNotes(''); }} className="flex items-center gap-1 rounded-md bg-ber-olive px-2.5 py-1.5 text-xs font-semibold text-ber-black hover:bg-ber-olive/80"><Check size={12} /> Aprovar</button>
                                  <button onClick={() => { setEtapaAction({ id: etapa.id, type: 'reject' }); setEtapaNotes(''); }} className="flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600"><XCircle size={12} /> Rejeitar</button>
                                </>
                              )}
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Início real</p><p className="mt-0.5 text-ber-carbon">{etapa.startDate ? new Date(etapa.startDate).toLocaleDateString('pt-BR') : '—'}</p></div>
                              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Conclusão</p><p className="mt-0.5 text-ber-carbon">{etapa.endDate ? new Date(etapa.endDate).toLocaleDateString('pt-BR') : etapa.estimatedEndDate ? `Prev. ${new Date(etapa.estimatedEndDate).toLocaleDateString('pt-BR')}` : '—'}</p></div>
                              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Duração estimada</p><p className="mt-0.5 text-ber-carbon">{etapa.estimatedDays} dia{etapa.estimatedDays !== 1 ? 's' : ''}</p></div>
                              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Disciplina</p><p className="mt-0.5 text-ber-carbon capitalize">{DISCIPLINE_LABELS[etapa.discipline] ?? etapa.discipline}</p></div>
                            </div>

                            {/* Dependencies */}
                            {etapa.dependencies && etapa.dependencies.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Dependências</p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {etapa.dependencies.map((depId: string) => {
                                    const dep = sequenciamento!.etapas.find(e => e.id === depId);
                                    return dep ? (
                                      <span key={depId} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${dep.status === 'aprovada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                        {dep.status === 'aprovada' ? '✓' : '⏳'} {dep.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {(etapa.gestorNotes || etapa.coordenadorNotes || etapa.rejectionReason) && (
                              <div className="space-y-2">
                                {etapa.rejectionReason && <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700"><strong>Rejeitada:</strong> {etapa.rejectionReason}{etapa.rejecter && <span className="text-red-400"> — {etapa.rejecter.name}</span>}</div>}
                                {etapa.gestorNotes && <div className="rounded-md bg-ber-offwhite p-2.5 text-xs text-ber-carbon"><strong className="text-ber-gray">Gestor:</strong> {etapa.gestorNotes}</div>}
                                {etapa.coordenadorNotes && <div className="rounded-md bg-ber-offwhite p-2.5 text-xs text-ber-carbon"><strong className="text-ber-gray">Coordenador:</strong> {etapa.coordenadorNotes}</div>}
                              </div>
                            )}

                            {/* Edit unlock for concluida/aprovada */}
                            {['concluida','aprovada'].includes(etapa.status) && isGestor && !isCoord && (
                              (() => {
                                const hasPend = editReqSent.has(etapa.id) || pendingEditReqs.some(r => r.etapa.id === etapa.id);
                                const unlockExp = unlockedEtapas.get(etapa.id);
                                const unlocked = unlockExp && unlockExp > new Date();
                                return hasPend
                                  ? <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 font-medium">⏳ Solicitação de edição pendente — aguardando aprovação</div>
                                  : unlocked
                                    ? <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 font-medium">🔓 Edição liberada até {unlockExp!.toLocaleTimeString('pt-BR')}</div>
                                    : <button onClick={() => { setEditReqModal({ etapaId: etapa.id, etapaName: etapa.name }); setEditReqMotivo(''); }} className="flex items-center gap-1.5 rounded-lg border border-ber-gray/30 bg-ber-offwhite px-3 py-2 text-xs font-medium text-ber-gray hover:bg-white">🔒 Editar (requer autorização)</button>;
                              })()
                            )}

                            {/* Blocked warning */}
                            {isBlocked && <p className="flex items-center gap-1 text-xs text-red-500"><Lock size={11} /> Aguardando: {blocking.join(', ')}</p>}

                            {/* Evidências */}
                            {(etapa.evidenciaDescricao || etapa.evidenciaFotos.length > 0) && (
                              <div className="rounded-md bg-ber-offwhite p-2.5">
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Evidência{etapa.evidenciaRegistradaEm && ` — ${new Date(etapa.evidenciaRegistradaEm).toLocaleDateString('pt-BR')}`}</p>
                                {etapa.evidenciaDescricao && <p className="mb-1.5 text-xs text-ber-carbon">{etapa.evidenciaDescricao}</p>}
                                {etapa.evidenciaFotos.length > 0 && <div className="flex flex-wrap gap-1.5">{etapa.evidenciaFotos.map((url: string, i: number) => <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block h-14 w-14 overflow-hidden rounded border border-ber-gray/15 hover:opacity-80"><img src={url} alt={`Evidência ${i+1}`} className="h-full w-full object-cover" /></a>)}</div>}
                              </div>
                            )}
                          </div>
                        )}
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
