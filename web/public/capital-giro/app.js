/* ============================================================
   ESTADO
   ============================================================ */
const LS_THEME = 'ber_theme_v1'; // preferência de tema (claro/escuro) continua local — não é dado de negócio

const DEFAULT_PREM = {
  juros: 2.8,      // %/mês (custo do dinheiro / antecipação)
  imposto: 17,     // % sobre receita (adm + savings)
  adm: 10,         // % taxa de administração sobre o budget
  savings: 8,      // % share sobre a economia
  agio: 70,        // % do contrato que passa pelo caixa da BER
  ret: 10,         // % retenção
  forn: 30,        // dias pagamento fornecedor
  receb: 60,       // dias recebimento cliente
  metaAnual: 70000000,  // R$ meta de faturamento anual
  estruturaPct: 6,      // % da meta anual gasto com estrutura fixa (legado)
  backofficeMes: 500000 // R$ despesa fixa (backoffice) por mês — sai do caixa único todo mês
};

const SEED_OBRAS = [
  { id:'exemplo', nome:'Obra Exemplo', contrato:3000000, agio:40, mod:143000, fornMat:558000, budget:701000, imposto:11.5, savings:10, adm:10, ret:0, juros:2.8, comissao:3.87, duracao:4, inicioMes:'2026-08', sinal:20, prazoSinal:0, formaReceb:'prazo', prazoReceb:30, fornTipo:'prazo', fornDias:15 }
];

let PREM  = structuredClone(DEFAULT_PREM);
let OBRAS = structuredClone(SEED_OBRAS);
let editingId = null;

// ── Persistência: portada de localStorage pra API do ber-app (banco real) ──
// Mesmo contrato de antes (load/save síncronos do ponto de vista de quem
// chama) — só a implementação mudou. A base da API vem de uma <meta> tag
// (já presente no DOM antes deste script rodar — evita race condition).
function apiBase(){
  const m = document.querySelector('meta[name="cg-api-base"]');
  return m ? m.content : '';
}
function apiHeaders(){
  const t = (typeof localStorage!=='undefined') ? localStorage.getItem('accessToken') : null;
  const h = { 'Content-Type': 'application/json' };
  if(t) h['Authorization'] = 'Bearer '+t;
  return h;
}
// Trava de segurança: NUNCA deixar salvar antes de um load bem-sucedido —
// se o load falhar (rede, deploy em andamento, 401 etc.), OBRAS fica no
// padrão (SEED_OBRAS) e o render() automático no final do CGInit chamaria
// save(), sobrescrevendo o dado real do banco com o exemplo. Já aconteceu
// (2026-08-08, perdeu obra real durante uma janela de deploy) — daqui pra
// frente save() é um no-op até _loadOk virar true.
let _loadOk = false;
async function loadState(){
  try {
    const res = await fetch(apiBase() + '/capital-giro/state', { headers: apiHeaders() });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const json = await res.json();
    const data = json.data || {};
    if(Array.isArray(data.obras) && data.obras.length) OBRAS = data.obras;
    if(data.premissas && Object.keys(data.premissas).length) PREM = Object.assign(structuredClone(DEFAULT_PREM), data.premissas);
    _loadOk = true;
  } catch(e){
    console.error('[capital-giro] erro ao carregar estado — edição bloqueada até recarregar com sucesso:', e);
    alert('Não consegui carregar os dados salvos do Capital de Giro (falha de rede ou servidor). Pra sua segurança, edições ficam bloqueadas até recarregar a página com sucesso — nada será sobrescrito.');
  }
  PREM.backofficeMes = DEFAULT_PREM.backofficeMes; // constante do negócio, nunca vem do salvo
}
let _saveTimer = null;
function save(){
  if(!_loadOk){ console.warn('[capital-giro] save() ignorado — load inicial ainda não confirmado.'); return; }
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>{
    fetch(apiBase() + '/capital-giro/state', {
      method: 'PUT', headers: apiHeaders(),
      body: JSON.stringify({ obras: OBRAS, premissas: PREM }),
    }).catch(e => console.error('[capital-giro] erro ao salvar:', e));
  }, 350); // debounce leve — bindPrem() dispara render()+save() a cada tecla
}

/* ============================================================
   MOTOR FINANCEIRO
   ------------------------------------------------------------
   Só a FATIA ÁGIO (agio% do contrato) passa pelo caixa.
   Custo é repasse: você paga fornecedor, cliente reembolsa.
   Timing (em meses, arredondado):
     saída fornecedor  = mês de execução + forn/30
     entrada reembolso = mês de execução + (aprov + receb)/30
   Sinal: adiantamento no início, amortizado no fim (net zero, alivia o pico).
   Retenção: segura ret% do reembolso até o fim + reembolso.
   Receita real (lucro) = adm + savings, líquidos de imposto, caem junto do reembolso.
   Pool: soma todas as obras na linha do tempo. Saldo negativo => antecipação
   a juros%/mês sobre o buraco (capitalizado). Zero capital próprio.
   ============================================================ */
function months(dias){ return Math.max(0, Math.round(dias/30)); }
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function mesToIndex(ym){ if(!ym) return null; const p=ym.split('-'); return (+p[0])*12 + ((+p[1])-1); }
function indexToMes(idx){ const y=Math.floor(idx/12), m=((idx%12)+12)%12; return { ym: y+'-'+String(m+1).padStart(2,'0'), label: MESES[m]+'/'+String(y).slice(-2) }; }
let BASE_MES = null; // índice do mês 1 da linha do tempo
function parseParcelas(str){
  if(!str) return [];
  return str.split(',').map(s=>{
    const parts = s.split(':');
    const mes = parseFloat((parts[0]||'').trim());
    const pct = parseFloat((parts[1]||'').trim());
    return (isNaN(mes)||isNaN(pct)) ? null : { mes, pct };
  }).filter(Boolean);
}

