import * as types from './src/modules/alocacoes/types';
const { createAlocacaoSchema, CARGOS_ALOCACAO } = types;

console.log('CARGOS_ALOCACAO:', CARGOS_ALOCACAO);

const r1 = createAlocacaoSchema.safeParse({
  userId: '11111111-1111-1111-1111-111111111111',
  obraId: '22222222-2222-2222-2222-222222222222',
  cargoNaAlocacao: 'mestre',
  dedicacaoPct: 100,
});
console.log('1) contratada válida:', r1.success);
if (!r1.success) console.log(r1.error.issues);

const r2 = createAlocacaoSchema.safeParse({
  userId: '11111111-1111-1111-1111-111111111111',
  crmOportunidadeId: '33333333-3333-3333-3333-333333333333',
  origemTipo: 'pipeline',
  cargoNaAlocacao: 'residente',
  dedicacaoPct: 50,
  dataInicio: '2026-10-01',
  dataFim: '2027-01-01',
});
console.log('2) pipeline válida:', r2.success);
if (!r2.success) console.log(r2.error.issues);

const r3 = createAlocacaoSchema.safeParse({
  userId: '11111111-1111-1111-1111-111111111111',
  crmOportunidadeId: '33333333-3333-3333-3333-333333333333',
  origemTipo: 'pipeline',
  cargoNaAlocacao: 'residente',
  dedicacaoPct: 50,
});
console.log('3) pipeline sem datas (deve ser false):', r3.success);

const r4 = createAlocacaoSchema.safeParse({
  userId: '11111111-1111-1111-1111-111111111111',
  obraId: '22222222-2222-2222-2222-222222222222',
  crmOportunidadeId: '33333333-3333-3333-3333-333333333333',
  cargoNaAlocacao: 'mestre',
  dedicacaoPct: 100,
});
console.log('4) obra+oportunidade juntos (deve ser false):', r4.success);

const r5 = createAlocacaoSchema.safeParse({
  obraId: '22222222-2222-2222-2222-222222222222',
  cargoNaAlocacao: 'mestre',
  dedicacaoPct: 100,
});
console.log('5) sem recurso (deve ser false):', r5.success);

const r6 = createAlocacaoSchema.safeParse({
  userId: '11111111-1111-1111-1111-111111111111',
  obraId: '22222222-2222-2222-2222-222222222222',
  cargoNaAlocacao: 'administrativo',
  dedicacaoPct: 100,
});
console.log('6) cargo administrativo válido:', r6.success);
