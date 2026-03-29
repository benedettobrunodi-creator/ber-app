'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  id: string;
  children: ReactNode;
}

export default function CockpitBlock({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Grip handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 hidden cursor-grab rounded p-1 text-ber-gray/30 transition-colors hover:bg-ber-offwhite hover:text-ber-gray group-hover:flex active:cursor-grabbing"
        title="Arrastar para reordenar"
        tabIndex={-1}
      >
        <GripVertical size={14} />
      </button>
      {children}
    </div>
  );
}
