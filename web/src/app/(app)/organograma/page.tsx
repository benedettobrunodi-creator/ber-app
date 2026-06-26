'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, Pencil, Plus, Trash2, Download, Loader2, Check, X, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

/* ─── Types ─── */

interface OrgNode {
  id: string;
  nome: string;
  cargo: string;
  colorKey: ColorKey;
  salario?: number;
  isGroup?: boolean;
  /** Quando true, este grupo aparece como filho de TODOS os gestores (clone visual).
   *  Só faz sentido em nós com isGroup=true. */
  shared?: boolean;
  children: OrgNode[];
}

type ColorKey = 'diretoria' | 'operacional' | 'coordenacao' | 'gestor' | 'admin' | 'campo';

const COLOR_MAP: Record<ColorKey, { bg: string; text: string }> = {
  diretoria:   { bg: '#1E2432', text: '#ffffff' },
  operacional: { bg: '#2C4A5A', text: '#ffffff' },
  admin:       { bg: '#3D5A6A', text: '#ffffff' },
  coordenacao: { bg: '#5A7A7A', text: '#ffffff' },
  gestor:      { bg: '#B5B820', text: '#ffffff' },
  campo:       { bg: '#868686', text: '#ffffff' },
};

const COLOR_OPTIONS: { key: ColorKey; label: string }[] = [
  { key: 'diretoria',   label: 'Diretoria' },
  { key: 'operacional', label: 'Operacional' },
  { key: 'admin',       label: 'Admin' },
  { key: 'coordenacao', label: 'Coordenação' },
  { key: 'gestor',      label: 'Gestor' },
  { key: 'campo',       label: 'Campo' },
];

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/* ─── Helpers ─── */

function generateId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function findNode(root: OrgNode, id: string): OrgNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

function isDescendant(node: OrgNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  return node.children.some(c => isDescendant(c, targetId));
}

function removeNode(root: OrgNode, id: string): { tree: OrgNode; removed: OrgNode | null } {
  let removed: OrgNode | null = null;
  function recurse(node: OrgNode): OrgNode {
    const newChildren = node.children
      .filter(c => { if (c.id === id) { removed = c; return false; } return true; })
      .map(recurse);
    return { ...node, children: newChildren };
  }
  return { tree: recurse(root), removed };
}

function reparentNode(root: OrgNode, draggedId: string, targetId: string): OrgNode {
  if (draggedId === targetId) return root;
  const dragged = findNode(root, draggedId);
  if (!dragged) return root;
  if (isDescendant(dragged, targetId)) return root;
  const { tree: withoutDragged } = removeNode(root, draggedId);
  function addToTarget(node: OrgNode): OrgNode {
    if (node.id === targetId) return { ...node, children: [...node.children, dragged!] };
    return { ...node, children: node.children.map(addToTarget) };
  }
  return addToTarget(withoutDragged);
}

function updateNodeInTree(root: OrgNode, updated: OrgNode): OrgNode {
  if (root.id === updated.id) return updated;
  return { ...root, children: root.children.map(c => updateNodeInTree(c, updated)) };
}

/** Remove o nó alvo e PROMOVE os filhos dele pro avô (não deleta em cascata). */
function deleteNodeFromTree(root: OrgNode, id: string): OrgNode {
  function recurse(node: OrgNode): OrgNode {
    const newChildren: OrgNode[] = [];
    for (const c of node.children) {
      if (c.id === id) {
        // pula o nó alvo e sobe seus filhos pro avô (= node atual)
        for (const grandChild of c.children) newChildren.push(recurse(grandChild));
      } else {
        newChildren.push(recurse(c));
      }
    }
    return { ...node, children: newChildren };
  }
  return recurse(root);
}

/** Coleta todos os grupos marcados como shared (em qualquer profundidade). */
function collectSharedGroups(root: OrgNode): OrgNode[] {
  const out: OrgNode[] = [];
  function walk(node: OrgNode) {
    if (node.isGroup && node.shared) out.push(node);
    for (const c of node.children) walk(c);
  }
  walk(root);
  return out;
}

