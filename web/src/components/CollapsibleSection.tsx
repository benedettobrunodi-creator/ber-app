'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  accent?: 'teal' | 'olive' | 'amber' | 'red' | 'green';
  defaultOpen?: boolean;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}

const ACCENT_STYLES = {
  teal:  { bg: 'bg-ber-teal/10',  text: 'text-ber-teal',  border: 'border-l-ber-teal' },
  olive: { bg: 'bg-ber-olive/10', text: 'text-ber-olive', border: 'border-l-ber-olive' },
  amber: { bg: 'bg-amber-50',     text: 'text-amber-600', border: 'border-l-amber-500' },
  red:   { bg: 'bg-red-50',       text: 'text-ber-red',   border: 'border-l-ber-red' },
  green: { bg: 'bg-green-50',     text: 'text-ber-green',  border: 'border-l-ber-green' },
};

export default function CollapsibleSection({
  title,
  count,
  accent = 'teal',
  defaultOpen = true,
  children,
  onAdd,
  addLabel = '+ Adicionar item',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const s = ACCENT_STYLES[accent];

  return (
    <div className={`rounded-xl bg-white border border-ber-border shadow-sm overflow-hidden border-l-4 ${s.border}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-gray-50 ${s.bg}`}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={16} className={s.text} /> : <ChevronRight size={16} className={s.text} />}
          <h3 className={`text-xs font-black uppercase tracking-widest ${s.text}`}>
            {count !== undefined && <span className="mr-1.5">{count}</span>}
            {title}
          </h3>
        </div>
        <span className="text-[10px] text-ber-gray">{open ? 'recolher' : 'expandir'}</span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 py-4">
          {children}

          {/* Add button */}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ber-gray/30 py-2.5 text-sm font-medium text-ber-gray hover:border-ber-teal hover:text-ber-teal transition-colors"
            >
              {addLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