// #4 curva de avanço físico-financeiro → fração de cada mês (soma sempre = 1)
function curvaFracs(dur, tipo){
  dur = Math.max(1, dur|0);
  const w = [];
  for(let t=1;t<=dur;t++){
    const x = dur===1 ? 0.5 : (t-0.5)/dur;   // posição no meio do mês [0..1]
    let wt;
    if(tipo==='s')          wt = Math.exp(-Math.pow((x-0.5)/0.24, 2));  // curva S: taxa em sino (lento→rápido→lento)
    else if(tipo==='front') wt = 1 - 0.8*x;                            // front-loaded: forte no começo
    else if(tipo==='back')  wt = 0.2 + 0.8*x;                          // back-loaded: forte no fim
    else                    wt = 1;                                     // linear (uniforme)
    w.push(Math.max(1e-4, wt));
  }
  const s = w.reduce((a,b)=>a+b,0);
  return w.map(v=>v/s);
}
function computeObra(o, prem){
  const dur = Math.max(1, o.duracao|0);
  const start = Math.max(1, o._inicioG || o.inicio || 1);
  // parâmetros financeiros POR OBRA (herdam do padrão global se não definidos)
  const agioPct = (o.agio ?? prem.agio)/100;
  const impPct = (o.imposto ?? prem.imposto)/100;
  const faturamento = o.contrato * agioPct;                          // fatia agio = faturamento (já inclui a taxa de adm)
  const impV = faturamento * impPct;                                 // imposto (só sobre a fatia BER faturada)
  const faturamentoNet = faturamento - impV;                         // − imposto (só sobre a fatia BER)
  const faturamentoDireto = o.contrato - faturamento;                // contrato − fatia BER (o que o cliente compra direto)
  const admV = o.contrato * ((o.adm ?? prem.adm)/100);               // taxa de administração — sobre o contrato total
  // === BUDGET DA OBRA ===
  const savPct = (o.savings ?? prem.savings)/100;
  const custoOrcado = (o.budget!=null ? o.budget : 0);               // Custo orçado da obra (digitado, projeto inteiro)
  const modV = (o.mod!=null ? o.mod : 0);                            // Mão de obra direta · equipe (digitado, integral — sempre da BER)
  // FIX 2026-08-08 (Bruno): savings de compras = % sobre (contrato total − imposto − equipe − taxa de adm),
  // não mais sobre (custo orçado − MOD). Base maior e alinhada ao que sobra pra BER reter como margem.
  const savingsBase = Math.max(0, o.contrato - impV - modV - admV);
  const savingsGeral = savPct * savingsBase;                         // savings geral (unificado) → margem retida
  const savingsVal = savingsGeral;                                   // (compat p/ referências antigas)
  const budgetCompras = Math.max(0, custoOrcado - modV - savingsGeral); // Budget de compras = orçado − MOD − savings (DERIVADO, projeto inteiro)
  // FIX 2026-08-08: só a FATIA BER das compras passa pelo caixa da BER; o resto é relação direta
  // cliente↔parceiro/subcontratado (fora do caixa/exposição da BER). Fórmula antiga usava (1-fatia),
  // invertida — jogava a maior parte do custo de terceiros pro caixa da BER. Corrigido pra usar a fatia.
  const comprasNoFluxo = budgetCompras * agioPct;
  const fornV = comprasNoFluxo;                                      // compras (fatia BER) que a BER financia/paga — entra no fluxo
  const agioVal = modV + fornV;                                      // custo da BER = MOD (integral) + compras (fatia BER)
  const ret = (o.ret ?? prem.ret)/100;
  const sinalVal = o.contrato * ((o.sinal||0)/100);
  // FIX 2026-08-08 (Bruno): comissão e RT usam a MESMA base do savings — contrato total
  // (não a fatia — comissão é sobre o negócio inteiro) − imposto − equipe − taxa de adm.
  const baseComRT = savingsBase;
  const comissaoTotal = baseComRT * ((o.comissao||0)/100);
  const rtTotal       = baseComRT * ((o.reservaTecnica||0)/100);

  const lagForn  = months(o.fornTipo==='avista' ? 0 : (o.fornDias != null ? o.fornDias : prem.forn)); // pagamento fornecedor (por obra)
  const lagReceb = 1 + months(o.prazoReceb != null ? o.prazoReceb : prem.receb); // +1 = medição fecha no fim do mês; recebe o prazo depois
  const lagSinal = months(o.prazoSinal != null ? o.prazoSinal : prem.receb);    // prazo do sinal (0 = à vista)
  // #1 fornecedor escalonado: sinal% na largada + saldo em 2 prazos (default 30/45d) → minimiza o giro
  const fornEsc = (o.fornTipo==='escalonado');
  const fSinal = (o.fornSinalPct!=null?o.fornSinalPct:20)/100;
  const fLag1 = months(o.fornPrazo1!=null?o.fornPrazo1:30);
  const fLag2 = months(o.fornPrazo2!=null?o.fornPrazo2:45);
  // #4 curva de avanço: distribui execução/medição na duração (linear = uniforme)
  const fracs = curvaFracs(dur, o.curva || 'linear');
  // parcelas fixas = N vezes × valor de cada (espalhadas na duração); cada parcela vira % da fatia BER
  let parcelasArr = [];
  if(o.formaReceb==='parcelas'){
    if((o.parcelasN|0) > 0){
      const N = o.parcelasN|0, V = o.parcelasValor||0;
      const pct = agioVal>0 ? (V/agioVal)*100 : 0;
      for(let k=1;k<=N;k++){ parcelasArr.push({ mes: Math.max(1, Math.round(k*dur/N)), pct }); }
    } else if(o.parcelas){ parcelasArr = parseParcelas(o.parcelas); } // compat legado
  }
  const parcelasMode = parcelasArr.length > 0;

  // acumuladores por mês GLOBAL (1-based)
  const inflow = {}, outflow = {};
  const outMOD = {}, outForn = {};   // saídas separadas: MOD (mão de obra) e Fornecedor (materiais)
  const add = (obj,g,v)=>{ if(v){ obj[g]=(obj[g]||0)+v; } };

  let lastExecG = start;
  for(let t=1;t<=dur;t++){
    const g = start + t - 1;
    lastExecG = g;
    const fr = fracs[t-1];
    // saídas de custo: MOD à vista (mês g) + Fornecedor (prazo único OU escalonado #1)
    add(outflow, g, modV * fr);            add(outMOD,  g,           modV * fr);
    const fExec = fornV * fr;
    if(fornEsc){
      add(outflow, g,       fExec*fSinal);       add(outForn, g,       fExec*fSinal);
      add(outflow, g+fLag1, fExec*(1-fSinal)/2); add(outForn, g+fLag1, fExec*(1-fSinal)/2);
      add(outflow, g+fLag2, fExec*(1-fSinal)/2); add(outForn, g+fLag2, fExec*(1-fSinal)/2);
    } else {
      add(outflow, g + lagForn, fExec);          add(outForn, g + lagForn, fExec);
    }
    // entrada por MEDIÇÃO: reembolso do custo + receita (adm+savings) na mesma curva
    if(!parcelasMode){
      add(inflow, g + lagReceb, faturamentoNet * fr * (1-ret)); // fatia BER líq. de imposto (com retenção)
      // savings NÃO entra como inflow: é margem retida (gasta-se menos) → já está no custo real menor (agioVal)
    }
  }
  // entrada por PARCELAS FIXAS: recebe % do contrato (fatia BER líq. retenção) + adm proporcional
  if(parcelasMode){
    parcelasArr.forEach(p=>{
      const gp = start + Math.max(1,(p.mes|0)) - 1;
      add(inflow, gp, faturamentoNet * (1-ret) * (p.pct/100));
      // savings via custo menor (não é inflow)
    });
  }
  // sinal: entra no "prazo do sinal" (0 = à vista) e amortiza nos reembolsos
  add(inflow, start + lagSinal, sinalVal);
  for(let t=1;t<=dur;t++){
    const g = start + t - 1;
    add(outflow, g + lagReceb, sinalVal * fracs[t-1]);
  }
  // retenção liberada no fim (sobre o faturamento líq. de imposto)
  add(inflow, lastExecG + lagReceb, faturamentoNet * ret);
  // comissão + RT: base contrato−adm−imposto, fracionadas na duração + 1 mês (SAÍDAS)
  const custoExtra = comissaoTotal + rtTotal;
  const comMonths = dur + 1;
  for(let t=1;t<=comMonths;t++){ add(outflow, start + t - 1, custoExtra/comMonths); }

  return {
    inflow, outflow, outMOD, outForn,
    comissaoVal: comissaoTotal, rtVal: rtTotal,
    receitaLiquida: (faturamentoNet - agioVal),  // margem: fatia BER líq. − custo real (savings já embutido no custo menor)
    receitaObra: faturamentoNet, custoObra: agioVal,  // receita (fatia líq. imposto) e custo real (MOD + compras), p/ Receita/Despesa/Lucro
    admLiq: (faturamentoNet - agioVal), savingsLiq: savingsGeral, budgetCompras: budgetCompras, savingsGeral: savingsGeral,
    firstG: start, lastG: lastExecG + lagReceb
  };
}

