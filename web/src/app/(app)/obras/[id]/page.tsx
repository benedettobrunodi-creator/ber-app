'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Plus, Calendar, User, ChevronDown, X, ClipboardCheck, Tent, XCircle, Lock, Clock, Pencil, ChevronUp, Trash2, Camera, Image as ImageIcon, ChevronRight, Upload, RefreshCw } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import CapaObra from '@/components/obras/CapaObra';
import RecebimentoTab from '@/components/obras/RecebimentoTab';
import DiarioTab from '@/components/obras/DiarioTab';
import RelatorioTab from '@/components/obras/RelatorioTab';
import ObraInfoModal from '@/components/obras/ObraInfoModal';


type ObraStatus = 'nao_iniciada' | 'planejamento' | 'em_andamento' | 'pos_obra' | 'pausada' | 'concluida';
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
  coordinator: { id: string; name: string; avatarUrl: string | null } | null;
  members: { user: { id: string; name: string; role: string; avatarUrl: string | null }; joinedAt: string }[];
  _count: { tasks: number; photos: number };
  orcamentoId: string | null;
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
  fotoObrigatoria?: boolean; sourceItCode?: string | null; responsavelArea?: string | null;
}
interface ObraFvsItemType {
  id: string; momento: string; descricao: string | null; checked: boolean; na: boolean; observacao: string | null; fotoUrl: string | null; filledAt: string | null;
  dataLimite?: string | null;
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
  nao_iniciada: { label: 'Não iniciada', badge: 'bg-ber-gray/10 text-ber-gray/70', selectBorder: 'border-ber-gray focus:ring-ber-gray' },
  planejamento: { label: 'Pré Obra - Planejamento', badge: 'bg-ber-gray/15 text-ber-gray', selectBorder: 'border-ber-gray focus:ring-ber-gray' },
  em_andamento: { label: 'Em andamento', badge: 'bg-ber-teal/15 text-ber-teal', selectBorder: 'border-ber-teal focus:ring-ber-teal' },
  pos_obra: { label: 'Pós Obra', badge: 'bg-ber-olive/10 text-ber-olive/80', selectBorder: 'border-ber-olive focus:ring-ber-olive' },
  pausada: { label: 'Pausada', badge: 'bg-amber-100 text-amber-700', selectBorder: 'border-amber-400 focus:ring-amber-400' },
  concluida: { label: 'Concluída', badge: 'bg-ber-olive/15 text-ber-olive', selectBorder: 'border-ber-olive focus:ring-ber-olive' },
};

type TabKey = 'capa' | 'equipe' | 'recebimento' | 'canteiro' | 'fvs' | 'kanban' | 'cronograma' | 'diario' | 'relatorios';

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

// ─── Kanban DnD components ────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<string, { text: string; className: string }> = {
  low:    { text: 'Baixa',   className: 'text-ber-gray' },
  medium: { text: 'Média',   className: 'text-ber-teal' },
  high:   { text: 'Alta',    className: 'text-amber-500' },
  urgent: { text: 'Urgente', className: 'text-red-600 font-bold' },
};
const PRIORITY_STYLE: Record<string, string> = {
  low:    'border-l-gray-200',
  medium: 'border-l-ber-teal/50',
  high:   'border-l-amber-400',
  urgent: 'border-l-red-500',
};
const KANBAN_COLUMNS = [
  { key: 'todo',        label: 'A fazer' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'review',      label: 'Revisão' },
  { key: 'done',        label: 'Concluído' },
];

