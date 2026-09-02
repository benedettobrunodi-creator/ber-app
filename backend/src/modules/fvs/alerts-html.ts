const header = `
  <div style="background:#1E2432;padding:24px 28px;border-radius:12px 12px 0 0;">
    <p style="color:#fff;font-size:16px;font-weight:700;letter-spacing:3px;margin:0;">BÈR ENGENHARIA</p>
    <p style="color:#8A93A3;font-size:10px;letter-spacing:2px;margin:4px 0 0;">CUIDADO EM CADA OBRA</p>
  </div>`;
const footer = `
  <p style="color:#868686;font-size:11px;text-align:center;margin-top:16px;">
    BÈR Engenharia · Aviso automático do Sequenciamento (FVS) — item com prazo vencido.
  </p>`;

function fmtBR(d: Date): string {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function itensVencidosHtml({ area, itens }: {
  area: string;
  itens: { obraNome: string; descricao: string; dataLimite: Date }[];
}): string {
  const porObra = new Map<string, typeof itens>();
  for (const i of itens) {
    const lista = porObra.get(i.obraNome) ?? [];
    lista.push(i);
    porObra.set(i.obraNome, lista);
  }

  const blocos = Array.from(porObra.entries()).map(([obra, lista]) => `
    <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:16px 0 6px;">${obra}</p>
    <ul style="margin:0;padding-left:18px;">
      ${lista.map(i => `
        <li style="color:#2D2D2D;font-size:13px;line-height:1.6;margin-bottom:4px;">
          ${i.descricao}
          <span style="color:#d03b3b;font-size:11px;font-weight:600;"> — vencido em ${fmtBR(i.dataLimite)}</span>
        </li>`).join('')}
    </ul>
  `).join('');

  return `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    ${header}
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">Itens de Sequenciamento vencidos — ${area}</h2>
      <p style="color:#5A7A7A;font-size:13px;margin:0;">${itens.length} ${itens.length === 1 ? 'item aberto' : 'itens abertos'} com prazo vencido, agrupados por obra:</p>
      ${blocos}
    </div>
    ${footer}
  </div>`;
}

export function fasesAtrasadasHtml({ fases }: {
  fases: { obraNome: string; faseCode: string; faseNome: string; abertos: number; total: number; faseAtual: string }[];
}): string {
  const porObra = new Map<string, typeof fases>();
  for (const f of fases) {
    const lista = porObra.get(f.obraNome) ?? [];
    lista.push(f);
    porObra.set(f.obraNome, lista);
  }

  const blocos = Array.from(porObra.entries()).map(([obra, lista]) => `
    <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:16px 0 6px;">${obra}
      <span style="color:#868686;font-weight:400;font-size:11px;"> — fase atual: ${lista[0].faseAtual}</span>
    </p>
    <ul style="margin:0;padding-left:18px;">
      ${lista.map(f => `
        <li style="color:#2D2D2D;font-size:13px;line-height:1.6;margin-bottom:4px;">
          <strong>${f.faseCode}</strong> · ${f.faseNome}
          <span style="color:#d03b3b;font-size:11px;font-weight:600;"> — ficou pra trás: ${f.abertos} de ${f.total} itens em aberto</span>
        </li>`).join('')}
    </ul>
  `).join('');

  return `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    ${header}
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">Fases do Sequenciamento que ficaram pra trás</h2>
      <p style="color:#5A7A7A;font-size:13px;margin:0;">Fase anterior à fase atual da obra com itens ainda em aberto. Resolver ou marcar N/A libera o alerta:</p>
      ${blocos}
    </div>
    ${footer}
  </div>`;
}