// acumula o fluxo com JUROS do dinheiro sobre o saldo negativo (custo do dinheiro dentro do fluxo)
function accFlow(r, jurosPct){
  let saldo=0, mn=0, mnG=null, totJuros=0; const byMonth={};
  for(let g=r.firstG; g<=r.lastG; g++){
    saldo += (r.inflow[g]||0) - (r.outflow[g]||0);
    let juros=0;
    if(saldo<0){ juros = -saldo*(jurosPct/100); saldo -= juros; totJuros += juros; }
    byMonth[g] = { juros, saldo };
    if(saldo<mn){ mn=saldo; mnG=g; }
  }
  return { aporte:-mn, mnG, custoDinheiro:totJuros, saldoFinal:saldo, byMonth };
}
function computePortfolio(){
  const prem = PREM;
  // resolve o mês base (mês 1 = a obra mais antiga) e o offset inteiro de cada obra
  const idxs = OBRAS.map(o => { const i = mesToIndex(o.inicioMes); return i!=null ? i : null; });
  const validIdxs = idxs.filter(i=>i!=null);
  BASE_MES = validIdxs.length ? Math.min(...validIdxs) : null;
  OBRAS.forEach((o,i)=>{ o._inicioG = (idxs[i]!=null && BASE_MES!=null) ? (idxs[i]-BASE_MES+1) : (o.inicio||1); });
  const per = OBRAS.map(o => ({ o, r: computeObra(o, prem) }));
  let horizon = 1;
  per.forEach(p => horizon = Math.max(horizon, p.r.lastG));

  // POR OBRA (standalone): cada obra como se fosse a única no caixa — mostra o esforço individual
  const flowObra = per.map((p,i)=> accFlow(p.r, (OBRAS[i].juros ?? prem.juros)));
  const picosInd = flowObra.map(f=>f.aporte);             // capital de giro de cada obra sozinha
  const somaPicosInd = picosInd.reduce((s,v)=>s+v,0);
  const custoFinObra = flowObra.map(f=>f.custoDinheiro);  // custo do dinheiro de cada obra sozinha
  const custoFinTotal = custoFinObra.reduce((s,v)=>s+v,0);

  // CAIXA ÚNICO (pool): a sobra de uma obra cobre o buraco de outra — visão consolidada (rastreabilidade/fluxo)
  const combinedIn={}, combinedOut={};
  per.forEach(p=>{ for(let g=p.r.firstG; g<=p.r.lastG; g++){ combinedIn[g]=(combinedIn[g]||0)+(p.r.inflow[g]||0); combinedOut[g]=(combinedOut[g]||0)+(p.r.outflow[g]||0); } });
  // pool SÓ DAS OBRAS (sem backoffice) = base da economia de juro. Pooling entre obras só ajuda → economia ≥ 0.
  const flowConsObras = accFlow({ inflow:combinedIn, outflow:combinedOut, firstG:1, lastG:horizon }, prem.juros);
  const custoFinPoolObrasOnly = flowConsObras.custoDinheiro;
  // BACKOFFICE (despesa fixa): sai do caixa único TODO mês (fixo, não diluído por obra) → mexe no giro/pico/custo REAL
  const backofficeMes = prem.backofficeMes || 0;
  for(let g=1; g<=horizon; g++){ combinedOut[g] = (combinedOut[g]||0) + backofficeMes; }
  const flowCons = accFlow({ inflow:combinedIn, outflow:combinedOut, firstG:1, lastG:horizon }, prem.juros);
  const picoNatural = -flowCons.aporte;
  const custoFinPool = flowCons.custoDinheiro;            // custo REAL do dinheiro no caixa único (inclui backoffice)
  const backofficeJuro = Math.max(0, custoFinPool - custoFinPoolObrasOnly);  // juro incremental do backoffice = overhead da empresa (não é culpa da obra)
  const custoFinPoolObra = per.map(()=>0);               // juro do pool DE OBRAS rateado por obra — p/ o acerto final

  const rows = [];
  const perObraMonthly = per.map(()=>({}));
  for(let g=1; g<=horizon; g++){
    let inn=0, out=0;
    per.forEach((p,i)=>{
      const pin = p.r.inflow[g]||0, pout = p.r.outflow[g]||0;
      inn += pin; out += pout;
      perObraMonthly[i][g] = pin - pout;
    });
    out += backofficeMes;   // backoffice sai do caixa todo mês (fixo)
    const bm = flowCons.byMonth[g] || {juros:0, saldo:0};
    const bmo = flowConsObras.byMonth[g] || {juros:0, saldo:0};   // pool só das obras (base da economia)
    const giroMes = bm.saldo<0 ? -bm.saldo : 0;
    // quem está devendo: rateia o buraco (giro) e o juro do pool DE OBRAS entre as obras no vermelho (peso = saldo negativo)
    let giroPorObra = [];
    if(giroMes>1 || bmo.juros>0){
      let negTot=0; const neg=per.map((p,i)=>{ const s=flowObra[i].byMonth[g]; const v=(s&&s.saldo<0)?-s.saldo:0; negTot+=v; return v; });
      if(negTot>0) per.forEach((p,i)=>{
        if(giroMes>1 && neg[i]>0) giroPorObra.push({ nome:OBRAS[i].nome, val: giroMes*(neg[i]/negTot) });
        if(bmo.juros>0) custoFinPoolObra[i] += bmo.juros*(neg[i]/negTot);   // juro do pool DE OBRAS rateado (economia ≥ 0)
      });
    }
    rows.push({ g, inn, out, backoffice: backofficeMes, juros:bm.juros, net: inn-out-bm.juros, naturalCum: bm.saldo, antecipado: giroMes, giroPorObra });
  }

  const receitaLiquida = per.reduce((s,p)=>s+p.r.receitaLiquida,0);
  const contratoTotal  = OBRAS.reduce((s,o)=>s+o.contrato,0);

  // contribuição pra despesas fixas = % (da meta) aplicado sobre o CONTRATO de cada obra
  const estPct = (prem.estruturaPct||0)/100;
  const fixaObra = OBRAS.map(o=> (o.contrato||0) * estPct);   // AGCO: 6% × 5,44M = 326k
  const despesasFixas = fixaObra.reduce((s,v)=>s+v,0);        // = estPct × contratoTotal
  const margemContrib = receitaLiquida - custoFinTotal;
  const lucroLiquido  = margemContrib - despesasFixas;

  // === Receita / Despesa / Lucro DA OBRA (visão simples: entra, sai, sobra) ===
  const comissaoObra = per.map(p => p.r.comissaoVal);                             // comissão (base contrato−adm−imposto) = SAÍDA
  const rtObra       = per.map(p => p.r.rtVal);                                   // reserva técnica (mesma base) = SAÍDA
  const receitaObra  = per.map(p => p.r.receitaObra);                             // bruto: fatia líq. imposto + savings
  const despesaObra  = per.map((p,i)=> p.r.custoObra + custoFinObra[i] + comissaoObra[i] + rtObra[i] + fixaObra[i]); // custo + juros + comissão + RT + estrutura
  const lucroObra    = per.map((p,i)=> receitaObra[i] - despesaObra[i]);
  const receitaObraTotal = receitaObra.reduce((s,v)=>s+v,0);
  const despesaObraTotal = despesaObra.reduce((s,v)=>s+v,0);
  const lucroObraTotal   = lucroObra.reduce((s,v)=>s+v,0);

  // === ACERTO FINAL (quita empréstimos internos · empréstimo interno de graça) ===
  // a obra pagava o juro como se isolada; no caixa único paga só a fatia do juro do POOL DE OBRAS. A diferença é economia (≥ 0).
  // reconcilia: garante que TODO o juro do pool de obras foi rateado (evita sobra não alocada que superestimava o total)
  const somaRateio = custoFinPoolObra.reduce((s,v)=>s+v,0);
  const residuo = custoFinPoolObrasOnly - somaRateio;
  if(residuo>0.01 && custoFinTotal>0) per.forEach((p,i)=>{ custoFinPoolObra[i] += residuo*(custoFinObra[i]/custoFinTotal); });
  const economiaJuroObra   = per.map((p,i)=> Math.max(0, custoFinObra[i] - custoFinPoolObra[i]));   // juro que a obra deixou de pagar (≥ 0)
  const resultadoFinalObra = per.map((p,i)=> lucroObra[i] + economiaJuroObra[i]);      // resultado da obra pós-quitação
  const economiaJuroTotal   = economiaJuroObra.reduce((s,v)=>s+v,0);
  const resultadoObrasTotal = resultadoFinalObra.reduce((s,v)=>s+v,0);                 // subtotal das obras
  const resultadoFinalTotal = resultadoObrasTotal - backofficeJuro;                    // (−) juro do backoffice (overhead) = lucro real da empresa

  return {
    rows, horizon, per, perObraMonthly, picosInd, custoFinObra, fixaObra,
    picoConsolidado: -picoNatural,
    custoFinPool,
    somaPicosInd,
    custoFinTotal,
    receitaLiquida,
    margemContrib,
    despesasFixas,
    lucroLiquido,
    comissaoObra, rtObra, receitaObra, despesaObra, lucroObra,
    receitaObraTotal, despesaObraTotal, lucroObraTotal,
    custoFinPoolObra, economiaJuroObra, resultadoFinalObra, economiaJuroTotal,
    resultadoObrasTotal, backofficeJuro, resultadoFinalTotal,
    contratoTotal
  };
}

