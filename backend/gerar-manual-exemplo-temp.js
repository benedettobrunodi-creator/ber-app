const React = require('react');
const { renderToBuffer } = require('@react-pdf/renderer');
const { ManualProprietarioPdf } = require('./dist/modules/close-out/manual-pdf');
const fs = require('fs');

const data = {
  obra: { name: 'Poatek · 8° andar', client: 'Poatek Tellus Digital', address: 'Rua Minas Gerais, 316 · Higienópolis · São Paulo/SP · Ed. Panorama Paulista Corporate', areaM2: 431.8 },
  manual: {
    fotoCapaUrl: null,
    dataEntrega: '2026-09-01',
    urlOnline: 'ber-engenharia.com.br/manual/poatek',
    canalAssistencia: 'assistencia@ber-engenharia.com.br',
    textoBemVindos: null,
    materiais: ['eletrica', 'porcelanato', 'vinilico', 'carpete', 'forro_gesso', 'pintura_acrilica', 'divisorias_vidro', 'marmore_granito', 'rejunte', 'marcenaria', 'metais', 'fechaduras', 'hidraulica', 'eletrodomesticos'],
    galeria: [],
    acabamentos: [
      { grupo: 'Pisos', nome: 'Corelay Wood Eng Oak Medium', cor: '#B08B5A', tipo: 'Piso vinílico', fornecedor: 'Creative Wall' },
      { grupo: 'Pisos', nome: 'Corelay Concret Eng Gray', cor: '#9A9A95', tipo: 'Piso vinílico', fornecedor: 'Creative Wall' },
      { grupo: 'Pintura de paredes', nome: 'Cânion Verde', cor: '#3D4A2F', tipo: 'Tinta acrílica', fornecedor: 'Suvinil' },
      { grupo: 'Pintura de paredes', nome: 'Branco Neve', cor: '#F2F2EE', tipo: 'Tinta acrílica', fornecedor: 'Suvinil' },
      { grupo: 'Pintura de paredes', nome: 'Tijolo', cor: '#A8532F', tipo: 'Tinta acrílica', fornecedor: 'Suvinil' },
      { grupo: 'Pedras', nome: 'Granito Preto São Gabriel', cor: '#2B2B2B', tipo: 'Marmoraria', fornecedor: 'AMG Pedras' },
    ],
    mobiliario: [
      { nome: 'Plataforma Volle dupla face para 8 postos', medida: '1200x600 mm', descricao: 'branco 25mm / Divisor vidro incolor' },
      { nome: 'Mesa Volle reunião quadrada', medida: '1400x1400 mm', descricao: 'carvalho avelã 25mm' },
      { nome: 'Cadeira Quick fixa "V"', medida: null, descricao: 'Basalto' },
      { nome: 'Locker Klappt 10 portas', medida: '800x500x2100 mm', descricao: 'Portas grafite e carvalho avelã · corpo branco' },
    ],
    fornecedores: [
      { categoria: 'Drywall e gesso', nome: 'Method', telefone: '(11) 94724-8095', email: null, endereco: 'Avenida Paulista, 807 — São Paulo/SP' },
      { categoria: 'Pintura', nome: 'Master Pinturas e Texturas', telefone: '(11) 98746-3203', email: null, endereco: 'Carapicuíba/SP' },
      { categoria: 'Vinílico', nome: 'Creative Wall', telefone: null, email: null, endereco: 'Santana de Parnaíba/SP' },
      { categoria: 'Ar condicionado', nome: 'Cold Control', telefone: '(11) 99639-3095', email: null, endereco: 'Lapa — São Paulo/SP' },
      { categoria: 'Mobiliário corporativo', nome: 'Dematec', telefone: null, email: null, endereco: 'Boituva/SP' },
      { categoria: 'Extintores', nome: 'Extinpel', telefone: null, email: 'vendas7@fcvextintores.com.br', endereco: 'Santo Antônio da Platina/PR' },
    ],
    equipe: [
      { papel: 'Diretor de obras', nome: 'Gustavo Carmezini' },
      { papel: 'Gerente de projetos (PMO)', nome: 'Camila Fernandes' },
      { papel: 'Gestor de obra', nome: 'Victor Hugo' },
      { papel: 'Orçamentista', nome: 'Bruna Lima' },
      { papel: 'Compras', nome: 'Emerson Machado' },
    ],
    anexos: [
      { tipo: 'RRT', nome: 'RRT — Direção de Obra', url: 'x' },
      { tipo: 'ART', nome: 'ART Principal', url: 'x' },
    ],
  },
  projetos: [
    { codigo: '982-BO00-POA-BOM-BO', disciplina: 'Arquitetura', revisao: 'Rev.D' },
    { codigo: '982-0801-POA-CLI-EQ', disciplina: 'Arquitetura', revisao: 'Rev.C' },
    { codigo: '982-0702-POA-ELE-DT', disciplina: 'Instalações Elétricas', revisao: 'Rev.E' },
    { codigo: '982-0803-POA-ELE-PI', disciplina: 'Instalações Elétricas', revisao: 'Rev.C' },
    { codigo: '982-0801-POA-HID-ES', disciplina: 'Hidráulica', revisao: 'R00' },
    { codigo: '982-0701-POA-INC-SP', disciplina: 'Combate a Incêndio', revisao: 'R01' },
  ],
};

renderToBuffer(React.createElement(ManualProprietarioPdf, { data })).then(buf => {
  fs.writeFileSync('/tmp/BER-Manual-Exemplo.pdf', buf);
  console.log('OK', (buf.length / 1024).toFixed(0), 'KB');
}).catch(e => { console.error('ERRO:', e.message); process.exit(1); });