const CUSTO_DIRETO_KEYS: ColorKey[] = ['gestor', 'campo'];

interface TreeStats {
  totalPessoas: number;
  folhaTotal: number;
  diretoPessoas: number;
  diretoFolha: number;
  indiretoPessoas: number;
  indiretoFolha: number;
}

function computeStats(node: OrgNode, stats: TreeStats = { totalPessoas: 0, folhaTotal: 0, diretoPessoas: 0, diretoFolha: 0, indiretoPessoas: 0, indiretoFolha: 0 }): TreeStats {
  if (!node.isGroup) {
    stats.totalPessoas++;
    const sal = node.salario ?? 0;
    stats.folhaTotal += sal;
    if (CUSTO_DIRETO_KEYS.includes(node.colorKey)) {
      stats.diretoPessoas++;
      stats.diretoFolha += sal;
    } else {
      stats.indiretoPessoas++;
      stats.indiretoFolha += sal;
    }
  }
  node.children.forEach(c => computeStats(c, stats));
  return stats;
}

/* ─── SVG Connectors ─── */

interface Line { x1: number; y1: number; x2: number; y2: number }

function computeLines(root: OrgNode, cardRefs: Map<string, HTMLElement>, container: DOMRect): Line[] {
  const lines: Line[] = [];
  function traverse(node: OrgNode) {
    if (node.isGroup) return;
    const parentEl = cardRefs.get(node.id);
    if (!parentEl) return;
    const pr = parentEl.getBoundingClientRect();
    const px = pr.left + pr.width / 2 - container.left;
    const py = pr.bottom - container.top;
    for (const child of node.children) {
      const childEl = cardRefs.get(child.id);
      if (!childEl) { traverse(child); continue; }
      const cr = childEl.getBoundingClientRect();
      const cx = cr.left + cr.width / 2 - container.left;
      const cy = cr.top - container.top;
      const midY = py + (cy - py) / 2;
      lines.push({ x1: px, y1: py, x2: px, y2: midY });
      lines.push({ x1: px, y1: midY, x2: cx, y2: midY });
      lines.push({ x1: cx, y1: midY, x2: cx, y2: cy });
      traverse(child);
    }
  }
  traverse(root);
  return lines;
}

/* ─── Node card (card only — no action buttons) ─── */

