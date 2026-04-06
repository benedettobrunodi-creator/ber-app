'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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

// ─── Fotos types ────────────────────────────────────────────────────────────
interface ObraPlanta { id: string; fileUrl: string; createdAt: string; ambientes: ObraAmbiente[]; }
interface ObraAmbiente {
  id: string; nome: string; posX: number; posY: number; cor: string; plantaId: string | null;
  _count: { fotos: number };
  fotos: { tiradaEm: string | null; createdAt: string }[];
}
interface ObraFoto {
  id: string; fileUrl: string; categoria: string; legenda: string | null;
  tiradaEm: string | null; createdAt: string;
  ambiente: ObraAmbiente | null;
  autor: { id: string; name: string; avatarUrl: string | null } | null;
}

interface BerClTemplate {
  id: string; code: string; name: string; recorrente: boolean;
  items: BerClTemplateItem[];
}
interface BerClTemplateItem {
  id: string; secao: string | null; descricao: string; fotoObrigatoria: boolean; ordem: number;
}
interface ObraBerClItem {
  id: string; checked: boolean; fotoUrl: string | null; observacao: string | null; filledAt: string | null; ambiente: string | null;
  templateItem: BerClTemplateItem | null;
}
interface ObraChecklistAmbiente { id: string; nome: string; ordem: number; }
interface ObraBerChecklist {
  id: string; status: string; visitaNumero: number; createdAt: string; submittedAt: string | null;
  template: BerClTemplate | null;
  filler: { id: string; name: string } | null;
  items: ObraBerClItem[];
  ambientes: ObraChecklistAmbiente[];
}