/* ============================================================
   FORMATO
   ============================================================ */
const fmt = (v)=> (v<0?'-':'') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR');
const fmtK = (v)=>{ const a=Math.abs(v); let s; if(a>=1e6) s=(v/1e6).toFixed(a>=1e7?1:2)+'M'; else if(a>=1e3) s=Math.round(v/1e3)+'k'; else s=Math.round(v).toString(); return 'R$ '+s; };
const pct = (v)=> (v>=0?'':'') + v.toFixed(1) + '%';
const monthLabel = (g)=> BASE_MES!=null ? indexToMes(BASE_MES + g - 1).label : ('M'+g);

/* ============================================================
   RENDER
   ============================================================ */
let CALC = null;
let expandedObra = null;
const ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
function toggleObra(id){ expandedObra = (expandedObra===id ? null : id); renderPortfolio(); }
function renderObraFluxo(i){
  const p = CALC.per[i]; const r = p.r;
  const jurosO = p.o.juros ?? PREM.juros;
  const f = accFlow(r, jurosO);
  const aporte = f.aporte, mnG = f.mnG;
  const lucro = f.saldoFinal;                 // saldo final já traz juros e comissão dentro do fluxo
  const rows=[];
  for(let g=r.firstG; g<=r.lastG; g++){
    const inn=r.inflow[g]||0, base=r.outflow[g]||0, bm=f.byMonth[g]||{juros:0,saldo:0};
    const out=base+bm.juros;                  // saída inclui o custo do dinheiro (juros) do mês
    rows.push({g, inn, out, juros:bm.juros, net:inn-out, cum:bm.saldo});
  }
  const body = rows.map(x=>`<tr class="${x.g===mnG&&aporte>1?'peak-row':''}">
    <td class="cell-name">${monthLabel(x.g)}</td>
    <td class="num mono cell-pos">${x.inn?fmtK(x.inn):'—'}</td>
    <td class="num mono cell-neg">${x.out?('-'+fmtK(x.out)):'—'}</td>
    <td class="num mono cell-neg">${x.juros>1?('-'+fmtK(x.juros)):'—'}</td>
    <td class="num mono" style="color:${x.net>=0?'var(--success)':'var(--danger)'}">${fmtK(x.net)}</td>
    <td class="num mono" style="font-weight:600;color:${x.cum<0?'var(--danger)':'var(--text-primary)'}">${fmt(x.cum)}</td>
  </tr>`).join('');
  return `<div class="obra-fluxo">
    <div class="obra-fluxo-head">Fluxo de caixa · ${p.o.nome} · aporte máximo <strong style="color:var(--danger)">${aporte>1?fmtK(aporte):'R$ 0'}</strong>${mnG?(' em '+monthLabel(mnG)):''} · lucro <strong style="color:${lucro>=0?'var(--success)':'var(--danger)'}">${fmtK(lucro)}</strong><span class="info-i">i<span class="tip"><b>Como esta análise é calculada.</b><br><b>Aporte máximo</b> = ponto mais fundo do caixa acumulado (quanto injetar até a retenção final).<br><br><b>Entradas:</b> reembolso do custo + <b>adm + savings diluídos igualmente</b> (no prazo de recebimento) · sinal · retenção no fim.<br><b>Saídas:</b> MOD à vista · Fornecedor (prazo único ou escalonado) · comissão · RT.<br><br><b>Custo do dinheiro:</b> ${PREM.juros}%/mês sobre o saldo negativo, cobrado <b>dentro do fluxo</b> mês a mês (coluna Custo $).<br><b>Imposto:</b> só sobre a fatia BER.<br><b>Comissão e RT:</b> base = contrato − adm − imposto, fracionadas na duração + 1 mês (saídas no fluxo).<br><b>Curva de avanço:</b> distribui execução/medição (linear, S, front ou back-loaded).<br><br><b>Lucro = saldo final</b> (já traz custo do dinheiro, comissão e RT dentro).</span></span></div>
    <div class="table-wrapper"><table class="mini">
      <thead><tr><th>Mês</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Custo $</th><th class="num">Saldo do mês</th><th class="num">Saldo acumulado</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
  </div>`;
}

function render(){
  CALC = computePortfolio();
  document.getElementById('fixoReadout').innerHTML = `= ${PREM.estruturaPct}% × ${fmtK(CALC.contratoTotal)} contratado = <strong>${fmtK(CALC.despesasFixas)}</strong> pro fixo${PREM.metaAnual?` · ${(CALC.contratoTotal/PREM.metaAnual*100).toFixed(0)}% da meta`:''}`;
  renderKPIs();
  renderPortfolio();
  renderFluxo();
  renderRastro();
  renderCompat();
  save();
}
function renderCompat(){
  const c = CALC;
  const t = document.getElementById('compatTable');
  if(!t) return;
  let acc = 0;
  let body = c.rows.map(r=>{
    let forn=0, mod=0;
    c.per.forEach(p=>{ forn += p.r.outForn[r.g]||0; mod += p.r.outMOD[r.g]||0; });
    const receb = r.inn;              // recebido do cliente no mês (medições + sinal + retenção)
    const pago = forn + mod;          // pago à cadeia (fornecedor + MOD)
    const desc = receb - pago;        // descasamento do mês
    acc += desc;
    return `<tr class="${acc<-1?'peak':''}">
      <td class="cell-name">${monthLabel(r.g)}</td>
      <td class="num mono cell-pos">${receb>1?fmtK(receb):'—'}</td>
      <td class="num mono cell-neg">${forn>1?('-'+fmtK(forn)):'—'}</td>
      <td class="num mono cell-neg">${mod>1?('-'+fmtK(mod)):'—'}</td>
      <td class="num mono" style="color:${desc>=0?'var(--success)':'var(--danger)'}">${fmtK(desc)}</td>
      <td class="num mono" style="font-weight:600;color:${acc<0?'var(--danger)':'var(--text-primary)'}">${fmt(acc)}</td>
    </tr>`;
  }).join('');
  const pior = Math.min(0, ...(function(){ let a=0; return c.rows.map(r=>{ let f=0,m=0; c.per.forEach(p=>{ f+=p.r.outForn[r.g]||0; m+=p.r.outMOD[r.g]||0; }); a += r.inn - f - m; return a; }); })());
  t.innerHTML = `
    <thead><tr><th>Mês</th><th class="num">Recebido do cliente</th><th class="num">Pago fornecedor</th><th class="num">Pago MOD</th><th class="num">Descasamento do mês</th><th class="num">Descasamento acumulado</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td>Pior descasamento</td><td></td><td></td><td></td><td></td>
      <td class="num mono" style="color:var(--danger)">${fmt(pior)}</td>
    </tr></tfoot>`;
}

