'use client';

import { useRouter } from 'next/navigation';

export type Farol = 'verde' | 'amarelo' | 'vermelho';

export interface ObraClickUpRow {
  id: string;
  name: string;
  status: string;
  progressPercent: number;
  totalTasks: number;
  doneTasks: number;
  atrasadas: number;
  urgentes: number;
  proximosMarcos: number;
  farol: Farol;
}

const FAROL_COLORS: Record<Farol, { dot: string; label: string }> = {
  verde:    { dot: '#3D9E5F', label: 'No prazo' },
  amarelo:  { dot: '#B5B820', label: 'Atenção' },
  vermelho: { dot: '#E05555', label: 'Crítico' },
};

export default function ObrasClickUpPanel({ rows }: { rows: ObraClickUpRow[] }) {
  const router = useRouter();

  if (!rows.length) {
    return (
      <div className="text-sm text-ber-gray italic">
        Sem obras ativas para exibir. Sync do ClickUp roda diariamente às 06h.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ber-border text-[10px] uppercase tracking-widest text-ber-gray">
            <th className="px-5 py-2 text-left font-semibold">Obra</th>
            <th className="px-3 py-2 text-center font-semibold">Farol</th>
            <th className="px-3 py-2 text-right font-semibold">Avanço</th>
            <th className="px-3 py-2 text-right font-semibold">Tarefas</th>
            <th className="px-3 py-2 text-right font-semibold">Atrasadas</th>
            <th className="px-3 py-2 text-right font-semibold">Urgentes</th>
            <th className="px-3 py-2 text-right font-semibold">Próx. 14d</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const farol = FAROL_COLORS[r.farol];
            return (
              <tr
                key={r.id}
                onClick={() => router.push(`/obras/${r.id}`)}
                className="border-b border-ber-border/60 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-3 py-3 text-center">
                  <span
                    title={farol.label}
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: farol.dot }}
                  />
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${r.progressPercent}%`, backgroundColor: '#5A7A7A' }}
                      />
                    </div>
                    <span className="tabular-nums w-10 text-right">{r.progressPercent}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-ber-gray">
                  {r.doneTasks}/{r.totalTasks}
                </td>
                <td className="px-3 py-3 text-right tabular-nums" style={{ color: r.atrasadas > 0 ? '#E05555' : '#868686' }}>
                  {r.atrasadas}
                </td>
                <td className="px-3 py-3 text-right tabular-nums" style={{ color: r.urgentes > 0 ? '#B5B820' : '#868686' }}>
                  {r.urgentes}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-ber-gray">{r.proximosMarcos}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
