import PptxGenJS from 'pptxgenjs';
import type { KickoffExternoConteudo, ItemKE, PessoaKE } from './externo-template';

// PPT do Kickoff EXTERNO — design system institucional BÈR (mesmo da lib
// ppt-ber aprovada pelo Bruno 09/09/26): fundo carvão, oliva como acento,
// Montserrat, header com projeto + numeração.

const CARVAO = '1E1E22';
const CARD = '26262B';
const OLIVA = 'B5B820';
const BRANCO = 'F4F4F2';
const CINZA = '9A9C90';
const LINHA = '3A3A40';
const FONT = 'Montserrat';

interface ObraInfo { name: string; address: string | null }

export async function gerarKickoffExternoPptx(obra: ObraInfo, c: KickoffExternoConteudo): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'W', width: 13.33, height: 7.5 });
  pptx.layout = 'W';

  const cliente = c.nomeCliente || obra.name;
  let num = 0;

  const dataFmt = c.dataReuniao
    ? new Date(c.dataReuniao + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  function novoSlide(): PptxGenJS.Slide {
    num += 1;
    const s = pptx.addSlide();
    s.background = { color: CARVAO };
    // header
    s.addText(`REUNIÃO KICK OFF · ${cliente.toUpperCase()}`, {
      x: 0.55, y: 0.28, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: CINZA, charSpacing: 3, bold: true,
    });
    s.addText(String(num).padStart(2, '0'), {
      x: 12.3, y: 0.28, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 10, color: OLIVA, bold: true, align: 'right',
    });
    s.addShape('line', { x: 0.55, y: 0.62, w: 12.23, h: 0, line: { color: LINHA, width: 0.75 } });
    // footer
    s.addText('BÈR ENGENHARIA  ·  SÃO PAULO', {
      x: 0.55, y: 7.05, w: 6, h: 0.3, fontFace: FONT, fontSize: 8, color: CINZA, charSpacing: 3,
    });
    return s;
  }

  function titulo(s: PptxGenJS.Slide, txt: string) {
    s.addText(txt, { x: 0.55, y: 0.95, w: 12, h: 0.85, fontFace: FONT, fontSize: 32, color: BRANCO, bold: true });
    s.addShape('line', { x: 0.58, y: 1.85, w: 1.1, h: 0, line: { color: OLIVA, width: 3 } });
  }

  // ── CAPA ────────────────────────────────────────────────────────────────
  const capa = novoSlide();
  capa.addText('Kick off.', { x: 0.55, y: 2.5, w: 12, h: 1.1, fontFace: FONT, fontSize: 54, color: BRANCO, bold: true });
  capa.addText(`Projeto ${cliente}.`, { x: 0.55, y: 3.6, w: 12, h: 0.8, fontFace: FONT, fontSize: 30, color: OLIVA, bold: true });
  if (obra.address) capa.addText(obra.address, { x: 0.55, y: 4.6, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, color: CINZA });
  capa.addText(dataFmt, { x: 0.55, y: 5.05, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, color: CINZA });

  // ── PAUTA (das seções ativas) ───────────────────────────────────────────
  const pautaItens: string[] = [];
  if (c.time.ativo) pautaItens.push('Apresentação do time');
  if (c.escopo.ativo) pautaItens.push('Escopo de trabalho');
  if (c.responsabilidades.ativo) pautaItens.push('Responsabilidades');
  if (c.aprovacoes.ativo) pautaItens.push('Aprovações e decisões');
  if (c.comunicacao.ativo) pautaItens.push('Fluxo de comunicação');
  if (c.projetosAprovacoes.ativo) pautaItens.push('Projetos — aprovações');
  if (c.periodoObras.ativo) pautaItens.push('Período de obras');
  if (c.registros.ativo) pautaItens.push('Registros e documentos de obra');
  if (c.logistica.ativo) pautaItens.push('Logística e estacionamento');
  if (c.tecnicos.ativo) pautaItens.push('Assuntos técnicos de obra');
  if (c.condominio.ativo) pautaItens.push('Interface com o condomínio');
  const pauta = novoSlide();
  titulo(pauta, 'Pauta.');
  pautaItens.forEach((it, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    pauta.addText(String(i + 1).padStart(2, '0'), {
      x: 0.65 + col * 6.2, y: 2.25 + row * 0.75, w: 0.55, h: 0.4, fontFace: FONT, fontSize: 14, color: OLIVA, bold: true,
    });
    pauta.addText(it, {
      x: 1.3 + col * 6.2, y: 2.25 + row * 0.75, w: 5.4, h: 0.4, fontFace: FONT, fontSize: 15, color: BRANCO,
    });
  });

  // ── TIME ────────────────────────────────────────────────────────────────
  if (c.time.ativo) {
    const s = novoSlide();
    titulo(s, 'Time.');
    const pessoa = (p: PessoaKE, x: number, y: number, w: number) => {
      s.addShape('roundRect', { x, y, w, h: 1.05, rectRadius: 0.06, fill: { color: CARD }, line: { color: LINHA, width: 0.5 } });
      s.addText(p.papel.toUpperCase(), { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.28, fontFace: FONT, fontSize: 9, color: OLIVA, bold: true, charSpacing: 2 });
      s.addText(p.nome || '—', { x: x + 0.15, y: y + 0.36, w: w - 0.3, h: 0.32, fontFace: FONT, fontSize: 13, color: BRANCO, bold: true });
      if (p.contato) s.addText(p.contato, { x: x + 0.15, y: y + 0.68, w: w - 0.3, h: 0.26, fontFace: FONT, fontSize: 9, color: CINZA });
    };
    s.addText('LADO BÈR', { x: 0.55, y: 2.05, w: 4, h: 0.3, fontFace: FONT, fontSize: 11, color: CINZA, bold: true, charSpacing: 2 });
    c.time.ladoBer.forEach((p, i) => pessoa(p, 0.55 + (i % 2) * 3.2, 2.45 + Math.floor(i / 2) * 1.2, 3.05));
    s.addText('BACK OFFICE', { x: 7.1, y: 2.05, w: 3, h: 0.3, fontFace: FONT, fontSize: 11, color: CINZA, bold: true, charSpacing: 2 });
    c.time.backOffice.forEach((p, i) => pessoa(p, 7.1, 2.45 + i * 1.2, 2.85));
    s.addText(`LADO ${cliente.toUpperCase()}`, { x: 10.15, y: 2.05, w: 3, h: 0.3, fontFace: FONT, fontSize: 11, color: CINZA, bold: true, charSpacing: 2 });
    c.time.ladoCliente.forEach((p, i) => pessoa(p, 10.15, 2.45 + i * 1.2, 2.65));
  }

  // ── ESCOPO ──────────────────────────────────────────────────────────────
  if (c.escopo.ativo && c.escopo.texto.trim()) {
    const s = novoSlide();
    titulo(s, 'Escopo de trabalho.');
    s.addText(c.escopo.texto, { x: 0.55, y: 2.3, w: 11.5, h: 3.5, fontFace: FONT, fontSize: 18, color: BRANCO, lineSpacing: 30, valign: 'top' });
  }

  // ── RESPONSABILIDADES ───────────────────────────────────────────────────
  if (c.responsabilidades.ativo) {
    const s = novoSlide();
    titulo(s, 'Responsabilidades.');
    const lista = (rotulo: string, itens: string[], x: number) => {
      s.addText(rotulo, { x, y: 2.15, w: 5.6, h: 0.32, fontFace: FONT, fontSize: 11, color: OLIVA, bold: true, charSpacing: 2 });
      s.addText(itens.map((t) => ({ text: `—   ${t}`, options: { breakLine: true } })), {
        x, y: 2.55, w: 5.6, h: 3.6, fontFace: FONT, fontSize: 14, color: BRANCO, lineSpacing: 26, valign: 'top',
      });
    };
    lista(`LADO ${cliente.toUpperCase()}`, c.responsabilidades.cliente, 0.55);
    lista('LADO BÈR', c.responsabilidades.ber, 6.9);
  }

  // ── genérico: lista numerada de itens {titulo, descricao} ───────────────
  const slideItens = (tituloSlide: string, intro: string | null, itens: ItemKE[]) => {
    const s = novoSlide();
    titulo(s, tituloSlide);
    let y = 2.15;
    if (intro) { s.addText(intro, { x: 0.55, y, w: 11.5, h: 0.35, fontFace: FONT, fontSize: 13, color: CINZA }); y += 0.55; }
    itens.forEach((it, i) => {
      s.addText(String(i + 1).padStart(2, '0'), { x: 0.55, y, w: 0.6, h: 0.4, fontFace: FONT, fontSize: 16, color: OLIVA, bold: true });
      s.addText(it.titulo.toUpperCase(), { x: 1.25, y, w: 10.8, h: 0.35, fontFace: FONT, fontSize: 13, color: BRANCO, bold: true, charSpacing: 1 });
      if (it.descricao) { s.addText(it.descricao, { x: 1.25, y: y + 0.36, w: 10.8, h: 0.35, fontFace: FONT, fontSize: 11, color: CINZA }); }
      y += it.descricao ? 0.95 : 0.6;
    });
  };

  if (c.aprovacoes.ativo && c.aprovacoes.itens.length) slideItens('Aprovações e decisões.', c.aprovacoes.intro, c.aprovacoes.itens);
  if (c.comunicacao.ativo && c.comunicacao.blocos.length) slideItens('Fluxo de comunicação.', null, c.comunicacao.blocos);
  if (c.projetosAprovacoes.ativo && c.projetosAprovacoes.etapas.length) slideItens('Projetos — aprovações.', null, c.projetosAprovacoes.etapas);

  // ── PERÍODO DE OBRAS ────────────────────────────────────────────────────
  if (c.periodoObras.ativo) {
    const s = novoSlide();
    titulo(s, 'Período de obras.');
    s.addText(c.periodoObras.texto, { x: 0.55, y: 2.4, w: 11.5, h: 0.7, fontFace: FONT, fontSize: 26, color: BRANCO, bold: true });
    s.addText(c.periodoObras.observacao, { x: 0.55, y: 3.2, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 14, color: CINZA });
  }

  if (c.registros.ativo && c.registros.blocos.length) slideItens('Registros e documentos de obra.', null, c.registros.blocos);

  // ── LOGÍSTICA ───────────────────────────────────────────────────────────
  if (c.logistica.ativo) {
    const s = novoSlide();
    titulo(s, `${c.logistica.titulo}.`);
    s.addText(c.logistica.texto, { x: 0.55, y: 2.4, w: 11.5, h: 2.5, fontFace: FONT, fontSize: 17, color: BRANCO, lineSpacing: 28, valign: 'top' });
  }

  // ── TÉCNICOS (índice + um slide por bloco) ──────────────────────────────
  if (c.tecnicos.ativo && c.tecnicos.blocos.length) {
    slideItens('Assuntos técnicos de obra.', null, c.tecnicos.blocos.map((b) => ({ titulo: b.titulo, descricao: '' })));
    for (const bloco of c.tecnicos.blocos) {
      if (!bloco.topicos.length) continue;
      const s = novoSlide();
      titulo(s, `${bloco.titulo}.`);
      let y = 2.15;
      bloco.topicos.forEach((t) => {
        s.addText(t.titulo.toUpperCase(), { x: 0.55, y, w: 11.8, h: 0.32, fontFace: FONT, fontSize: 12, color: OLIVA, bold: true, charSpacing: 1.5 });
        s.addText(t.descricao, { x: 0.55, y: y + 0.33, w: 11.8, h: 0.55, fontFace: FONT, fontSize: 12, color: BRANCO, lineSpacing: 18 });
        y += 1.05;
      });
    }
  }

  // ── CONDOMÍNIO ──────────────────────────────────────────────────────────
  if (c.condominio.ativo && c.condominio.texto.trim()) {
    const s = novoSlide();
    titulo(s, 'Interface com o condomínio.');
    s.addText(c.condominio.texto, { x: 0.55, y: 2.4, w: 11.5, h: 2.5, fontFace: FONT, fontSize: 17, color: BRANCO, lineSpacing: 28, valign: 'top' });
  }

  // ── ENCERRAMENTO ────────────────────────────────────────────────────────
  const fim = novoSlide();
  fim.addText(c.encerramento || "Let's Move Forward!", {
    x: 0.55, y: 3.1, w: 12.2, h: 1.2, fontFace: FONT, fontSize: 44, color: OLIVA, bold: true, align: 'center',
  });

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return out;
}
