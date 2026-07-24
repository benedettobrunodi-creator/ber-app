#!/usr/bin/env python3
"""
Passo a Passo da Obra — seed do Controle de Coordenação.

Substitui os antigos templates de FVS por disciplina (FVS_0..FVS_20) pelo
checklist de coordenação organizado por FASE DE AVANÇO FÍSICO da obra,
extraído do documento "Passo a Passo Obra Rev 02" (F-ENG 21-C).

São 6 fases e 105 itens. Cada item guarda em `source_it_code` o número
original do documento (1.1, 2.14, 5.2b), pra que o time possa continuar
conversando pelo código do papel.

Itens cujo resultado deixa evidência física no canteiro exigem foto
(33 de 105). Reunião, contrato, e-mail e análise de projeto não exigem —
a prova deles é documental, não fotográfica.

DESTRUTIVO: apaga fvs_templates, fvs_template_items, obra_fvs e
obra_fvs_items antes de inserir. Faça backup antes (ver README do backup).

Uso:
    DATABASE_URL=postgresql://... python3 passo-a-passo-seed.py
    python3 passo-a-passo-seed.py "postgresql://..."
"""
import os
import subprocess
import sys

DB = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DATABASE_URL")
if not DB:
    sys.exit("Defina DATABASE_URL (env) ou passe a URL como primeiro argumento.")