interface FvsTemplateType {
  id: string; code: string; name: string; disciplina: string | null; bloco: number | null;
  items?: FvsTemplateItemType[];
}
interface FvsTemplateItemType {
  id: string; momento: string; secao: string | null; descricao: string; obrigatorio: boolean; ordem: number;
}
interface ObraFvsItemType {
  id: string; checked: boolean; na: boolean; observacao: string | null; fotoUrl: string | null; filledAt: string | null;
  templateItem: FvsTemplateItemType | null;
  filler: { id: string; name: string } | null;
}
interface ObraFvs {
  id: string; status: string; createdAt: string;
  template: FvsTemplateType | null;
  etapa: { id: string; name: string; discipline: string | null } | null;
  filler: { id: string; name: string } | null;
  gestorApprover: { id: string; name: string } | null;
  coordApprover: { id: string; name: string } | null;
  items: ObraFvsItemType[];
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

type TabKey = 'cockpit' | 'fotos' | 'equipe' | 'checklists' | 'canteiro' | 'sequenciamento' | 'recebimentos' | 'fvs' | 'kanban';

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
  dependencies?: string[];
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
  // Fotos
  const imgRef = useRef<HTMLImageElement>(null);
  const [plantas, setPlantas] = useState<ObraPlanta[]>([]);
  const [ambientes, setAmbientes] = useState<ObraAmbiente[]>([]);
  const [fotos, setFotos] = useState<ObraFoto[]>([]);
  const [fotosView, setFotosView] = useState<'planta' | 'grid'>('planta');
  const [selectedAmbiente, setSelectedAmbiente] = useState<ObraAmbiente | null>(null);
  const [fotosLoading, setFotosLoading] = useState(false);
  const [fullscreenFoto, setFullscreenFoto] = useState<ObraFoto | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addAmbienteMode, setAddAmbienteMode] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadStep, setUploadStep] = useState<'files' | 'ambiente' | 'meta'>('files');
  const [uploadAmbienteId, setUploadAmbienteId] = useState('');
  const [uploadCategoria, setUploadCategoria] = useState('geral');
  const [uploadLegenda, setUploadLegenda] = useState('');
  const [referenceFoto, setReferenceFoto] = useState<ObraFoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fotosAmbienteFilter, setFotosAmbienteFilter] = useState('');
  const [fotasCatFilter, setFotosCatFilter] = useState('');

  // BÈR Checklists
  const [berChecklists, setBerChecklists] = useState<ObraBerChecklist[]>([]);
  const [berClTemplates, setBerClTemplates] = useState<BerClTemplate[]>([]);
  const [activeCl, setActiveCl] = useState<ObraBerChecklist | null>(null);
  const [clModalOpen, setClModalOpen] = useState(false);
  const [clSubmitting, setClSubmitting] = useState(false);
  const [newAmbiente, setNewAmbiente] = useState('');

  // FVS
  const [obraFvsList, setObraFvsList] = useState<ObraFvs[]>([]);
  const [fvsFilter, setFvsFilter] = useState<string>('todos');
  const [activeFvs, setActiveFvs] = useState<ObraFvs | null>(null);
  const [fvsModalOpen, setFvsModalOpen] = useState(false);
  const [fvsSubmitting, setFvsSubmitting] = useState(false);
  const [fvsTemplates, setFvsTemplates] = useState<FvsTemplateType[]>([]);
  const [createFvsModal, setCreateFvsModal] = useState(false);
  const [createFvsTemplateId, setCreateFvsTemplateId] = useState('');
  const [createFvsEtapaId, setCreateFvsEtapaId] = useState('');

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
  // FVS inline in etapa modals
  const [etapaFvs, setEtapaFvs] = useState<ObraFvs | null>(null);
  const [etapaFvsLoading, setEtapaFvsLoading] = useState(false);
  // Rich modal fields
  const [rf, setRf] = useState({
    startDate: new Date().toISOString().slice(0,10),
    fornecedor: '', numOperarios: '', condicoesIniciais: '', fotoInicialUrl: '',
    endDate: new Date().toISOString().slice(0,10),
    qtdExecutada: '', qtdPrevista: '', fvsPreenchida: false,
    hasNaoConf: false, naoConformidades: '', obsConclusao: '',
    obsAprovador: '',
  });
  const [rfFotosEv, setRfFotosEv] = useState<string[]>([]);
  const [rfFotoInicial, setRfFotoInicial] = useState<string | null>(null);
  const [uploadingRf, setUploadingRf] = useState(false);
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
  const [editingDaysId, setEditingDaysId] = useState<string | null>(null);
  const [inlineDays, setInlineDays] = useState(0);
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
      const fvsRes = await api.get(`/obras/${params.id}/fvs`).catch(() => ({ data: { data: [] } }));
      setObraFvsList(fvsRes.data.data ?? []);
      const tmplRes = await api.get('/fvs-templates').catch(() => ({ data: { data: [] } }));
      setFvsTemplates(tmplRes.data.data ?? []);
      const plantasRes = await api.get(`/obras/${params.id}/plantas`).catch(() => ({ data: { data: [] } }));
      setPlantas(plantasRes.data.data ?? []);
      const ambientesRes = await api.get(`/obras/${params.id}/ambientes`).catch(() => ({ data: { data: [] } }));
      setAmbientes(ambientesRes.data.data ?? []);
      const fotosRes2 = await api.get(`/obras/${params.id}/fotos`).catch(() => ({ data: { data: [] } }));
      setFotos(fotosRes2.data.data ?? []);

      const berClRes = await api.get(`/obras/${params.id}/ber-checklists`).catch(() => ({ data: { data: [] } }));
      setBerChecklists(berClRes.data.data ?? []);
      const berClTmplRes = await api.get('/ber-checklist-templates').catch(() => ({ data: { data: [] } }));
      setBerClTemplates(berClTmplRes.data.data ?? []);
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
      if (type === 'start') {
        body.startDate = rf.startDate;
        body.fornecedor = rf.fornecedor || undefined;
        body.numOperarios = rf.numOperarios ? parseInt(rf.numOperarios) : undefined;
        body.condicoesIniciais = rf.condicoesIniciais || undefined;
        body.fotoInicialUrl = rfFotoInicial || undefined;
        body.gestorNotes = etapaNotes || undefined;
      }
      if (type === 'submit') {
        body.qtdExecutada = rf.qtdExecutada || undefined;
        body.qtdPrevista = rf.qtdPrevista || undefined;
        body.fvsPreenchida = rf.fvsPreenchida;
        body.naoConformidades = rf.hasNaoConf ? rf.naoConformidades : undefined;
        body.fotosEvidencia = rfFotosEv;
        body.obsConclusao = rf.obsConclusao || undefined;
        body.evidenciaDescricao = rf.obsConclusao || undefined;
        body.evidenciaFotos = rfFotosEv;
        body.gestorNotes = etapaNotes || undefined;
      }
      if (type === 'approve') {
        body.coordenadorNotes = etapaNotes || undefined;
        body.obsAprovador = rf.obsAprovador || undefined;
      }
      if (type === 'reject') {
        body.rejectionReason = etapaNotes;
      }
      await api.patch(`/obras/${params.id}/etapas/${id}/${type}`, body);
      setEtapaAction(null);
      setEtapaNotes('');
      setEvidenciaDescricao('');
      setEvidenciaFotos([]);
      setRfFotosEv([]);
      setRfFotoInicial(null);
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

  async function saveInlineDays(etapaId: string) {
    if (inlineDays < 1) return;
    try {
      await api.put(`/obras/${params.id}/etapas/${etapaId}`, { estimatedDays: inlineDays });
      setEditingDaysId(null);
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

  const renderSequenciamento = () => (
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
                          {editingDaysId === etapa.id ? (
                            <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                type="number" min={1} max={999}
                                value={inlineDays}
                                onChange={e => setInlineDays(parseInt(e.target.value) || 1)}
                                onKeyDown={e => { if (e.key === 'Enter') saveInlineDays(etapa.id); if (e.key === 'Escape') setEditingDaysId(null); }}
                                onBlur={() => saveInlineDays(etapa.id)}
                                autoFocus
                                className="w-12 rounded border border-ber-teal px-1.5 py-0.5 text-[11px] text-center text-ber-carbon focus:outline-none"
                              />
                              <span className="text-[10px] text-ber-gray">d</span>
                            </span>
                          ) : (
                            <button
                              title="Clique para editar prazo"
                              onClick={e => { e.stopPropagation(); if (etapa.status !== 'aprovada') { setEditingDaysId(etapa.id); setInlineDays(etapa.estimatedDays); } }}
                              className={`text-[10px] text-ber-gray rounded px-1 py-0.5 transition-colors ${etapa.status !== 'aprovada' ? 'hover:bg-ber-offwhite hover:text-ber-teal cursor-pointer' : 'cursor-default'}`}
                            >
                              {etapa.estimatedDays}d {etapa.status !== 'aprovada' && <span className="opacity-0 group-hover:opacity-60 text-[8px]">✎</span>}
                            </button>
                          )}
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
                    {/* ── Action buttons ── always visible, no freeze requirement for coord/dir */}
                    {(() => {
                      const canAct = isFrozen || isCoord;
                      const hasAction =
                        (isGestor && etapa.status === 'nao_iniciada' && !isBlocked && canAct) ||
                        (isGestor && etapa.status === 'em_andamento') ||
                        (isCoord && etapa.status === 'aguardando_aprovacao') ||
                        ['concluida', 'aprovada'].includes(etapa.status);
                      if (!hasAction) return null;
                      return (
                        <div className="flex flex-wrap gap-2 rounded-lg bg-ber-offwhite/60 p-3">
                          {isGestor && etapa.status === 'nao_iniciada' && !isBlocked && canAct && (
                            <button
                              onClick={() => {
                                setEtapaAction({ id: etapa.id, type: 'start' }); setEtapaNotes(''); setRf(p => ({...p, startDate: new Date().toISOString().slice(0,10), fornecedor:'', numOperarios:'', condicoesIniciais:''})); setRfFotoInicial(null);
                                setEtapaFvs(null); setEtapaFvsLoading(true);
                                api.get(`/obras/${params.id}/etapas/${etapa.id}/fvs`).then(r => setEtapaFvs(r.data.data)).catch(() => {}).finally(() => setEtapaFvsLoading(false));
                              }}
                              className="flex items-center gap-1.5 rounded-md bg-green-500 px-3 py-2 text-xs font-bold text-white hover:bg-green-600 shadow-sm"
                            >
                              <Play size={13} /> Iniciar Etapa
                            </button>
                          )}
                          {isGestor && etapa.status === 'nao_iniciada' && isBlocked && (
                            <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                              <Lock size={12} /> Aguardando: {getBlockingEtapas(etapa).join(', ')}
                            </span>
                          )}
                          {isGestor && etapa.status === 'em_andamento' && (
                            <button
                              onClick={() => {
                              setEtapaAction({ id: etapa.id, type: 'submit' }); setEtapaNotes(''); setEvidenciaDescricao(''); setEvidenciaFotos([]); setRfFotosEv([]); setRf(p => ({...p, qtdExecutada:'', qtdPrevista:'', fvsPreenchida:false, hasNaoConf:false, naoConformidades:'', obsConclusao:''}));
                              setEtapaFvs(null); setEtapaFvsLoading(true);
                              api.get(`/obras/${params.id}/etapas/${etapa.id}/fvs`).then(r => setEtapaFvs(r.data.data)).catch(() => {}).finally(() => setEtapaFvsLoading(false));
                            }}
                              className="flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 shadow-sm"
                            >
                              <Send size={13} /> Enviar para Aprovação
                            </button>
                          )}
                          {isCoord && etapa.status === 'aguardando_aprovacao' && (
                            <>
                              <button
                                onClick={() => { setEtapaAction({ id: etapa.id, type: 'approve' }); setEtapaNotes(''); }}
                                className="flex items-center gap-1.5 rounded-md bg-green-500 px-3 py-2 text-xs font-bold text-white hover:bg-green-600 shadow-sm"
                              >
                                <Check size={13} /> Aprovar Etapa
                              </button>
                              <button
                                onClick={() => { setEtapaAction({ id: etapa.id, type: 'reject' }); setEtapaNotes(''); }}
                                className="flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 shadow-sm"
                              >
                                <XCircle size={13} /> Rejeitar
                              </button>
                            </>
                          )}
                          {['concluida', 'aprovada'].includes(etapa.status) && isCoord && (
                            (() => {
                              const exp = unlockedEtapas.get(etapa.id);
                              const ok = exp && exp > new Date();
                              return ok
                                ? <span className="text-xs font-semibold text-green-600">🔓 Liberado até {exp!.toLocaleTimeString('pt-BR')}</span>
                                : <button
                                    onClick={async () => {
                                      try {
                                        const r1 = await api.post(`/obras/${params.id}/sequenciamento/etapas/${etapa.id}/edit-request`, { motivo: 'Desbloqueio direto' });
                                        await api.patch(`/sequenciamento/edit-requests/${r1.data.data.id}`, { action: 'approve' });
                                        setUnlockedEtapas(prev => new Map([...prev, [etapa.id, new Date(Date.now() + 30 * 60 * 1000)]]));
                                      } catch {}
                                    }}
                                    className="flex items-center gap-1.5 rounded-md bg-ber-olive px-3 py-2 text-xs font-bold text-ber-black hover:bg-ber-olive/80 shadow-sm"
                                  >
                                    🔓 Desbloquear edição (30 min)
                                  </button>;
                            })()
                          )}
                          {['concluida', 'aprovada'].includes(etapa.status) && isGestor && !isCoord && (
                            (() => {
                              const pending = editReqSent.has(etapa.id) || pendingEditReqs.some(r => r.etapa.id === etapa.id);
                              const exp = unlockedEtapas.get(etapa.id);
                              const ok = exp && exp > new Date();
                              return pending
                                ? <span className="text-xs font-semibold text-amber-600">⏳ Solicitação pendente — aguardando aprovação</span>
                                : ok
                                  ? <span className="text-xs font-semibold text-green-600">🔓 Edição liberada até {exp!.toLocaleTimeString('pt-BR')}</span>
                                  : <button
                                      onClick={() => { setEditReqModal({ etapaId: etapa.id, etapaName: etapa.name }); setEditReqMotivo(''); }}
                                      className="flex items-center gap-1.5 rounded-md border border-ber-gray/40 bg-white px-3 py-2 text-xs font-semibold text-ber-gray hover:bg-ber-offwhite shadow-sm"
                                    >
                                      🔒 Solicitar edição
                                    </button>;
                            })()
                          )}
                        </div>
                      );
                    })()}

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Início real</p><p className="mt-0.5 text-ber-carbon">{etapa.startDate ? new Date(etapa.startDate).toLocaleDateString('pt-BR') : '—'}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Conclusão</p><p className="mt-0.5 text-ber-carbon">{etapa.endDate ? new Date(etapa.endDate).toLocaleDateString('pt-BR') : etapa.estimatedEndDate ? `Prev. ${new Date(etapa.estimatedEndDate).toLocaleDateString('pt-BR')}` : '—'}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Duração estimada</p><p className="mt-0.5 text-ber-carbon">{etapa.estimatedDays} dia{etapa.estimatedDays !== 1 ? 's' : ''}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Disciplina</p><p className="mt-0.5 text-ber-carbon capitalize">{DISCIPLINE_LABELS[etapa.discipline] ?? etapa.discipline}</p></div>
                      {etapa.submitter && <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Enviado por</p><p className="mt-0.5 text-ber-carbon">{etapa.submitter.name}</p></div>}
                      {etapa.approver && <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Aprovado por</p><p className="mt-0.5 text-ber-carbon">{etapa.approver.name}</p></div>}
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
                        {etapa.gestorNotes && !['sim','não','nao','true','false','yes','no'].includes(etapa.gestorNotes.toLowerCase().trim()) && <div className="rounded-md bg-ber-offwhite p-2.5 text-xs text-ber-carbon"><strong className="text-ber-gray">Gestor:</strong> {etapa.gestorNotes}</div>}
                        {etapa.coordenadorNotes && <div className="rounded-md bg-ber-offwhite p-2.5 text-xs text-ber-carbon"><strong className="text-ber-gray">Coordenador:</strong> {etapa.coordenadorNotes}</div>}
                      </div>
                    )}

                    {/* Edit unlock for concluida/aprovada */}
                    {['concluida','aprovada'].includes(etapa.status) && isCoord && (
                      (() => {
                        const unlockExp = unlockedEtapas.get(etapa.id);
                        const unlocked = unlockExp && unlockExp > new Date();
                        return unlocked
                          ? <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 font-medium">🔓 Edição liberada até {unlockExp!.toLocaleTimeString('pt-BR')}</div>
                          : <button onClick={async () => {
                              try {
                                const res = await api.post(`/obras/${params.id}/sequenciamento/etapas/${etapa.id}/edit-request`, { motivo: 'Desbloqueio direto' });
                                const reqId = res.data.data.id;
                                await api.patch(`/sequenciamento/edit-requests/${reqId}`, { action: 'approve' });
                                setUnlockedEtapas(prev => new Map([...prev, [etapa.id, new Date(Date.now() + 30*60*1000)]]));
                              } catch {}
                            }} className="flex items-center gap-1.5 rounded-lg bg-ber-olive/90 px-3 py-2 text-xs font-semibold text-white hover:bg-ber-olive">🔓 Desbloquear edição (30 min)</button>;
                      })()
                    )}
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
  );

  if (!obra) {
    return <div className="text-sm text-ber-gray">Obra não encontrada.</div>;
  }

  const statusCfg = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'cockpit', label: '🎛 Cockpit' },
    { key: 'sequenciamento', label: `Sequenciamento${sequenciamento ? ` (${sequenciamento.etapas.filter(e => e.status === 'aprovada').length}/${sequenciamento.etapas.length})` : ''}` },
    { key: 'fvs', label: `FVS (${obraFvsList.length})` },
    { key: 'checklists', label: `Checklists (${checklists.length})` },
    { key: 'fotos', label: `Fotos (${obra._count.photos})` },
    { key: 'recebimentos', label: `Recebimentos (${recebimentos.length})` },
    { key: 'equipe', label: `Equipe (${obra.members.length})` },
  ];

  return (
    <div className="p-4 md:p-6">
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
            <h1 className="text-xl md:text-2xl font-black text-ber-carbon">{obra.name}</h1>
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
      <div className="mt-6 flex gap-1 border-b border-ber-gray/20 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-ber-olive text-ber-carbon'
                : 'text-ber-gray hover:text-ber-carbon'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {/* Medição — página dedicada */}
        <Link
          href={`/obras/${params.id}/medicao`}
          className="shrink-0 px-4 py-2.5 text-sm font-medium text-ber-gray hover:text-ber-carbon transition-colors flex items-center gap-1"
        >
          📊 Medição
        </Link>
        {/* Compras — página dedicada */}
        <Link
          href={`/obras/${params.id}/compras`}
          className="shrink-0 px-4 py-2.5 text-sm font-medium text-ber-gray hover:text-ber-carbon transition-colors flex items-center gap-1"
        >
          🛒 Compras
        </Link>
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
            sequenciamento: renderSequenciamento(),
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
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4" onClick={() => setShowTPModal(false)}>
                  <div className="w-full max-w-md rounded-t-2xl md:rounded-xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4" onClick={() => setShowTPHistory(false)}>
                  <div className="w-full max-w-lg rounded-t-2xl md:rounded-xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4" onClick={() => setEditReqModal(null)}>
                  <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4" onClick={() => setShowPLModal(null)}>
                  <div className="w-full max-w-md rounded-t-2xl md:rounded-xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

        {activeTab === 'fotos' && (() => {
          const CATEGORIAS = ['geral','canteiro','demolicao','eletrica','hidraulica','ac_hvac','drywall','forro','piso','pintura','marcenaria','acabamento','entrega','sem_categoria'];
          const CAT_LABELS: Record<string,string> = {geral:'Geral',canteiro:'Canteiro',demolicao:'Demolição',eletrica:'Elétrica',hidraulica:'Hidráulica',ac_hvac:'AC/HVAC',drywall:'Drywall',forro:'Forro',piso:'Piso/Revestimento',pintura:'Pintura',marcenaria:'Marcenaria',acabamento:'Acabamento Final',entrega:'Entrega',sem_categoria:'Sem categoria'};
          const planta = plantas[0] ?? null;
          const now = Date.now();
          const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

          const getPinColor = (amb: ObraAmbiente) => {
            if (amb._count.fotos === 0) return '#9CA3AF'; // gray
            const lastDate = amb.fotos[0]?.tiradaEm ?? amb.fotos[0]?.createdAt;
            if (!lastDate) return '#9CA3AF';
            return (now - new Date(lastDate).getTime()) < SEVEN_DAYS ? '#22C55E' : '#F59E0B'; // green or yellow
          };

          const filteredFotos = fotos.filter(f => {
            if (fotosAmbienteFilter && f.ambiente?.id !== fotosAmbienteFilter) return false;
            if (fotasCatFilter && f.categoria !== fotasCatFilter) return false;
            return true;
          });

          const ambienteFotos = selectedAmbiente ? fotos.filter(f => f.ambiente?.id === selectedAmbiente.id) : [];

          // Refetch fotos + ambientes do servidor (fonte da verdade)
          const refetchFotosAmbientes = async () => {
            const [fRes, aRes] = await Promise.all([
              api.get(`/obras/${params.id}/fotos`),
              api.get(`/obras/${params.id}/ambientes`),
            ]);
            setFotos(fRes.data.data ?? []);
            setAmbientes(aRes.data.data ?? []);
          };

          const handleUploadFiles = async () => {
            if (!pendingFiles.length) return;
            setUploading(true);
            try {
              const urls: string[] = [];
              for (const file of pendingFiles) {
                const fd = new FormData(); fd.append('file', file);
                const up = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                urls.push(up.data.data?.url ?? up.data.url);
              }
              const batch = urls.map(url => ({
                fileUrl: url,
                ...(uploadAmbienteId && { ambienteId: uploadAmbienteId }),
                categoria: uploadCategoria,
                ...(uploadLegenda && { legenda: uploadLegenda }),
              }));
              await api.post(`/obras/${params.id}/fotos/batch`, { fotos: batch });
              // Refetch completo: garante fotos com ambiente populado + _count atualizado nos pins
              await refetchFotosAmbientes();
              setUploadModalOpen(false); setPendingFiles([]); setUploadStep('files');
              setUploadAmbienteId(''); setUploadCategoria('geral'); setUploadLegenda(''); setReferenceFoto(null);
            } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro no upload'); }
            finally { setUploading(false); }
          };

          const handleAddAmbiente = async (e: React.MouseEvent<HTMLDivElement>) => {
            e.stopPropagation(); // evita bubbling para containers pai
            if (!addAmbienteMode || !planta) return;
            const imgEl = imgRef.current;
            if (!imgEl) return;
            const rect = imgEl.getBoundingClientRect();
            const posX = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
            const posY = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
            const nome = prompt('Nome do ambiente:');
            if (!nome?.trim()) return;
            setAddAmbienteMode(false); // desativa antes do POST para evitar duplo disparo
            try {
              await api.post(`/obras/${params.id}/ambientes`, { nome: nome.trim(), posX, posY, plantaId: planta.id });
              // Refetch substitui state inteiro — sem acumulação
              const aRes = await api.get(`/obras/${params.id}/ambientes`);
              setAmbientes(aRes.data.data ?? []);
            } catch (e: any) {
              setAddAmbienteMode(true); // reativa se falhou
              alert(e?.response?.data?.error?.message ?? 'Erro');
            }
          };

          const handleDeleteFoto = async (fotoId: string) => {
            if (!confirm('Excluir esta foto?')) return;
            try {
              await api.delete(`/obras/${params.id}/fotos/${fotoId}`);
              setFotos(prev => prev.filter(f => f.id !== fotoId));
              setFullscreenFoto(null);
              const ambRes = await api.get(`/obras/${params.id}/ambientes`);
              setAmbientes(ambRes.data.data ?? []);
            } catch { alert('Erro ao excluir'); }
          };

          const handlePlantaUpload = async (file: File) => {
            const fd = new FormData(); fd.append('file', file);
            try {
              const up = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
              const url = up.data.data?.url ?? up.data.url;
              const r = await api.post(`/obras/${params.id}/plantas`, { fileUrl: url });
              setPlantas(prev => [r.data.data, ...prev]);
            } catch { alert('Erro no upload da planta'); }
          };

          // Check reference foto when ambiente+categoria change
          const checkReference = async (ambId: string, cat: string) => {
            if (!ambId || !cat) { setReferenceFoto(null); return; }
            try {
              const r = await api.get(`/obras/${params.id}/fotos/referencia?ambienteId=${ambId}&categoria=${cat}`);
              setReferenceFoto(r.data.data ?? null);
            } catch { setReferenceFoto(null); }
          };

          return (
            <div>
              {/* Header */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Fotos ({fotos.length})</h3>
                  <div className="flex rounded-md border border-ber-gray/20 overflow-hidden">
                    <button onClick={() => setFotosView('planta')}
                      className={`px-3 py-1 text-xs font-semibold transition ${fotosView === 'planta' ? 'bg-ber-carbon text-white' : 'text-ber-gray hover:bg-ber-offwhite'}`}>
                      🗺️ Planta
                    </button>
                    <button onClick={() => setFotosView('grid')}
                      className={`px-3 py-1 text-xs font-semibold transition ${fotosView === 'grid' ? 'bg-ber-carbon text-white' : 'text-ber-gray hover:bg-ber-offwhite'}`}>
                      📷 Grid
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {planta && (
                    <button onClick={() => setAddAmbienteMode(!addAmbienteMode)}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${addAmbienteMode ? 'bg-amber-500 text-white animate-pulse' : 'border border-ber-gray/20 text-ber-gray hover:bg-ber-offwhite'}`}>
                      {addAmbienteMode ? '📍 Clique na planta...' : '+ Ambiente'}
                    </button>
                  )}
                  <button onClick={() => { setUploadModalOpen(true); setUploadStep('files'); setPendingFiles([]); }}
                    className="rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-bold text-white hover:bg-ber-black">
                    + Foto
                  </button>
                </div>
              </div>

              {/* VISTA PLANTA */}
              {fotosView === 'planta' && (
                <div className="flex gap-4 flex-col lg:flex-row">
                  {/* Planta */}
                  <div className="flex-1 min-w-0">
                    {!planta ? (
                      <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ber-gray/30 py-16 cursor-pointer hover:border-ber-teal/50 transition">
                        <span className="text-3xl mb-2">🏗️</span>
                        <span className="text-sm font-semibold text-ber-gray">Upload da planta baixa</span>
                        <span className="text-[10px] text-ber-gray/60 mt-0.5">JPG, PNG ou PDF</span>
                        <input type="file" accept="image/*,.pdf" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePlantaUpload(f); }} />
                      </label>
                    ) : (
                      <div className="rounded-xl overflow-hidden border border-ber-gray/10 shadow-sm">
                        {/* Wrapper relativo à imagem — pins posicionados AQUI dentro */}
                        <div className="relative"
                          onClick={handleAddAmbiente}
                          style={{ cursor: addAmbienteMode ? 'crosshair' : 'default', lineHeight: 0 }}>
                          <img
                            ref={imgRef}
                            src={planta.fileUrl}
                            alt="Planta"
                            className="w-full h-auto block"
                          />
                          {/* Pins — absolutamente posicionados dentro do wrapper da imagem */}
                          {ambientes.filter(a => a.plantaId === planta.id).map((amb) => {
                            const pinColor = getPinColor(amb);
                            const isSelected = selectedAmbiente?.id === amb.id;
                            return (
                              <button key={amb.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedAmbiente(isSelected ? null : amb); }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
                                style={{ left: `${amb.posX}%`, top: `${amb.posY}%` }}
                                title={amb.nome}>
                                <div className={`relative flex items-center justify-center rounded-full shadow-lg transition-transform ${isSelected ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}
                                  style={{ backgroundColor: pinColor, width: 28, height: 28 }}>
                                  <span className="text-[9px] font-black text-white">{amb._count.fotos}</span>
                                </div>
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[8px] text-white opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                  {amb.nome}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Painel lateral */}
                  {selectedAmbiente && (
                    <div className="w-full lg:w-80 shrink-0 rounded-xl border border-ber-gray/10 bg-white shadow-sm overflow-hidden">
                      <div className="border-b border-ber-offwhite px-4 py-3 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-ber-carbon">{selectedAmbiente.nome}</h4>
                          <p className="text-[10px] text-ber-gray">{ambienteFotos.length} foto{ambienteFotos.length !== 1 ? 's' : ''}</p>
                        </div>
                        <button onClick={() => setSelectedAmbiente(null)} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={14} /></button>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto p-3 space-y-3">
                        {ambienteFotos.length === 0 ? (
                          <p className="text-xs text-ber-gray text-center py-6">Nenhuma foto neste ambiente.</p>
                        ) : ambienteFotos.map(foto => (
                          <button key={foto.id} onClick={() => setFullscreenFoto(foto)}
                            className="w-full rounded-lg overflow-hidden border border-ber-gray/10 hover:shadow-md transition text-left">
                            <img src={foto.fileUrl} alt={foto.legenda ?? ''} className="w-full h-32 object-cover" />
                            <div className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-ber-teal/10 px-1.5 py-0.5 text-[9px] font-semibold text-ber-teal">{CAT_LABELS[foto.categoria] ?? foto.categoria}</span>
                                <span className="text-[10px] text-ber-gray">{foto.tiradaEm ? new Date(foto.tiradaEm).toLocaleDateString('pt-BR') : ''}</span>
                              </div>
                              {foto.legenda && <p className="mt-1 text-xs text-ber-carbon truncate">{foto.legenda}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VISTA GRID */}
              {fotosView === 'grid' && (
                <div>
                  {/* Filtros */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    <select value={fotosAmbienteFilter} onChange={e => setFotosAmbienteFilter(e.target.value)}
                      className="rounded-md border border-ber-gray/20 px-2.5 py-1.5 text-xs text-ber-carbon">
                      <option value="">Todos os ambientes</option>
                      {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                    <select value={fotasCatFilter} onChange={e => setFotosCatFilter(e.target.value)}
                      className="rounded-md border border-ber-gray/20 px-2.5 py-1.5 text-xs text-ber-carbon">
                      <option value="">Todas as categorias</option>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                    </select>
                  </div>
                  {filteredFotos.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-center">
                      <span className="text-3xl mb-2">📷</span>
                      <p className="text-sm text-ber-gray">Nenhuma foto {(fotosAmbienteFilter || fotasCatFilter) ? 'com esses filtros' : 'ainda'}.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {filteredFotos.map(foto => (
                        <button key={foto.id} onClick={() => setFullscreenFoto(foto)}
                          className="group rounded-lg overflow-hidden border border-ber-gray/10 bg-white shadow-sm hover:shadow-md transition text-left">
                          <div className="relative aspect-square">
                            <img src={foto.fileUrl} alt={foto.legenda ?? ''} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="px-2.5 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-ber-teal/10 px-1.5 py-0.5 text-[8px] font-semibold text-ber-teal">{CAT_LABELS[foto.categoria] ?? foto.categoria}</span>
                              {foto.ambiente && <span className="text-[8px] text-ber-gray truncate">{foto.ambiente.nome}</span>}
                            </div>
                            {foto.legenda && <p className="mt-0.5 text-[10px] text-ber-carbon truncate">{foto.legenda}</p>}
                            <p className="text-[9px] text-ber-gray/50">{foto.tiradaEm ? new Date(foto.tiradaEm).toLocaleDateString('pt-BR') : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* FULLSCREEN MODAL */}
              {fullscreenFoto && (() => {
                const list = selectedAmbiente ? ambienteFotos : filteredFotos;
                const idx = list.findIndex(f => f.id === fullscreenFoto.id);
                const prev = idx > 0 ? list[idx - 1] : null;
                const next = idx < list.length - 1 ? list[idx + 1] : null;
                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setFullscreenFoto(null)}>
                    <button onClick={(e) => { e.stopPropagation(); setFullscreenFoto(null); }}
                      className="absolute top-4 right-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"><X size={20} /></button>
                    {prev && (
                      <button onClick={(e) => { e.stopPropagation(); setFullscreenFoto(prev); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-3 text-white hover:bg-white/30 text-lg font-bold">←</button>
                    )}
                    {next && (
                      <button onClick={(e) => { e.stopPropagation(); setFullscreenFoto(next); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-3 text-white hover:bg-white/30 text-lg font-bold">→</button>
                    )}
                    <div className="max-h-[90vh] max-w-[90vw] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                      <img src={fullscreenFoto.fileUrl} alt="" className="max-h-[75vh] max-w-full rounded-lg object-contain" />
                      <div className="mt-3 text-center text-white">
                        {fullscreenFoto.ambiente && <span className="text-sm font-semibold">{fullscreenFoto.ambiente.nome}</span>}
                        <span className="mx-2 text-white/40">·</span>
                        <span className="text-sm">{CAT_LABELS[fullscreenFoto.categoria] ?? fullscreenFoto.categoria}</span>
                        {fullscreenFoto.tiradaEm && <>
                          <span className="mx-2 text-white/40">·</span>
                          <span className="text-sm">{new Date(fullscreenFoto.tiradaEm).toLocaleDateString('pt-BR')}</span>
                        </>}
                        {fullscreenFoto.autor && <>
                          <span className="mx-2 text-white/40">·</span>
                          <span className="text-xs text-white/70">{fullscreenFoto.autor.name}</span>
                        </>}
                        {fullscreenFoto.legenda && <p className="mt-1 text-xs text-white/80 italic">{fullscreenFoto.legenda}</p>}
                        <button onClick={() => handleDeleteFoto(fullscreenFoto.id)}
                          className="mt-2 rounded-md bg-red-500/80 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500">
                          🗑️ Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* UPLOAD MODAL */}
              {uploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-3">
                  <div className="w-full max-w-lg rounded-t-2xl md:rounded-xl bg-white shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-ber-offwhite px-5 py-3">
                      <h3 className="text-sm font-bold text-ber-carbon">Nova Foto</h3>
                      <button onClick={() => { setUploadModalOpen(false); setPendingFiles([]); }} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Step 1: Files */}
                      {uploadStep === 'files' && (
                        <div>
                          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ber-gray/30 py-8 cursor-pointer hover:border-ber-teal/50 transition">
                            <span className="text-2xl mb-1">📷</span>
                            <span className="text-sm font-semibold text-ber-gray">Selecione fotos</span>
                            <span className="text-[10px] text-ber-gray/60">Câmera ou galeria · múltiplas fotos</span>
                            <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                              onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) { setPendingFiles(files); setUploadStep('ambiente'); } }} />
                          </label>
                          {pendingFiles.length > 0 && (
                            <p className="mt-2 text-xs text-ber-teal font-semibold">{pendingFiles.length} foto{pendingFiles.length > 1 ? 's' : ''} selecionada{pendingFiles.length > 1 ? 's' : ''}</p>
                          )}
                        </div>
                      )}
                      {/* Step 2: Ambiente + Categoria */}
                      {uploadStep === 'ambiente' && (
                        <div className="space-y-3">
                          <p className="text-xs text-ber-gray font-semibold">{pendingFiles.length} foto{pendingFiles.length > 1 ? 's' : ''} selecionada{pendingFiles.length > 1 ? 's' : ''}</p>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ber-gray">Ambiente</label>
                            <select value={uploadAmbienteId} onChange={e => { setUploadAmbienteId(e.target.value); checkReference(e.target.value, uploadCategoria); }}
                              className="w-full rounded-md border border-ber-gray/20 px-3 py-2 text-sm">
                              <option value="">Sem ambiente</option>
                              {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ber-gray">Categoria</label>
                            <select value={uploadCategoria} onChange={e => { setUploadCategoria(e.target.value); checkReference(uploadAmbienteId, e.target.value); }}
                              className="w-full rounded-md border border-ber-gray/20 px-3 py-2 text-sm">
                              {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ber-gray">Legenda (opcional)</label>
                            <input value={uploadLegenda} onChange={e => setUploadLegenda(e.target.value)}
                              className="w-full rounded-md border border-ber-gray/20 px-3 py-2 text-sm" placeholder="Ex: Quadro QD-01 instalado" />
                          </div>
                          {referenceFoto && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="text-[10px] font-bold text-amber-700 mb-1">📷 Foto anterior — mesmo ângulo</p>
                              <img src={referenceFoto.fileUrl} alt="" className="w-full h-24 object-cover rounded" />
                              <p className="mt-1 text-[9px] text-amber-600">{referenceFoto.tiradaEm ? new Date(referenceFoto.tiradaEm).toLocaleDateString('pt-BR') : ''}</p>
                            </div>
                          )}
                          <button onClick={handleUploadFiles} disabled={uploading}
                            className="w-full rounded-md bg-ber-carbon py-2.5 text-sm font-bold text-white hover:bg-ber-black disabled:opacity-50">
                            {uploading ? 'Enviando...' : `Enviar ${pendingFiles.length} foto${pendingFiles.length > 1 ? 's' : ''}`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-md rounded-t-2xl md:rounded-xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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

        {activeTab === 'checklists' && (() => {
          const CL_STATUS: Record<string, { label: string; color: string; dot: string }> = {
            nao_iniciado: { label: 'Não iniciado', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
            em_preenchimento: { label: 'Em preenchimento', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
            concluido: { label: 'Concluído ✓', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
          };
          // Group by template code (show all 5 types)
          const byCode: Record<string, ObraBerChecklist[]> = {};
          berChecklists.forEach(c => { const code = c.template?.code ?? '?'; (byCode[code] = byCode[code] ?? []).push(c); });

          return (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Checklists BÈR</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {berClTemplates.map(tmpl => {
                  const instances = byCode[tmpl.code] ?? [];
                  const latest = instances[instances.length - 1] ?? null;
                  const allDone = instances.length > 0 && instances.every(c => c.status === 'concluido');
                  const sc = latest ? (CL_STATUS[latest.status] ?? CL_STATUS.nao_iniciado) : CL_STATUS.nao_iniciado;
                  const totalItems = latest?.items.length ?? tmpl.items.length;
                  const checkedItems = latest?.items.filter(i => i.checked).length ?? 0;
                  const pct = totalItems > 0 ? Math.round(checkedItems / totalItems * 100) : 0;
                  const COLORS = ['bg-slate-50','bg-blue-50','bg-orange-50','bg-green-50','bg-red-50'];
                  const CODE_IDX = ['CL_1','CL_2','CL_3','CL_4','CL_5'].indexOf(tmpl.code);
                  const bgColor = COLORS[CODE_IDX] ?? 'bg-gray-50';

                  return (
                    <div key={tmpl.id} className={`rounded-xl border border-ber-gray/10 ${bgColor} p-4 shadow-sm`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray/60">{tmpl.code}</p>
                          <p className="mt-0.5 text-sm font-bold text-ber-carbon leading-snug">{tmpl.name}</p>
                          {tmpl.recorrente && (
                            <span className="mt-1 inline-block rounded-full bg-ber-teal/10 px-2 py-0.5 text-[9px] font-semibold text-ber-teal">Recorrente</span>
                          )}
                        </div>
                        {latest && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                        )}
                      </div>

                      {/* Instances list */}
                      {instances.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          {instances.map(cl => {
                            const s = CL_STATUS[cl.status] ?? CL_STATUS.nao_iniciado;
                            const checked = cl.items.filter(i => i.checked).length;
                            const total = cl.items.length;
                            return (
                              <button key={cl.id} onClick={() => { setActiveCl(cl); setClModalOpen(true); }}
                                className="w-full flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-left hover:bg-white transition-colors shadow-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                                  <span className="text-xs font-medium text-ber-carbon truncate">
                                    {tmpl.recorrente ? `Visita ${cl.visitaNumero}` : 'Abrir'} · {checked}/{total} itens
                                  </span>
                                </div>
                                <span className="shrink-0 text-[10px] text-ber-gray">{new Date(cl.createdAt).toLocaleDateString('pt-BR')}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Progress bar (latest) */}
                      {latest && (
                        <div className="mb-3">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                            <div className="h-full rounded-full bg-ber-teal transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="mt-0.5 text-right text-[10px] text-ber-gray">{pct}%</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {(tmpl.recorrente || instances.length === 0) && (
                          <button
                            onClick={async () => {
                              try {
                                const r = await api.post(`/obras/${params.id}/ber-checklists`, { templateId: tmpl.id });
                                const newCl = r.data.data;
                                setBerChecklists(prev => [...prev, newCl]);
                                setActiveCl(newCl); setClModalOpen(true);
                              } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
                            }}
                            className="flex-1 rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-bold text-white hover:bg-ber-black transition-colors">
                            {tmpl.recorrente && instances.length > 0 ? '+ Nova visita' : '+ Iniciar'}
                          </button>
                        )}
                        {!tmpl.recorrente && instances.length > 0 && (
                          <button onClick={() => { setActiveCl(latest!); setClModalOpen(true); }}
                            className="flex-1 rounded-md border border-ber-gray/20 px-3 py-1.5 text-xs font-medium text-ber-carbon hover:bg-white transition-colors">
                            Abrir →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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

        {activeTab === 'sequenciamento' && renderSequenciamento()}
      </div>

      {/* ─── Confirm Freeze Modal ─── */}
      {confirmFreeze && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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

      {/* ─── Etapa Action Modal (Rich Forms) ─── */}
      {etapaAction && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-3">
          <div className="w-full max-w-lg rounded-t-2xl md:rounded-xl bg-white shadow-2xl max-h-[90dvh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4 shrink-0">
              <div>
                <h2 className="text-base font-black text-ber-carbon">
                  {etapaAction.type === 'start' && '🚀 Iniciar Etapa'}
                  {etapaAction.type === 'submit' && '📋 Concluir e Enviar para Aprovação'}
                  {etapaAction.type === 'approve' && '✅ Aprovar Etapa'}
                  {etapaAction.type === 'reject' && '❌ Rejeitar Etapa'}
                </h2>
                <p className="text-xs text-ber-gray mt-0.5">
                  {sequenciamento?.etapas.find(e => e.id === etapaAction.id)?.name ?? ''}
                </p>
              </div>
              <button onClick={() => setEtapaAction(null)} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-4 space-y-4">

              {/* ── INICIAR ── */}
              {etapaAction.type === 'start' && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Data real de início *</label>
                    <input type="date" value={rf.startDate} onChange={e => setRf(p => ({...p, startDate: e.target.value}))}
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Nº de operários</label>
                    <input type="number" min={0} value={rf.numOperarios} onChange={e => setRf(p => ({...p, numOperarios: e.target.value}))}
                      placeholder="Ex: 3"
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Fornecedor / equipe executando</label>
                    <input type="text" value={rf.fornecedor} onChange={e => setRf(p => ({...p, fornecedor: e.target.value}))}
                      placeholder="Ex: Equipe Hidráulica A, Fornecedor X"
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Condições iniciais / pré-requisitos atendidos</label>
                    <textarea rows={3} value={rf.condicoesIniciais} onChange={e => setRf(p => ({...p, condicoesIniciais: e.target.value}))}
                      placeholder="Descreva as condições iniciais e quais pré-requisitos foram verificados..."
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Foto do estado inicial (opcional)</label>
                    <div className="mt-1 flex items-center gap-3">
                      {rfFotoInicial && <img src={rfFotoInicial} alt="Inicial" className="h-16 w-16 rounded-lg object-cover border border-ber-gray/20" />}
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ber-gray/30 px-3 py-2 text-xs font-medium text-ber-gray hover:bg-ber-offwhite">
                        <Camera size={13} /> {uploadingRf ? 'Enviando...' : rfFotoInicial ? 'Trocar foto' : 'Adicionar foto'}
                        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploadingRf}
                          onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return;
                            setUploadingRf(true);
                            try {
                              const fd = new FormData(); fd.append('file', file);
                              const r = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                              setRfFotoInicial(r.data.data?.url ?? r.data.url);
                            } catch {} finally { setUploadingRf(false); }
                          }} />
                      </label>
                    </div>
                  </div>
                </div>
                {/* FVS Pré-execução inline */}
                {etapaFvsLoading && <p className="text-xs text-ber-gray animate-pulse">Carregando FVS...</p>}
                {etapaFvs && (() => {
                  const inicioItems = etapaFvs.items.filter(i => i.templateItem?.momento === 'inicio');
                  if (!inicioItems.length) return null;
                  const obrigTotal = inicioItems.filter(i => i.templateItem?.obrigatorio).length;
                  const obrigChecked = inicioItems.filter(i => i.templateItem?.obrigatorio && (i.checked || i.na)).length;
                  const grouped: Record<string, typeof inicioItems> = {};
                  inicioItems.forEach(i => { const s = i.templateItem?.secao ?? 'Geral'; (grouped[s] = grouped[s] ?? []).push(i); });
                  return (
                    <div className="rounded-lg border-2 border-amber-200 bg-amber-50/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-amber-800">📋 FVS Pré-execução — {etapaFvs.template?.code}</p>
                        <span className={`text-[10px] font-bold ${obrigChecked === obrigTotal ? 'text-green-600' : 'text-amber-700'}`}>{obrigChecked}/{obrigTotal}</span>
                      </div>
                      {Object.entries(grouped).map(([secao, items]) => (
                        <div key={secao}>
                          <p className="text-[9px] font-bold uppercase tracking-wide text-amber-600 mb-1">{secao}</p>
                          {items.map(item => (
                            <div key={item.id} className="flex items-start gap-2 py-0.5">
                              <input type="checkbox" checked={item.checked} disabled={item.na}
                                onChange={async () => {
                                  try {
                                    const r = await api.patch(`/obra-fvs/${etapaFvs.id}/items/${item.id}`, { checked: !item.checked });
                                    setEtapaFvs(prev => prev ? { ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, ...r.data.data } : i) } : null);
                                  } catch {}
                                }}
                                className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded accent-green-500 disabled:opacity-30" />
                              <span className={`flex-1 text-xs leading-snug ${item.na ? 'text-gray-400 line-through' : item.checked ? 'text-green-700 line-through' : 'text-ber-carbon'}`}>
                                {item.templateItem?.descricao}
                                {!item.templateItem?.obrigatorio && <span className="text-[9px] text-ber-gray/50 ml-1">(opcional)</span>}
                              </span>
                              <button type="button"
                                onClick={async () => {
                                  try {
                                    const r = await api.patch(`/obra-fvs/${etapaFvs.id}/items/${item.id}`, { na: !item.na });
                                    setEtapaFvs(prev => prev ? { ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, ...r.data.data } : i) } : null);
                                  } catch {}
                                }}
                                className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${item.na ? 'bg-gray-300 text-gray-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                                N/A
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div>
                  <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Observações (opcional)</label>
                  <textarea rows={2} value={etapaNotes} onChange={e => setEtapaNotes(e.target.value)} placeholder="Observações adicionais..."
                    className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                </div>
              </>)}

              {/* ── CONCLUIR (submit) ── */}
              {etapaAction.type === 'submit' && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Qtd. prevista</label>
                    <input type="text" value={rf.qtdPrevista} onChange={e => setRf(p => ({...p, qtdPrevista: e.target.value}))}
                      placeholder="Ex: 120m²"
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Qtd. executada *</label>
                    <input type="text" value={rf.qtdExecutada} onChange={e => setRf(p => ({...p, qtdExecutada: e.target.value}))}
                      placeholder="Ex: 118m²"
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                  </div>
                </div>

                {/* FVS Conclusão inline */}
                {etapaFvsLoading && <p className="text-xs text-ber-gray animate-pulse">Carregando FVS...</p>}
                {etapaFvs && (() => {
                  const conclusaoItems = etapaFvs.items.filter(i => i.templateItem?.momento === 'conclusao');
                  if (!conclusaoItems.length) return (
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${rf.fvsPreenchida ? 'border-green-400 bg-green-50' : 'border-ber-gray/30 bg-ber-offwhite/50'}`}>
                      <input type="checkbox" checked={rf.fvsPreenchida} onChange={e => setRf(p => ({...p, fvsPreenchida: e.target.checked}))} className="h-4 w-4 rounded accent-green-500" />
                      <div><p className="text-sm font-semibold text-ber-carbon">FVS preenchida ✓</p><p className="text-xs text-ber-gray">Sem itens de conclusão nesta FVS</p></div>
                    </label>
                  );
                  const obrigTotal = conclusaoItems.filter(i => i.templateItem?.obrigatorio).length;
                  const obrigChecked = conclusaoItems.filter(i => i.templateItem?.obrigatorio && (i.checked || i.na)).length;
                  const allDone = obrigChecked === obrigTotal;
                  const grouped: Record<string, typeof conclusaoItems> = {};
                  conclusaoItems.forEach(i => { const s = i.templateItem?.secao ?? 'Geral'; (grouped[s] = grouped[s] ?? []).push(i); });
                  // Auto-set fvsPreenchida based on checklist state
                  if (allDone && !rf.fvsPreenchida) setRf(p => ({...p, fvsPreenchida: true}));
                  if (!allDone && rf.fvsPreenchida) setRf(p => ({...p, fvsPreenchida: false}));
                  return (
                    <div className={`rounded-lg border-2 p-3 space-y-2 ${allDone ? 'border-green-400 bg-green-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-800">📋 FVS Conclusão — {etapaFvs.template?.code}</p>
                        <span className={`text-[10px] font-bold ${allDone ? 'text-green-600' : 'text-blue-700'}`}>{obrigChecked}/{obrigTotal} {allDone ? '✓' : ''}</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {Object.entries(grouped).map(([secao, items]) => (
                          <div key={secao}>
                            <p className="text-[9px] font-bold uppercase tracking-wide text-blue-600 mb-1">{secao}</p>
                            {items.map(item => (
                              <div key={item.id} className="flex items-start gap-2 py-0.5">
                                <input type="checkbox" checked={item.checked} disabled={item.na}
                                  onChange={async () => {
                                    try {
                                      const r = await api.patch(`/obra-fvs/${etapaFvs.id}/items/${item.id}`, { checked: !item.checked });
                                      setEtapaFvs(prev => prev ? { ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, ...r.data.data } : i) } : null);
                                    } catch {}
                                  }}
                                  className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded accent-green-500 disabled:opacity-30" />
                                <span className={`flex-1 text-xs leading-snug ${item.na ? 'text-gray-400 line-through' : item.checked ? 'text-green-700 line-through' : 'text-ber-carbon'}`}>
                                  {item.templateItem?.descricao}
                                  {!item.templateItem?.obrigatorio && <span className="text-[9px] text-ber-gray/50 ml-1">(opcional)</span>}
                                </span>
                                <button type="button"
                                  onClick={async () => {
                                    try {
                                      const r = await api.patch(`/obra-fvs/${etapaFvs.id}/items/${item.id}`, { na: !item.na });
                                      setEtapaFvs(prev => prev ? { ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, ...r.data.data } : i) } : null);
                                    } catch {}
                                  }}
                                  className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${item.na ? 'bg-gray-300 text-gray-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                                  N/A
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {!etapaFvs && !etapaFvsLoading && (
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${rf.fvsPreenchida ? 'border-green-400 bg-green-50' : 'border-ber-gray/30 bg-ber-offwhite/50'}`}>
                    <input type="checkbox" checked={rf.fvsPreenchida} onChange={e => setRf(p => ({...p, fvsPreenchida: e.target.checked}))} className="h-4 w-4 rounded accent-green-500" />
                    <div><p className="text-sm font-semibold text-ber-carbon">FVS preenchida ✓</p><p className="text-xs text-ber-gray">Ficha de Verificação de Serviço foi preenchida e assinada</p></div>
                  </label>
                )}

                {/* Não conformidades */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-ber-carbon">
                    <input type="checkbox" checked={rf.hasNaoConf} onChange={e => setRf(p => ({...p, hasNaoConf: e.target.checked}))} className="h-4 w-4 rounded accent-red-500" />
                    Houve não conformidades?
                  </label>
                  {rf.hasNaoConf && (
                    <textarea rows={3} value={rf.naoConformidades} onChange={e => setRf(p => ({...p, naoConformidades: e.target.value}))}
                      placeholder="Descreva as não conformidades encontradas..."
                      className="mt-2 w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none" />
                  )}
                </div>

                {/* Fotos de evidência */}
                <div>
                  <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">
                    Fotos de evidência <span className="text-red-500">* (mín. 1)</span>
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {rfFotosEv.map((url, i) => (
                      <div key={i} className="group relative">
                        <img src={url} alt={`Ev ${i+1}`} className="h-16 w-16 rounded-lg object-cover border border-ber-gray/20" />
                        <button type="button" onClick={() => setRfFotosEv(prev => prev.filter((_,j) => j !== i))}
                          className="absolute -right-1.5 -top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ber-gray/30 text-ber-gray/50 hover:border-ber-teal hover:text-ber-teal transition-colors">
                      <Camera size={16} />
                      <span className="text-[9px] mt-0.5">{uploadingRf ? '...' : '+ foto'}</span>
                      <input type="file" accept="image/*" multiple capture="environment" className="hidden" disabled={uploadingRf}
                        onChange={async e => {
                          const files = Array.from(e.target.files ?? []); if (!files.length) return;
                          setUploadingRf(true);
                          try {
                            for (const file of files) {
                              const fd = new FormData(); fd.append('file', file);
                              const r = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                              setRfFotosEv(prev => [...prev, r.data.data?.url ?? r.data.url]);
                            }
                          } catch {} finally { setUploadingRf(false); }
                        }} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Observações finais</label>
                  <textarea rows={3} value={rf.obsConclusao} onChange={e => setRf(p => ({...p, obsConclusao: e.target.value}))}
                    placeholder="Observações sobre a execução, pontos de atenção para o coordenador..."
                    className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                </div>
              </>)}

              {/* ── APROVAR ── */}
              {etapaAction.type === 'approve' && (
                <div>
                  <div className="mb-3 flex items-start gap-3 rounded-lg bg-green-50 p-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-sm font-semibold text-green-800">Confirmar aprovação desta etapa?</p>
                      <p className="text-xs text-green-700 mt-0.5">A etapa passará para status <strong>Aprovada</strong> e as dependentes serão desbloqueadas.</p>
                    </div>
                  </div>
                  <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Observações do aprovador (opcional)</label>
                  <textarea rows={3} value={rf.obsAprovador} onChange={e => setRf(p => ({...p, obsAprovador: e.target.value}))}
                    placeholder="Observações, ressalvas ou comentários para o registro..."
                    className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                </div>
              )}

              {/* ── REJEITAR ── */}
              {etapaAction.type === 'reject' && (
                <div>
                  <div className="mb-3 flex items-start gap-3 rounded-lg bg-red-50 p-3">
                    <span className="text-2xl">❌</span>
                    <div>
                      <p className="text-sm font-semibold text-red-800">Rejeitar esta etapa?</p>
                      <p className="text-xs text-red-700 mt-0.5">A etapa voltará para <strong>Em andamento</strong> para correção pelo gestor.</p>
                    </div>
                  </div>
                  <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Motivo da rejeição *</label>
                  <textarea rows={4} value={etapaNotes} onChange={e => setEtapaNotes(e.target.value)}
                    placeholder="Descreva o motivo da rejeição e o que precisa ser corrigido..."
                    className="mt-1 w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none" />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-ber-offwhite px-6 py-4 shrink-0">
              <button onClick={() => setEtapaAction(null)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
              <button
                onClick={handleEtapaAction}
                disabled={
                  etapaSubmitting ||
                  (etapaAction.type === 'submit' && rfFotosEv.length === 0) ||
                  (etapaAction.type === 'submit' && !rf.fvsPreenchida) ||
                  (etapaAction.type === 'reject' && !etapaNotes.trim())
                }
                className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition-colors ${
                  etapaAction.type === 'reject' ? 'bg-red-500 hover:bg-red-600' :
                  etapaAction.type === 'approve' ? 'bg-green-500 hover:bg-green-600' :
                  'bg-ber-carbon hover:bg-ber-black'
                }`}
              >
                {etapaSubmitting ? 'Salvando...' :
                  etapaAction.type === 'start' ? '🚀 Iniciar Etapa' :
                  etapaAction.type === 'submit' ? '📋 Enviar para Aprovação' :
                  etapaAction.type === 'approve' ? '✅ Aprovar Etapa' :
                  '❌ Rejeitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sequenciamento Template Modal ─── */}
      {showSeqModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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

        {/* ─── FVS Tab ─── */}
        {activeTab === 'fvs' && (() => {
          const FVS_STATUS: Record<string, { label: string; color: string }> = {
            pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-600' },
            inicio_preenchido: { label: 'Início preenchido', color: 'bg-blue-100 text-blue-700' },
            aguardando_gestor: { label: 'Aguardando gestor', color: 'bg-amber-100 text-amber-700' },
            aguardando_coord: { label: 'Aguardando coord.', color: 'bg-orange-100 text-orange-700' },
            aprovada: { label: 'Aprovada ✓', color: 'bg-green-100 text-green-700' },
            rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-700' },
          };
          const FILTERS = [
            { key: 'todos', label: 'Todos' },
            { key: 'pendente', label: 'Pendente' },
            { key: 'inicio_preenchido', label: 'Em preenchimento' },
            { key: 'aguardando_gestor', label: 'Ag. Gestor' },
            { key: 'aguardando_coord', label: 'Ag. Coord.' },
            { key: 'aprovada', label: 'Aprovadas' },
            { key: 'rejeitada', label: 'Rejeitadas' },
          ];
          const sortFvs = (list: typeof obraFvsList) => [...list].sort((a, b) => {
            const parseCode = (code: string) => {
              const m = code.match(/FVS_(\d+)([A-Z]?)/i);
              if (!m) return [0, ''];
              return [parseInt(m[1]), m[2] || ''];
            };
            const [na, sa] = parseCode(a.template?.code ?? '');
            const [nb, sb] = parseCode(b.template?.code ?? '');
            return na !== nb ? (na as number) - (nb as number) : (sa as string).localeCompare(sb as string);
          });
          const filtered = sortFvs(fvsFilter === 'todos' ? obraFvsList : obraFvsList.filter(f => f.status === fvsFilter));
          return (
            <div>
              {/* Header */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Fichas de Verificação de Serviço</h3>
                {isGestor && (
                  <button onClick={() => setCreateFvsModal(true)}
                    className="flex items-center gap-1.5 rounded-md bg-ber-carbon px-3 py-2 text-xs font-bold text-white hover:bg-ber-black">
                    + Nova FVS
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="mb-4 flex flex-wrap gap-2">
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => setFvsFilter(f.key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${fvsFilter === f.key ? 'bg-ber-carbon text-white' : 'bg-ber-offwhite text-ber-gray hover:bg-ber-offwhite/80'}`}>
                    {f.label} {f.key !== 'todos' ? `(${obraFvsList.filter(x => x.status === f.key).length})` : `(${obraFvsList.length})`}
                  </button>
                ))}
              </div>

              {/* Cards */}
              {filtered.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-ber-gray/20 p-12 text-center">
                  <p className="text-sm text-ber-gray/60">Nenhuma FVS {fvsFilter !== 'todos' ? 'com este filtro' : 'criada para esta obra'}.</p>
                  {isGestor && fvsFilter === 'todos' && (
                    <button onClick={() => setCreateFvsModal(true)} className="mt-3 text-sm font-semibold text-ber-teal hover:underline">
                      + Criar primeira FVS
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filtered.map(fvs => {
                    const total = fvs.items.length;
                    const checked = fvs.items.filter(i => i.checked || i.na).length;
                    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
                    const sc = FVS_STATUS[fvs.status] ?? { label: fvs.status, color: 'bg-gray-100 text-gray-500' };
                    // Cor de borda superior por bloco disciplinar
                    const BLOCO_ACCENT = [
                      '#6B7280', // 0 - cinza (geral)
                      '#3B82F6', // 1 - azul (estrutura)
                      '#8B5CF6', // 2 - roxo (elétrica bruta)
                      '#A855F7', // 3 - violeta (elétrica acabamento)
                      '#F97316', // 4 - laranja (cabeamento/hidráulica)
                      '#EAB308', // 5 - amarelo (sprinkler/SDAI)
                      '#10B981', // 6 - verde (drywall/forro)
                      '#5A7A7A', // 7 - teal BÈR (AC/revestimento)
                      '#B5B820', // 8 - oliva BÈR (marcenaria/pintura)
                      '#EF4444', // 9 - vermelho (entrega/comissionamento)
                    ];
                    // Cor da borda lateral esquerda por STATUS
                    const STATUS_ACCENT: Record<string, string> = {
                      pendente: '#D1D5DB',
                      inicio_preenchido: '#3B82F6',
                      aguardando_gestor: '#F97316',
                      aguardando_coord: '#A855F7',
                      aprovada: '#10B981',
                      rejeitada: '#EF4444',
                    };
                    const blocoAccent = BLOCO_ACCENT[fvs.template?.bloco ?? 0] ?? '#6B7280';
                    const statusAccent = STATUS_ACCENT[fvs.status] ?? '#D1D5DB';
                    const barColor = pct === 100 ? '#10B981' : pct > 0 ? '#5A7A7A' : '#E5E7EB';
                    return (
                      <button key={fvs.id} onClick={() => { setActiveFvs(fvs); setFvsModalOpen(true); }}
                        className="group rounded-xl bg-white p-4 text-left shadow-sm hover:shadow-md transition-all overflow-hidden"
                        style={{ borderLeft: `4px solid ${statusAccent}`, borderTop: `3px solid ${blocoAccent}`, border: `1px solid #e5e7eb`, borderLeftWidth: '4px', borderTopWidth: '3px', borderTopColor: blocoAccent, borderLeftColor: statusAccent }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: blocoAccent }}>{fvs.template?.code}</p>
                            <p className="mt-0.5 text-sm font-bold text-ber-carbon leading-tight">{fvs.template?.name ?? 'FVS'}</p>
                            {fvs.etapa && <p className="mt-0.5 text-xs text-ber-gray">↳ {fvs.etapa.name}</p>}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                        </div>
                        {/* Progress */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[10px] text-ber-gray/70 mb-1">
                            <span>{checked}/{total} itens</span>
                            <span className="font-bold" style={{ color: pct === 100 ? '#10B981' : 'inherit' }}>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[10px] text-ber-gray/60">{new Date(fvs.createdAt).toLocaleDateString('pt-BR')}</p>
                          <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: blocoAccent }}>Abrir →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

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
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
                <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
                <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
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
      {/* ─── BÈR Checklist Detail Modal ─── */}
      {clModalOpen && activeCl && (() => {
        const cl = activeCl;
        const isLocked = cl.status === 'concluido';
        const CL_STATUS_CFG: Record<string, { label: string; color: string }> = {
          nao_iniciado: { label: 'Não iniciado', color: 'bg-gray-100 text-gray-500' },
          em_preenchimento: { label: 'Em preenchimento', color: 'bg-blue-100 text-blue-700' },
          concluido: { label: 'Concluído ✓', color: 'bg-green-100 text-green-700' },
        };
        const sc = CL_STATUS_CFG[cl.status] ?? CL_STATUS_CFG.nao_iniciado;
        const isCl5 = cl.template?.code === 'CL_5';

        // Group items by secao+ambiente
        const grouped: Record<string, ObraBerClItem[]> = {};
        cl.items.forEach(i => {
          const key = i.ambiente ? `${i.templateItem?.secao ?? 'Geral'} · ${i.ambiente}` : (i.templateItem?.secao ?? 'Geral');
          (grouped[key] = grouped[key] ?? []).push(i);
        });

        const toggleItem = async (itemId: string, checked: boolean) => {
          if (isLocked) return;
          setClSubmitting(true);
          try {
            const r = await api.patch(`/obra-ber-checklists/${cl.id}/items/${itemId}`, { checked: !checked });
            const updated = { ...cl, items: cl.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i), status: r.data.data.status ?? cl.status };
            setActiveCl(updated as ObraBerChecklist);
            setBerChecklists(prev => prev.map(c => c.id === cl.id ? updated as ObraBerChecklist : c));
          } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
          finally { setClSubmitting(false); }
        };

        const uploadPhoto = async (itemId: string, file: File) => {
          setClSubmitting(true);
          try {
            const fd = new FormData(); fd.append('file', file);
            const up = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            const url = up.data.data?.url ?? up.data.url;
            const r = await api.patch(`/obra-ber-checklists/${cl.id}/items/${itemId}`, { fotoUrl: url });
            const updated = { ...cl, items: cl.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
            setActiveCl(updated as ObraBerChecklist);
            setBerChecklists(prev => prev.map(c => c.id === cl.id ? updated as ObraBerChecklist : c));
          } catch (e: any) { alert('Erro no upload'); }
          finally { setClSubmitting(false); }
        };

        const totalObrig = cl.items.filter(i => i.templateItem?.fotoObrigatoria || true).length;
        const checkedCount = cl.items.filter(i => i.checked).length;
        const pct = cl.items.length > 0 ? Math.round(checkedCount / cl.items.length * 100) : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-3">
            <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-2xl md:rounded-xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between border-b border-ber-offwhite px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray/60">{cl.template?.code}</p>
                    {cl.template?.recorrente && <span className="text-[10px] font-bold text-ber-teal">Visita {cl.visitaNumero}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                  </div>
                  <h2 className="mt-0.5 text-base font-black text-ber-carbon leading-tight">{cl.template?.name}</h2>
                  <p className="text-xs text-ber-gray mt-0.5">{checkedCount}/{cl.items.length} itens · {pct}%</p>
                </div>
                <button onClick={() => setClModalOpen(false)} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={18} /></button>
              </div>

              {/* Progress */}
              <div className="h-1 w-full bg-gray-100 shrink-0">
                <div className="h-full bg-ber-teal transition-all" style={{ width: `${pct}%` }} />
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {/* CL5: add ambiente */}
                {isCl5 && !isLocked && (
                  <div className="flex gap-2">
                    <input value={newAmbiente} onChange={e => setNewAmbiente(e.target.value)}
                      placeholder="Nome do ambiente (ex: Sala de Reuniões)"
                      className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:outline-none" />
                    <button disabled={!newAmbiente.trim() || clSubmitting}
                      onClick={async () => {
                        try {
                          const r = await api.post(`/obra-ber-checklists/${cl.id}/ambientes`, { nome: newAmbiente.trim() });
                          const updated = r.data.data.checklist as ObraBerChecklist;
                          setActiveCl(updated);
                          setBerChecklists(prev => prev.map(c => c.id === cl.id ? updated : c));
                          setNewAmbiente('');
                        } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
                      }}
                      className="rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-bold text-white hover:bg-ber-black disabled:opacity-50">
                      + Ambiente
                    </button>
                  </div>
                )}

                {/* Checklist items grouped by section */}
                {Object.entries(grouped).map(([secao, items]) => (
                  <div key={secao}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray">{secao}</p>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.id} className={`rounded-lg border p-3 transition-colors ${item.checked ? 'border-green-200 bg-green-50' : 'border-ber-gray/10 bg-ber-offwhite/40'}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={item.checked} disabled={isLocked || clSubmitting}
                              onChange={() => toggleItem(item.id, item.checked)}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-green-500 disabled:opacity-40" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${item.checked ? 'text-green-700 line-through' : 'text-ber-carbon'}`}>
                                {item.templateItem?.fotoObrigatoria && <span className="mr-1 text-amber-500">📷</span>}
                                {item.templateItem?.descricao}
                              </p>
                              {/* Photo */}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {item.fotoUrl && (
                                  <a href={item.fotoUrl} target="_blank" rel="noreferrer">
                                    <img src={item.fotoUrl} alt="foto" className="h-12 w-12 rounded object-cover border border-ber-gray/15 hover:opacity-80" />
                                  </a>
                                )}
                                {!isLocked && item.templateItem?.fotoObrigatoria && (
                                  <label className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${item.fotoUrl ? 'border-green-300 text-green-600 hover:bg-green-50' : 'border-amber-300 text-amber-600 hover:bg-amber-50'}`}>
                                    <Camera size={11} />
                                    {item.fotoUrl ? 'Trocar foto' : 'Foto obrigatória'}
                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(item.id, f); }} />
                                  </label>
                                )}
                                {!isLocked && !item.templateItem?.fotoObrigatoria && (
                                  <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-ber-gray/20 px-2 py-1 text-[10px] text-ber-gray/60 hover:bg-ber-offwhite">
                                    <Camera size={11} /> {item.fotoUrl ? 'Trocar' : '+ Foto'}
                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(item.id, f); }} />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-ber-offwhite px-6 py-4 flex justify-end gap-3">
                <button onClick={() => setClModalOpen(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Fechar</button>
                {!isLocked && (
                  <button disabled={clSubmitting}
                    onClick={async () => {
                      setClSubmitting(true);
                      try {
                        const r = await api.post(`/obra-ber-checklists/${cl.id}/submit`);
                        const updated = r.data.data as ObraBerChecklist;
                        setActiveCl(updated);
                        setBerChecklists(prev => prev.map(c => c.id === cl.id ? updated : c));
                      } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro ao concluir'); }
                      finally { setClSubmitting(false); }
                    }}
                    className="rounded-md bg-green-500 px-5 py-2 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">
                    ✅ Concluir Checklist
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── FVS Detail Modal ─── */}
      {fvsModalOpen && activeFvs && (() => {
        const fvs = activeFvs;
        const FVS_STATUS: Record<string, { label: string; color: string }> = {
          pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-600' },
          inicio_preenchido: { label: 'Início preenchido', color: 'bg-blue-100 text-blue-700' },
          aguardando_gestor: { label: 'Aguardando gestor', color: 'bg-amber-100 text-amber-700' },
          aguardando_coord: { label: 'Aguardando coord.', color: 'bg-orange-100 text-orange-700' },
          aprovada: { label: 'Aprovada ✓', color: 'bg-green-100 text-green-700' },
          rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-700' },
        };
        const sc = FVS_STATUS[fvs.status] ?? { label: fvs.status, color: 'bg-gray-100 text-gray-500' };
        const isLocked = ['aprovada', 'rejeitada'].includes(fvs.status);

        const inicioItems = fvs.items.filter(i => i.templateItem?.momento === 'inicio');
        const conclusaoItems = fvs.items.filter(i => i.templateItem?.momento === 'conclusao');
        const inicioObrigTotal = inicioItems.filter(i => i.templateItem?.obrigatorio).length;
        const inicioObrigChecked = inicioItems.filter(i => i.templateItem?.obrigatorio && (i.checked || i.na)).length;
        const conclusaoObrigTotal = conclusaoItems.filter(i => i.templateItem?.obrigatorio).length;
        const conclusaoObrigChecked = conclusaoItems.filter(i => i.templateItem?.obrigatorio && (i.checked || i.na)).length;

        const bySecao = (items: ObraFvsItemType[]) => {
          const map: Record<string, ObraFvsItemType[]> = {};
          items.forEach(i => { const s = i.templateItem?.secao ?? 'Geral'; (map[s] = map[s] ?? []).push(i); });
          return map;
        };

        const toggleItem = async (itemId: string, field: 'checked' | 'na') => {
          if (isLocked) return;
          const item = fvs.items.find(i => i.id === itemId);
          if (!item) return;
          setFvsSubmitting(true);
          try {
            const body = field === 'na'
              ? { na: !item.na }
              : { checked: !item.checked };
            const r = await api.patch(`/obra-fvs/${fvs.id}/items/${itemId}`, body);
            const updated = { ...fvs, items: fvs.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
            setActiveFvs(updated);
            setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
          } catch (e: any) {
            alert(e?.response?.data?.message ?? 'Erro ao salvar');
          } finally { setFvsSubmitting(false); }
        };

        const renderSection = (sectionItems: ObraFvsItemType[], momento: string) => {
          const grouped = bySecao(sectionItems);
          return Object.entries(grouped).map(([secao, items]) => (
            <div key={secao} className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray">{secao}</p>
              <div className="space-y-1.5">
                {items.map(item => (
                  <div key={item.id} className={`flex items-start gap-2 rounded-lg p-2.5 transition-colors ${
                    item.na ? 'bg-gray-50' : item.checked ? 'bg-green-50' : 'hover:bg-ber-offwhite/60'
                  }`}>
                    {/* Checkbox */}
                    <input type="checkbox" checked={item.checked} disabled={isLocked || fvsSubmitting || item.na}
                      onChange={() => toggleItem(item.id, 'checked')}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-green-500 disabled:cursor-not-allowed disabled:opacity-40" />
                    {/* Description */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${item.na ? 'text-gray-400 line-through' : item.checked ? 'text-green-700 line-through' : 'text-ber-carbon'}`}>
                        {item.templateItem?.descricao}
                        {item.templateItem?.obrigatorio === false && <span className="ml-1 text-[10px] text-ber-gray/40">(opcional)</span>}
                      </p>
                    </div>
                    {/* N/A toggle */}
                    {!isLocked && (
                      <button type="button" disabled={fvsSubmitting}
                        onClick={() => toggleItem(item.id, 'na')}
                        title={item.na ? 'Desmarcar N/A' : 'Marcar como Não Aplicável'}
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                          item.na
                            ? 'bg-gray-300 text-gray-600'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}>
                        N/A
                      </button>
                    )}
                    {isLocked && item.na && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-500">N/A</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ));
        };

        const doAction = async (type: 'submit-inicio' | 'submit-conclusao' | 'approve-gestor' | 'approve-coord' | 'reject', reason?: string) => {
          setFvsSubmitting(true);
          try {
            const body = type === 'reject' ? { reason } : {};
            const r = await api.post(`/obra-fvs/${fvs.id}/${type}`, body);
            const updated = r.data.data;
            setActiveFvs(updated);
            setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
          } catch (e: any) {
            alert(e?.response?.data?.message ?? 'Erro');
          } finally { setFvsSubmitting(false); }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-3">
            <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-2xl md:rounded-xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between border-b border-ber-offwhite px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray/60">{fvs.template?.code}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                  </div>
                  <h2 className="mt-0.5 text-base font-black text-ber-carbon">{fvs.template?.name}</h2>
                  {fvs.etapa && <p className="text-xs text-ber-gray">↳ {fvs.etapa.name}</p>}
                </div>
                <button onClick={() => setFvsModalOpen(false)} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={18} /></button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Seção Início */}
                {inicioItems.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-ber-carbon">🟡 Pré-execução (Início)</h3>
                      <span className={`text-xs font-semibold ${inicioObrigChecked === inicioObrigTotal ? 'text-green-600' : 'text-amber-600'}`}>
                        {inicioObrigChecked}/{inicioObrigTotal} obrigatórios
                      </span>
                    </div>
                    {renderSection(inicioItems, 'inicio')}
                  </div>
                )}

                {/* Seção Conclusão */}
                {conclusaoItems.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-ber-carbon">🔵 Execução e Conclusão</h3>
                      <span className={`text-xs font-semibold ${conclusaoObrigChecked === conclusaoObrigTotal ? 'text-green-600' : 'text-blue-600'}`}>
                        {conclusaoObrigChecked}/{conclusaoObrigTotal} obrigatórios
                      </span>
                    </div>
                    {renderSection(conclusaoItems, 'conclusao')}
                  </div>
                )}
              </div>

              {/* Footer — actions */}
              <div className="shrink-0 border-t border-ber-offwhite px-6 py-4">
                {fvsSubmitting && <p className="mb-2 text-center text-xs text-ber-gray">Salvando...</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={() => setFvsModalOpen(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Fechar</button>

                  {/* submit-inicio */}
                  {fvs.status === 'pendente' && inicioItems.length > 0 && (
                    <button disabled={fvsSubmitting || inicioObrigChecked < inicioObrigTotal}
                      onClick={() => doAction('submit-inicio')}
                      className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50">
                      ✅ Confirmar Início
                    </button>
                  )}

                  {/* submit-conclusao */}
                  {['pendente', 'inicio_preenchido'].includes(fvs.status) && conclusaoItems.length > 0 && (
                    <button disabled={fvsSubmitting || conclusaoObrigChecked < conclusaoObrigTotal}
                      onClick={() => doAction('submit-conclusao')}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
                      📋 Enviar para Aprovação
                    </button>
                  )}

                  {/* approve-gestor */}
                  {fvs.status === 'aguardando_gestor' && isGestor && (
                    <>
                      <button disabled={fvsSubmitting}
                        onClick={() => {
                          const r = prompt('Motivo da rejeição:');
                          if (r) doAction('reject', r);
                        }}
                        className="rounded-md bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                        ❌ Rejeitar
                      </button>
                      <button disabled={fvsSubmitting} onClick={() => doAction('approve-gestor')}
                        className="rounded-md bg-green-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-600 disabled:opacity-50">
                        ✅ Aprovar (Gestor)
                      </button>
                    </>
                  )}

                  {/* approve-coord */}
                  {fvs.status === 'aguardando_coord' && (user?.role === 'coordenacao' || user?.role === 'diretoria') && (
                    <>
                      <button disabled={fvsSubmitting}
                        onClick={() => {
                          const r = prompt('Motivo da rejeição:');
                          if (r) doAction('reject', r);
                        }}
                        className="rounded-md bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                        ❌ Rejeitar
                      </button>
                      <button disabled={fvsSubmitting} onClick={() => doAction('approve-coord')}
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50">
                        ✅ Aprovação Final
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Create FVS Modal ─── */}
      {createFvsModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-3">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-xl bg-white shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
              <h2 className="text-base font-black text-ber-carbon">Nova FVS</h2>
              <button onClick={() => setCreateFvsModal(false)} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Template FVS *</label>
                <select value={createFvsTemplateId} onChange={e => setCreateFvsTemplateId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:outline-none">
                  <option value="">Selecionar template...</option>
                  {fvsTemplates.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Etapa da obra</label>
                <select value={createFvsEtapaId} onChange={e => setCreateFvsEtapaId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:outline-none">
                  <option value="">Sem vínculo com etapa</option>
                  {sequenciamento?.etapas?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-ber-offwhite px-6 py-4">
              <button onClick={() => setCreateFvsModal(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
              <button disabled={!createFvsTemplateId}
                onClick={async () => {
                  if (!createFvsTemplateId) return;
                  const etapaId = createFvsEtapaId || (sequenciamento?.etapas?.[0]?.id ?? '');
                  try {
                    const r = await api.post(`/obras/${params.id}/etapas/${etapaId}/fvs`, { templateId: createFvsTemplateId });
                    setObraFvsList(prev => [r.data.data, ...prev]);
                    setActiveFvs(r.data.data);
                    setFvsModalOpen(true);
                    setCreateFvsModal(false);
                  } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
                }}
                className="rounded-md bg-ber-carbon px-5 py-2 text-sm font-bold text-white hover:bg-ber-black disabled:opacity-50">
                Criar FVS
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