function NodeCard({
  node,
  cardRefs,
  isDragOverlay = false,
  showSalarios = false,
}: {
  node: OrgNode;
  cardRefs?: React.MutableRefObject<Map<string, HTMLElement>>;
  isDragOverlay?: boolean;
  showSalarios?: boolean;
}) {
  const color = COLOR_MAP[node.colorKey] ?? COLOR_MAP.campo;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-${node.id}`,
    disabled: node.isGroup || isDragOverlay,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    disabled: node.isGroup || isDragOverlay,
  });

  const ref = useCallback((el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
    if (cardRefs && el) cardRefs.current.set(node.id, el);
  }, [node.id]);

  return (
    <div
      ref={ref}
      {...attributes}
      className={`relative select-none rounded-lg transition-opacity ${isDragging && !isDragOverlay ? 'opacity-30' : 'opacity-100'}`}
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.15)', width: 176 }}
    >
      {!node.isGroup && !isDragOverlay && (
        <div
          {...listeners}
          className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab text-white/40 hover:text-white/80 z-10 touch-none"
        >
          <GripVertical size={14} />
        </div>
      )}

      <div
        className="rounded-lg px-3 py-2.5 pl-6"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        <p className="text-xs font-bold leading-tight text-center">{node.nome}</p>
        {node.cargo && (
          <p className="mt-0.5 text-[10px] font-medium opacity-80 leading-tight text-center">{node.cargo}</p>
        )}
        {showSalarios && !node.isGroup && (
          <p className="mt-1 text-[10px] font-semibold text-center opacity-90 border-t border-white/20 pt-1">
            {node.salario ? fmtBRL(node.salario) : '—'}
          </p>
        )}
      </div>

      {isOver && !isDragOverlay && !node.isGroup && (
        <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-ber-olive" />
      )}
    </div>
  );
}

/* ─── Group box (decorative, not draggable) ─── */

function GroupBox({
  node,
  cardRefs,
  showSalarios,
  onEdit,
  onAddMember,
  onDelete,
  isClone = false,
}: {
  node: OrgNode;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  showSalarios: boolean;
  onEdit: (n: OrgNode) => void;
  onAddMember: (parentId: string) => void;
  onDelete: (id: string) => void;
  isClone?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `drop-${node.id}`, disabled: true });

  const ref = useCallback((el: HTMLDivElement | null) => {
    setNodeRef(el);
    // Clones não capturam ref (evita conflito de chave no cardRefs)
    if (el && !isClone) cardRefs.current.set(node.id, el);
  }, [node.id, isClone]);

  return (
    <div ref={ref} className="flex flex-col items-center">
      <div className={`rounded-lg border-2 border-dashed px-4 py-3 min-w-[160px] ${node.shared ? 'border-ber-teal/60 bg-ber-teal/5' : 'border-ber-gray/40'}`}>
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-ber-gray">
          {node.nome}
          {node.shared && <span className="ml-1 text-ber-teal" title="Grupo compartilhado entre todos os gestores">🔗</span>}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {node.children.map(member => {
            const color = COLOR_MAP[member.colorKey] ?? COLOR_MAP.campo;
            return (
              <div key={member.id} className="flex flex-col items-center gap-0.5">
                <div
                  className="rounded-md px-2 py-1 text-center"
                  style={{ backgroundColor: color.bg, color: color.text, minWidth: 70 }}
                >
                  <p className="text-[10px] font-semibold leading-tight">{member.nome}</p>
                  {member.cargo && (
                    <p className="text-[9px] opacity-75 leading-tight">{member.cargo}</p>
                  )}
                  {showSalarios && (
                    <p className="text-[9px] font-semibold border-t border-white/20 pt-0.5 mt-0.5">
                      {member.salario ? fmtBRL(member.salario) : '—'}
                    </p>
                  )}
                </div>
                {/* Member actions (somente na instância canônica, não nos clones) */}
                {!isClone && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onEdit(member)}
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-ber-teal"
                    >
                      <Pencil size={8} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Excluir ${member.nome}?`)) onDelete(member.id); }}
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-red-500"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Group actions (somente na instância canônica) */}
      {!isClone && (
      <div className="mt-1 flex items-center gap-1">
        <button
          onClick={() => onEdit(node)}
          title="Editar grupo"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-ber-teal"
        >
          <Pencil size={9} />
        </button>
        <button
          onClick={() => onAddMember(node.id)}
          title="Adicionar membro"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-ber-teal"
        >
          <Plus size={9} />
        </button>
        <button
          onClick={() => { if (confirm(`Excluir grupo "${node.nome}" e todos os ${node.children.length} membros?`)) onDelete(node.id); }}
          title="Excluir grupo"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-red-500"
        >
          <Trash2 size={9} />
        </button>
      </div>
      )}
    </div>
  );
}

/* ─── Recursive tree subtree ─── */