function renderKPIs(){
  const c = CALC;
  const picoReal = c.somaPicosInd;                                       // soma do giro de cada obra (o que a coluna por obra soma)
  const picoPct = c.contratoTotal ? (picoReal / c.contratoTotal * 100) : 0;
  const economiaPool = c.somaPicosInd - c.picoConsolidado;              // quanto o caixa único economiza vs obras isoladas
  const lucroPos = c.lucroObraTotal >= 0;
  const margemPct = c.contratoTotal ? (c.lucroObraTotal / c.contratoTotal * 100) : 0;
  const custoFinPctReceita = c.receitaObraTotal ? (c.custoFinTotal / c.receitaObraTotal * 100) : 0;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card hero">
      <div class="kpi-label">⚠ Pico de capital de giro</div>
      <div class="kpi-value">${fmt(picoReal)}</div>
      <div class="kpi-sub"><strong>${picoPct.toFixed(1)}%</strong> do contrato · soma por obra · no caixa único (pool): <strong>${fmtK(c.picoConsolidado)}</strong></div>
    </div>
    <div class="kpi-card warn">
      <div class="kpi-label">Custo financeiro</div>
      <div class="kpi-value">${fmtK(c.custoFinTotal)}</div>
      <div class="kpi-sub">soma por obra · no caixa único (pool): <strong>${fmtK(c.custoFinPool)}</strong></div>
    </div>
    <div class="kpi-card brand">
      <div class="kpi-label">Receita da obra</div>
      <div class="kpi-value">${fmtK(c.receitaObraTotal)}</div>
      <div class="kpi-sub">o que entra: fatia BER (pós-imposto) · savings vira custo menor</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Despesa da obra</div>
      <div class="kpi-value">${fmtK(c.despesaObraTotal)}</div>
      <div class="kpi-sub">o que sai: custo + juros + comissão + RT + estrutura</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-label">Lucro da obra</div>
      <div class="kpi-value ${lucroPos?'pos':'neg'}">${fmtK(c.lucroObraTotal)}</div>
      <div class="kpi-sub">receita − despesa · ${margemPct.toFixed(1)}% do contrato</div>
    </div>`;
}

function renderPortfolio(){
  const t = document.getElementById('obrasTable');
  if(!OBRAS.length){ t.innerHTML = `<tbody><tr><td><div class="empty"><b>Nenhuma obra ainda</b>Adicione uma obra pra simular o capital de giro.</div></td></tr></tbody>`; return; }
  let body = OBRAS.map((o,i)=>{
    const r = CALC.per[i].r;
    const pico = CALC.picosInd[i];   // capital de giro da obra sozinha (individual)
    const agioVal = o.budget * ((o.agio ?? PREM.agio)/100);
    const isOpen = expandedObra===o.id;
    // usa caixa do pool (precisa de giro) E dá prejuízo (mesmo com o pool de graça) → desistir
    const desistir = (CALC.picosInd[i] > 1) && (CALC.resultadoFinalObra[i] < 0);
    // FIX 2026-08-08 (Bruno): alerta se despesa/capital de giro da obra ultrapassar contrato × fatia BER —
    // pega descasamento de base (custo escopado pra BER maior que a própria fatia dela no contrato).
    const fatiaValor = o.contrato * ((o.agio ?? PREM.agio)/100);
    const descasado = (CALC.despesaObra[i] > fatiaValor) || (pico > fatiaValor);
    return `<tr onclick="toggleObra('${o.id}')" class="${isOpen?'is-open':''}" style="cursor:pointer">
      <td class="cell-name">${o.nome}${desistir?' <span class="badge badge-danger" style="margin-left:6px"><span class="badge-dot"></span>desistir da obra</span>':''}${(!desistir && descasado)?' <span class="badge badge-warning" style="margin-left:6px" title="Despesa ou capital de giro maior que a fatia BER no contrato — confira o cadastro de custo da obra (mão de obra/compras podem estar computando escopo de terceiros)"><span class="badge-dot"></span>confira o custo cadastrado</span>':''}</td>
      <td class="num mono">${fmtK(o.contrato)}</td>
      <td class="num mono">${fmtK(o.contrato*((o.agio ?? PREM.agio)/100))} · ${o.agio ?? PREM.agio}%</td>
      <td class="num mono cell-muted">${o.inicioMes?indexToMes(mesToIndex(o.inicioMes)).label:('M'+(o._inicioG||o.inicio||1))}</td>
      <td class="num mono cell-muted">${o.duracao}m</td>
      <td class="num mono cell-muted">${o.sinal}% · ${o.prazoSinal||0}d</td>
      <td class="num mono cell-neg">${fmtK(pico)}</td>
      <td class="num mono" style="color:var(--warning)">${fmtK(CALC.custoFinObra[i])}</td>
      <td class="num mono cell-pos">${fmtK(CALC.receitaObra[i])}</td>
      <td class="num mono" style="color:var(--danger)">${fmtK(CALC.despesaObra[i])}</td>
      <td class="num mono" style="font-weight:600;color:${CALC.lucroObra[i]>=0?'var(--success)':'var(--danger)'}">${fmtK(CALC.lucroObra[i])}</td>
      <td style="width:72px"><div class="row-act">
        <button title="Editar obra" onclick="event.stopPropagation(); openObra('${o.id}')">${ICON_EDIT}</button>
        <button class="del" title="Excluir obra" onclick="event.stopPropagation(); deleteObraRow('${o.id}')">${ICON_TRASH}</button>
      </div></td>
    </tr>${isOpen?`<tr class="expand-row"><td colspan="13">${renderObraFluxo(i)}</td></tr>`:''}`;
  }).join('');
  const totContrato = OBRAS.reduce((s,o)=>s+o.contrato,0);
  const totBudget = OBRAS.reduce((s,o)=>s+o.budget,0);
  const totAgio = OBRAS.reduce((s,o)=>s+o.contrato*((o.agio ?? PREM.agio)/100),0);   // faturamento total (fatia)
  t.innerHTML = `
    <thead><tr>
      <th>Obra</th><th class="num">Contrato</th><th class="num">Fatia BER</th>
      <th class="num">Início</th><th class="num">Prazo</th><th class="num">Sinal</th>
      <th class="num">Capital de giro</th><th class="num">Custo fin.</th><th class="num">Receita da obra</th><th class="num">Despesa da obra</th><th class="num">Lucro da obra</th><th></th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td>Total · ${OBRAS.length} obras</td>
      <td class="num mono">${fmtK(totContrato)}</td>
      <td class="num mono">${fmtK(totAgio)}</td>
      <td></td><td></td><td></td>
      <td class="num mono" style="color:var(--danger)">${fmtK(CALC.somaPicosInd)}</td>
      <td class="num mono" style="color:var(--warning)">${fmtK(CALC.custoFinTotal)}</td>
      <td class="num mono" style="color:var(--success)">${fmtK(CALC.receitaObraTotal)}</td>
      <td class="num mono" style="color:var(--danger)">${fmtK(CALC.despesaObraTotal)}</td>
      <td class="num mono" style="color:${CALC.lucroObraTotal>=0?'var(--success)':'var(--danger)'}">${fmtK(CALC.lucroObraTotal)}</td>
      <td></td>
    </tr></tfoot>`;
}

function renderFluxo(){
  const c = CALC;
  const peakRow = c.rows.reduce((a,b)=> b.naturalCum < a.naturalCum ? b : a, c.rows[0]||{naturalCum:0});
  document.getElementById('fluxoNote').innerHTML =
    `<b>Como ler:</b> a linha do <b>saldo acumulado</b> mostra o quanto você está no vermelho a cada mês. O ponto mais fundo — <b>${monthLabel(peakRow.g)}</b>, ${fmt(c.picoConsolidado*-1)} — é o <b>pico de capital de giro</b>: o máximo que você precisa bancar de uma vez. Fornecedor pago em ${PREM.forn}d após a execução; recebimento conforme a forma de cada obra. <b>Custo financeiro</b> = ${PREM.juros}%/mês sobre o giro exigido × prazo de cada obra.`;

  const t = document.getElementById('fluxoTable');
  let body = c.rows.map(r=>{
    const isPeak = r.g===peakRow.g;
    return `<tr class="${isPeak?'peak':''}">
      <td class="cell-name">${monthLabel(r.g)}${isPeak?' <span class="badge badge-warning" style="margin-left:6px"><span class="badge-dot"></span>pico</span>':''}</td>
      <td class="num mono cell-pos">${r.inn?fmtK(r.inn):'—'}</td>
      <td class="num mono cell-neg" style="vertical-align:top">${r.out?('-'+fmtK(r.out)):'—'}${r.backoffice>1?`<div class="rastro-sub">↳ backoffice −${fmtK(r.backoffice)}</div>`:''}</td>
      <td class="num mono" style="color:${r.net>=0?'var(--success)':'var(--danger)'}">${fmtK(r.net)}</td>
      <td class="num mono" style="font-weight:600;color:${r.naturalCum>=0?'var(--text-primary)':'var(--danger)'}">${fmt(r.naturalCum)}</td>
      <td class="num mono">${r.antecipado>1?fmtK(r.antecipado):'—'}</td>
    </tr>`;
  }).join('');
  t.innerHTML = `
    <thead><tr>
      <th>Mês</th><th class="num">Entradas</th><th class="num">Saídas</th>
      <th class="num">Saldo do mês</th><th class="num">Saldo acumulado</th>
      <th class="num">Giro exigido</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td>Total</td><td></td><td></td><td></td>
      <td class="num mono" style="color:var(--danger)">pico ${fmt(-c.picoConsolidado)}</td>
      <td class="num mono" style="color:var(--warning)">custo fin. ${fmtK(c.custoFinPool)}</td>
    </tr></tfoot>`;
  drawChart(c.rows);
  renderAcerto();
}

function renderAcerto(){
  const c = CALC;
  const t = document.getElementById('acertoTable');
  if(!t) return;
  let body = OBRAS.map((o,i)=>{
    const li = c.lucroObra[i], ec = c.economiaJuroObra[i], rf = c.resultadoFinalObra[i];
    return `<tr>
      <td class="cell-name">${o.nome}</td>
      <td class="num mono" style="color:${li>=0?'var(--success)':'var(--danger)'}">${fmtK(li)}</td>
      <td class="num mono" style="color:var(--success)">${ec>1?'+ '+fmtK(ec):'—'}</td>
      <td class="num mono" style="font-weight:600;color:${rf>=0?'var(--success)':'var(--danger)'}">${fmtK(rf)}</td>
    </tr>`;
  }).join('');
  const bo = c.backofficeJuro||0;
  t.innerHTML = `
    <thead><tr><th>Obra</th><th class="num">Lucro isolado</th><th class="num">(+) Economia de juro (pool de obras)</th><th class="num">= Resultado da obra</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot>
      <tr>
        <td>Subtotal · obras</td>
        <td class="num mono">${fmtK(c.lucroObraTotal)}</td>
        <td class="num mono" style="color:var(--success)">${c.economiaJuroTotal>1?'+ '+fmtK(c.economiaJuroTotal):'—'}</td>
        <td class="num mono" style="font-weight:600;color:${c.resultadoObrasTotal>=0?'var(--success)':'var(--danger)'}">${fmtK(c.resultadoObrasTotal)}</td>
      </tr>
      <tr>
        <td style="font-weight:500;color:var(--text-secondary)">(−) Juro do backoffice · overhead da empresa</td>
        <td></td><td></td>
        <td class="num mono" style="color:${bo>1?'var(--danger)':'var(--text-tertiary)'}">${bo>1?'- '+fmtK(bo):'—'}</td>
      </tr>
      <tr>
        <td style="font-weight:700">= Resultado final · empresa</td>
        <td></td><td></td>
        <td class="num mono" style="font-weight:700;color:${c.resultadoFinalTotal>=0?'var(--success)':'var(--danger)'}">${fmtK(c.resultadoFinalTotal)}</td>
      </tr>
    </tfoot>`;
}

function renderRastro(){
  const c = CALC;
  const t = document.getElementById('rastroTable');
  // cabeçalho dinâmico com nomes das obras
  const heads = OBRAS.map(o=>`<th class="num">${o.nome}</th>`).join('');
  let body = c.rows.map(r=>{
    const cells = OBRAS.map((o,i)=>{
      const v = c.perObraMonthly[i][r.g]||0;
      const mod  = c.per[i].r.outMOD[r.g]||0;
      const forn = c.per[i].r.outForn[r.g]||0;
      const hasV = Math.abs(v)>=1, hasCusto = (mod>=1 || forn>=1);
      if(!hasV && !hasCusto) return `<td class="num mono cell-muted">—</td>`;
      const net = hasV ? `<div style="color:${v>=0?'var(--success)':'var(--danger)'}">${fmtK(v)}</div>` : `<div class="cell-muted">—</div>`;
      const sub = hasCusto ? `<div class="rastro-sub">↳ MOD ${mod>=1?'−'+fmtK(mod):'—'}</div><div class="rastro-sub">↳ Forn ${forn>=1?'−'+fmtK(forn):'—'}</div>` : '';
      return `<td class="num mono" style="vertical-align:top">${net}${sub}</td>`;
    }).join('');
    return `<tr class="${r.antecipado>1?'peak':''}">
      <td class="cell-name">${monthLabel(r.g)}</td>
      ${cells}
      <td class="num mono" style="font-weight:600;vertical-align:top;color:${r.antecipado>1?'var(--danger)':'inherit'}">${r.antecipado>1?fmtK(r.antecipado):'—'}${(r.giroPorObra&&r.giroPorObra.length)?r.giroPorObra.map(function(x){return `<div class="rastro-sub">↳ ${x.nome} −${fmtK(x.val)}</div>`;}).join(''):''}</td>
      <td class="num mono" style="vertical-align:top;color:${r.juros>1?'var(--warning)':'inherit'}">${r.juros>1?'−'+fmtK(r.juros):'—'}</td>
    </tr>`;
  }).join('');
  t.innerHTML = `
    <thead><tr><th>Mês</th>${heads}<th class="num">Giro exigido no mês</th><th class="num">Custo do dinheiro</th></tr></thead>
    <tbody>${body}</tbody>`;
}

/* ---- CHART (canvas) ---- */
function drawChart(rows){
  const cv = document.getElementById('flowChart');
  const dpr = window.devicePixelRatio||1;
  const W = cv.clientWidth, H = 260;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  if(!rows.length) return;
  const css = getComputedStyle(document.body);
  const cDanger = css.getPropertyValue('--danger').trim() || '#ef4444';
  const cBrand = css.getPropertyValue('--brand').trim() || '#1B3A5C';
  const cBorder = css.getPropertyValue('--border').trim() || '#e2e8f0';
  const cText = css.getPropertyValue('--text-tertiary').trim() || '#94a3b8';

  const pad = {l:64,r:16,t:16,b:24};
  const vals = rows.map(r=>r.naturalCum);
  const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
  const range = (maxV-minV)||1;
  const x = i => pad.l + (W-pad.l-pad.r) * (rows.length===1?0.5:i/(rows.length-1));
  const y = v => pad.t + (H-pad.t-pad.b) * (1 - (v-minV)/range);

  // grid + labels
  ctx.font = "11px 'IBM Plex Sans', sans-serif"; ctx.fillStyle = cText; ctx.textAlign='right';
  const steps=4;
  for(let s=0;s<=steps;s++){
    const v = minV + range*s/steps;
    const yy = y(v);
    ctx.strokeStyle = cBorder; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad.l,yy); ctx.lineTo(W-pad.r,yy); ctx.stroke();
    ctx.fillText(fmtK(v), pad.l-8, yy+4);
  }
  // zero line stronger
  const y0=y(0); ctx.strokeStyle=cText; ctx.lineWidth=1.5; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(pad.l,y0); ctx.lineTo(W-pad.r,y0); ctx.stroke(); ctx.setLineDash([]);

  // area under 0 (danger)
  ctx.beginPath(); ctx.moveTo(x(0),y0);
  rows.forEach((r,i)=>ctx.lineTo(x(i), y(Math.min(0,r.naturalCum))));
  ctx.lineTo(x(rows.length-1),y0); ctx.closePath();
  ctx.fillStyle = 'rgba(239,68,68,0.10)'; ctx.fill();

  // line
  ctx.beginPath(); rows.forEach((r,i)=>{ const xx=x(i),yy=y(r.naturalCum); i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); });
  ctx.strokeStyle=cBrand; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.stroke();

  // peak marker
  let pi=0; rows.forEach((r,i)=>{ if(r.naturalCum<rows[pi].naturalCum) pi=i; });
  if(rows[pi].naturalCum<0){
    const xx=x(pi),yy=y(rows[pi].naturalCum);
    ctx.fillStyle=cDanger; ctx.beginPath(); ctx.arc(xx,yy,5,0,7); ctx.fill();
    ctx.fillStyle=cDanger; ctx.textAlign='center'; ctx.font="600 11px 'IBM Plex Sans', sans-serif";
    ctx.fillText('pico '+fmtK(rows[pi].naturalCum), xx, yy-10);
  }
  // x labels (sparse)
  ctx.fillStyle=cText; ctx.textAlign='center'; ctx.font="10px 'IBM Plex Sans', sans-serif";
  const stepX = Math.ceil(rows.length/12);
  rows.forEach((r,i)=>{ if(i%stepX===0) ctx.fillText(monthLabel(r.g), x(i), H-6); });
}

/* ============================================================
   TABS / THEME
   ============================================================ */
function switchTab(name){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.tab-content').forEach(s=>s.classList.toggle('active', s.id==='tab-'+name));
  if(name==='fluxo') drawChart(CALC.rows);
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme');
  const nxt = cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme', nxt);
  localStorage.setItem(LS_THEME, nxt);
  if(CALC) drawChart(CALC.rows);
}

/* ============================================================
   PREMISSAS (sidebar inputs)
   ============================================================ */
const PREM_FIELDS = {p_juros:'juros',p_imposto:'imposto',p_adm:'adm',p_savings:'savings',p_agio:'agio',p_ret:'ret',p_meta:'metaAnual',p_estrutpct:'estruturaPct'};
function syncPremToInputs(){ for(const id in PREM_FIELDS) document.getElementById(id).value = PREM[PREM_FIELDS[id]]; }
function bindPrem(){
  for(const id in PREM_FIELDS){
    document.getElementById(id).addEventListener('input', e=>{
      const v = parseFloat(e.target.value); if(!isNaN(v)){ PREM[PREM_FIELDS[id]] = v; render(); }
    });
  }
}

/* ============================================================
   MODAL OBRA
   ============================================================ */
function openObra(id){
  editingId = id||null;
  const o = id ? OBRAS.find(x=>x.id===id) : null;
  document.getElementById('modalTitle').textContent = o? 'Editar obra' : 'Nova obra';
  document.getElementById('delObraBtn').style.display = o? 'inline-flex':'none';
  document.getElementById('o_nome').value     = o?o.nome:'';
  document.getElementById('o_contrato').value = o?Number(o.contrato).toLocaleString('pt-BR'):'';
  document.getElementById('o_mod').value      = o&&o.mod?Number(o.mod).toLocaleString('pt-BR'):'';
  document.getElementById('o_budgetTotal').value = o?Number(o.budget||((o.mod||0)+(o.fornMat||0))||0).toLocaleString('pt-BR'):'';
  // o_fornMat é derivado (Budget − MOD); preenchido pelo updateFlow() ao final
  document.getElementById('o_duracao').value  = o?o.duracao:6;
  document.getElementById('o_inicioMes').value = o?(o.inicioMes||defaultMes()):defaultMes();
  document.getElementById('o_sinal').value    = o?o.sinal:20;
  document.getElementById('o_juros').value    = o?(o.juros ?? PREM.juros):PREM.juros;
  document.getElementById('o_imposto').value  = o?(o.imposto ?? PREM.imposto):PREM.imposto;
  document.getElementById('o_adm').value       = o?(o.adm ?? PREM.adm):PREM.adm;
  document.getElementById('o_savings').value   = o?(o.savings ?? PREM.savings):PREM.savings;
  document.getElementById('o_agio').value      = o?(o.agio ?? PREM.agio):PREM.agio;
  document.getElementById('o_ret').value       = o?(o.ret ?? PREM.ret):PREM.ret;
  document.getElementById('o_prazoSinal').value = o?(o.prazoSinal!=null?o.prazoSinal:PREM.receb):PREM.receb;
  document.getElementById('o_formaReceb').value = o?(o.formaReceb||'prazo'):'prazo';
  document.getElementById('o_prazoReceb').value = o?(o.prazoReceb!=null?o.prazoReceb:PREM.receb):PREM.receb;
  document.getElementById('o_parcN').value       = o?(o.parcelasN||''):'';
  document.getElementById('o_parcV').value       = o&&o.parcelasValor?Number(o.parcelasValor).toLocaleString('pt-BR'):'';
  document.getElementById('o_fornTipo').value   = o?(o.fornTipo||'prazo'):'prazo';
  document.getElementById('o_fornDias').value   = o?(o.fornDias!=null?o.fornDias:PREM.forn):PREM.forn;
  document.getElementById('o_comissao').value   = o?(o.comissao||0):0;
  document.getElementById('o_reservaTecnica').value = o?(o.reservaTecnica||0):0;
  document.getElementById('o_curva').value = o?(o.curva||'linear'):'linear';
  document.getElementById('o_fornSinalPct').value = o?(o.fornSinalPct!=null?o.fornSinalPct:20):20;
  document.getElementById('o_fornPrazo1').value = o?(o.fornPrazo1!=null?o.fornPrazo1:30):30;
  document.getElementById('o_fornPrazo2').value = o?(o.fornPrazo2!=null?o.fornPrazo2:45):45;
  toggleFormaReceb(); toggleFornTipo(); updateFlow();
  document.getElementById('obraModal').classList.add('active');
}
function toggleFormaReceb(){
  const parcelas = document.getElementById('o_formaReceb').value === 'parcelas';
  document.getElementById('wrap_prazoReceb').style.display = parcelas ? 'none' : 'block';
  document.getElementById('wrap_parcelas').style.display   = parcelas ? 'block' : 'none';
}
function toggleFornTipo(){
  const tipo = document.getElementById('o_fornTipo').value;
  document.getElementById('wrap_fornDias').style.display = (tipo==='prazo') ? 'block' : 'none';
  document.getElementById('wrap_fornEsc').style.display  = (tipo==='escalonado') ? 'block' : 'none';
}
function updateFlow(){
  const contrato = parseNum(document.getElementById('o_contrato').value);
  const agio = parseFloat(document.getElementById('o_agio').value)||0;
  const imp = parseFloat(document.getElementById('o_imposto').value)||0;
  const adm = parseFloat(document.getElementById('o_adm').value)||0;
  const sav = parseFloat(document.getElementById('o_savings').value)||0;
  const mod = parseNum(document.getElementById('o_mod').value);
  const custoOrcado = parseNum(document.getElementById('o_budgetTotal').value);
  const comissao = parseFloat(document.getElementById('o_comissao').value)||0;
  const rt = parseFloat(document.getElementById('o_reservaTecnica').value)||0;
  const dur = Math.max(1, parseInt(document.getElementById('o_duracao').value)||1);
  const fat = contrato*agio/100, admV = contrato*adm/100, impV = fat*imp/100;
  const fatLiq = Math.max(0, contrato - impV - mod - admV); // FIX 2026-08-08: base comissão/RT/savings = contrato − imposto − equipe − adm
  const comV = comissao/100*fatLiq, rtV = rt/100*fatLiq;
  const entrada = fat - impV - comV - rtV;     // Entrada da obra (receita) — sem savings (savings vira custo menor)
  const direto = contrato - fat;
  const baseSavings = fatLiq;                  // mesma base de comissão/RT (contrato − imposto − equipe − adm)
  const savGeral = sav/100*baseSavings;        // savings geral = % sobre essa base
  const budgetCompras = Math.max(0, custoOrcado - mod - savGeral);   // DERIVADO = orçado − MOD − savings
  const comprasNoFluxo = budgetCompras * agio/100; // só a FATIA BER das compras entra no caixa da BER (o resto é direto cliente↔parceiro)
  const custoReal = mod + comprasNoFluxo;      // custo que passa pelo caixa da BER
  const R = v=>'R$ '+Math.round(v).toLocaleString('pt-BR');
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  // entrada (receita)
  set('cf_fat', R(fat)); set('cf_adm', R(admV)); set('cf_imp', '− '+R(impV));
  set('cf_com','− '+R(comV)); set('cf_rt','− '+R(rtV)); set('cf_compct', comissao+'%'); set('cf_rtpct', rt+'%'); set('cf_liqbase','base: '+R(fatLiq));
  set('cf_ent', R(entrada));
  // budget da obra
  set('cb_orcado', R(custoOrcado)); set('cb_mod', '− '+R(mod));
  set('cb_savpct', sav+'%'); set('cb_sav', '− '+R(savGeral)); set('cb_savbase', 'sobre contrato−imp.−equipe−adm: '+R(baseSavings));
  set('cb_result', R(budgetCompras));
  set('cb_agiopct', agio+'%'); set('cb_direta', R(comprasNoFluxo));
  const hid = document.getElementById('o_fornMat'); if(hid) hid.value = budgetCompras;
  // saídas (custo real)
  set('cs_mod', '− '+R(mod)); set('cs_forn', '− '+R(comprasNoFluxo)); set('cs_budget', '− '+R(custoReal));
  set('cs_modsub', dur+'× de '+R(mod/dur)+'/mês');
  set('cs_fornsub', 'só × fatia BER · '+dur+'× de '+R(comprasNoFluxo/dur)+'/mês');
  set('cs_com', 'na entrada'); set('cs_comsub', 'comissão deduzida no faturamento (acima)');
  set('cs_tot', '− '+R(custoReal));
}
function maxStart(){ return OBRAS.reduce((m,o)=>Math.max(m,o.inicio||1),0); }
function defaultMes(){
  const withMes = OBRAS.filter(o=>o.inicioMes);
  if(withMes.length){ return indexToMes(Math.max(...withMes.map(o=>mesToIndex(o.inicioMes)))).ym; }
  const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function closeObra(){ document.getElementById('obraModal').classList.remove('active'); editingId=null; }
function openSetup(){ render(); document.getElementById('setupModal').classList.add('active'); }
function closeSetup(){ document.getElementById('setupModal').classList.remove('active'); }
function val(id){ return parseFloat(document.getElementById(id).value)||0; }
function parseNum(str){ return parseFloat(String(str).replace(/[^\d]/g,''))||0; }
function fmtInputBRL(el){ const n=parseNum(el.value); el.value = n? n.toLocaleString('pt-BR'):''; }
function saveObra(){
  const nome = document.getElementById('o_nome').value.trim() || 'Obra sem nome';
  const mod = parseNum(document.getElementById('o_mod').value);
  const custoOrcado = parseNum(document.getElementById('o_budgetTotal').value);   // Custo orçado da obra
  const data = { nome, contrato:parseNum(document.getElementById('o_contrato').value), mod, budget:custoOrcado, duracao:Math.max(1,val('o_duracao')), inicioMes:document.getElementById('o_inicioMes').value||defaultMes(), sinal:val('o_sinal'),
    juros:val('o_juros'), imposto:val('o_imposto'), adm:val('o_adm'), savings:val('o_savings'), agio:val('o_agio'), ret:val('o_ret'),
    prazoSinal:val('o_prazoSinal'), formaReceb:document.getElementById('o_formaReceb').value, prazoReceb:val('o_prazoReceb'), parcelasN:val('o_parcN'), parcelasValor:parseNum(document.getElementById('o_parcV').value),
    fornTipo:document.getElementById('o_fornTipo').value, fornDias:val('o_fornDias'), comissao:val('o_comissao'), reservaTecnica:val('o_reservaTecnica'),
    curva:document.getElementById('o_curva').value, fornSinalPct:val('o_fornSinalPct'), fornPrazo1:val('o_fornPrazo1'), fornPrazo2:val('o_fornPrazo2') };
  if(editingId){ const o=OBRAS.find(x=>x.id===editingId); Object.assign(o,data); }
  else { data.id = 'o'+Date.now(); OBRAS.push(data); }
  closeObra(); render();
}
function deleteObra(){ if(editingId){ OBRAS = OBRAS.filter(o=>o.id!==editingId); closeObra(); render(); } }
function deleteObraRow(id){
  const o = OBRAS.find(x=>x.id===id); if(!o) return;
  if(confirm('Excluir a obra "'+o.nome+'"? Essa ação não pode ser desfeita.')){
    OBRAS = OBRAS.filter(x=>x.id!==id); render();
  }
}

/* ============================================================
   EXPORT / IMPORT
   ============================================================ */
function exportJSON(){
  const blob = new Blob([JSON.stringify({premissas:PREM,obras:OBRAS},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ber-capital-giro.json'; a.click();
}
function importJSON(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result); if(d.obras) OBRAS=d.obras; if(d.premissas) PREM=Object.assign(structuredClone(DEFAULT_PREM),d.premissas); syncPremToInputs(); render(); }catch(err){ alert('Arquivo inválido.'); } }; r.readAsText(f); e.target.value='';
}

/* ============================================================
   INIT
   ============================================================ */
// Exposto em window (em vez de auto-executar) porque isso roda dentro de uma
// SPA (Next.js): o <script src="app.js"> só carrega/executa UMA vez (dedupe
// do next/script), mas a página React pode desmontar/remontar (o usuário sai
// e volta pra tela) — cada remontagem precisa recarregar o estado e
// repopular o DOM novo. window.CGInit() é chamado pela página a cada mount;
// os listeners globais (modal, resize) só são presos na 1ª vez.
let _cgListenersBound = false;
window.CGInit = async function CGInit(){
  const th = localStorage.getItem(LS_THEME); if(th) document.documentElement.setAttribute('data-theme', th);
  await loadState();
  syncPremToInputs(); bindPrem(); render();
  if(!_cgListenersBound){
    _cgListenersBound = true;
    document.getElementById('obraModal').addEventListener('click', e=>{ if(e.target.id==='obraModal') closeObra(); });
    // Enter em qualquer campo do modal → salva e recalcula na hora (não em select/textarea)
    document.getElementById('obraModal').addEventListener('keydown', e=>{ if(e.key==='Enter' && e.target.tagName==='INPUT' && e.target.type!=='file'){ e.preventDefault(); saveObra(); } });
    document.getElementById('setupModal').addEventListener('click', e=>{ if(e.target.id==='setupModal') closeSetup(); });
    window.addEventListener('resize', ()=>{ if(CALC && document.getElementById('tab-fluxo').classList.contains('active')) drawChart(CALC.rows); });
  }
};
