import * as storage from './src/services/storage';

const url = '/uploads/1788207961215-fake_cronograma.pdf';
const buf = await storage.downloadFile(url);
console.log('bytes lidos:', buf.length);
console.log('conteudo:', buf.toString('utf8'));
