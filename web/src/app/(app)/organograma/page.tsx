'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Plus, Trash2, Download, Loader2, Check, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

/* ─── Types ─── */

interface OrgNode {
  id: string;
  nome: string;
  cargo: string;
  colorKey: ColorKey;
  isGroup?: boolean;
  children: OrgNode[];
}

type ColorKey = 'diretoria' | 'operacional' | 'coordenacao' | 'gestor' | 'admin' | 'campo';

const COLOR_MAP: Record<ColorKey, { bg: string; text: string; border: string }> = {
  diretoria:   { bg: '#1E2432', text: '#ffffff', border: '#1E2432' },
  operacional: { bg: '#2C4A5A', text: '#ffffff', border: '#2C4A5A' },
  admin:       { bg: '#3D5A6A', text: '#ffffff', border: '#3D5A6A' },
  coordenacao: { bg: '#5A7A7A', text: '#ffffff', border: '#5A7A7A' },
  gestor:      { bg: '#B5B820', text: '#ffffff', border: '#B5B820' },
  campo:       { bg: '#868686', text: '#ffffff', border: '#868686' },
};

const COLOR_OPTIONS: { key: ColorKey; label: string }[] = [
  { key: 'diretoria',   label: 'Diretoria' },
  { key: 'operacional', label: 'Operacional' },
  { key: 'admin',       label: 'Admin' },
  { key: 'coordenacao', label: 'Coordenação' },
  { key: 'gestor',      label: 'Gestor' },
  { key: 'campo',       label: 'Campo' },
];

/* ─── Helpers ─── */

function generateId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function findParent(root: OrgNode, targetId: string): OrgNode | null {
  if (root.children.some(c => c.id === targetId)) return root;
  for (const c of root.children) {
    const found = findParent(c, targetId);
    if (found) return found;
  }
  return null;
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
    if (node.id === targetId) {
      return { ...node, children: [...node.children, dragged!] };
    }
    return { ...node, children: node.children.map(addToTarget) };
  }

  return addToTarget(withoutDragged);
}

function updateNodeInTree(root: OrgNode, updated: OrgNode): OrgNode {
  if (root.id === updated.id) return updated;
  return { ...root, children: root.children.map(c => updateNodeInTree(c, updated)) };
}

function deleteNodeFromTree(root: OrgNode, id: string): OrgNode {
  return {
    ...root,
    children: root.children
      .filter(c => c.id !== id)
      .map(c => deleteNodeFromTree(c, id)),
  };
}

/* ─── SVG Connectors ─── */

interface Line { x1: number; y1: number; x2: number; y2: number }