function OrgSubtree({
  node,
  cardRefs,
  showSalarios,
  onEdit,
  onAddChild,
  onDelete,
  isRoot,
  sharedGroups,
  isClone = false,
}: {
  node: OrgNode;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  showSalarios: boolean;
  onEdit: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  isRoot?: boolean;
  sharedGroups?: OrgNode[];
  /** Quando true, este nó é um clone visual (de um shared group renderizado
   *  sob um gestor). Não captura cardRefs, não duplica eventos. */
  isClone?: boolean;
}) {
  if (node.isGroup) {
    return (
      <GroupBox
        node={node}
        cardRefs={cardRefs}
        showSalarios={showSalarios}
        onEdit={onEdit}
        onAddMember={onAddChild}
        onDelete={onDelete}
        isClone={isClone}
      />
    );
  }

  const isGestor = node.colorKey === 'gestor';
  // Esconde shared groups do filhos normais (eles serão renderizados em todos
  // os gestores como clone). Resultado: o pool aparece embaixo de cada gestor.
  const normalChildren = node.children.filter(c => !(c.isGroup && c.shared));
  const sharedChildrenForGestor = isGestor && !isClone ? (sharedGroups ?? []) : [];
  const hasChildren = normalChildren.length + sharedChildrenForGestor.length > 0;
  const canDelete = !isRoot && !isClone;

  return (
    <div className="inline-flex flex-col items-center">
      <NodeCard
        node={node}
        cardRefs={isClone ? undefined : cardRefs}
        showSalarios={showSalarios}
      />

      {/* Action buttons — always visible (exceto em clone) */}
      {!isClone && (
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={() => onEdit(node)}
            title="Editar"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-ber-teal"
          >
            <Pencil size={9} />
          </button>
          <button
            onClick={() => onAddChild(node.id)}
            title="Adicionar subordinado"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-ber-teal"
          >
            <Plus size={9} />
          </button>
          {canDelete && (
            <button
              onClick={() => {
                const msg = node.children.length > 0
                  ? `Excluir ${node.nome}? Os ${node.children.length} subordinado(s) sobem 1 nível.`
                  : `Excluir ${node.nome}?`;
                if (confirm(msg)) onDelete(node.id);
              }}
              title="Excluir"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-ber-offwhite text-ber-gray hover:bg-white hover:text-red-500"
            >
              <Trash2 size={9} />
            </button>
          )}
        </div>
      )}

      {hasChildren && (
        <div className="flex items-start gap-8 pt-8">
          {normalChildren.map(child => (
            <OrgSubtree
              key={child.id}
              node={child}
              cardRefs={cardRefs}
              showSalarios={showSalarios}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              sharedGroups={sharedGroups}
              isClone={isClone}
            />
          ))}
          {sharedChildrenForGestor.map(group => (
            <OrgSubtree
              key={`shared-${node.id}-${group.id}`}
              node={group}
              cardRefs={cardRefs}
              showSalarios={showSalarios}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              isClone={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Edit modal ─── */

function EditModal({
  node,
  onSave,
  onCancel,
}: {
  node: OrgNode;
  onSave: (updated: OrgNode) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(node.nome);
  const [cargo, setCargo] = useState(node.cargo);
  const [colorKey, setColorKey] = useState<ColorKey>(node.colorKey);
  const [salario, setSalario] = useState(node.salario != null ? String(node.salario) : '');
  const [shared, setShared] = useState(!!node.shared);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const salNum = salario.replace(/\D/g, '');
    onSave({
      ...node,
      nome,
      cargo,
      colorKey,
      salario: salNum ? Number(salNum) : undefined,
      ...(node.isGroup ? { shared } : {}),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-ber-carbon">Editar nó</h2>
          <button onClick={onCancel} className="text-ber-gray hover:text-ber-carbon">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-ber-gray mb-1">Nome</label>
            <input
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full rounded-md border border-ber-border px-3 py-2 text-sm text-ber-carbon focus:border-ber-teal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ber-gray mb-1">Cargo</label>
            <input
              value={cargo}
              onChange={e => setCargo(e.target.value)}
              className="w-full rounded-md border border-ber-border px-3 py-2 text-sm text-ber-carbon focus:border-ber-teal focus:outline-none"
            />
          </div>
          {!node.isGroup && (
            <div>
              <label className="block text-xs font-semibold text-ber-gray mb-1">Salário (R$)</label>
              <input
                value={salario}
                onChange={e => setSalario(e.target.value)}
                placeholder="Ex: 8000"
                inputMode="numeric"
                className="w-full rounded-md border border-ber-border px-3 py-2 text-sm text-ber-carbon focus:border-ber-teal focus:outline-none"
              />
            </div>
          )}
          {node.isGroup && (
            <label className="flex items-center gap-2 rounded-md border border-ber-border bg-ber-bg/30 px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shared}
                onChange={e => setShared(e.target.checked)}
                className="h-4 w-4 rounded accent-ber-teal"
              />
              <div>
                <p className="text-xs font-semibold text-ber-carbon">Compartilhar com todos os gestores</p>
                <p className="text-[10px] text-ber-gray">Este grupo aparece como filho de cada Gestor de Obra/Contrato</p>
              </div>
            </label>
          )}
          <div>
            <label className="block text-xs font-semibold text-ber-gray mb-1">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(opt => {
                const c = COLOR_MAP[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setColorKey(opt.key)}
                    className={`rounded-md px-2 py-1 text-xs font-semibold transition-all ${colorKey === opt.key ? 'ring-2 ring-ber-olive ring-offset-1' : ''}`}
                    style={{ backgroundColor: c.bg, color: c.text }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-md border border-ber-gray/30 px-4 py-2 text-sm font-medium text-ber-carbon hover:bg-ber-offwhite"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main page ─── */

export default function OrganogramaPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const perms = getUserPermissions(user);

  const [tree, setTree] = useState<OrgNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editNode, setEditNode] = useState<OrgNode | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showSalarios, setShowSalarios] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    if (user && !perms.organograma) router.replace('/portfolio-360');
  }, [user]);

  useEffect(() => {
    api.get('/organograma')
      .then(r => {
        const payload = r.data.data;
        setTree(Array.isArray(payload) ? payload[0] : payload);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useLayoutEffect(() => {
    if (!tree || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setLines(computeLines(tree, cardRefs.current, rect));
  }, [tree]);

  async function handleSave(treeToSave: OrgNode) {
    setSaving(true);
    try {
      await api.put('/organograma', { data: [treeToSave] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  function applyChange(newTree: OrgNode) {
    setTree(newTree);
    handleSave(newTree);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over || !tree) return;
    const draggedId = String(active.id).replace('drag-', '');
    const targetId = String(over.id).replace('drop-', '');
    if (draggedId === targetId) return;
    applyChange(reparentNode(tree, draggedId, targetId));
  }

  function handleEditSave(updated: OrgNode) {
    if (!tree) return;
    setEditNode(null);
    applyChange(updateNodeInTree(tree, updated));
  }

  function handleAddChild(parentId: string) {
    if (!tree) return;
    const newNode: OrgNode = {
      id: generateId(),
      nome: 'Novo membro',
      cargo: 'Cargo',
      colorKey: 'campo',
      children: [],
    };
    function addChild(node: OrgNode): OrgNode {
      if (node.id === parentId) return { ...node, children: [...node.children, newNode] };
      return { ...node, children: node.children.map(addChild) };
    }
    applyChange(addChild(tree));
    setTimeout(() => setEditNode(newNode), 100);
  }

  function handleDelete(id: string) {
    if (!tree || tree.id === id) return;
    applyChange(deleteNodeFromTree(tree, id));
  }

  async function handleExportPNG() {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(containerRef.current, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true, logging: false });
      const link = document.createElement('a');
      link.download = 'organograma-ber.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { alert('Erro ao exportar PNG.'); }
    finally { setExporting(false); }
  }

  async function handleExportPDF() {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(containerRef.current, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save('organograma-ber.pdf');
    } catch { alert('Erro ao exportar PDF.'); }
    finally { setExporting(false); }
  }

  const activeNode = activeId ? (tree ? findNode(tree, activeId.replace('drag-', '')) : null) : null;
  const stats = tree ? computeStats(tree) : null;

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-ber-gray" />
      </div>
    );
  }

  if (!tree) return null;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Organograma</h1>
          <p className="mt-0.5 text-xs text-ber-gray">Arraste os cartões para reorganizar · ✏️ editar · + adicionar · 🗑 excluir</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-ber-green">
              <Check size={12} /> Salvo
            </span>
          )}
          {saving && (
            <span className="flex items-center gap-1 text-xs text-ber-gray">
              <Loader2 size={12} className="animate-spin" /> Salvando…
            </span>
          )}
          <button
            onClick={() => setShowSalarios(s => !s)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              showSalarios
                ? 'border-ber-olive bg-ber-olive/10 text-ber-olive'
                : 'border-ber-gray/30 bg-white text-ber-carbon hover:bg-ber-offwhite'
            }`}
          >
            {showSalarios ? <EyeOff size={13} /> : <Eye size={13} />}
            Salários
          </button>
          <button
            onClick={handleExportPNG}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-ber-gray/30 bg-white px-3 py-2 text-xs font-medium text-ber-carbon hover:bg-ber-offwhite disabled:opacity-50"
          >
            <Download size={13} /> PNG
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-ber-gray/30 bg-white px-3 py-2 text-xs font-medium text-ber-carbon hover:bg-ber-offwhite disabled:opacity-50"
          >
            <Download size={13} /> PDF
          </button>
        </div>
      </div>

      {/* KPI header */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-ber-border bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">Colaboradores</p>
            <p className="mt-1 text-2xl font-black text-ber-carbon">{stats.totalPessoas}</p>
            <p className="text-[10px] text-ber-gray/70">total na estrutura</p>
          </div>

          <div className="rounded-xl border border-ber-border bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">Folha mensal</p>
            <p className="mt-1 text-xl font-black text-ber-carbon">
              {showSalarios ? (stats.folhaTotal > 0 ? fmtBRL(stats.folhaTotal) : '—') : '••••••'}
            </p>
            <p className="text-[10px] text-ber-gray/70">soma de salários</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Custo direto</p>
            <p className="mt-1 text-2xl font-black text-amber-800">{stats.diretoPessoas} <span className="text-sm font-semibold">pessoas</span></p>
            <p className="text-[10px] font-semibold text-amber-700">
              {showSalarios ? fmtBRL(stats.diretoFolha) : '••••••'}
            </p>
            <p className="text-[9px] text-amber-600/60">gestores + campo · variável</p>
          </div>

          <div className="rounded-xl border border-ber-teal/20 bg-ber-teal/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ber-teal">Custo indireto</p>
            <p className="mt-1 text-2xl font-black text-ber-teal">{stats.indiretoPessoas} <span className="text-sm font-semibold">pessoas</span></p>
            <p className="text-[10px] font-semibold text-ber-teal">
              {showSalarios ? fmtBRL(stats.indiretoFolha) : '••••••'}
            </p>
            <p className="text-[9px] text-ber-teal/50">core da empresa · fixo</p>
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="mt-4 overflow-auto rounded-xl border border-ber-border bg-white p-8 pb-12">
        <DndContext
          sensors={sensors}
          onDragStart={e => setActiveId(String(e.active.id))}
          onDragOver={e => setOverId(e.over ? String(e.over.id) : null)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setActiveId(null); setOverId(null); }}
        >
          <div ref={containerRef} className="relative inline-block min-w-full">
            {/* SVG connector lines */}
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              style={{ width: '100%', height: '100%', zIndex: 0 }}
            >
              {lines.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#D8DDD8" strokeWidth={2} />
              ))}
            </svg>

            {/* Tree */}
            <div className="relative" style={{ zIndex: 1 }}>
              <OrgSubtree
                node={tree}
                cardRefs={cardRefs}
                showSalarios={showSalarios}
                onEdit={setEditNode}
                onAddChild={handleAddChild}
                onDelete={handleDelete}
                isRoot
                sharedGroups={collectSharedGroups(tree)}
              />
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeNode && <NodeCard node={activeNode} isDragOverlay />}
          </DragOverlay>
        </DndContext>
      </div>

      {editNode && (
        <EditModal node={editNode} onSave={handleEditSave} onCancel={() => setEditNode(null)} />
      )}
    </div>
  );
}
