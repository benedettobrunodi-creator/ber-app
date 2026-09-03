// Exemplo visual do Relatório de Recebimento pro Bruno (fotos do modelo 606.26).
import * as React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync } from 'node:fs';
import { RecebimentoPDF } from '../src/modules/recebimento/recebimento-pdf';

const F = (n: string) => `/tmp/receb_exemplo/foto-${n}.jpg`;

const ambientes = [
  { nome: 'Salão', fotos: [
    { url: F('000'), legenda: 'Vista geral com proteção de piso instalada.', patologia: false },
    { url: F('001'), legenda: 'Vista geral, lado oposto.', patologia: false },
    { url: F('006'), legenda: 'Quadro elétrico principal.', patologia: false },
    { url: F('008'), legenda: 'Falta de detector de fumaça e peça existente, não fixada.', patologia: true },
    { url: F('010'), legenda: 'Longa fissura na parede de divisa com o escritório ao lado.', patologia: true },
  ]},
  { nome: 'Área Técnica', fotos: [
    { url: F('014'), legenda: 'Banheiro da área técnica, bacia sem tampa, sem rejunte e bastante sujeira.', patologia: true },
    { url: F('016'), legenda: 'Parede e forro da área técnica.', patologia: false },
    { url: F('018'), legenda: 'Piso e parede da área técnica com marcas de uso e sujeira.', patologia: true },
  ]},
  { nome: 'Banheiro PNE', fotos: [
    { url: F('019'), legenda: 'Pia, torneira e barras em bom estado.', patologia: false },
  ]},
  { nome: 'Bancada de Apoio do Salão', fotos: [
    { url: F('024'), legenda: 'Torneira sem filtro/arejador.', patologia: true },
  ]},
  { nome: 'Hall dos Elevadores', fotos: [
    { url: F('026'), legenda: 'Piso tátil na saída dos elevadores.', patologia: false },
  ]},
];

async function main() {
  const buf = await renderToBuffer(
    React.createElement(RecebimentoPDF, {
      obraNome: '606.26 Segura AI',
      obraTipo: 'Reforma Comercial',
      endereco: 'Rua dos Pinheiros 623, Pinheiros, São Paulo – SP – Conj. 141',
      cliente: 'Segura AI',
      responsavel: 'Alisson Luan',
      dataVistoria: new Date('2026-08-14T12:00:00Z'),
      objetivo:
        'O presente relatório tem como objetivo registrar as condições físicas do imóvel no início das atividades no endereço situado à Rua dos Pinheiros, nº 623, Conj. 141, Pinheiros – São Paulo/SP. Os registros fotográficos a seguir documentam as instalações elétricas, hidráulicas, os equipamentos presentes no local, bem como eventuais patologias e avarias.',
      ambientes,
    }) as never,
  );
  writeFileSync('/tmp/BER-Exemplo-Relatorio-Recebimento.pdf', buf);
  console.log(`OK ${buf.length} bytes`);
}
main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