# (code, nome, [(source_it_code, descricao, foto_obrigatoria, ordem), ...])
FASES = [
  ('PP1', '1. Planejamento / Pré-Obra', [
    ('1.1', 'Kick off Comercial (informações Comerciais) / Técnico (Informações de Arquitetura e Técnico): Informar particularidades do projeto junto aos departamentos envolvidos.', False, 1),
    ('1.1a', 'Para desenvolvimento de D&B - Fazer scaneamento do ambiente 360º antes do projeto', False, 2),
    ('1.1b', 'Teremos Interfone no andar?', False, 3),
    ('1.1c', 'Responsabilidade Planejamento - Desenvolver projetos técnicos de acordo as premissas de venda e requisitos do cliente, monitorando desenvolvimento.', False, 4),
    ('1.2', 'Kick off Cliente e Gerenciadora, alinhar todas expectativas do projeto, como plano de comunicação, confirmação de cronograma, relatório de obra, datas de medições, fluxo de pagamentos e próximos passos. Registrar em Ata', False, 5),
    ('1.3', 'Solicitar reunião com Time de TI para alinhamento de 100% dos escopos contratados X requeridos pelas diferentes áreas do cliente. Importante validarmos layout, bayface, peculiaridades dos sistemas a serem instalados, datas com acompanhamento de representante do cliente. (Para os casos de D&B, fundamentais para alinhamento no desenvolvimento dos projetos conforme escopo estimado e no caso dos projetos já existentes, confirmação do que foi considerado)', False, 6),
    ('1.4', 'Alinhamento dos itens de automação e multimídia. Solicitar acompanhamento dos responsáveis para verificação do escopo, acompanhamento dos processos construtivos com a validação das infraestruturas e posicionamento dos equipamentos, como racks, reforços, localizações, e demais ações necessárias. Verificar escopo e fornecedores embarcados', False, 7),
    ('1.5', 'Informar na primeira reunião de fornecedores explicando o projeto e cliente. Que é de total responsabilidade da empresa CONTRATADA a retirada, armazenamento e reinstalação de todos equipamentos desmontados no decorrer da obra caso haja reaproveitamento destes equipamentos como: controladoras, termostatos, placas de comandos, detectores, módulos de acionamento, sirenes, etc. A perda destes equipamentos, acarretará em fornecimento de novos equipamentos pela empresa CONTRATADA. Lembrar dos normativos indicados nas cartilhas e manuais.', False, 8),
    ('1.6', 'Realizar reunião com condomínio para entender todas as regras dos fluxos e autorizações dos trabalhos. Aproveitar e solicitar o caderno técnico, caso não tenha recebido na reunião com comercial.', False, 9),
    ('1.7', 'Executar o Check List de Recebimento do Conjunto, com check list técnico e elaborar relatório (com a solicitação de relatórios ao condomínio e verificando item a item). O documento precisa ser enviado ao cliente e condomínio antes do início da obra. Deve ser solicitado ao condomínio as regras de trabalho.', False, 10),
    ('1.8', 'Conhecer o contrato Cliente X BÈR e entender todas as questões de clausulas que podem gerar prejuízos a BÈR.', False, 11),
    ('1.9', 'Contratar Seguro de obra: Não é permitido o início da obra sem o seguro contratado.', False, 12),
    ('1.9a', 'Início de obra com contrato assinado', False, 13),
    ('1.10', 'Verificar que a lista de projetos está valida - Nomenclatura e Revisão - Conferir com os projetos de venda', False, 14),
    ('1.10a', 'Sala de Gerra para deliberar sobre obra / Cronograma / Contratações / Autorizações / Etc...', False, 15),
    ('1.11', 'Reunião de Início de Obra: Deve ser realizada antes do início da demolição já com o canteiro finalizado. Abordar as ações preliminares de compra de materiais, alinhamento de ações, de mobilização e estratégia de obra', False, 16),
    ('1.12', 'Checar e verificar de quem é a responsabilidade de obter a autorização do condomínio para o início da obra e para os projetos apresentados (conforme necessidade). Verificar vagas para estacionamento.', False, 17),
    ('1.13', 'Efetuar semanalmente reunião com todos os fornecedores. Informar dia da semana na ata de início da obra.', False, 18),
    ('1.14', 'Projetos técnicos e de arquitetura deverão ser validados por planejamento e por engenharia para poder seguir para obra. (double check) O pessoal de obra também deverá fazer análise do projeto', False, 19),
    ('1.15', 'Acompanhamento do time técnico para indicação de pontos de atenção, vistoria em conjunto ao site de obra e acompanhamento dos serviços de forma progressiva de obra, tendo em vista ações prioritárias para os sistemas a serem instalados. Fazer lista e distribuir para obra.', False, 20),
    ('1.16', 'Alinhar com o cliente e arquitetura, quais serão os itens que demandem Mockup, bem como controle de aprovação de amostras. Colocar na plataforma e distribuir para os validadores.', False, 21),
    ('1.17', 'Ideal que tenhamos um cronograma de compras para que 80% das compras da obra em até 20% do prazo de início oficial da obra. Caso o projeto seja D&B, deve-se ficar mais próximo da arquitetura para evitar perda de tempo e alinhar a antecipação das compras, verificando os devidos prazos.', False, 22),
    ('1.18', 'Desabilitar, quando possível, o sistema de detecção de fumaça antes do início da obra. Caso haja necessidade de iniciar com o sistema em operação, solicitar autorização da gerenciadora/cliente para o início dos serviços e responsabilizando os mesmos em caso de incidentes (documentar). Nem sempre, quando possível. No SPCTowers, por exemplo, se desabilitar o sistema de detecção junto com a rede de SPK será necessário ter bombeiro 24/7 durante todo o tempo que o sistemas ficarem desabilitados.', False, 23),
    ('1.19', 'Verificar prazos de fornecedores contratados pelo cliente/arquiteto X prazo de obra - Verificar problemas caso necessário. - Cronograma', False, 24),
    ('1.20', 'Solicitar ao time de orçamentos auxilio no levantamento dos materiais que demandam longo prazo de fabricação e entrega. Principalmente itens externos - cliente e arquitetura. Considerar antecipação no cronograma de contratação para estes itens. Bruna - apontamento prévio.', False, 25),
    ('1.22', 'Conferir medidas gerais da obra x medidas do projeto arquitetônico - informar arquitetura no caso de divergência.', False, 26),
    ('1.22a', 'fazer mapa de setorização de obra / identificação de placas', False, 27),
    ('1.23', 'Elaborar Plano de Segurança de Obra e Outros, por demanda. API, PAE, PCMSO Caso necessários - PAE e Layout de obra Obrigatórios', False, 28),
    ('1.24', "É obrigatório a execução da impermeabilização (com mureta de contenção) em todos os cpd's que contenham equipamentos de precisão ou que possuem risco de vazamento. - Verificar projeto técnico e sugerir ao cliente, registrando. Preferencialmente nenhuma instalação hidrossanitária deverá passar pelo CPD ou SPK - Ver requisitos do cliente", True, 29),
    ('1.25', 'Drenar Rede de sprinklers antes do inicio da obra. Responsabilidade do engenheiro registrar com foto o momento do lacre do registro de SPK bem como lançar no relatório semanal a foto do mesmo. Não é permitido o inicio de obra sem este procedimento. Somente proceder a abertura da rede ou retirada de bicos com a presença de bombeiro do condomínio acompanhando este início de serviço.', True, 30),
    ('1.26', 'É obrigatória a execução de alçapões para manutenções no entreforro. Verificar se o projeto de arquitetura contempla as informações dos projetos técnicos de ar condicionado e demais sistemas que necessitam de acesso ao entreforro.', True, 31),
    ('1.27', 'Salvar na rede todas as aprovações, como projetos, custos, alterações e outras que porventura forem necessárias, seja email ou ata.', False, 32),
    ('1.28', 'Verificar com o departamento Fiscal a abertura da CNO, caso faça parte do escopo. Tratar de forma diferenciada processos que envolvam PO, pois isso afeta o fluxo financeiro da obra, principalmente Fat direto', False, 33),
  ]),
  ('PP2', '2. Obra de 0 a 25%', [
    ('2.1', 'Colocar quadro de Gestão na obra / Plantas e Cronogramas / Avaliação de Fornecedores / Atividades Principais da Semana / Principais Milestones. ART, Seguro de obra também', True, 1),
    ('2.2', 'Solicitar despressurização da rede de SPK e presença de Bombeiro/Bravo para acompanhar a desplugagem do primeiro bico.', True, 2),
    ('2.3', 'Listar itens pendentes de compra de forma visível na gestão a vista', True, 3),
    ('2.4', 'Listar todas as datas principais de atividades, como por exemplo, Fechamento de Piso, Instalação de Carpete, Medição de Marcenaria, Divisórias, Persianas, Fechamento de Forro, Recebimento de UPS etc...', False, 4),
    ('2.5', 'Informar Início Efetivo da Obra para os todos os envolvidos da obra.', False, 5),
    ('2.6', 'Eixos e níveis da obra estão marcados e checados – Atentar para marcação do nível do forro. Os níveis deverão estar marcados antes do inicio efetivo de obra', True, 6),
    ('2.7', 'Checar cotas das instalações hidráulicas, elétricas e demais e escrever as cotas na parede.', True, 7),
    ('2.8', 'É EXPRESSAMENTE PROIBIDO aplicação de piso vinílico ou carpete em áreas de contrapiso sem a validação e autorização assinada pelo instalador de piso. - Verificar com prestador de serviço procedimentos antes da contratação e na reunião inicial. Adotar como padrão executar estes acabamentos após primeira demão de pintura, salvo exceções. Prever em cronograma a dependência destas atividades.', False, 8),
    ('2.9', 'Acompanhamento do time Técnico para vistoria dos serviços iniciados e orientação para próximas atividades', False, 9),
    ('2.10', 'Início das marcações das atividades executadas e infraestruturas lançadas em planta, para efeito de controle de avanço e anotadas as divergências do projeto para as built imediato da obra (arquitetura e disciplinas técnicas). Preferencialmente marcações visíveis no piso, inclusive do luminotécnico, spks, detecção, utilizando cores diferentes', True, 10),
    ('2.11', 'Muita atenção para a execução de serviços de impermeabilização. Alguns condomínios solicitam relatório de execução e testes de impermeabilização - verificar.', True, 11),
    ('2.12', 'Testar a impermeabilização nas áreas molhadas de acordo com o manual técnico. Alguns condomínios solicitam relatório de execução e testes de impermeabilização - verificar.', True, 12),
    ('2.13', 'Áreas com bacias de contenção: Deve haver bacia de contenção envolvendo a área da parede hidráulica e área molhada, para que eventual vazamento da parede não percole em local sem impermeabilização. Idealmente devemos prever sensor e válvula solenoide em caso de utilização de bomba de esgoto. Caso não esteja previsto, alertar.', True, 13),
    ('2.14', 'Em locais com áreas que podem molhar mas que não tem a devida contensão, propor ao cliente e/ou gerenciadora que seja feito aditivo para ser feita área de contensão com ralo, impermeabilizada.', False, 14),
    ('2.15', 'Antes do fechamento de forro conferir se todos os sistemas foram executados e que não existem interferências no em treforro para evitarmos reabertura em forro', True, 15),
    ('2.16', 'Conferir alinhamento de pontos de esgoto e AF para então liberar medição de bancadas Isso impacta na compra de sifões rígidos e também na marcenaria de gabinetes', True, 16),
    ('2.17', 'Conferir todos os encontros de acabamentos de piso, acabamentos de rodapés. Eixo de portas e divisórias e, também se será utilizado algum tipo de perfil. Temos também que avaliar se haverá soleiras e rebaixos para áreas molhadas.', False, 17),
    ('2.18', 'No caso de existência de box para chuveiro avaliar se haverá rebaixo e como será o detalhamento de instalação do box', False, 18),
    ('2.19', 'Iniciar a marcação dos itens de As Built em projeto - Hidráulica / Elétrica / Arquitetura', False, 19),
    ('2.20', 'Conferir previamente e após instalação do piso se o caimento está correto', True, 20),
    ('2.21', 'Área do CPD em utilização. Validar e confirmar com o time de TI, solicitando acompanhamento de todas as atualizações dos ambientes e validações técnicas. Tornar padrão a validação da planta de pontos com o time de TI do cliente, bom como CFTV, Controle de Acesso e Outros', False, 21),
    ('2.22', 'Análise crítica dos projetos para verificar a área de retorno do ar condicionado que deve ser de no mínimo 1,5 vezes a área de insulflamento - Solicitar cálculo ao projetista/instalador.', False, 22),
    ('2.23', 'Verificar se todos os equipamentos instalados estão sendo atendidos pelo ar externo, indicados em projeto.', False, 23),
    ('2.24', 'Verificar local para instalação das condensadoras no andar para instalação de evaporadoras - Atenção para área com ventilação e com o barulho que o equipamento emite. Validar com projetista/instalador.', False, 24),
    ('2.25', 'Marcenaria - indicação de locais para instalação de pontos de elétrica/cabling (acesso e caminhamento da tubulação foi considerado no projeto do móvel). Definir no início da obra.', False, 25),
    ('2.26', 'Verificar modelos e fabricantes das tomadas e RJs. Informar empresa de mobiliário para confecção da estampa de fixação.', False, 26),
    ('2.27', 'Verificar com arquiteto e instaladores posicionamento dos sensores de temperatura das salas - Altura e local.', False, 27),
    ('2.28', 'Divisórias industriais: verificar instalação de pontos de elétrica; cabling e interruptores. Medições e Preparo dos Septos. Verificar in loco a utilização de banda acústica e estudar encontros com caixilharia existente.(Mesmo processo para drywall)', True, 28),
    ('2.29', 'Verificar locais para instalação de reforço em paredes de Drywall (TV, armários, prateleiras e pivôs superiores para portas). Fazer teste de sobrecarga. Obrigatória a presença do Gerente da obra, Prever bases para instalação de molas para as portas', True, 29),
    ('2.30', 'Verificar locais para instalação de reforço em forros; assim como estudar a necessidade de estrutura auxiliar. Fazer teste de sobrecarga após a instalação. Obrigatória a presença do Gerente da obra', True, 30),
    ('2.31', 'Checar equipamentos que sejam fixados em laje que tenham algum esforço, como molas automáticas para sistema de extração de fumaça, portas automáticas e demais itens que necessitam qualquer tipo de reforço e verificar se os mesmos foram considerados quanto ao tipo e forma de fixação.', True, 31),
    ('2.32', 'Verificar possibilidade de vazamento de som em TODOS os encontros de Drywall e septos com paredes existentes; caixilhos; lajes; divisórias industriais; aberturas para passagem de tubos; eletrocalhas e dutos. Caso identifique qualquer abertura a mesma deve ser vedada. No caso da existência de projeto/consultor de acústica, observar se todas as indicações foram atendidas. Uma dica para identificar se existe abertura é projetar luz de um lado e verificar de outro - fazer a noite esta verificação.', True, 32),
    ('2.33', 'Salvar na rede todas as aprovações, como projetos, custos, alterações e outras que porventura forem necessárias', False, 33),
    ('2.34', 'Liberar a marcação das paredes no piso e verificar as medidas. Oportunidade de soltar as medidas das divisórias caso o cronograma da obra seja muito justo. Pontos de SPK e sistemas também podem ser indicados para verificar eventual problema de compatibilização do projeto.', True, 34),
    ('2.35', 'Liberação da medição das paredes e septos para divisória industrial. Sempre após o fechamento dos recortes e nivelamento do piso elevado', False, 35),
    ('2.36', 'Utilização de torneiras com flexíveis em áreas sem rebaixo de piso e/ou sem ralo. Utilização de nanoglass, granilite, cimento queimado, pisos monolíticos, pisos cimentícios, castellato e similares. Utilização de concreto aparente. Além de atentar com cuidados aos fornecedores, indicar para arquitetura eventuais problemas que podem acontecer com a especificação indicada.', False, 36),
  ]),
  ('PP3', '3. Obra de 25 a 50%', [
    ('3.1', 'Verificar e alertar a arquitetura quanto instalação de dimmer, controle de acesso ou outros sistemas em montantes de divisórias industriais, caso ocorram.', False, 1),
    ('3.2', 'Marcações de Itens de As Built em Projetos - Hidráulica / Elétrica / Ar Condicionado', False, 2),
    ('3.3', 'Luminárias pendentes e com mais de 500gr devem ser atirantadas na Laje. Proibida a instalação de luminárias diretamente no forro. - Alinhar com o fornecedor - uma vez que esta ação acontecerá no quarto final da obra. Luminárias tipo no frame e a maioria das decorativas pequenas não necessariamente necessitam estar atirantadas. Todas as funcionais deverão estar atirantadas.', True, 3),
    ('3.4', 'Para portas automáticas ou eletroímãs, verificar se o sistema esta ligado ao Nobreak ou no Grupo Gerador. Caso não tenha nobreak previsto, informar sobre eventuais futuros problemas que podem acontecer.', False, 4),
    ('3.5', 'Fazer a limpeza e organização das eletrocalhas/ entrepiso antes do fechamento do piso Elevado', True, 5),
    ('3.6', 'Identificar os QFLs (Quadros de Força e Luz) tanto os disjuntores (circuitos), quanto na tampa do mesmo. Verificar se o barramento está protegido, limpo e testado.', True, 6),
    ('3.7', 'Verificar o sistema de exaustão - Projeto e funcionamento.', False, 7),
    ('3.8', "Verificar como deverá ser feito o acionamento dos exaustores de WC's e copa (sensor/ interruptor)", False, 8),
    ('3.9', 'Evitar sempre que possível a instalação de evaporadoras sobre o Rack, banco de baterias e etc. Caso seja inevitável a evaporadora dentro do datacenter, instalar bandeja embaixo da mesma e ligá-la ao dreno para evitar possível gotejamento. Avaliar a necessidade de quadro de transferência caso tenhamos gerador e/ou nobreak', True, 9),
    ('3.10', 'Verificar drenos de ar condicionado (caimento adequado). Todos os drenos devem possuir isolamento térmico, ser sifonados e testados. Obrigatoriamente ter bitola mínima de # 1".', True, 10),
    ('3.11', 'Acompanhamento do time técnico para vistoria dos serviços iniciados e orientação para próximas atividades - neste momento deveremos ter se não 100% das infras lançadas, próximo de finalizar.', False, 11),
    ('3.12', 'Convidar o fornecedor de pintura para validar o serviço de drywall que será entregue para pintura e avaliar para propor correções, se necessário.', False, 12),
    ('3.13', 'Continuidade das marcações das atividades executadas e infraestruturas lançadas em planta, para efeito de controle de avanço e anotadas as divergências do projeto para as built imediato da obra (arquitetura e disciplinas técnicas)', False, 13),
  ]),
  ('PP4', '4. Obra de 50 a 75%', [
    ('4.1', 'Checar se existem contratações a serem realizadas', False, 1),
    ('4.2', 'Finalização dos serviços de infraestrutura, acompanhados pelo Apoio Técnico, caso necessário, com a verificação de todos os cabeamentos lançados.', True, 2),
    ('4.3', 'Fazer a limpeza e organização das eletrocalhas/ entrepiso antes do fechamento do piso Elevado.', True, 3),
    ('4.4', 'Salvar na rede todas as aprovações, como projetos, custos, alterações e outras que porventura forem necessárias', False, 4),
    ('4.5', 'Checar Alinhamento e locação das estações de trabalho conforme o projeto cotado de arquitetura.', True, 5),
    ('4.6', 'Agendar com o PMO o Check List antecipado.', False, 6),
    ('4.7', 'Convidar o fornecedor de pintura para validar o serviço de drywall que será entregue para pintura e avaliar para propor correções, se necessário. Se ele entender que está ok iniciará os serviços de pintura. Caso contrário não inicia.', False, 7),
    ('4.8', 'Continuidade das marcações das atividades executadas e infraestruturas lançadas em planta, para efeito de controle de avanço e anotadas as divergências do projeto para as built imediato da obra (arquitetura e disciplinas técnicas)', False, 8),
    ('4.9', 'Pressurização prévia da rede de SPK para checagem de vazamento.', True, 9),
    ('4.10', 'Brinde final de obra (Solicitação deve ocorrer quando iniciar o check list antecipado).', False, 10),
  ]),
  ('PP5', '5. Obra de 75 a 100%', [
    ('5.1', 'Executar todos os testes finais.', True, 1),
    ('5.2', 'Verificar as alterações do projeto de arquitetura e encaminhar para Escritório de Arquitetura e/ou técnicos para que seja liberado arquivo base para a confecção final dos "as built" técnicos.', False, 2),
    ('5.2b', 'Finalização de todas as anotações para os as built de todas as disciplinas executadas', False, 3),
    ('5.3', 'Verificação de 100% dos equipamentos instalados e verificados pelas especificações dos fabricantes e acompanhados pela vistoria e documentado pelo instalador.', True, 4),
    ('5.4', 'Relatório de balanceamento do ar condicionado. Identificar o responsável pelo escritório logo após a ocupação e checar temperatura do ambiente.', False, 5),
    ('5.5', 'Verificar correção do fire stop caso tenha atividade junto à área de fire stop, caso tenha.', True, 6),
    ('5.6', 'ATENÇÃO: Agendar o treinamento dos sistemas de Elétrica / Ar condicionado e outros, caso exista. Protocolar com nome e RG de todos os participantes. Recolher assinatura no termo de recebimento dos manuais técnicos de elétrica e ar condicionado. Plano de manutenção deve ser preenchido pelo respectivo fornecedor. Arquivar documentação na Rede.', False, 7),
  ]),
  ('PP6', '6. Pós-Obra', [
    ('6.1', 'Garantir que 100% dos itens técnicos tenham documento de entrega, assinado pelo cliente - Exemplo: Cabeamento dados / Instalação Elétrica / Ar Condicionado / Automação / AV / Outros - Se não assinado pelo cliente - formalizar via email.', False, 1),
    ('6.2', 'Conferir Documentos de obra Recebidos dos instaladores - As Built', False, 2),
    ('6.3', 'Elaborar caderno da Databook', False, 3),
    ('6.4', 'Finalizar os itens de pendência de obra', False, 4),
    ('6.5', 'Colher o aceite final da obra Elaborar documentos de recebimentos de chaves, controle e etc.', False, 5),
    ('6.6', 'Orientar sobre garantias de manutenção de sistemas', False, 6),
  ]),
]


