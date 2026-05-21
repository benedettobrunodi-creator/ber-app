'use client';

import { X } from 'lucide-react';
import { Oportunidade, fmt, fmtDate, ETAPA_MAP } from '../types';

interface Props {
  title: string;
  oportunidades: Oportunidade[];
  onClose: () => void;
}

export default function DrilldownModal({ title, oportunidades, onClose }: Props) {
  const total = oportunidades.reduce((s, o) => s + Number(o.valor ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full md:max-w-2xl max-h-[80vh] rounded-t-2xl md:rounded-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ber-border">
          <div>
            <p className="font-bold text-ber-carbon">{title}</p>
            <p className="text-xs text-ber-gray mt-0.5">
              {oportunidades.length} oportunidade{oportunidades.length !== 1 ? 's' : ''}{total > 0 ? ` · ${fmt(total)}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ber-surface text-ber-gray">
            <X size={18} />
          </button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 divide-y divide-ber-border">
          {oportunidades.length === 0 && (
            <p className="text-center text-sm text-ber-gray py-10">Nenhuma oportunidade</p>
          )}
          {oportunidades.map((op) => {
            const etapaCfg = ETAPA_MAP[op.etapa];
            return (
              <div key={op.id} className="px-5 py-3 flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: etapaCfg?.color ?? '#aaa' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ber-carbon truncate">{op.titulo}</p>
                  <p className="text-xs text-ber-gray truncate">
                    {op.empresa?.razaoSocial ?? '—'}
                    {op.responsavel ? ` · ${op.responsavel.name}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-ber-carbon">{fmt(op.valor)}</p>
                  <p className="text-xs text-ber-gray">{etapaCfg?.label ?? op.etapa}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
