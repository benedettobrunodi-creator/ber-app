'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

export interface BurndownData {
  hasData: boolean;
  reason?: string | null;
  total: number;
  series: { date: string; remaining: number; ideal: number }[];
  pctComplete: number;
  pctExpected: number;
  status: 'ahead' | 'behind' | 'on_track';
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  data: BurndownData | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function BurndownChart({ data }: Props) {
  if (!data || !data.hasData) {
    const reason = data?.reason;
    const msg =
      reason === 'missing_dates' ? 'Defina as datas de início e prazo da obra'
      : reason === 'no_tasks' ? 'Sincronize o cronograma para gerar tarefas'
      : 'Nenhum dado disponível';
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <p className="text-sm text-gray-400">{msg}</p>
      </div>
    );
  }

  const { series, total, pctComplete, pctExpected, status } = data;
  const realColor = status === 'behind' ? '#EF4444' : status === 'ahead' ? '#22C55E' : '#3B82F6';
  const statusLabel = status === 'behind' ? 'Atrasado' : status === 'ahead' ? 'Adiantado' : 'No prazo';
  const statusClass = status === 'behind' ? 'bg-red-100 text-red-700' : status === 'ahead' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';

  const chartPoints = series.map(s => ({ ...s, date: fmtDate(s.date) }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs font-semibold text-gray-500">
          {Math.round(((total - (series[series.length - 1]?.remaining ?? total)) / total) * 100)}% concluído ({total - (series[series.length - 1]?.remaining ?? total)}/{total} tarefas)
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
          {statusLabel}
        </span>
        <span className="text-[10px] text-gray-400 ml-auto">
          Real {pctComplete}% · Esperado {pctExpected}%
        </span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            domain={[0, total]}
            allowDecimals={false}
            width={30}
            label={{ value: 'Restantes', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9CA3AF' }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: unknown, name: unknown) => [
              `${value} tarefa${Number(value) !== 1 ? 's' : ''}`,
              name === 'ideal' ? 'Ideal' : 'Real',
            ]}
          />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value: string) => (
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {value === 'ideal' ? 'Ideal' : 'Real'}
              </span>
            )}
          />
          <ReferenceLine
            x={fmtDate(new Date().toISOString().split('T')[0])}
            stroke="#9CA3AF"
            strokeDasharray="4 4"
            label={{ value: 'Hoje', fontSize: 10, fill: '#9CA3AF', position: 'top' }}
          />
          <Line type="monotone" dataKey="ideal" stroke="#94A3B8" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
          <Line type="stepAfter" dataKey="remaining" stroke={realColor} strokeWidth={2.5} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