def sql_str(v: str) -> str:
    """Escapa aspas simples para literal SQL."""
    return "'" + v.replace("'", "''") + "'"


def run(sql: str) -> str:
    r = subprocess.run(
        ["psql", DB, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
        input=sql, capture_output=True, text=True,
    )
    if r.returncode != 0:
        sys.exit(f"psql falhou:\n{r.stderr}")
    return r.stdout


total_itens = sum(len(itens) for _, _, itens in FASES)
total_fotos = sum(1 for _, _, itens in FASES for it in itens if it[2])

print(f"Passo a Passo — {len(FASES)} fases, {total_itens} itens ({total_fotos} exigem foto)")
print("Apagando FVS antigo e inserindo o novo, em transação única…")

stmts = [
    "BEGIN;",
    "DELETE FROM obra_fvs_items;",
    "DELETE FROM obra_fvs;",
    "DELETE FROM fvs_template_items;",
    "DELETE FROM fvs_templates;",
]

for bloco, (code, nome, itens) in enumerate(FASES, start=1):
    stmts.append(
        "INSERT INTO fvs_templates (code, name, disciplina, bloco) "
        f"VALUES ({sql_str(code)}, {sql_str(nome)}, 'coordenacao', {bloco});"
    )
    for source_code, descricao, foto, ordem in itens:
        stmts.append(
            "INSERT INTO fvs_template_items "
            "(template_id, momento, secao, descricao, obrigatorio, foto_obrigatoria, source_it_code, ordem) "
            f"SELECT id, 'conclusao', NULL, {sql_str(descricao)}, true, "
            f"{'true' if foto else 'false'}, {sql_str(source_code)}, {ordem} "
            f"FROM fvs_templates WHERE code = {sql_str(code)};"
        )

stmts.append("COMMIT;")
run("\n".join(stmts))

print(run(
    "SELECT t.code, t.name, count(i.id) AS itens, "
    "count(i.id) FILTER (WHERE i.foto_obrigatoria) AS com_foto "
    "FROM fvs_templates t LEFT JOIN fvs_template_items i ON i.template_id = t.id "
    "GROUP BY t.code, t.name ORDER BY t.code;"
))
