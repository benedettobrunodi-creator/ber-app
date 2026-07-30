import { Request, Response } from 'express';
import { prisma } from '../../config/database';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  no_prazo: { label: 'NO PRAZO', color: '#059669' },
  em_risco: { label: 'ATENÇÃO', color: '#D97706' },
  atrasado: { label: 'ATRASADO', color: '#DC2626' },
};

function fmt(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtShort(d: Date | string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }).replace('/', '.');
}

function diasRestantes(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

const DISCIPLINA_COLORS = [
  '#1a1a1a', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  '#6366F1', '#06B6D4', '#EAB308', '#A855F7',
];

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface EfetivoDisciplina {
  disciplina: string;
  porDia?: Record<string, number> | null;
  quantidade?: number | null;
}

function diaSemana(iso: string): string {
  return DIAS_PT[new Date(iso + 'T12:00:00').getDay()];
}

function diaMes(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Lista de datas ISO (YYYY-MM-DD) entre início e fim, inclusive.
function datasEntre(inicio: string | Date | null, fim: string | Date | null): string[] {
  if (!inicio || !fim) return [];
  const out: string[] = [];
  // Prisma entrega Date; a API entrega string ISO. String(Date).slice(0,10) vira "Sun Jul 19"
  // (inválido + erra o dia por timezone) -> datasEntre retornava [] no PDF -> caía no fallback sem gráfico.
  const toISO = (v: string | Date) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  const start = new Date(toISO(inicio) + 'T12:00:00');
  const end = new Date(toISO(fim) + 'T12:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Total de pessoas de uma disciplina: soma o porDia quando existe, senão usa quantidade.
function totalDisciplina(d: EfetivoDisciplina): number {
  if (d.porDia && Object.keys(d.porDia).length > 0) {
    return Object.values(d.porDia).reduce((s, v) => s + (Number(v) || 0), 0);
  }
  return Number(d.quantidade) || 0;
}

// Histograma de barras empilhadas por dia (uma cor por disciplina). Só o gráfico; a legenda vai em HTML abaixo.
function buildHistogramaSvg(disciplinas: EfetivoDisciplina[], dias: string[]): string {
  const W = 560, H = 150;
  const PAD = { top: 10, right: 12, bottom: 22, left: 26 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const totaisDia = dias.map(dia => disciplinas.reduce((s, d) => s + (Number(d.porDia?.[dia]) || 0), 0));
  const maxTotal = Math.max(1, ...totaisDia);
  const step = maxTotal <= 5 ? 1 : maxTotal <= 10 ? 2 : maxTotal <= 20 ? 5 : maxTotal <= 50 ? 10 : 20;
  const axisMax = Math.ceil(maxTotal / step) * step || step;

  const toY = (v: number) => PAD.top + cH - (v / axisMax) * cH;
  const bandW = cW / (dias.length || 1);
  const barW = Math.min(38, bandW * 0.6);

  const yTicks: number[] = [];
  for (let v = 0; v <= axisMax; v += step) yTicks.push(v);

  const grid = yTicks.map(v =>
    `<line x1="${PAD.left}" y1="${toY(v).toFixed(1)}" x2="${W - PAD.right}" y2="${toY(v).toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5"/>` +
    `<text x="${PAD.left - 3}" y="${(toY(v) + 3).toFixed(1)}" text-anchor="end" fill="#9ca3af" font-size="7">${v}</text>`
  ).join('');

  const bars = dias.map((dia, i) => {
    const cx = PAD.left + bandW * i + bandW / 2;
    let acc = 0;
    const segs = disciplinas.map((d, di) => {
      const val = Number(d.porDia?.[dia]) || 0;
      if (val <= 0) return '';
      const y0 = toY(acc);
      const y1 = toY(acc + val);
      acc += val;
      return `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${DISCIPLINA_COLORS[di % DISCIPLINA_COLORS.length]}"/>`;
    }).join('');
    const label = `<text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="#9ca3af" font-size="7">${diaSemana(dia)}</text>`;
    return segs + label;
  }).join('');

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif;display:block;">
  ${grid}
  ${bars}
</svg>`;
}

function buildCurvaSvg(
  pontos: { semana: Date; planejadoPct: number | null; realizadoPct: number | null }[],
  startDate: Date | null,
  endDate: Date | null,
): string {
  const W = 560, H = 150;
  const PAD = { top: 18, right: 16, bottom: 20, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allMs = pontos.map(p => new Date(p.semana).getTime());
  if (startDate) allMs.push(startDate.getTime());
  if (endDate) allMs.push(endDate.getTime());
  if (!allMs.length) return `<svg width="${W}" height="${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#9ca3af" font-size="9">Sem dados</text></svg>`;

  const minT = Math.min(...allMs);
  const maxT = Math.max(...allMs);
  const rangeT = maxT - minT || 1;

  const toX = (ms: number) => PAD.left + ((ms - minT) / rangeT) * cW;
  const toY = (pct: number) => PAD.top + cH - (pct / 100) * cH;

  const sorted = [...pontos].sort((a, b) => new Date(a.semana).getTime() - new Date(b.semana).getTime());
  const pla = sorted.filter(p => p.planejadoPct != null).map(p => ({ x: toX(new Date(p.semana).getTime()), y: toY(p.planejadoPct!) }));
  const rea = sorted.filter(p => p.realizadoPct != null).map(p => ({ x: toX(new Date(p.semana).getTime()), y: toY(p.realizadoPct!) }));

  const path = (pts: { x: number; y: number }[]) => pts.length < 2 ? '' : `M ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;

  // X labels: weeks relative to startDate, spaced at least 50px apart
  const xLabels: { x: number; label: string }[] = [];
  sorted.forEach(p => {
    const ms = new Date(p.semana).getTime();
    // Sem. 1 = dias 0-6, Sem. 2 = dias 7-13, ... → usa floor (não round).
    const wk = startDate ? Math.floor((ms - startDate.getTime()) / (7 * 86_400_000)) + 1 : xLabels.length + 1;
    const x = toX(ms);
    if (!xLabels.length || x - xLabels[xLabels.length - 1].x > 50) xLabels.push({ x, label: `Sem. ${wk}` });
  });
  if (endDate) {
    const x = toX(endDate.getTime());
    const wk = startDate ? Math.floor((endDate.getTime() - startDate.getTime()) / (7 * 86_400_000)) + 1 : '?';
    if (!xLabels.length || x - xLabels[xLabels.length - 1].x > 50) xLabels.push({ x, label: `Sem. ${wk}` });
  }

  const yLines = [0, 25, 50, 75, 100];

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif;display:block;">
  ${yLines.map(pct => `<line x1="${PAD.left}" y1="${toY(pct).toFixed(1)}" x2="${W - PAD.right}" y2="${toY(pct).toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5"/>`).join('')}
  ${yLines.map(pct => `<text x="${PAD.left - 3}" y="${(toY(pct) + 3).toFixed(1)}" text-anchor="end" fill="#9ca3af" font-size="7">${pct}%</text>`).join('')}
  ${xLabels.map(l => `<text x="${l.x.toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="#9ca3af" font-size="7">${l.label}</text>`).join('')}
  ${pla.length >= 2 ? `<path d="${path(pla)}" fill="none" stroke="#3b82f6" stroke-width="1.8" stroke-dasharray="5 2"/>` : ''}
  ${rea.length >= 2 ? `<path d="${path(rea)}" fill="none" stroke="#22c55e" stroke-width="2.4"/>` : ''}
  ${rea.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#22c55e"/>`).join('')}
  ${sorted.map(p => {
    const x = toX(new Date(p.semana).getTime());
    const parts: string[] = [];
    if (p.planejadoPct != null) parts.push(`<text x="${x.toFixed(1)}" y="${(toY(p.planejadoPct) - 6).toFixed(1)}" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="bold">${Math.round(p.planejadoPct)}%</text>`);
    if (p.realizadoPct != null) parts.push(`<text x="${x.toFixed(1)}" y="${(toY(p.realizadoPct) + 12).toFixed(1)}" text-anchor="middle" fill="#16a34a" font-size="7" font-weight="bold">${Math.round(p.realizadoPct)}%</text>`);
    return parts.join('');
  }).join('')}
  <g transform="translate(${((W - 190) / 2).toFixed(0)},8)">
    <line x1="0" y1="0" x2="12" y2="0" stroke="#3b82f6" stroke-width="1.8" stroke-dasharray="4 2"/><text x="15" y="3" fill="#6b7280" font-size="7">Planejado acumulado</text>
    <line x1="110" y1="0" x2="122" y2="0" stroke="#22c55e" stroke-width="2.4"/><text x="125" y="3" fill="#6b7280" font-size="7">Realizado acumulado</text>
  </g>
</svg>`;
}

function buildHtml(
  rel: any,
  obra: any,
  curvaS: any[],
  prevRel: any | null,
): string {
  const sec = (key: string): boolean => {
    if (!rel.secoesPdf) return true;
    return rel.secoesPdf[key] !== false;
  };
  const st = STATUS_MAP[rel.status] ?? STATUS_MAP.no_prazo;
  const prevTerminoEff: string | Date | null = rel.dataPrevistaTermino ?? obra.expectedEndDate;
  const dias = diasRestantes(prevTerminoEff ? new Date(prevTerminoEff) : null);
  const avanco = parseFloat(rel.avancoPct ?? 0);
  const delta = rel.avancoDelta != null ? parseFloat(rel.avancoDelta) : null;

  const efetivos: EfetivoDisciplina[] = rel.efetivoPorDisciplina ?? [];
  const atividades: { wbs: string; nome: string; tipo: string }[] = rel.atividadesSemana ?? [];
  const andamento = atividades.filter(a => a.tipo === 'andamento');
  const proximos = atividades.filter(a => a.tipo === 'proximo');
  const marcosConc = (rel.marcos ?? []).filter((m: any) => m.tipo === 'concluido');
  const marcosProx = (rel.marcos ?? []).filter((m: any) => m.tipo === 'proximo');

  // Agrupa fotos por AMBIENTE. Chave = nome do ângulo; senão a legenda; senão "Fotos gerais".
  // Agrupar por NOME (e não por anguloId) colapsa ambientes homônimos num único bloco com 1 título.
  const grupos = new Map<string, { nome: string; fotos: any[] }>();
  (rel.fotos ?? []).forEach((ft: any) => {
    const nome = ((ft.angulo?.nome ?? ft.legenda ?? 'Fotos gerais') as string).trim() || 'Fotos gerais';
    const e = grupos.get(nome) ?? { nome, fotos: [] };
    e.fotos.push(ft);
    grupos.set(nome, e);
  });

  const rtNum = String(rel.numero).padStart(3, '0');
  const d1 = fmt(rel.periodoInicio);
  const d2 = fmt(rel.periodoFim);

  const sectionTitle = (t: string) => `<p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#9ca3af;border-bottom:1px solid #f3f4f6;padding-bottom:3px;margin-bottom:8px;">${t}</p>`;

  const kpi = (label: string, value: string, big = false) => `
    <div style="border:1px solid #f3f4f6;border-radius:6px;padding:8px;text-align:center;">
      <p style="font-size:${big ? '20px' : '16px'};font-weight:900;color:#111827;">${value}</p>
      <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-top:2px;">${label}</p>
    </div>`;

  const bullet = (text: string, color: string) => `
    <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:3px;">
      <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;margin-top:3px;display:inline-block;"></span>
      <span style="font-size:10px;color:#374151;">${text}</span>
    </div>`;

  const fotosSection = Array.from(grupos.values()).map(({ nome, fotos }) => {
    // Foto do mesmo ambiente no relatório anterior (comparação), casando pelo NOME do ângulo.
    const prevFoto = prevRel?.fotos?.find((f: any) => f.angulo?.nome && f.angulo.nome === nome) ?? null;
    // Grid uniforme: todas as fotos no mesmo tamanho (tile 4:3, object-fit:cover).
    const cards: { url: string; cap: string; prev?: boolean }[] = [
      ...fotos.map((ft: any) => ({
        url: ft.url,
        // Não repetir a legenda quando ela é igual ao título do grupo (evita "ambiente" 2x).
        cap: (ft.legenda && String(ft.legenda).trim() !== nome) ? String(ft.legenda) : '',
      })),
      ...(prevFoto ? [{ url: prevFoto.url, cap: `RT-${String(rel.numero - 1).padStart(3, '0')} (anterior)`, prev: true }] : []),
    ];
    return `
      <div style="margin-bottom:16px;">
        <p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;margin-bottom:6px;break-after:avoid;">${nome}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start;">
          ${cards.map(c => `
            <div style="break-inside:avoid;${c.prev ? 'opacity:0.6;' : ''}">
              <img src="${c.url}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;display:block;background:#f9fafb;" />
              ${c.cap ? `<p style="font-size:7px;color:#9ca3af;margin-top:2px;">${c.cap}</p>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  const hasFotos = grupos.size > 0;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111827; background: white; }
  @media print { @page { size: A4; margin: 20mm; } }
</style>
</head>
<body>

<!-- CABEÇALHO -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:2px solid #111827;margin-bottom:16px;">
  <div>
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#9ca3af;margin-bottom:2px;">Relatório Gerencial de Obra</p>
    <h1 style="font-size:20px;font-weight:900;color:#111827;line-height:1.1;">${obra.name}</h1>
    ${obra.client ? `<p style="font-size:11px;color:#6b7280;margin-top:2px;">${obra.client}</p>` : ''}
  </div>
  <div style="text-align:right;">
    <p style="font-size:22px;font-weight:900;color:#111827;">RT-${rtNum}</p>
    <p style="font-size:9px;color:#6b7280;margin-top:2px;">${d1} — ${d2}</p>
  </div>
</div>

${(rel.dataInicioObra || rel.dataPrevistaTermino || rel.dataRealTermino) ? `
<div style="display:flex;gap:24px;margin-bottom:10px;font-size:9px;color:#6b7280;">
  ${rel.dataInicioObra ? `<span><b style="color:#374151;">Início: </b>${fmt(rel.dataInicioObra)}</span>` : ''}
  ${rel.dataPrevistaTermino ? `<span><b style="color:#374151;">Prev. término: </b>${fmt(rel.dataPrevistaTermino)}</span>` : ''}
  ${rel.dataRealTermino ? `<span style="color:#059669;"><b>Término real: </b>${fmt(rel.dataRealTermino)}</span>` : ''}
</div>` : ''}

<!-- STATUS + PRAZO -->
<div style="display:flex;gap:10px;margin-bottom:16px;">
  <div style="width:130px;flex-shrink:0;border-radius:6px;border:1px solid ${st.color};display:flex;align-items:center;justify-content:center;padding:10px;">
    <span style="font-size:11px;font-weight:900;letter-spacing:0.08em;color:${st.color};">${st.label}</span>
  </div>
  <div style="flex:1;border-radius:6px;border:1px solid #e5e7eb;padding:10px;">
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:2px;">Previsão de conclusão</p>
    <p style="font-size:14px;font-weight:900;color:#111827;">${prevTerminoEff ? fmt(prevTerminoEff) : '—'}</p>
    ${dias != null ? `<p style="font-size:9px;margin-top:2px;color:${dias < 0 ? '#DC2626' : dias <= 14 ? '#D97706' : '#6b7280'};">${dias < 0 ? `${Math.abs(dias)} dias em atraso` : `${dias} dias restantes`}</p>` : ''}
  </div>
</div>

<!-- AVANÇO FÍSICO -->
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Avanço Físico')}
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
    ${kpi('Acumulado', `${avanco}%`, true)}
    ${kpi('Na semana', delta != null ? `+${delta}%` : '—')}
    ${kpi('Efetivo médio/dia', rel.efetivoMedio != null ? String(parseFloat(rel.efetivoMedio)) : '—')}
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
    <span style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;">Avanço físico acumulado</span>
    <span style="font-size:9px;font-weight:900;color:#111827;">${avanco}%</span>
  </div>
  <div style="height:8px;width:100%;background:#f3f4f6;border-radius:4px;overflow:hidden;">
    <div style="height:100%;width:${Math.min(100, avanco)}%;background:#111827;border-radius:4px;"></div>
  </div>
</div>

<!-- CURVA S -->
${curvaS.length >= 1 && sec('curvaS') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Curva S — Planejado vs. Realizado (acumulado)')}
  ${buildCurvaSvg(curvaS, obra.startDate ? new Date(obra.startDate) : null, obra.expectedEndDate ? new Date(obra.expectedEndDate) : null)}
</div>` : ''}

<!-- HISTOGRAMA / EFETIVO POR DISCIPLINA -->
${efetivos.length > 0 && sec('equipe') ? (() => {
  const dias = datasEntre(rel.periodoInicio, rel.periodoFim);
  const hasMatriz = efetivos.some(d => d.porDia && Object.keys(d.porDia).length > 0) && dias.length > 0;
  const totalGeral = efetivos.reduce((s, d) => s + totalDisciplina(d), 0);
  const thDay = 'font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;padding:3px 2px;text-align:center;';

  if (hasMatriz) {
    const matriz = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead><tr style="border-bottom:1px solid #d1d5db;">
          <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;padding:3px 4px 3px 0;text-align:left;">Disciplina</th>
          ${dias.map(dia => `<th style="${thDay}"><div>${diaSemana(dia)}</div><div style="font-size:6px;font-weight:400;color:#b7bcc4;">${diaMes(dia)}</div></th>`).join('')}
          <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;padding:3px 0 3px 4px;text-align:center;">Total</th>
        </tr></thead>
        <tbody>
          ${efetivos.map(d => `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:4px 4px 4px 0;color:#374151;font-size:9px;">${d.disciplina}</td>
            ${dias.map(dia => `<td style="padding:4px 2px;text-align:center;color:#374151;font-size:9px;">${Number(d.porDia?.[dia]) || 0}</td>`).join('')}
            <td style="padding:4px 0 4px 4px;text-align:center;font-weight:600;color:#111827;font-size:9px;">${totalDisciplina(d)}</td>
          </tr>`).join('')}
          <tr style="border-top:1px solid #d1d5db;background:#f9fafb;">
            <td style="padding:4px 4px 4px 0;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Total/dia</td>
            ${dias.map(dia => `<td style="padding:4px 2px;text-align:center;font-weight:600;color:#111827;font-size:9px;">${efetivos.reduce((s, d) => s + (Number(d.porDia?.[dia]) || 0), 0)}</td>`).join('')}
            <td style="padding:4px 0 4px 4px;text-align:center;font-weight:900;color:#111827;font-size:9px;">${totalGeral}</td>
          </tr>
        </tbody>
      </table>`;

    const legenda = `
      <div style="display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:center;margin-top:6px;">
        ${efetivos.map((d, di) => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:8px;color:#4b5563;">
          <span style="width:8px;height:8px;border-radius:2px;background:${DISCIPLINA_COLORS[di % DISCIPLINA_COLORS.length]};display:inline-block;"></span>${d.disciplina}
        </span>`).join('')}
      </div>`;

    return `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Histograma de efetivos')}
  ${matriz}
  ${buildHistogramaSvg(efetivos, dias)}
  ${legenda}
</div>`;
  }

  // Fallback: sem matriz por dia → tabela simples (usa totalDisciplina p/ evitar undefined/NaN).
  return `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Efetivo por disciplina')}
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Disciplina</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:right;width:80px;">Pessoas</th>
    </tr></thead>
    <tbody>
      ${efetivos.map(e => `<tr><td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${e.disciplina}</td><td style="padding:5px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:500;">${totalDisciplina(e)}</td></tr>`).join('')}
      <tr>
        <td style="padding:5px 0;border-top:1px solid #d1d5db;font-size:8px;font-weight:700;text-transform:uppercase;color:#6b7280;">Total</td>
        <td style="padding:5px 0;border-top:1px solid #d1d5db;text-align:right;font-weight:900;">${totalGeral}</td>
      </tr>
    </tbody>
  </table>
</div>`;
})() : ''}

<!-- ATIVIDADES DA SEMANA -->
${atividades.length > 0 && sec('atividades') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Atividades da semana')}
  ${andamento.length > 0 ? `
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:4px;">Em andamento</p>
    ${andamento.map(a => bullet(a.nome, '#3b82f6')).join('')}` : ''}
  ${proximos.length > 0 ? `
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-top:8px;margin-bottom:4px;">Próximos</p>
    ${proximos.map(a => bullet(a.nome, '#f59e0b')).join('')}` : ''}
</div>` : ''}

<!-- PONTOS DE ATENÇÃO -->
${(rel.pontosAtencao ?? []).length > 0 && sec('pontosAtencao') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Pontos de atenção')}
  ${(rel.pontosAtencao as any[]).map((p: any) => `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;">
      <span style="font-size:7px;font-weight:700;padding:2px 6px;border-radius:3px;flex-shrink:0;margin-top:2px;background:${p.severidade === 'critico' ? '#fee2e2' : '#fef3c7'};color:${p.severidade === 'critico' ? '#b91c1c' : '#92400e'};">
        ${p.severidade === 'critico' ? 'CRÍTICO' : 'ATENÇÃO'}
      </span>
      <span style="font-size:10px;color:#374151;">${p.descricao}</span>
    </div>`).join('')}
</div>` : ''}

<!-- PLANO DE AÇÃO -->
${(rel.planoAcao ?? []).length > 0 && sec('planoAcao') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Plano de ação para atividades em atraso')}
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Atividade atrasada</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Ação corretiva</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:90px;">Responsável</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:70px;">Prazo</th>
    </tr></thead>
    <tbody>
      ${(rel.planoAcao as any[]).map((p: any) => `<tr>
        <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${p.atividadeAtrasada}</td>
        <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${p.acaoCorretiva}</td>
        <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${p.responsavel || '—'}</td>
        <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${p.prazo ? fmt(p.prazo) : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- ENTREGAS PREVISTAS -->
${(rel.entregasPrevistas ?? []).length > 0 && sec('entregasPrevistas') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Entregas previstas')}
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Material / Equipamento</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:70px;">Data prevista</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:90px;">Status</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Observação</th>
    </tr></thead>
    <tbody>
      ${(rel.entregasPrevistas as any[]).map((e: any) => {
        const badge = e.status === 'recebida' ? { bg: '#d1fae5', text: '#065f46', label: 'RECEBIDA' } : e.status === 'reprogramada' ? { bg: '#fee2e2', text: '#b91c1c', label: 'REPROGRAMADA' } : { bg: '#fef3c7', text: '#92400e', label: 'PREVISTA' };
        return `<tr>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${e.descricao}</td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${e.dataPrevista ? fmt(e.dataPrevista) : '—'}</td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:7px;font-weight:700;padding:2px 5px;border-radius:3px;background:${badge.bg};color:${badge.text};">${badge.label}</span>
          </td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${e.observacao || '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- MARCOS -->
${(marcosConc.length > 0 || marcosProx.length > 0) && sec('marcos') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Marcos')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    ${marcosConc.length > 0 ? `
      <div>
        <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:6px;">Concluídos no período</p>
        ${marcosConc.map((m: any) => `
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;">
            <span style="width:7px;height:7px;border-radius:50%;background:#10b981;flex-shrink:0;margin-top:2px;display:inline-block;"></span>
            <div><p style="font-size:10px;font-weight:500;color:#111827;">${m.nome}</p><p style="font-size:8px;color:#9ca3af;">${fmt(m.data)}</p></div>
          </div>`).join('')}
      </div>` : '<div></div>'}
    ${marcosProx.length > 0 ? `
      <div>
        <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:6px;">Próximos marcos críticos</p>
        ${marcosProx.map((m: any) => `
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;">
            <span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:2px;display:inline-block;"></span>
            <div><p style="font-size:10px;font-weight:500;color:#111827;">${m.nome}</p><p style="font-size:8px;color:#9ca3af;">${fmt(m.data)}</p></div>
          </div>`).join('')}
      </div>` : '<div></div>'}
  </div>
</div>` : ''}

<!-- DESTAQUES -->
${rel.destaques && sec('destaques') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Destaques da semana')}
  <p style="font-size:10px;color:#374151;white-space:pre-wrap;line-height:1.5;">${rel.destaques}</p>
</div>` : ''}

<!-- REGISTRO FOTOGRÁFICO -->
${hasFotos && sec('fotos') ? `
<div style="margin-bottom:14px;">
  ${sectionTitle('Registro fotográfico')}
  ${fotosSection}
</div>` : ''}

<!-- ITENS EM ABERTO -->
${(rel.pendencias ?? []).length > 0 && sec('pendencias') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Itens em aberto')}
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Item</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:100px;">Responsável</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:80px;">Status</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:80px;">Data limite</th>
    </tr></thead>
    <tbody>
      ${(rel.pendencias ?? []).map((p: any) => {
        const badgeColor = p.status === 'critico' ? { bg: '#fee2e2', text: '#b91c1c' } : p.status === 'atencao' ? { bg: '#fef3c7', text: '#92400e' } : { bg: '#d1fae5', text: '#065f46' };
        const badgeLabel = p.status === 'critico' ? 'CRÍTICO' : p.status === 'atencao' ? 'ATENÇÃO' : 'SOB CONTROLE';
        return `<tr>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${p.descricao}</td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${p.responsavel ?? '—'}</td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:7px;font-weight:700;padding:2px 5px;border-radius:3px;background:${badgeColor.bg};color:${badgeColor.text};">${badgeLabel}</span>
          </td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${p.prazo ? fmt(p.prazo) : '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- PRÓXIMOS 7 DIAS -->
${rel.proximosSete && sec('proximosSete') ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Próximos 7 dias')}
  <p style="font-size:10px;color:#374151;white-space:pre-wrap;line-height:1.5;">${rel.proximosSete}</p>
</div>` : ''}

<!-- RODAPÉ -->
<div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;">
  <div>
    ${rel.responsavelNome ? `
      <div style="width:130px;border-bottom:1px solid #9ca3af;margin-bottom:3px;"></div>
      <p style="font-size:9px;color:#4b5563;">${rel.responsavelNome}</p>
      <p style="font-size:7px;color:#9ca3af;">Responsável técnico</p>` : ''}
  </div>
  <p style="font-size:7px;color:#d1d5db;">BÈR Engenharia · ${fmt(new Date())}</p>
</div>

</body>
</html>`;
}

export async function generatePdf(req: Request, res: Response) {
  try {
    const { id: obraId, relatorioId } = req.params;

    const [relatorio, obra, curvaSPontos, allRelatorios] = await Promise.all([
      prisma.relatorioSemanal.findFirst({
        where: { id: relatorioId, obraId },
        include: {
          pendencias: { orderBy: { ordem: 'asc' } },
          marcos: { orderBy: { data: 'asc' } },
          fotos: {
            orderBy: { ordem: 'asc' },
            include: { angulo: { select: { id: true, nome: true } } },
          },
        },
      }),
      prisma.obra.findUnique({
        where: { id: obraId },
        select: { name: true, client: true, expectedEndDate: true, startDate: true },
      }),
      prisma.relatorioCurvaS.findMany({ where: { obraId }, orderBy: { semana: 'asc' } }),
      prisma.relatorioSemanal.findMany({
        where: { obraId },
        orderBy: { numero: 'asc' },
        select: {
          numero: true,
          fotos: { include: { angulo: { select: { id: true, nome: true } } } },
        },
      }),
    ]);

    if (!relatorio || !obra) {
      return res.status(404).json({ error: { message: 'Relatório ou obra não encontrado' } });
    }

    const prevRel = allRelatorios.find(r => r.numero === relatorio.numero - 1) ?? null;
    const html = buildHtml(relatorio, obra, curvaSPontos, prevRel);

    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium-browser';
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      // Wait for images to finish loading
      await page.evaluate(() => Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Array.from((globalThis as any).document.querySelectorAll('img')).map((img: any) =>
          img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })
        )
      ));

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      });

      const rtNum = String(relatorio.numero).padStart(3, '0');
      const d1 = fmtShort(relatorio.periodoInicio);
      const d2 = fmtShort(relatorio.periodoFim);
      const obraNome = obra.name.replace(/[/\\:*?"<>|]/g, '-');
      const filename = `BER_${obraNome}_RT-${rtNum}_${d1}-${d2}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
    }
  } catch (e: any) {
    console.error('[pdf] ERROR:', e.message);
    return res.status(500).json({ error: { message: e.message } });
  }
}