function computeLines(
  root: OrgNode,
  cardRefs: Map<string, HTMLElement>,
  container: DOMRect,
): Line[] {
  const lines: Line[] = [];

  function traverse(node: OrgNode) {
    if (node.isGroup) return;
    const parentEl = cardRefs.get(node.id);
    if (!parentEl) return;
    const pr = parentEl.getBoundingClientRect();
    const px = pr.left + pr.width / 2 - container.left;
    const py = pr.bottom - container.top;

    for (const child of node.children) {
      if (child.isGroup) {
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
        continue;
      }
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

/* ─── Draggable/Droppable node card ─── */

function NodeCard({
  node,
  cardRefs,
  isDragOverlay = false,
  isDropTarget = false,
  onEdit,
  onAddChild,
  onDelete,
  canDelete,
}: {
  node: OrgNode;
  cardRefs?: React.MutableRefObject<Map<string, HTMLElement>>;
  isDragOverlay?: boolean;
  isDropTarget?: boolean;
  onEdit?: (n: OrgNode) => void;
  onAddChild?: (parentId: string) => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
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

  const ring = isDropTarget && isOver ? '0 0 0 3px #B5B820' : undefined;

  return (
    <div
      ref={ref}
      {...attributes}
      className={`group/card relative select-none rounded-lg transition-opacity ${isDragging && !isDragOverlay ? 'opacity-30' : 'opacity-100'}`}
      style={{ boxShadow: ring ? ring : '0 1px 4px rgba(0,0,0,0.15)', width: 176 }}
    >
      {/* Drag handle — only on non-group nodes */}
      {!node.isGroup && !isDragOverlay && (
        <div
          {...listeners}
          className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab text-white/40 hover:text-white/80 z-10 touch-none"
        >
          <GripVertical size={14} />
        </div>
      )}

      <div
        className="rounded-lg px-3 py-2.5 pl-6 text-center"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        <p className="text-xs font-bold leading-tight">{node.nome}</p>
        {node.cargo && (
          <p className="mt-0.5 text-[10px] font-medium opacity-80 leading-tight">{node.cargo}</p>
        )}
      </div>

      {/* Hover actions */}
      {!isDragOverlay && onEdit && (
        <div className="absolute -right-1 -top-1 hidden group-hover/card:flex items-center gap-0.5 z-20">
          <button
            onClick={() => onEdit(node)}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow text-ber-carbon hover:text-ber-teal"
          >
            <Pencil size={10} />
          </button>
          {onAddChild && (
            <button
              onClick={() => onAddChild(node.id)}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow text-ber-carbon hover:text-ber-teal"
            >
              <Plus size={10} />
            </button>
          )}
          {onDelete && canDelete && (
            <button
              onClick={() => onDelete(node.id)}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow text-ber-carbon hover:text-red-500"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      )}

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
  onEdit,
  onDelete,
}: {
  node: OrgNode;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  onEdit: (n: OrgNode) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `drop-${node.id}`, disabled: true });

  const ref = useCallback((el: HTMLDivElement | null) => {
    setNodeRef(el);
    if (el) cardRefs.current.set(node.id, el);
  }, [node.id]);

  return (
    <div ref={ref} className="group/grp flex flex-col items-center">
      <div className="rounded-lg border-2 border-dashed border-ber-gray/40 px-4 py-3 min-w-[160px]">
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-ber-gray">
          {node.nome}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {node.children.map(member => {
            const color = COLOR_MAP[member.colorKey] ?? COLOR_MAP.campo;
            return (
              <div
                key={member.id}
                className="group/member relative rounded-md px-2 py-1 text-center"
                style={{ backgroundColor: color.bg, color: color.text, minWidth: 70 }}
              >
                <p className="text-[10px] font-semibold leading-tight">{member.nome}</p>
                {member.cargo && (
                  <p className="text-[9px] opacity-75 leading-tight">{member.cargo}</p>
                )}
                <button
                  onClick={() => onEdit(member)}
                  className="absolute -right-1 -top-1 hidden group-hover/member:flex h-4 w-4 items-center justify-center rounded-full bg-white shadow text-ber-carbon hover:text-ber-teal"
                >
                  <Pencil size={8} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {/* Group-level actions */}
      <div className="mt-1 hidden group-hover/grp:flex items-center gap-1">
        <button
          onClick={() => onEdit(node)}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow text-ber-carbon hover:text-ber-teal"
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={() => onDelete(node.id)}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow text-ber-carbon hover:text-red-500"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

/* ─── Recursive tree subtree ─── */

function OrgSubtree({
  node,
  cardRefs,
  activeId,
  overId,
  onEdit,
  onAddChild,
  onDelete,
  isRoot,
}: {
  node: OrgNode;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  activeId: string | null;
  overId: string | null;
  onEdit: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  isRoot?: boolean;
}) {
  if (node.isGroup) {
    return (
      <GroupBox node={node} cardRefs={cardRefs} onEdit={onEdit} onDelete={onDelete} />
    );
  }

  const hasChildren = node.children.length > 0;
  const canDelete = !hasChildren && !isRoot;

  return (
    <div className="inline-flex flex-col items-center">
      <NodeCard
        node={node}
        cardRefs={cardRefs}
        isDropTarget={true}
        onEdit={onEdit}
        onAddChild={onAddChild}
        onDelete={onDelete}
        canDelete={canDelete}
      />

      {hasChildren && (
        <div className="flex items-start gap-8 pt-12">
          {node.children.map(child => (
            <OrgSubtree
              key={child.id}
              node={child}
              cardRefs={cardRefs}
              activeId={activeId}
              overId={overId}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ ...node, nome, cargo, colorKey });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
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

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Guard: diretoria only
  useEffect(() => {
    if (user && !perms.configuracoes) {
      router.replace('/dashboard');
    }
  }, [user]);

  useEffect(() => {
    api.get('/organograma')
      .then(r => {
        // Backend returns { data: [rootNode] }; INITIAL_DATA is an array with one root
        const payload = r.data.data;
        setTree(Array.isArray(payload) ? payload[0] : payload);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Recompute SVG lines whenever tree changes (dep array prevents infinite loop)
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
    const newTree = addChild(tree);
    applyChange(newTree);
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
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        logging: false,
      });
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
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        logging: false,
      });
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
          <p className="mt-0.5 text-xs text-ber-gray">Arraste os cartões para reorganizar · Clique no ✏️ para editar</p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={handleExportPNG}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-ber-gray/30 bg-white px-3 py-2 text-xs font-medium text-ber-carbon hover:bg-ber-offwhite disabled:opacity-50"
          >
            <Download size={13} />
            PNG
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-ber-gray/30 bg-white px-3 py-2 text-xs font-medium text-ber-carbon hover:bg-ber-offwhite disabled:opacity-50"
          >
            <Download size={13} />
            PDF
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="mt-6 overflow-auto rounded-xl border border-ber-border bg-white p-8 pb-12">
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
                <line
                  key={i}
                  x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="#D8DDD8"
                  strokeWidth={2}
                />
              ))}
            </svg>

            {/* Tree */}
            <div className="relative" style={{ zIndex: 1 }}>
              <OrgSubtree
                node={tree}
                cardRefs={cardRefs}
                activeId={activeId}
                overId={overId}
                onEdit={setEditNode}
                onAddChild={handleAddChild}
                onDelete={handleDelete}
                isRoot
              />
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeNode && (
              <NodeCard node={activeNode} isDragOverlay />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Edit modal */}
      {editNode && (
        <EditModal
          node={editNode}
          onSave={handleEditSave}
          onCancel={() => setEditNode(null)}
        />
      )}
    </div>
  );
}
