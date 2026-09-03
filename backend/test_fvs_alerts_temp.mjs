import { checkFvsItensVencidos } from './src/modules/fvs/alerts';

const r = await checkFvsItensVencidos();
console.log('resultado:', r);