function KanbanCard({ task, ghost = false }: { task: Task; ghost?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const pCfg = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL.medium;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-md border-l-[3px] bg-white p-3 cursor-grab active:cursor-grabbing select-none transition-shadow ${PRIORITY_STYLE[task.priority]} ${isDragging || ghost ? 'opacity-40 shadow-none' : 'shadow-sm hover:shadow-md'}`}
    >
      <p className="text-sm font-medium text-ber-carbon">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ber-gray">
        <span className={`font-semibold ${pCfg.className}`}>{pCfg.text}</span>
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
}

function KanbanCardOverlay({ task }: { task: Task }) {
  const pCfg = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL.medium;
  return (
    <div className={`rounded-md border-l-[3px] bg-white p-3 shadow-xl cursor-grabbing select-none ${PRIORITY_STYLE[task.priority]}`}>
      <p className="text-sm font-medium text-ber-carbon">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ber-gray">
        <span className={`font-semibold ${pCfg.className}`}>{pCfg.text}</span>
      </div>
    </div>
  );
}

function KanbanColumn({ col, tasks, draggingId }: { col: { key: string; label: string }; tasks: Task[]; draggingId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-3 transition-colors ${isOver ? 'bg-ber-teal/10 ring-2 ring-ber-teal/30' : 'bg-white/60'}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ber-gray">{col.label}</h3>
        <span className="rounded-full bg-ber-gray/10 px-2 py-0.5 text-xs font-semibold text-ber-gray">{tasks.length}</span>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} ghost={task.id === draggingId} />
        ))}
        {tasks.length === 0 && !isOver && (
          <p className="py-4 text-center text-xs text-ber-gray/40">Sem tarefas</p>
        )}
      </div>
    </div>
  );
}

// ─── End Kanban DnD components ────────────────────────────────────────────────

export default function ObraDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [obra, setObra] = useState<ObraDetail | null>(null);
  const [orcamentoCtx, setOrcamentoCtx] = useState<{ numero: string; status: string; oportunidade: { titulo: string } | null } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  // 'cockpit' aceito como alias legado — links e bookmarks antigos caem na Capa
  const tabParam = searchParams.get('tab');
  const initialTab = ((tabParam === 'cockpit' ? 'capa' : tabParam) as TabKey) || 'capa';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', assignedTo: '', priority: 'medium' as TaskPriority, dueDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [kanbanDragId, setKanbanDragId] = useState<string | null>(null);

  // Cronograma state
  type CronogramaOverride = { pct?: number; inicioRealizado?: string | null; fimRealizado?: string | null; observacao?: string };
  const [cronograma, setCronograma] = useState<{
    id: string; fileUrl: string; fileName: string;
    parsedAt: string | null; parsedData: {
      progressoGeral: number;
      tarefas: { wbs: string; nome: string; inicio: string | null; fim: string | null; duracaoDias: number | null; percentualConcluido: number; ehResumo: boolean; nivel: number }[];
    } | null;
    overrides: Record<string, CronogramaOverride> | null;
    progressPct: number | null;
  } | null>(null);
  const [cronogramaLoading, setCronogramaLoading] = useState(false);
  const [cronogramaUploading, setCronogramaUploading] = useState(false);
  const [cronogramaParsing, setCronogramaParsing] = useState(false);
  const [cronogramaSyncing, setCronogramaSyncing] = useState(false);
  const [cronogramaSyncResult, setCronogramaSyncResult] = useState<{ created: number; updated: number; progressoGeral: number } | null>(null);
  const [cronogramaCollapsed, setCronogramaCollapsed] = useState<Set<string>>(new Set());
  const [cronogramaGerandoCurvaS, setCronogramaGerandoCurvaS] = useState(false);
  const [relatorioTabKey, setRelatorioTabKey] = useState(0);
  const cronogramaInputRef = useRef<HTMLInputElement>(null);

  // Checklists state
  // Fotos
  const imgRef = useRef<HTMLImageElement>(null);

  // BÈR Checklists
  const [berChecklists, setBerChecklists] = useState<ObraBerChecklist[]>([]);
  const [berClTemplates, setBerClTemplates] = useState<BerClTemplate[]>([]);
  const [activeCl, setActiveCl] = useState<ObraBerChecklist | null>(null);
  const [clModalOpen, setClModalOpen] = useState(false);
  const [clSubmitting, setClSubmitting] = useState(false);

  // FVS
  const [obraFvsList, setObraFvsList] = useState<ObraFvs[]>([]);
  // Avanço do último relatório semanal — define qual fase do Passo a Passo está valendo
  const [avancoObra, setAvancoObra] = useState<number | null>(null);
  // Fase do Sequenciamento — leitura do cronograma + correção manual (02/09/26)
  interface FaseSeq {
    faseEfetiva: string | null;
    origem: 'manual' | 'cronograma' | 'relatorio' | null;
    faseManual: string | null;
    pctCronograma: number | null;
    pctCronogramaEm: string | null;
    pctRelatorio: number | null;
    faseCronograma: string | null;
    faseRelatorio: string | null;
    divergente: boolean;
  }
  const [faseSeq, setFaseSeq] = useState<FaseSeq | null>(null);
  const [faseSeqBusy, setFaseSeqBusy] = useState(false);
  const fetchFaseSeq = async () => {
    try {
      const r = await api.get(`/obras/${params.id}/fase-seq`);
      setFaseSeq(r.data.data);
    } catch { /* opcional — sem fase-seq a trilha usa o fallback antigo */ }
  };
  const setFaseManual = async (fase: string | null) => {
    setFaseSeqBusy(true);
    try {
      const r = await api.put(`/obras/${params.id}/fase-seq`, { faseManual: fase });
      setFaseSeq(r.data.data);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Erro ao salvar fase');
    } finally { setFaseSeqBusy(false); }
  };
  const relerCronogramaSeq = async () => {
    setFaseSeqBusy(true);
    try {
      const r = await api.post(`/obras/${params.id}/fase-seq/reler`);
      setFaseSeq(r.data.data);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Leitura do cronograma falhou — tente de novo em instantes');
    } finally { setFaseSeqBusy(false); }
  };
  const [fvsFilter, setFvsFilter] = useState<string>('todos');
  const [activeFvs, setActiveFvs] = useState<ObraFvs | null>(null);
  // Fases abertas na trilha. Bruno pediu que várias possam ficar abertas juntas.
  const [expandedFvs, setExpandedFvs] = useState<Set<string>>(new Set());
  const [fvsSubmitting, setFvsSubmitting] = useState(false);
  const [fvsViewMode, setFvsViewMode] = useState<'lista' | 'card'>(() => {
    if (typeof window === 'undefined') return 'lista';
    return (localStorage.getItem('ber_fvs_view_mode') as 'lista' | 'card') || 'lista';
  });
  const setFvsViewModePersist = (mode: 'lista' | 'card') => {
    setFvsViewMode(mode);
    try { localStorage.setItem('ber_fvs_view_mode', mode); } catch {}
  };
  const [fvsTemplates, setFvsTemplates] = useState<FvsTemplateType[]>([]);
  const [createFvsModal, setCreateFvsModal] = useState(false);
  const [createFvsTemplateId, setCreateFvsTemplateId] = useState('');

  const [addFvsItemOpen, setAddFvsItemOpen] = useState(false);
  const [addFvsItemDesc, setAddFvsItemDesc] = useState('');
  const [addFvsItemMomento, setAddFvsItemMomento] = useState<'inicio' | 'conclusao'>('conclusao');
  const [fvsResetConfirm, setFvsResetConfirm] = useState(false);

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

  // Sensores de drag-and-drop — usados pelo kanban de tarefas
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Equipe state
  const [newAmbiente, setNewAmbiente] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberRole, setMemberRole] = useState('membro');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const canManageMembers = user?.role ? ['socio', 'diretoria', 'coordenacao'].includes(user.role) : false;

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

  async function fetchData() {
    setLoading(true);
    try {
      const [obraRes, tasksRes, checklistsRes, canteiroRes] = await Promise.all([
        api.get(`/obras/${params.id}`),
        api.get(`/obras/${params.id}/tasks`, { params: { limit: 200 } }),
        api.get(`/obras/${params.id}/checklists`),
        api.get(`/obras/${params.id}/canteiro`),
      ]);
      setObra(obraRes.data.data);
      const obraData = obraRes.data.data;
      if (obraData?.orcamentoId) {
        api.get(`/crm/orcamentos/${obraData.orcamentoId}/contexto`).then(async (ctx) => {
          const oport = ctx.data.oportunidade;
          const orc = await api.get(`/orcamentos/${obraData.orcamentoId}`).catch(() => null);
          setOrcamentoCtx({ numero: orc?.data?.numero ?? obraData.orcamentoId, status: orc?.data?.status ?? '', oportunidade: oport ? { titulo: oport.titulo } : null });
        }).catch(() => {});
      }
      setTasks(tasksRes.data.data);
      setChecklists(checklistsRes.data.data);
      setCanteiroChecklists(canteiroRes.data.data);
      const fvsRes = await api.get(`/obras/${params.id}/fvs`).catch(() => ({ data: { data: [] } }));
      setObraFvsList(fvsRes.data.data ?? []);
      api.get(`/obras/${params.id}/relatorios`).then(r => {
        const lista = r.data?.data ?? [];
        const ultimo = [...lista].sort((a: { numero: number }, b: { numero: number }) => b.numero - a.numero)[0];
        setAvancoObra(ultimo ? Number(ultimo.avancoPct) : null);
      }).catch(() => {});
      fetchFaseSeq();
      const tmplRes = await api.get('/fvs-templates').catch(() => ({ data: { data: [] } }));
      setFvsTemplates(tmplRes.data.data ?? []);

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
    setCronogramaLoading(true);
    api.get(`/obras/${params.id}/cronograma`)
      .then(r => setCronograma(r.data.data))
      .catch(() => {})
      .finally(() => setCronogramaLoading(false));
  }, [params.id]);

  async function handleCronogramaUpload(file: File) {
    setCronogramaUploading(true);
    setCronogramaSyncResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post(`/obras/${params.id}/cronograma/upload`, form);
      setCronograma(r.data.data);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Erro no upload');
    } finally {
      setCronogramaUploading(false);
    }
  }

  async function handleCronogramaParse() {
    setCronogramaParsing(true);
    setCronogramaSyncResult(null);
    try {
      const r = await api.post(`/obras/${params.id}/cronograma/parse`);
      setCronograma(r.data.data);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Erro ao processar');
    } finally {
      setCronogramaParsing(false);
    }
  }

  async function handleGerarCurvaS() {
    if (!cronograma?.parsedData) return;
    setCronogramaGerandoCurvaS(true);
    try {
      const tarefas = cronograma.parsedData.tarefas;
      const overrides = cronograma.overrides ?? {};
      const folhas = tarefas.filter(t => !t.ehResumo && (t.duracaoDias ?? 0) > 0 && t.inicio && t.fim);
      if (!folhas.length) { alert('Sem tarefas com cronograma para gerar Curva S.'); return; }
      const totalDias = folhas.reduce((s, t) => s + (t.duracaoDias ?? 0), 0);
      if (!totalDias) return;
      const raiz = tarefas.find(t => t.ehResumo && t.inicio && t.fim);
      if (!raiz?.inicio || !raiz?.fim) { alert('Tarefa-raiz sem datas. Processe o cronograma com IA primeiro.'); return; }
      // planejado uses linear time within root task span — matches cockpit "% planejado"
      // (task-weighted approach gives wrong results when parsedData covers only part of project)
      const raizStartMs = new Date(raiz.inicio + 'T00:00:00').getTime();
      const raizEndMs   = new Date(raiz.fim   + 'T00:00:00').getTime();
      const raizSpan    = raizEndMs - raizStartMs;
      const projStart   = new Date(raiz.inicio + 'T00:00:00');
      const loopEnd     = new Date(raiz.fim    + 'T00:00:00');
      const today       = new Date(); today.setHours(0, 0, 0, 0);
      // realizado = same source as cockpit: cronograma.progressPct ?? obra.progressPercent
      const currentPct = cronograma.progressPct ?? obra?.progressPercent ??
        Math.round(
          folhas.reduce((s, t) => {
            const key = t.wbs || t.nome;
            const ov = overrides[key];
            const pct = ov?.pct !== undefined ? ov.pct : t.percentualConcluido;
            return s + (t.duracaoDias ?? 0) * (pct as number) / 100;
          }, 0) / totalDias * 100
        );
      // planTodayPct via same linear formula — used to scale past realized proportionally
      const planTodayPct = raizSpan > 0
        ? Math.min(100, Math.max(0, Math.round((today.getTime() - raizStartMs) / raizSpan * 1000) / 10))
        : 0;
      // snap start to Monday before projStart
      const firstDay = new Date(projStart);
      const dow = firstDay.getDay();
      firstDay.setDate(firstDay.getDate() - (dow === 0 ? 6 : dow - 1));
      const pontos: { semana: string; planejadoPct: number | null; realizadoPct: number | null }[] = [];
      let weekStart = new Date(firstDay);
      while (weekStart <= loopEnd) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59);
        const wEnd = weekEnd.getTime();
        // planejado = linear elapsed within root task span
        const planejadoPct = raizSpan > 0
          ? Math.min(100, Math.max(0, Math.round((wEnd - raizStartMs) / raizSpan * 1000) / 10))
          : 0;
        const semanaKey = weekStart.toISOString().slice(0, 10);
        const isCurrentWeek = weekStart <= today && today <= weekEnd;
        const isPast = weekEnd.getTime() < today.getTime();
        let realizadoPct: number | null;
        if (isCurrentWeek) {
          realizadoPct = currentPct;
        } else if (isPast && planTodayPct > 0) {
          // proportional scaling: realizado_semanaX = planejado_semanaX × (realizado_hoje / planejado_hoje)
          realizadoPct = Math.round(planejadoPct * currentPct / planTodayPct * 10) / 10;
        } else {
          realizadoPct = null;
        }
        pontos.push({ semana: semanaKey, planejadoPct, realizadoPct });
        weekStart = new Date(weekStart); weekStart.setDate(weekStart.getDate() + 7);
      }
      await api.put(`/obras/${params.id}/relatorios/curva-s`, { pontos });
      setRelatorioTabKey(k => k + 1);
      setActiveTab('relatorios');
      alert(`Curva S gerada com ${pontos.length} semanas.`);
    } catch { alert('Erro ao gerar Curva S.'); }
    finally { setCronogramaGerandoCurvaS(false); }
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
      await api.patch(`/obras/${params.id}/status`, { status: newStatus });
      setObra((prev) => prev ? { ...prev, status: newStatus } : prev);
    } catch {
      /* handled by interceptor */
    } finally {
      setUpdatingStatus(false);
    }
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
      // Lista leve liberada a todos os autenticados. Antes usava /users (admin-only),
      // que dava 403 pra coordenação/gestão e deixava a lista vazia sem avisar.
      const res = await api.get('/users/responsaveis');
      setAllUsers(res.data.data ?? res.data);
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Não consegui carregar a lista de colaboradores. Tente novamente.');
    } finally { setLoadingUsers(false); }
  }

  async function handleAddMember() {
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      await api.post(`/obras/${params.id}/members`, { userId: selectedUserId, role: memberRole });
      setShowAddMemberModal(false);
      fetchData();
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Não consegui adicionar o membro. Verifique sua permissão e tente novamente.');
    } finally { setAddingMember(false); }
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

  const isGestor = user?.role ? ['gestor', 'coordenacao', 'diretoria'].includes(user.role) : false;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-sm text-ber-gray">Carregando...</div>;
  }

  if (!obra) {
    return <div className="text-sm text-ber-gray">Obra não encontrada.</div>;
  }

  const statusCfg = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;

  // Abas da obra agrupadas pelo ciclo de vida (com rótulo de grupo, sem emojis).
  // type 'tab' = aba interna (activeTab); type 'link' = página dedicada (rota relativa a /obras/:id).
  type ObraTab =
    | { type: 'tab'; key: TabKey; label: string }
    | { type: 'link'; href: string; label: string };
  // Reorganizado 27/08/26 (decisão do Bruno): ciclo de vida da obra —
  // Cockpit → Pré-Obra → Durante → Pós-Obra. "Relatórios vai pra durante".
  const TAB_GROUPS: { grupo: string; tabs: ObraTab[] }[] = [
    { grupo: 'Cockpit', tabs: [
      { type: 'tab', key: 'capa', label: 'Cockpit' },
    ] },
    { grupo: 'Pré-Obra', tabs: [
      { type: 'link', href: 'kickoff', label: 'Kick-Off' },
      { type: 'link', href: 'stakeholders', label: 'Stakeholders' },
      { type: 'tab', key: 'equipe', label: `Equipe (${obra.members.length})` },
      { type: 'link', href: 'raci', label: 'RACI' },
      { type: 'link', href: 'cronograma', label: 'Cronograma' },
      { type: 'link', href: 'cronograma-contratacoes', label: 'Crn. Contratações' },
    ] },
    { grupo: 'Durante a Obra', tabs: [
      // Checklists saiu como aba (02/09/26): Relatório de Recebimento virou aba
      // própria; Qualidade e Segurança ganham módulos próprios depois.
      { type: 'tab', key: 'recebimento', label: 'Rel. Recebimento' },
      { type: 'link', href: 'controle-documentos', label: 'Documentos' },
      { type: 'tab', key: 'fvs', label: `Sequenciamento (${obraFvsList.length})` },
      { type: 'tab', key: 'diario', label: 'Diário' },
      { type: 'link', href: 'atas', label: 'Atas' },
      { type: 'link', href: 'aditivos', label: 'Change Orders' },
      { type: 'link', href: 'amostras', label: 'Amostras' },
      { type: 'link', href: 'qualidade', label: 'Qualidade' },
      { type: 'tab', key: 'relatorios', label: 'Relatórios' },
    ] },
    { grupo: 'Pós-Obra', tabs: [
      { type: 'link', href: 'pendencias', label: 'Pendências' },
      { type: 'link', href: 'close-out', label: 'Close Out' },
    ] },
  ];


  const renderFvsPainel = (fvs: ObraFvs) => {
        const FVS_STATUS: Record<string, { label: string; color: string }> = {
          pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-600' },
          inicio_preenchido: { label: 'Início — Aguard. gestor', color: 'bg-blue-100 text-blue-700' },
          inicio_aprovado_gestor: { label: 'Início — Aguard. coord.', color: 'bg-purple-100 text-purple-700' },
          inicio_aprovado: { label: 'Início aprovado ✓', color: 'bg-teal-100 text-teal-700' },
          aguardando_gestor: { label: 'Conclusão — Aguard. gestor', color: 'bg-amber-100 text-amber-700' },
          aguardando_coord: { label: 'Conclusão — Aguard. coord.', color: 'bg-orange-100 text-orange-700' },
          aprovada: { label: 'Aprovada ✓', color: 'bg-green-100 text-green-700' },
          rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-700' },
        };
        const sc = FVS_STATUS[fvs.status] ?? { label: fvs.status, color: 'bg-gray-100 text-gray-500' };
        const isLocked = ['aprovada', 'rejeitada'].includes(fvs.status);
        const inicioAprovado = ['inicio_aprovado', 'aguardando_gestor', 'aguardando_coord', 'aprovada', 'rejeitada'].includes(fvs.status);

        const inicioItems = fvs.items.filter(i => (i.templateItem?.momento ?? i.momento) === 'inicio');
        const conclusaoItems = fvs.items.filter(i => (i.templateItem?.momento ?? i.momento) === 'conclusao');
        const inicioObrigTotal = inicioItems.filter(i => i.templateItem?.obrigatorio).length;
        const inicioObrigChecked = inicioItems.filter(i => i.templateItem?.obrigatorio && (i.checked || i.na)).length;
        const conclusaoObrigTotal = conclusaoItems.filter(i => i.templateItem?.obrigatorio).length;
        const conclusaoObrigChecked = conclusaoItems.filter(i => i.templateItem?.obrigatorio && (i.checked || i.na)).length;

        const bySecao = (items: ObraFvsItemType[]) => {
          const map: Record<string, ObraFvsItemType[]> = {};
          items.forEach(i => { const s = i.templateItem?.secao ?? (i.templateItem ? 'Geral' : 'Personalizado'); (map[s] = map[s] ?? []).push(i); });
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
            alert(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Erro ao salvar');
          } finally { setFvsSubmitting(false); }
        };

        const saveObservacaoFvs = async (itemId: string, observacao: string, currentNa: boolean) => {
          try {
            // manda "na" explícito pra impedir o backend de assumir checked=true
            // por omissão (regra existente: sem "na" nem "checked" no corpo, ele
            // marca o item como concluído — pensada pro fluxo de foto, não serve
            // pra uma edição de observação avulsa).
            const r = await api.patch(`/obra-fvs/${fvs.id}/items/${itemId}`, { observacao: observacao || null, na: currentNa });
            const updated = { ...fvs, items: fvs.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
            setActiveFvs(updated);
            setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
          } catch {
            alert('Erro ao salvar observação');
          }
        };

        // Prazo é por obra (ObraFvsItem) — quando vence e o item segue em
        // aberto, dispara o e-mail pra área responsável (job diário 08h15).
        const saveDataLimiteFvs = async (itemId: string, dataLimite: string, currentNa: boolean) => {
          try {
            const r = await api.patch(`/obra-fvs/${fvs.id}/items/${itemId}`, { dataLimite: dataLimite || null, na: currentNa });
            const updated = { ...fvs, items: fvs.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
            setActiveFvs(updated);
            setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
          } catch {
            alert('Erro ao salvar prazo');
          }
        };

        // Área responsável é do TEMPLATE do item (compartilhado entre todas as
        // obras que usam esse checklist) — igual à seção, é atribuição
        // organizacional, não específica desta obra.
        const saveResponsavelArea = async (templateItemId: string, responsavelArea: string) => {
          try {
            await api.patch(`/fvs-templates/items/${templateItemId}`, { responsavelArea: responsavelArea || null });
            const updated = {
              ...fvs,
              items: fvs.items.map(i => i.templateItem?.id === templateItemId && i.templateItem
                ? { ...i, templateItem: { ...i.templateItem, responsavelArea } }
                : i),
            };
            setActiveFvs(updated);
            setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
          } catch {
            alert('Erro ao salvar área responsável');
          }
        };

        const uploadFvsPhoto = async (itemId: string, file: File) => {
          setFvsSubmitting(true);
          try {
            const fd = new FormData(); fd.append('file', file);
            const up = await api.post('/uploads', fd);
            const url = up.data.data?.url ?? up.data.url;
            const r = await api.patch(`/obra-fvs/${fvs.id}/items/${itemId}`, { fotoUrl: url });
            const updated = { ...fvs, items: fvs.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
            setActiveFvs(updated);
            setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
          } catch (e: any) {
            alert(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Erro no upload');
          } finally { setFvsSubmitting(false); }
        };

        // O Passo a Passo NÃO é sequencial: os itens de uma fase acontecem em
        // paralelo ao longo dela. Travar por ordem prenderia o engenheiro sem
        // motivo. A única trava que resta é a foto obrigatória.
        const isItemBlocked = (_item: ObraFvsItemType, _sectionItems: ObraFvsItemType[]) => false;

        const renderSection = (sectionItems: ObraFvsItemType[], momento: string) => {
          const sorted = [...sectionItems].sort((a, b) => (a.templateItem?.ordem ?? 0) - (b.templateItem?.ordem ?? 0));
          const grouped = bySecao(sorted);
          if (fvsViewMode === 'lista') {
            return Object.entries(grouped).map(([secao, items]) => (
              <div key={secao} className="mb-4 w-full overflow-x-auto rounded-lg border border-ber-border">
                <table className="w-full min-w-[900px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-10" />
                    <col />
                    <col className="w-48" />
                    <col className="w-36" />
                    <col className="w-64" />
                    <col className="w-16" />
                  </colgroup>
                  <thead>
                    <tr className="bg-ber-offwhite text-ber-gray text-left">
                      <th className="px-3 py-3 font-bold uppercase tracking-wide" colSpan={2}>{secao}</th>
                      <th className="px-3 py-3 font-semibold">Responsável</th>
                      <th className="px-3 py-3 font-semibold">Prazo</th>
                      <th className="px-3 py-3 font-semibold">Observação</th>
                      <th className="px-3 py-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const blocked = isItemBlocked(item, sorted);
                      const needsPhoto = item.templateItem?.fotoObrigatoria ?? false;
                      const photoMissing = needsPhoto && !item.fotoUrl;
                      const canCheck = !blocked && !photoMissing;
                      return (
                        <tr key={item.id} className={`border-t border-ber-border/60 ${item.na ? 'bg-gray-50' : item.checked ? 'bg-green-50' : 'hover:bg-ber-offwhite/60'}`}>
                          <td className="px-3 py-3 align-top">
                            <input type="checkbox" checked={item.checked}
                              disabled={isLocked || fvsSubmitting || item.na || (!item.checked && !canCheck)}
                              onChange={() => toggleItem(item.id, 'checked')}
                              title={photoMissing ? 'Adicione a foto obrigatória primeiro' : ''}
                              className="h-4 w-4 cursor-pointer rounded accent-green-500 disabled:cursor-not-allowed disabled:opacity-40" />
                          </td>
                          <td className={`px-3 py-3 align-top ${item.na ? 'text-gray-400 line-through' : item.checked ? 'text-green-700 line-through' : 'text-ber-carbon'}`}>
                            {needsPhoto && <span className="mr-1 text-amber-500">📷</span>}
                            {item.templateItem?.sourceItCode && (
                              <span className="mr-1.5 font-bold tabular-nums text-ber-gray/70">{item.templateItem.sourceItCode}</span>
                            )}
                            {item.templateItem?.descricao ?? item.descricao}
                            {needsPhoto && !item.fotoUrl && !isLocked && (
                              <label className="ml-2 inline-flex cursor-pointer items-center gap-1 rounded border border-amber-300 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 hover:bg-amber-50">
                                <Camera size={10} /> Foto
                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFvsPhoto(item.id, f); }} />
                              </label>
                            )}
                            {item.fotoUrl && (
                              <a href={item.fotoUrl} target="_blank" rel="noreferrer" className="ml-2 inline-block align-middle">
                                <img src={item.fotoUrl} alt="foto" className="h-6 w-6 rounded object-cover border border-ber-gray/15 hover:opacity-80" />
                              </a>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <select
                              value={item.templateItem?.responsavelArea ?? ''}
                              disabled={isLocked || !item.templateItem}
                              onChange={e => item.templateItem && saveResponsavelArea(item.templateItem.id, e.target.value)}
                              className="w-full text-sm bg-white border border-ber-gray/40 rounded px-2 py-1.5 text-ber-carbon hover:border-ber-teal focus:outline-none focus:ring-1 focus:ring-ber-teal disabled:cursor-not-allowed"
                            >
                              <option value="">—</option>
                              <option value="PMO">PMO</option>
                              <option value="Engenharia">Engenharia</option>
                              <option value="Compras">Compras</option>
                              <option value="Financeiro">Financeiro</option>
                              <option value="Comercial">Comercial</option>
                            </select>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <input
                              type="date"
                              defaultValue={item.dataLimite?.slice(0, 10) ?? ''}
                              disabled={isLocked}
                              title="Dispara aviso por e-mail se vencer sem preencher"
                              onBlur={e => { if (e.target.value !== (item.dataLimite?.slice(0, 10) ?? '')) saveDataLimiteFvs(item.id, e.target.value, item.na); }}
                              className="w-full text-sm bg-white border border-ber-gray/40 rounded px-2 py-1.5 text-ber-carbon hover:border-ber-teal focus:outline-none focus:ring-1 focus:ring-ber-teal disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <input
                              defaultValue={item.observacao ?? ''}
                              disabled={isLocked}
                              placeholder="+ observação"
                              onBlur={e => { if (e.target.value !== (item.observacao ?? '')) saveObservacaoFvs(item.id, e.target.value.trim(), item.na); }}
                              className="w-full bg-transparent text-sm text-ber-carbon placeholder:text-ber-gray/50 border-b border-transparent hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-3 py-3 align-top text-right">
                            {!isLocked ? (
                              <button type="button" disabled={fvsSubmitting || (blocked && !item.na)}
                                onClick={() => toggleItem(item.id, 'na')}
                                title={item.na ? 'Desmarcar N/A' : 'Marcar como Não Aplicável'}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-40 ${item.na ? 'bg-gray-300 text-gray-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                                N/A
                              </button>
                            ) : item.na ? (
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-500">N/A</span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ));
          }

          return Object.entries(grouped).map(([secao, items]) => (
            <div key={secao} className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray">{secao}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {items.map(item => {
                  const blocked = isItemBlocked(item, sorted);
                  const needsPhoto = item.templateItem?.fotoObrigatoria ?? false;
                  const photoMissing = needsPhoto && !item.fotoUrl;
                  const canCheck = !blocked && !photoMissing;
                  return (
                  <div key={item.id} className={`rounded-lg p-2.5 transition-colors border border-ber-border shadow-sm h-full ${
                    item.na ? 'bg-gray-50' : item.checked ? 'bg-green-50' : blocked ? 'bg-ber-offwhite/40 opacity-60' : 'hover:bg-ber-offwhite/60'
                  }`}>
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      <input type="checkbox" checked={item.checked}
                        disabled={isLocked || fvsSubmitting || item.na || (!item.checked && !canCheck)}
                        onChange={() => toggleItem(item.id, 'checked')}
                        title={photoMissing ? 'Adicione a foto obrigatória primeiro' : ''}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-green-500 disabled:cursor-not-allowed disabled:opacity-40" />
                      {/* Description */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-snug ${item.na ? 'text-gray-400 line-through' : item.checked ? 'text-green-700 line-through' : 'text-ber-carbon'}`}>
                          {needsPhoto && <span className="mr-1 text-amber-500">📷</span>}
                          {item.templateItem?.sourceItCode && (
                            <span className="mr-1.5 font-bold tabular-nums text-ber-gray/70">{item.templateItem.sourceItCode}</span>
                          )}
                          {item.templateItem?.descricao ?? item.descricao}
                          {item.templateItem?.obrigatorio === false && <span className="ml-1 text-[10px] text-ber-gray/40">(opcional)</span>}
                          {!item.templateItem && <span className="ml-1 text-[10px] text-ber-teal/60">(personalizado)</span>}
                        </p>
                        {/* Photo row */}
                        {(needsPhoto || item.fotoUrl) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {item.fotoUrl && (
                              <a href={item.fotoUrl} target="_blank" rel="noreferrer">
                                <img src={item.fotoUrl} alt="foto" className="h-12 w-12 rounded object-cover border border-ber-gray/15 hover:opacity-80" />
                              </a>
                            )}
                            {!isLocked && (
                              <label className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${item.fotoUrl ? 'border-green-300 text-green-600 hover:bg-green-50' : needsPhoto ? 'border-amber-300 text-amber-600 hover:bg-amber-50' : 'border-ber-gray/20 text-ber-gray/60 hover:bg-ber-offwhite'}`}>
                                <Camera size={11} />
                                {item.fotoUrl ? 'Trocar foto' : needsPhoto ? 'Foto obrigatória' : '+ Foto'}
                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFvsPhoto(item.id, f); }} />
                              </label>
                            )}
                          </div>
                        )}
                        {/* Observação + Responsável + Prazo — bloco com destaque, senão passa despercebido */}
                        <div className="mt-2 rounded-lg border border-ber-gray/25 bg-ber-offwhite/50 p-2 space-y-1.5">
                          <input
                            key={item.id}
                            defaultValue={item.observacao ?? ''}
                            disabled={isLocked}
                            placeholder="+ observação"
                            onBlur={e => { if (e.target.value !== (item.observacao ?? '')) saveObservacaoFvs(item.id, e.target.value.trim(), item.na); }}
                            className="w-full bg-transparent text-xs font-medium text-ber-carbon placeholder:text-ber-gray/60 placeholder:font-normal border-b border-ber-gray/20 pb-1 focus:border-ber-teal focus:outline-none disabled:cursor-not-allowed"
                          />
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ber-carbon/70">
                              Responsável:
                              <select
                                value={item.templateItem?.responsavelArea ?? ''}
                                disabled={isLocked || !item.templateItem}
                                onChange={e => item.templateItem && saveResponsavelArea(item.templateItem.id, e.target.value)}
                                className="text-xs font-semibold bg-white border border-ber-gray/40 rounded px-1.5 py-1 text-ber-carbon hover:border-ber-teal focus:outline-none focus:ring-1 focus:ring-ber-teal disabled:cursor-not-allowed"
                              >
                                <option value="">—</option>
                                <option value="PMO">PMO</option>
                                <option value="Engenharia">Engenharia</option>
                                <option value="Compras">Compras</option>
                                <option value="Financeiro">Financeiro</option>
                                <option value="Comercial">Comercial</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ber-carbon/70">
                              Prazo:
                              <input
                                type="date"
                                defaultValue={item.dataLimite?.slice(0, 10) ?? ''}
                                disabled={isLocked}
                                title="Dispara aviso por e-mail se vencer sem preencher"
                                onBlur={e => { if (e.target.value !== (item.dataLimite?.slice(0, 10) ?? '')) saveDataLimiteFvs(item.id, e.target.value, item.na); }}
                                className="text-xs font-semibold bg-white border border-ber-gray/40 rounded px-1.5 py-1 text-ber-carbon hover:border-ber-teal focus:outline-none focus:ring-1 focus:ring-ber-teal disabled:cursor-not-allowed"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                      {/* N/A toggle */}
                      {!isLocked && (
                        <button type="button" disabled={fvsSubmitting || (blocked && !item.na)}
                          onClick={() => toggleItem(item.id, 'na')}
                          title={item.na ? 'Desmarcar N/A' : 'Marcar como Não Aplicável'}
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-40 ${
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
                  </div>
                  );
                })}
              </div>
            </div>
          ));
        };

        const doAction = async (type: 'submit-inicio' | 'submit-conclusao' | 'approve-gestor-inicio' | 'approve-coord-inicio' | 'approve-gestor' | 'approve-coord' | 'reject', reason?: string) => {
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

        const doReset = async () => {
          setFvsSubmitting(true);
          try {
            const r = await api.delete(`/obras/${params.id}/fvs/${fvs.id}/reset`);
            const updated = r.data.data;
            setActiveFvs(updated);
            setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
            setFvsResetConfirm(false);
          } catch (e: any) {
            alert(e?.response?.data?.message ?? 'Erro ao resetar FVS');
          } finally { setFvsSubmitting(false); }
        };

        return (
          <div className="mt-3 overflow-hidden rounded-xl border border-ber-border bg-white">
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
                <button onClick={() => { setExpandedFvs(prev => { const n = new Set(prev); n.delete(fvs.id); return n; }); setFvsResetConfirm(false); }}
                  className="rounded p-1 text-ber-gray hover:bg-ber-offwhite" title="Recolher"><ChevronUp size={18} /></button>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                {/* Alternar Lista/Card */}
                <div className="mb-3 flex justify-end">
                  <div className="inline-flex rounded-lg border border-ber-border overflow-hidden text-xs font-semibold">
                    <button
                      onClick={() => setFvsViewModePersist('lista')}
                      className={`px-3 py-1.5 transition-colors ${fvsViewMode === 'lista' ? 'bg-ber-carbon text-white' : 'bg-white text-ber-gray hover:bg-ber-offwhite'}`}
                    >
                      ☰ Lista
                    </button>
                    <button
                      onClick={() => setFvsViewModePersist('card')}
                      className={`px-3 py-1.5 transition-colors border-l border-ber-border ${fvsViewMode === 'card' ? 'bg-ber-carbon text-white' : 'bg-white text-ber-gray hover:bg-ber-offwhite'}`}
                    >
                      ▦ Card
                    </button>
                  </div>
                </div>
                {/* Seção Início */}
                {inicioItems.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-ber-carbon">
                        {fvs.status === 'pendente' ? '🟡' : '✅'} Pré-execução (Início)
                      </h3>
                      <span className={`text-xs font-semibold ${inicioObrigChecked === inicioObrigTotal ? 'text-green-600' : 'text-amber-600'}`}>
                        {inicioObrigChecked}/{inicioObrigTotal} obrigatórios
                      </span>
                    </div>
                    {fvs.status !== 'pendente' && inicioAprovado && (
                      <p className="mb-2 text-xs text-green-600 font-medium">Pré-execução aprovada pelo gestor e coordenador</p>
                    )}
                    {fvs.status !== 'pendente' && !inicioAprovado && (
                      <p className="mb-2 text-xs text-blue-600 font-medium">Pré-execução enviada — aguardando aprovação</p>
                    )}
                    {renderSection(inicioItems, 'inicio')}
                  </div>
                )}

                {conclusaoItems.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-ber-carbon">🔵 Itens da fase</h3>
                      <span className={`text-xs font-semibold ${conclusaoObrigChecked === conclusaoObrigTotal ? 'text-green-600' : 'text-blue-600'}`}>
                        {conclusaoObrigChecked}/{conclusaoObrigTotal} obrigatórios
                      </span>
                    </div>
                    {renderSection(conclusaoItems, 'conclusao')}
                  </div>
                )}

                {/* Adicionar etapa customizada */}
                {!isLocked && (
                  <div className="mt-6 border-t border-dashed border-ber-gray/20 pt-4">
                    {!addFvsItemOpen ? (
                      <button
                        onClick={() => setAddFvsItemOpen(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ber-gray/30 py-2.5 text-sm font-medium text-ber-gray hover:border-ber-teal hover:text-ber-teal transition-colors">
                        + Adicionar etapa
                      </button>
                    ) : (
                      <div className="space-y-3 rounded-lg bg-ber-offwhite/50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ber-gray">Nova etapa</p>
                        <input
                          type="text"
                          placeholder="Descrição da etapa..."
                          value={addFvsItemDesc}
                          onChange={e => setAddFvsItemDesc(e.target.value)}
                          className="w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:outline-none"
                          autoFocus
                        />
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-semibold text-ber-gray">Momento:</label>
                          <select
                            value={addFvsItemMomento}
                            onChange={e => setAddFvsItemMomento(e.target.value as 'inicio' | 'conclusao')}
                            className="rounded-md border border-ber-gray/30 px-2 py-1 text-sm focus:border-ber-teal focus:outline-none">
                            <option value="inicio">Pré-execução (Início)</option>
                            <option value="conclusao">Execução e Conclusão</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setAddFvsItemOpen(false); setAddFvsItemDesc(''); }}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">
                            Cancelar
                          </button>
                          <button
                            disabled={!addFvsItemDesc.trim() || fvsSubmitting}
                            onClick={async () => {
                              setFvsSubmitting(true);
                              try {
                                const r = await api.post(`/obra-fvs/${fvs.id}/items`, {
                                  descricao: addFvsItemDesc.trim(),
                                  momento: addFvsItemMomento,
                                });
                                const newItem = r.data.data;
                                const updated = { ...fvs, items: [...fvs.items, newItem] };
                                setActiveFvs(updated);
                                setObraFvsList(prev => prev.map(f => f.id === fvs.id ? updated : f));
                                setAddFvsItemDesc('');
                                setAddFvsItemOpen(false);
                              } catch (e: any) {
                                alert(e?.response?.data?.message ?? 'Erro ao adicionar etapa');
                              } finally { setFvsSubmitting(false); }
                            }}
                            className="rounded-md bg-ber-carbon px-4 py-1.5 text-sm font-bold text-white hover:bg-ber-black disabled:opacity-50">
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer — actions */}
              <div className="shrink-0 border-t border-ber-offwhite px-6 py-4">
                {fvsSubmitting && <p className="mb-2 text-center text-xs text-ber-gray">Salvando...</p>}

                {/* Confirmação de reset */}
                {fvsResetConfirm && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-700">Tem certeza? Todos os itens e fotos serão apagados e a FVS voltará ao status Pendente.</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={doReset} disabled={fvsSubmitting}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
                        Confirmar
                      </button>
                      <button onClick={() => setFvsResetConfirm(false)} disabled={fvsSubmitting}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {isGestor && !fvsResetConfirm && (
                    <button onClick={() => setFvsResetConfirm(true)} disabled={fvsSubmitting}
                      className="mr-auto rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">
                      🗑 Resetar FVS
                    </button>
                  )}
                  <button onClick={() => setExpandedFvs(prev => { const n = new Set(prev); n.delete(fvs.id); return n; })}
                    className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Recolher</button>

                  {/* submit-inicio — envia pré-execução para aprovação */}
                  {fvs.status === 'pendente' && inicioItems.length > 0 && (
                    <button disabled={fvsSubmitting || inicioObrigChecked < inicioObrigTotal}
                      onClick={() => doAction('submit-inicio')}
                      className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">
                      📋 Enviar Pré-execução para Aprovação
                    </button>
                  )}

                  {/* approve-gestor-inicio */}
                  {fvs.status === 'inicio_preenchido' && isGestor && (
                    <>
                      <button disabled={fvsSubmitting}
                        onClick={() => {
                          const r = prompt('Motivo da rejeição:');
                          if (r) doAction('reject', r);
                        }}
                        className="rounded-md bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                        ❌ Rejeitar
                      </button>
                      <button disabled={fvsSubmitting} onClick={() => doAction('approve-gestor-inicio')}
                        className="rounded-md bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">
                        ✅ Aprovar Início (Gestor)
                      </button>
                    </>
                  )}

                  {/* approve-coord-inicio */}
                  {fvs.status === 'inicio_aprovado_gestor' && (user?.role === 'coordenacao' || user?.role === 'diretoria') && (
                    <>
                      <button disabled={fvsSubmitting}
                        onClick={() => {
                          const r = prompt('Motivo da rejeição:');
                          if (r) doAction('reject', r);
                        }}
                        className="rounded-md bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                        ❌ Rejeitar
                      </button>
                      <button disabled={fvsSubmitting} onClick={() => doAction('approve-coord-inicio')}
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                        ✅ Aprovar Início (Coord.)
                      </button>
                    </>
                  )}

                  {/* submit-conclusao — só aparece após início aprovado (ou se não há itens de início) */}
                  {(fvs.status === 'inicio_aprovado' || (fvs.status === 'pendente' && inicioItems.length === 0)) && conclusaoItems.length > 0 && (
                    <button disabled={fvsSubmitting || conclusaoObrigChecked < conclusaoObrigTotal}
                      onClick={() => doAction('submit-conclusao')}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                      📋 Enviar para Aprovação
                    </button>
                  )}

                  {/* approve-gestor (conclusão) */}
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
                        className="rounded-md bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">
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
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                        ✅ Aprovação Final
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
        );
  };

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
            <div className="relative">
              <select
                value={obra.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as ObraStatus)}
                className={`appearance-none rounded-md border py-1 pl-3 pr-7 text-xs font-medium focus:ring-1 focus:outline-none disabled:opacity-50 ${statusCfg.selectBorder}`}
              >
                <option value="nao_iniciada">Não iniciada</option>
                <option value="planejamento">Pré Obra - Planejamento</option>
                <option value="em_andamento">Em andamento</option>
                <option value="pos_obra">Pós Obra</option>
                <option value="pausada">Pausada</option>
                <option value="concluida">Concluída</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ber-gray" />
            </div>
          </div>
          {obra.client && (
            <p className="mt-0.5 text-sm text-ber-gray">{obra.client}</p>
          )}
          <button
            onClick={() => setShowInfoModal(true)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-ber-teal hover:underline"
          >
            <Pencil size={11} /> Editar informações da obra
          </button>
          {orcamentoCtx && (
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] bg-ber-teal/10 text-ber-teal px-2 py-0.5 rounded-full font-medium">
                Orç. {orcamentoCtx.numero}
                {orcamentoCtx.status && <span className="opacity-70">· {orcamentoCtx.status}</span>}
              </span>
              {orcamentoCtx.oportunidade && (
                <span className="text-[11px] text-ber-gray truncate max-w-[200px]">{orcamentoCtx.oportunidade.titulo}</span>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Tabs — agrupadas por fase do ciclo de vida da obra */}
      <div className="mt-6 overflow-x-auto border-b border-ber-gray/20">
        <div className="flex items-stretch">
          {TAB_GROUPS.map((g, gi) => (
            <div key={g.grupo} className={`flex shrink-0 flex-col ${gi > 0 ? 'ml-2 border-l border-ber-gray/15 pl-2' : ''}`}>
              <span className="px-3 pb-0.5 pt-1 text-[9px] font-bold uppercase tracking-wider text-ber-gray/50 whitespace-nowrap">
                {g.grupo}
              </span>
              <div className="flex items-end gap-1">
                {g.tabs.map((t) => t.type === 'tab' ? (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === t.key
                        ? 'border-b-2 border-ber-olive text-ber-carbon'
                        : 'text-ber-gray hover:text-ber-carbon'
                    }`}
                  >
                    {t.label}
                  </button>
                ) : (
                  <Link
                    key={t.href}
                    href={`/obras/${params.id}/${t.href}`}
                    className="shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap text-ber-gray hover:text-ber-carbon transition-colors"
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'capa' && <CapaObra obraId={params.id} embedded />}

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

            {/* Kanban board — drag-and-drop */}
            <DndContext
              sensors={dndSensors}
              collisionDetection={pointerWithin}
              onDragStart={(e) => setKanbanDragId(e.active.id as string)}
              onDragEnd={async (e) => {
                setKanbanDragId(null);
                const { active, over } = e;
                if (!over) return;
                const taskId = active.id as string;
                const newStatus = over.id as string;
                const task = tasks.find(t => t.id === taskId);
                if (!task || task.status === newStatus) return;
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskStatus } : t));
                try {
                  await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
                } catch {
                  setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
                }
              }}
              onDragCancel={() => setKanbanDragId(null)}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {KANBAN_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    col={col}
                    tasks={tasks.filter(t => t.status === col.key)}
                    draggingId={kanbanDragId}
                  />
                ))}
              </div>
              <DragOverlay>
                {kanbanDragId ? <KanbanCardOverlay task={tasks.find(t => t.id === kanbanDragId)!} /> : null}
              </DragOverlay>
            </DndContext>
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
                  <div key={m.user.id} className="flex items-center gap-3 rounded-lg bg-white p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ber-teal text-sm font-bold text-white uppercase">
                      {m.user.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ber-carbon">{m.user.name}</p>
                      <p className="text-xs text-ber-gray capitalize">{m.user.role}</p>
                    </div>
                    {canManageMembers && (
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
                        <option value="coordenador">Coordenador</option>
                        <option value="gestor">Gestor de Obra</option>
                        <option value="engenheiro">Engenheiro</option>
                        <option value="mestre_obras">Mestre de Obras</option>
                        <option value="encarregado">Encarregado</option>
                        <option value="tecnico">Técnico</option>
                        <option value="comprador">Comprador</option>
                        <option value="auxiliar">Auxiliar</option>
                        <option value="estagiario">Estagiário</option>
                        <option value="membro">Membro</option>
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

        {activeTab === 'recebimento' && <RecebimentoTab obraId={params.id} />}

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
                      className="rounded-lg bg-white p-4 text-left transition-shadow"
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
              // PP1..PP6 = fases do Passo a Passo. FVS_n mantido pra dados legados.
              const m = code.match(/(?:FVS_|PP)(\d+)([A-Z]?)/i);
              if (!m) return [0, ''];
              return [parseInt(m[1]), m[2] || ''];
            };
            const [na, sa] = parseCode(a.template?.code ?? '');
            const [nb, sb] = parseCode(b.template?.code ?? '');
            return na !== nb ? (na as number) - (nb as number) : (sa as string).localeCompare(sb as string);
          });
          const filtered = sortFvs(fvsFilter === 'todos' ? obraFvsList : obraFvsList.filter(f => f.status === fvsFilter));

          // Faixa de avanço físico que cada fase cobre — usada pra dizer "você está aqui"
          const FASE_FAIXA: Record<string, string> = {
            PP1: 'antes do início',
            PP2: '0 a 25% de obra',
            PP3: '25 a 50% de obra',
            PP4: '50 a 75% de obra',
            PP5: '75 a 100% de obra',
            PP6: 'após a entrega',
          };
          // Fase efetiva: manual > cronograma (leitura IA) > relatório.
          // O fallback local reproduz a régua antiga caso o endpoint fase-seq falhe.
          const faseAtual: string | null = faseSeq?.faseEfetiva ?? (() => {
            if (obra.status === 'nao_iniciada' || obra.status === 'planejamento') return 'PP1';
            if (obra.status === 'pos_obra' || obra.status === 'concluida') return 'PP6';
            if (avancoObra == null) return null;
            if (avancoObra >= 100) return 'PP6';
            if (avancoObra >= 75) return 'PP5';
            if (avancoObra >= 50) return 'PP4';
            if (avancoObra >= 25) return 'PP3';
            return 'PP2';
          })();
          const ordemFase = (code?: string | null) => Number(String(code ?? '').replace(/\D/g, '')) || 0;
          const ordemAtual = ordemFase(faseAtual);

          return (
            <div>
              {/* Header */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Sequenciamento da Obra — Controle de Sequenciamento</h3>
                  <p className="mt-0.5 text-xs text-ber-gray/70">
                    O que precisa estar feito em cada altura da obra. Cada item é verificado pelo gestor e depois pelo coordenador.
                  </p>
                </div>
                {isGestor && (
                  <button onClick={() => setCreateFvsModal(true)}
                    className="flex items-center gap-1.5 rounded-md border border-ber-gray/25 px-3 py-2 text-xs font-semibold text-ber-gray hover:bg-ber-offwhite">
                    + Nova ficha
                  </button>
                )}
              </div>

              {/* Fase da obra — leitura do cronograma × relatório + correção manual (02/09/26) */}
              {faseSeq && (
                <div className={`mb-4 rounded-xl border p-4 ${faseSeq.divergente && !faseSeq.faseManual ? 'border-amber-300 bg-amber-50/60' : 'border-ber-border bg-white'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">Fase da obra</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-xl font-black text-ber-carbon">{faseSeq.faseEfetiva ?? '—'}</span>
                          {faseSeq.faseEfetiva && (
                            <span className="text-xs text-ber-gray">{FASE_FAIXA[faseSeq.faseEfetiva] ?? ''}</span>
                          )}
                          {faseSeq.origem && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              faseSeq.origem === 'manual' ? 'bg-purple-100 text-purple-700'
                              : faseSeq.origem === 'cronograma' ? 'bg-ber-teal/15 text-ber-teal'
                              : 'bg-ber-gray/15 text-ber-gray'
                            }`}>
                              {faseSeq.origem === 'manual' ? 'definida manualmente' : faseSeq.origem === 'cronograma' ? 'pelo cronograma' : 'pelo relatório'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-ber-gray">
                          Cronograma: <strong className="text-ber-carbon">{faseSeq.pctCronograma != null ? `${faseSeq.pctCronograma}%` : '—'}</strong>
                          {faseSeq.faseCronograma ? ` (${faseSeq.faseCronograma})` : ''}
                          <span className="mx-1.5">·</span>
                          Relatório: <strong className="text-ber-carbon">{faseSeq.pctRelatorio != null ? `${faseSeq.pctRelatorio}%` : '—'}</strong>
                          {faseSeq.faseRelatorio ? ` (${faseSeq.faseRelatorio})` : ''}
                        </p>
                        {faseSeq.divergente && !faseSeq.faseManual && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">⚠ Leituras divergentes — confira o cronograma ou corrija a fase manualmente.</p>
                        )}
                      </div>
                    </div>
                    {isGestor && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ber-carbon/70">
                          Corrigir fase:
                          <select
                            value={faseSeq.faseManual ?? ''}
                            disabled={faseSeqBusy}
                            onChange={e => setFaseManual(e.target.value || null)}
                            className="rounded border border-ber-gray/40 bg-white px-1.5 py-1 text-xs font-semibold text-ber-carbon hover:border-ber-teal focus:outline-none focus:ring-1 focus:ring-ber-teal disabled:opacity-50"
                          >
                            <option value="">automático</option>
                            <option value="PP1">PP1 — antes do início</option>
                            <option value="PP2">PP2 — 0 a 25%</option>
                            <option value="PP3">PP3 — 25 a 50%</option>
                            <option value="PP4">PP4 — 50 a 75%</option>
                            <option value="PP5">PP5 — 75 a 100%</option>
                            <option value="PP6">PP6 — após a entrega</option>
                          </select>
                        </label>
                        <button
                          onClick={relerCronogramaSeq}
                          disabled={faseSeqBusy}
                          title="Ler o % geral do cronograma de novo agora"
                          className="rounded-md border border-ber-gray/25 px-2.5 py-1.5 text-[11px] font-semibold text-ber-gray hover:bg-ber-offwhite disabled:opacity-50"
                        >
                          {faseSeqBusy ? 'Lendo…' : '↻ Reler cronograma'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Filtros — só os que têm conteúdo */}
              {(() => {
                const comConteudo = FILTERS.filter(f => f.key === 'todos' || obraFvsList.some(x => x.status === f.key));
                if (comConteudo.length <= 1) return null;
                return (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {comConteudo.map(f => (
                      <button key={f.key} onClick={() => setFvsFilter(f.key)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${fvsFilter === f.key ? 'bg-ber-carbon text-white' : 'bg-ber-offwhite text-ber-gray hover:bg-ber-offwhite/80'}`}>
                        {f.label} ({f.key === 'todos' ? obraFvsList.length : obraFvsList.filter(x => x.status === f.key).length})
                      </button>
                    ))}
                  </div>
                );
              })()}

              {filtered.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-ber-gray/20 p-12 text-center">
                  <p className="text-sm text-ber-gray/60">Nenhuma fase {fvsFilter !== 'todos' ? 'com este filtro' : 'criada para esta obra'}.</p>
                  {isGestor && fvsFilter === 'todos' && (
                    <button onClick={() => setCreateFvsModal(true)} className="mt-3 text-sm font-semibold text-ber-teal hover:underline">
                      + Criar primeira ficha
                    </button>
                  )}
                </div>
              ) : (
                /* Trilha vertical — cada fase é uma parada na vida da obra */
                <div className="relative">
                  {filtered.map((fvs, idx) => {
                    const code = fvs.template?.code ?? '';
                    const total = fvs.items.length;
                    const feitos = fvs.items.filter(i => i.checked || i.na).length;
                    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
                    const fotosPendentes = fvs.items.filter(i => i.templateItem?.fotoObrigatoria && !i.fotoUrl && !i.na).length;
                    const sc = FVS_STATUS[fvs.status] ?? { label: fvs.status, color: 'bg-gray-100 text-gray-500' };

                    const ordem = ordemFase(code);
                    const isAtual = faseAtual != null && code === faseAtual;
                    const isPassada = ordemAtual > 0 && ordem > 0 && ordem < ordemAtual;
                    const isFutura = ordemAtual > 0 && ordem > 0 && ordem > ordemAtual;
                    const completa = total > 0 && feitos === total;
                    const atrasada = isPassada && !completa;
                    const ultimo = idx === filtered.length - 1;

                    const anelCor = atrasada ? 'bg-red-500 text-white'
                      : completa ? 'bg-green-600 text-white'
                      : isAtual ? 'bg-ber-carbon text-white'
                      : 'bg-ber-offwhite text-ber-gray';
                    const barra = atrasada ? '#DC2626' : pct === 100 ? '#16A34A' : pct > 0 ? '#5A7A7A' : '#E5E7EB';

                    return (
                      <div key={fvs.id} className="relative flex gap-3 pb-3">
                        {/* Trilho + marcador */}
                        <div className="flex w-8 shrink-0 flex-col items-center">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${anelCor} ${isAtual ? 'ring-4 ring-ber-carbon/15' : ''}`}>
                            {completa && !atrasada ? '✓' : ordem || idx + 1}
                          </div>
                          {!ultimo && <div className="mt-1 w-px flex-1 bg-ber-gray/20" />}
                        </div>

                        {/* Cartão da fase + painel de itens */}
                        <div className="min-w-0 flex-1">
                        <button
                          onClick={() => {
                            setActiveFvs(fvs);
                            setExpandedFvs(prev => {
                              const n = new Set(prev);
                              if (n.has(fvs.id)) n.delete(fvs.id); else n.add(fvs.id);
                              return n;
                            });
                          }}
                          className={`group block w-full rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                            isAtual ? 'border-ber-carbon/30 bg-white shadow-sm'
                            : atrasada ? 'border-red-200 bg-red-50/40'
                            : isFutura ? 'border-ber-border bg-white/50 opacity-70 hover:opacity-100'
                            : 'border-ber-border bg-white'
                          }`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-ber-carbon">{fvs.template?.name ?? 'Fase'}</h4>
                                {isAtual && (
                                  <span className="rounded-full bg-ber-carbon px-2 py-0.5 text-[10px] font-bold text-white">FASE ATUAL</span>
                                )}
                                {atrasada && (
                                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">FICOU PRA TRÁS</span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-ber-gray">{FASE_FAIXA[code] ?? fvs.etapa?.name ?? ''}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                              <ChevronRight size={14} className={`shrink-0 text-ber-gray/40 transition-transform ${expandedFvs.has(fvs.id) ? 'rotate-90' : ''}`} />
                            </div>
                          </div>

                          {/* Progresso com fração — não só um zero solitário */}
                          <div className="mt-3 flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barra }} />
                            </div>
                            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ber-carbon">
                              {feitos} de {total}
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ber-gray">
                            {fotosPendentes > 0 && (
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <Camera size={11} /> {fotosPendentes} {fotosPendentes === 1 ? 'foto pendente' : 'fotos pendentes'}
                              </span>
                            )}
                            {atrasada && (
                              <span className="font-medium text-red-600">
                                {total - feitos} {total - feitos === 1 ? 'item aberto' : 'itens abertos'} de uma fase que a obra já passou
                              </span>
                            )}
                            {isAtual && !completa && (
                              <span className="font-medium text-ber-carbon">É aqui que a obra está agora</span>
                            )}
                          </div>
                        </button>
                        {expandedFvs.has(fvs.id) && renderFvsPainel(fvs)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Rodapé de contexto */}
                  {faseAtual == null && (
                    <p className="mt-2 text-[11px] text-ber-gray/70 italic">
                      A fase atual aparece destacada assim que o primeiro relatório semanal for emitido — é o avanço dele que diz onde a obra está.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}


        {/* ─── Cronograma tab — redireciona pra página dedicada ─── */}
        {activeTab === 'cronograma' && (
          <div className="py-12 text-center">
            <p className="text-sm text-ber-gray mb-3">O Cronograma tem página própria.</p>
            <a href={`/obras/${params.id}/cronograma`}
              className="inline-flex items-center gap-1.5 rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white hover:bg-ber-black">
              Abrir Cronograma →
            </a>
          </div>
        )}
      </div>



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
            const up = await api.post('/uploads', fd);
            const url = up.data.data?.url ?? up.data.url;
            const r = await api.patch(`/obra-ber-checklists/${cl.id}/items/${itemId}`, { fotoUrl: url });
            const updated = { ...cl, items: cl.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
            setActiveCl(updated as ObraBerChecklist);
            setBerChecklists(prev => prev.map(c => c.id === cl.id ? updated as ObraBerChecklist : c));
          } catch (e: any) { alert(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Erro no upload'); }
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
            </div>
            <div className="flex justify-end gap-3 border-t border-ber-offwhite px-6 py-4">
              <button onClick={() => setCreateFvsModal(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
              <button disabled={!createFvsTemplateId}
                onClick={async () => {
                  if (!createFvsTemplateId) return;
                  try {
                    const r = await api.post(`/obras/${params.id}/fvs`, { templateId: createFvsTemplateId });
                    setObraFvsList(prev => [r.data.data, ...prev]);
                    setActiveFvs(r.data.data);
                    // já abre a fase recém-criada na trilha
                    setExpandedFvs(prev => new Set(prev).add(r.data.data.id));
                    setCreateFvsModal(false);
                  } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
                }}
                className="rounded-md bg-ber-carbon px-5 py-2 text-sm font-bold text-white hover:bg-ber-black disabled:opacity-50">
                Criar ficha
              </button>
            </div>
          </div>
        </div>
      )}

        {/* ─── Diário tab ─── */}
        {activeTab === 'diario' && (
          <DiarioTab obraId={params.id} obraNome={obra.name} />
        )}

        {/* ─── Relatórios tab ─── */}
        {activeTab === 'relatorios' && (
          <RelatorioTab key={relatorioTabKey} obraId={params.id} obra={obra} />
        )}

        {showInfoModal && (
          <ObraInfoModal
            obraId={params.id}
            onClose={() => setShowInfoModal(false)}
            onSaved={() => {
              setShowInfoModal(false);
              api.get(`/obras/${params.id}`).then(r => setObra(r.data.data)).catch(() => {});
            }}
          />
        )}
    </div>
  );
}
