import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-07',
      title: 'Execução de Instalações Elétricas de Baixa Tensão',
      discipline: 'eletrica',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução de instalações elétricas de baixa tensão em interiores corporativos e residenciais, garantindo segurança, conformidade com a NBR 5410:2004 e correta identificação de quadros e circuitos.',
      materials: [
        'Conduíte rígido PVC (embutido em paredes e lajes)',
        'Conduíte flexível corrugado (smurf — conexões finais e trechos de difícil acesso)',
        'Eletrocalha perfurada ou lisa (infraestrutura aérea em forro e shafts)',
        'Caixas de passagem 4x2", 4x4" e octogonais (pontos elétricos)',
        'Fios e cabos conforme projeto (bitola mínima: 2,5mm² para tomadas, 1,5mm² para iluminação, 4mm² para AR, 6mm² ou mais para circuitos especiais)',
        'Disjuntores DIN conforme projeto (nunca substituir por bitola acima sem projeto)',
        'Quadro de distribuição (QDC) com barramento e espaço reserva mínimo 20%',
        'Fita isolante autofusão + fita isolante comum (emendas)',
        'Buchas e arruelas (entrada de conduíte nas caixas)',
        'Espaguetes e presilhas (organização de cabos em eletrocalha)',
        'Etiquetas de identificação de circuito (obrigatórias em todos os disjuntores)',
        'Abraçadeiras fixação de conduíte e eletrocalha'
      ],
      tools: [
        'Alicate de corte, universal e desencapador',
        'Chave de fenda e philips (vários tamanhos)',
        'Multímetro (verificação de tensão, continuidade e terra)',
        'Alicate amperímetro (verificação de carga)',
        'Furadeira e martelete (passagem de conduíte)',
        'Serra copo (furo em caixas e quadros)',
        'Nível a laser (alinhamento de caixas e eletrocalhas)',
        'Passafio de aço (passagem de cabos em conduíte)',
        'Detector de tensão sem contato (verificação de fase)',
        'Prensa-terminais (conexões no quadro)',
        'Régua de alumínio e trena'
      ],
      steps: [
        { order: 1, title: 'Análise do projeto elétrico', description: 'NUNCA iniciar execução sem projeto elétrico aprovado. Verificar: posição de todas as caixas (tomadas, interruptores, pontos de dados, luminárias), traçado dos circuitos, bitola dos cabos por circuito, carga total e dimensionamento do quadro. Em reforma: verificar a capacidade do ramal existente e do quadro antes de adicionar circuitos. Qualquer divergência entre projeto e obra deve ser resolvida com o projetista antes de executar.' },
        { order: 2, title: 'Infraestrutura — conduíte e eletrocalha', description: 'DENTRO DE PAREDES (drywall ou alvenaria): conduíte rígido PVC fixado nos montantes ou embutido. Raio mínimo de curva: 6x o diâmetro do conduíte. Máximo 3 curvas de 90° entre caixas de passagem. INFRA AÉREA (forro, shaft): eletrocalha perfurada fixada em suportes a cada 1,5m. Separar eletrocalhas: elétrica e dados em eletrocalhas separadas com distância mínima de 15cm. CONDUÍTE FLEXÍVEL: apenas em conexões finais (máximo 80cm) — nunca usar smurf em trechos longos. Fixar conduíte rígido com abraçadeiras a cada 80cm no máximo.' },
        { order: 3, title: 'Posicionamento das caixas', description: 'Alinhamento obrigatório com nível a laser — caixas tortas são inaceitáveis na BER. Alturas padrão (NBR 9050 e padrão BER): tomadas: 30cm do piso acabado (residencial) ou conforme projeto (corporativo — geralmente no rodapé técnico ou bancada); interruptores: 1,00m do piso acabado; quadro elétrico: 1,60m do piso ao centro. Deixar caixas salientes 2mm da parede de drywall — a chapa de acabamento deve ficar nivelada com a superfície. Identificar cada caixa com fita crepe indicando o circuito correspondente antes de fechar a parede.' },
        { order: 4, title: 'Passagem dos cabos', description: 'Sempre usar passafio de aço — nunca forçar cabo sem guia. Bitolas conforme projeto e NBR 5410: iluminação mínimo 1,5mm², tomadas mínimo 2,5mm², ar condicionado mínimo 4mm², circuitos especiais conforme carga. Identificar TODOS os cabos com fita colorida ou etiqueta nos dois extremos antes de puxar: fase=preto/marrom/cinza, neutro=azul claro, terra=verde/amarelo. Taxa de ocupação máxima do conduíte: 40% da seção transversal. Nunca fazer emendas dentro do conduíte — apenas dentro de caixas de passagem.' },
        { order: 5, title: 'Montagem do quadro de distribuição', description: 'QUADRO NOVO: instalar com espaço de reserva mínimo 20% para futuras expansões. Fixar firmemente na parede — quadro solto é risco de segurança. Identificar barramentos: fase, neutro e terra. QUADRO EXISTENTE: verificar se há espaço para os novos disjuntores. Nunca substituir um disjuntor por um de maior amperagem sem projeto — é gambiarra perigosa. Organizar os cabos com espiral organizador ou amarras. Todo circuito deve ter: disjuntor de proteção, identificação clara e cabo de terra.' },
        { order: 6, title: 'Conexões no quadro', description: 'Desligar a chave geral antes de qualquer trabalho no quadro — usar detector de tensão para confirmar. Usar terminais ilhados (olhal ou pino) para conexão no barramento — cabo solto no parafuso é risco de arco elétrico. Apertar os parafusos com torque adequado — verifique na embalagem do disjuntor (geralmente 1,2-2,0 Nm). Nunca conectar dois cabos no mesmo terminal de disjuntor — usar barra de distribuição.' },
        { order: 7, title: 'Identificação completa de circuitos — ETAPA CRÍTICA', description: 'Antes de energizar, identificar 100% dos circuitos. Método BER: ligar um circuito por vez no quadro, testar cada ponto e etiquetar o disjuntor imediatamente. Etiqueta padrão BER: número do circuito + descrição (ex: "C01 — Tomadas Sala") + data. Elaborar o diagrama unifiliar atualizado e fixar na porta do quadro. Fotografar o quadro identificado e arquivar na documentação da obra. Um quadro sem identificação é entrega incompleta — não aceitar.' },
        { order: 8, title: 'Testes elétricos obrigatórios', description: 'COM MULTÍMETRO, testar todos os pontos antes de instalar as tomadas e interruptores: 1) TENSÃO: verificar 127V ou 220V conforme projeto entre fase e neutro. 2) TERRA: verificar continuidade entre o pino terra da tomada e o barramento de terra do quadro. 3) INVERSÃO DE FASE/NEUTRO: nunca aceitar neutro no lugar da fase — risco de choque. 4) CONTINUIDADE: verificar que não há circuito aberto. ALICATE AMPERÍMETRO: após ligar as cargas, verificar se a corrente está dentro do dimensionamento. Registrar todos os resultados em planilha de testes.' },
        { order: 9, title: 'Instalação de tomadas e interruptores', description: 'Verificar a tensão do ponto antes de instalar (127V ou 220V). Conectar: fase no terminal L (ou identificado), neutro no terminal N, terra no terminal identificado com símbolo de terra. Apertar os parafusos firmemente — terminal frouxo causa aquecimento e falha. Verificar se a placa de acabamento ficou alinhada e nivelada com a parede. Testar cada ponto após instalação com detector de tensão e multímetro.' }
      ],
      attentionPoints: [
        'IDENTIFICAÇÃO DO QUADRO: entrega sem quadro 100% identificado é entrega incompleta — ponto crítico BER',
        'TERRA: verificar continuidade do terra em TODOS os pontos — terra ausente é risco de vida',
        'INVERSÃO FASE/NEUTRO: testar com multímetro antes de fechar — invertido causa choque ao tocar o interruptor',
        'BITOLA: nunca usar bitola menor que a de projeto — superaquecimento e incêndio',
        'DISJUNTOR SUPERDIMENSIONADO: nunca trocar por amperagem maior sem projeto — o cabo não é protegido',
        'EMENDA NO CONDUÍTE: proibido — apenas em caixas de passagem com conector adequado',
        'SMURF EM TRECHO LONGO: proibido — apenas conexões finais até 80cm',
        'SEPARAÇÃO ELÉTRICA/DADOS: eletrocalhas separadas a 15cm — interferência eletromagnética em dados'
      ],
      approvalCriteria: [
        'Todos os circuitos identificados no quadro com etiqueta e diagrama unifiliar atualizado',
        'Tensão verificada em 100% dos pontos: 127V ou 220V conforme projeto',
        'Continuidade do terra verificada em 100% dos pontos',
        'Ausência de inversão fase/neutro em todos os pontos',
        'Corrente de cada circuito dentro do dimensionamento (alicate amperímetro)',
        'Nenhuma emenda dentro de conduíte',
        'Caixas alinhadas e niveladas',
        'Planilha de testes preenchida e arquivada na documentação da obra'
      ]
    }
  });

  console.log('IT-07 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
