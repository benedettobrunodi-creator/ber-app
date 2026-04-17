#!/usr/bin/env python3
"""
migrate-fvs-prod.py — Migração dos templates FVS para o novo fvs-seed.py

Regras:
  - FVS_0, FVS_1, FVS_2, FVS_3→FVS_3A, FVS_6 : preservar obra_fvs + itens preenchidos
  - Templates vazios                            : deletar obra_fvs, recriar itens
  - FVS_2B, FVS_3B, FVS_5A                     : deletar tudo, sem migração
  - ITs                                         : atualizar fvs_code para novos códigos

Usage:
  python3 migrate-fvs-prod.py              # dry-run — relatório sem aplicar
  python3 migrate-fvs-prod.py --apply      # pede confirmação e aplica
"""

import sys

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("ERRO: instale psycopg2  →  pip install psycopg2-binary")

# ─── Banco de produção ────────────────────────────────────────────────────────

PROD_DB = "postgresql://postgres:khDQJEQdJCHINRgexWhzwzwqPJYhiylc@ballast.proxy.rlwy.net:12786/railway"
DRY_RUN = "--apply" not in sys.argv

# ─── Novo seed ────────────────────────────────────────────────────────────────

NEW_TEMPLATES = [
    {"code": "FVS_0",  "name": "Mobilização de Canteiro",      "disciplina": "preparacao",   "bloco": 1},
    {"code": "FVS_1",  "name": "Demolições / Alvenaria",        "disciplina": "demolição",    "bloco": 1},
    {"code": "FVS_2",  "name": "Vistoria Inicial / Estrutura",  "disciplina": "vistoria",     "bloco": 1},
    {"code": "FVS_2B", "name": "Layout / Marcações",            "disciplina": "marcacoes",    "bloco": 1},
    {"code": "FVS_3A", "name": "Elétrica Bruta",                "disciplina": "eletrica",     "bloco": 2},
    {"code": "FVS_3B", "name": "Elétrica Acabamento",           "disciplina": "eletrica",     "bloco": 4},
    {"code": "FVS_4",  "name": "Cabeamento Estruturado",        "disciplina": "dados",        "bloco": 2},
    {"code": "FVS_5",  "name": "Hidráulica",                    "disciplina": "hidraulica",   "bloco": 2},
    {"code": "FVS_6",  "name": "Sprinkler",                     "disciplina": "sprinkler",    "bloco": 2},
    {"code": "FVS_7",  "name": "SDAI",                          "disciplina": "sdai",         "bloco": 2},
    {"code": "FVS_8",  "name": "HVAC / Ar Condicionado",        "disciplina": "hvac",         "bloco": 2},
    {"code": "FVS_9",  "name": "Drywall",                       "disciplina": "drywall",      "bloco": 3},
    {"code": "FVS_10", "name": "Forro",                         "disciplina": "forro",        "bloco": 3},
    {"code": "FVS_11", "name": "Impermeabilização",             "disciplina": "impermeab",    "bloco": 1},
    {"code": "FVS_12", "name": "Revestimentos e Pisos",         "disciplina": "revestimento", "bloco": 4},
    {"code": "FVS_13", "name": "Pintura",                       "disciplina": "pintura",      "bloco": 4},
    {"code": "FVS_14", "name": "Marcenaria",                    "disciplina": "marcenaria",   "bloco": 5},
    {"code": "FVS_15", "name": "Pedras e Bancadas",             "disciplina": "pedras",       "bloco": 5},
    {"code": "FVS_16", "name": "Vidros e Esquadrias",           "disciplina": "vidros",       "bloco": 5},
    {"code": "FVS_17", "name": "Divisórias Industriais",        "disciplina": "divisorias",   "bloco": 4},
    {"code": "FVS_18", "name": "Limpeza Técnica",               "disciplina": "limpeza",      "bloco": 6},
    {"code": "FVS_19", "name": "Vistoria Final / Pré-entrega",  "disciplina": "vistoria",     "bloco": 6},
    {"code": "FVS_20", "name": "Desmobilização de Canteiro",    "disciplina": "preparacao",   "bloco": 6},
]

# (momento, secao, descricao, obrigatorio, ordem)
NEW_ITEMS = {
"FVS_0": [
    ("inicio","Acesso e segurança","Autorização de obras emitida pelo condomínio/gestora",True,1),
    ("inicio","Acesso e segurança","Capacho BÈR posicionado na entrada da obra",True,2),
    ("inicio","Acesso e segurança","Delimitação da área (tapume leve, fita ou plástico)",True,3),
    ("inicio","Acesso e segurança","Placa de obra afixada no local",True,4),
    ("inicio","Acesso e segurança","Proteção de piso das áreas comuns (corredor de acesso)",True,5),
    ("inicio","Acesso e segurança","Extintor disponível na área",True,6),
    ("inicio","Acesso e segurança","Kit de primeiros socorros completo e acessível",True,7),
    ("inicio","Acesso e segurança","Contato do síndico/gestora registrado para emergências",True,8),
    ("inicio","Equipe","EPI's disponíveis e em quantidade suficiente",True,9),
    ("inicio","Equipe","Refeitório montado (mesa, cadeiras, lixeira)",True,10),
    ("inicio","Equipe","Água filtrada disponível",True,11),
    ("inicio","Equipe","Geladeira disponível",False,12),
    ("inicio","Área da Engenharia","Mesa do engenheiro instalada",True,13),
    ("inicio","Área da Engenharia","Mesa de reunião disponível",False,14),
    ("inicio","Área da Engenharia","TV/monitor para apresentação de projetos",False,15),
    ("inicio","Área da Engenharia","Projetos e documentos organizados e armazenados (pasta física + digital)",True,16),
    ("inicio","Área da Engenharia","Almoxarifado organizado (materiais identificados e segregados)",True,17),
    ("conclusao","Higiene e limpeza","Lixeiras disponíveis na área de obra e refeitório",True,18),
    ("conclusao","Higiene e limpeza","Produtos de limpeza disponíveis (vassoura, pá, rodo, saco de lixo)",True,19),
    ("conclusao","Higiene e limpeza","Banheiro de uso da equipe identificado e acordado com o condomínio",True,20),
    ("conclusao","Higiene e limpeza","Sabonete e papel toalha disponíveis",True,21),
],
"FVS_1": [
    ("inicio","Pré-demolição","Paredes a demolir marcadas/identificadas conforme projeto",True,1),
    ("inicio","Pré-demolição","Marcenarias a descartar identificadas e listadas",True,2),
    ("inicio","Pré-demolição","Mobiliário a descartar identificado e listado",True,3),
    ("inicio","Pré-demolição","Itens a preservar/retirar com cuidado sinalizados",True,4),
    ("inicio","Pré-demolição","Escopo de demolição validado com o engenheiro antes do início",True,5),
    ("conclusao","Execução","EPI completo na equipe (capacete, luva, óculos, botina)",True,6),
    ("conclusao","Execução","Proteção de pisos/paredes adjacentes executada",True,7),
    ("conclusao","Execução","Instalações existentes (elétrica, hidro, AC) desligadas/isoladas antes da demolição",True,8),
    ("conclusao","Execução","Demolição executada conforme escopo marcado (sem extrapolar)",True,9),
    ("conclusao","Conclusão","Entulho removido e descartado em caçamba autorizada",True,10),
    ("conclusao","Conclusão","Nenhum dano em estruturas ou instalações adjacentes",True,11),
    ("conclusao","Conclusão","Área limpa e pronta para a próxima etapa",True,12),
],
"FVS_2": [
    ("inicio","Pré-execução","Planta executiva conferida com o local real",True,1),
    ("inicio","Pré-execução","Medições conferidas (largura, altura, pé-direito)",True,2),
    ("inicio","Pré-execução","Instalações existentes mapeadas (elétrica, hidro, AC)",True,3),
    ("inicio","Pré-execução","Patologias existentes fotografadas e registradas",True,4),
    ("inicio","Pré-execução","Acesso de obra verificado",True,5),
    ("conclusao","Conclusão","Relatório de vistoria assinado pelo cliente",True,6),
],
"FVS_2B": [
    ("inicio","Marcações de piso","Topógrafo contratado e no local",True,1),
    ("inicio","Marcações de piso","Cotas e níveis marcados nas paredes (referência para toda a obra)",True,2),
    ("inicio","Marcações de piso","Marcações de paredes executadas no piso conforme projeto",True,3),
    ("inicio","Marcações de piso","Marcações de divisórias/drywall executadas no piso",True,4),
    ("inicio","Marcações de piso","Marcações validadas com o projeto executivo",True,5),
    ("inicio","Marcações de piso","Fotos das marcações registradas antes do início da obra",True,6),
    ("conclusao","Compatibilização","Pontos de iluminação projetados no piso",True,7),
    ("conclusao","Compatibilização","Dutos de AC projetados no piso (percurso completo)",True,8),
    ("conclusao","Compatibilização","Pontos de dados/telecom projetados no piso",True,9),
    ("conclusao","Compatibilização","Interferências identificadas (coluna, viga, shaft) e registradas",True,10),
    ("conclusao","Compatibilização","Compatibilização aprovada pelo engenheiro antes de prosseguir",True,11),
    ("conclusao","Infras de piso","Infras de elétrica sob piso elevado marcadas e executadas",True,12),
    ("conclusao","Infras de piso","Infras de dados/telecom sob piso elevado marcadas e executadas",True,13),
    ("conclusao","Infras de piso","Percursos conferidos com projeto antes de tampar",True,14),
    ("conclusao","Infras de piso","Fotos das infras registradas antes do fechamento",True,15),
],
"FVS_3A": [
    ("inicio","Pré-execução","Projeto elétrico aprovado e conferido com o local",True,1),
    ("inicio","Pré-execução","Circuitos existentes mapeados e identificados",True,2),
    ("inicio","Pré-execução","Pontos de tomadas, interruptores e dados marcados nas paredes",True,3),
    ("conclusao","Execução","Infraestrutura de teto executada (eletrodutos, bitola e percurso)",True,4),
    ("conclusao","Execução","Infraestrutura de parede executada",True,5),
    ("conclusao","Execução","Infraestrutura de piso executada (sob piso elevado)",True,6),
    ("conclusao","Execução","Caixas de passagem posicionadas",True,7),
    ("conclusao","Execução","Fiação passada e identificada por circuito",True,8),
    ("conclusao","Identificação da infraestrutura","Eletrodutos identificados com etiqueta/spray (circuito + destino)",True,9),
    ("conclusao","Identificação da infraestrutura","Caixas numeradas conforme projeto",True,10),
    ("conclusao","Identificação da infraestrutura","Planta as-built atualizada com percursos reais (se houver desvio)",False,11),
    ("conclusao","Conclusão","Fotos das infraestruturas registradas antes do fechamento",True,12),
    ("conclusao","Conclusão","Sem fiação exposta ou pontos inacabados",True,13),
    ("conclusao","Conclusão","Conferido com o projeto antes de fechar paredes/forro",True,14),
],
"FVS_3B": [
    ("inicio","Quadros e circuitos","Quadro elétrico (QDL) instalado e identificado conforme projeto",True,1),
    ("inicio","Quadros e circuitos","Disjuntores instalados conforme memorial descritivo",True,2),
    ("inicio","Quadros e circuitos","Circuitos conectados e identificados nos quadros",True,3),
    ("inicio","Quadros e circuitos","Transformador posicionado e instalado (se aplicável)",False,4),
    ("conclusao","Pontos e luminárias","Tomadas instaladas e funcionando",True,5),
    ("conclusao","Pontos e luminárias","Interruptores instalados e funcionando",True,6),
    ("conclusao","Pontos e luminárias","Luminárias instaladas conforme projeto (posição e modelo)",True,7),
    ("conclusao","Testes e conclusão","Teste de continuidade realizado em todos os circuitos",True,8),
    ("conclusao","Testes e conclusão","Teste de funcionamento (ligar/desligar todos os pontos)",True,9),
    ("conclusao","Testes e conclusão","Sem pontos inacabados ou fiação exposta",True,10),
    ("conclusao","Testes e conclusão","ART de conclusão assinada pelo responsável técnico",True,11),
],
"FVS_4": [
    ("inicio","Pré-execução","Projeto de dados/telecom aprovado e conferido com o local",True,1),
    ("inicio","Pré-execução","Pontos de rede, telefone e AV marcados conforme projeto",True,2),
    ("conclusao","Infraestrutura bruta","Eletrodutos/calhas de dados instalados (teto + parede + piso)",True,3),
    ("conclusao","Infraestrutura bruta","Cabeamento passado e identificado por ponto",True,4),
    ("conclusao","Infraestrutura bruta","Infraestrutura identificada (etiqueta por circuito e destino)",True,5),
    ("conclusao","Infraestrutura bruta","Fotos registradas antes do fechamento",True,6),
    ("conclusao","Acabamento","Cabeamento concluído e testado",True,7),
    ("conclusao","Acabamento","Conectorização dos mobiliários realizada",True,8),
    ("conclusao","Acabamento","Patch panel instalado e organizado",True,9),
    ("conclusao","Acabamento","Rack/nobreak posicionado conforme projeto",False,10),
    ("conclusao","Acabamento","Acabamentos de face plate instalados",True,11),
    ("conclusao","Testes e conclusão","Teste de continuidade realizado em todos os pontos",True,12),
    ("conclusao","Testes e conclusão","Certificação do cabeamento (se exigido pelo cliente)",False,13),
    ("conclusao","Testes e conclusão","Planta as-built atualizada",True,14),
    ("conclusao","Testes e conclusão","Sem pontos inacabados",True,15),
],
"FVS_5": [
    ("inicio","Pré-execução","Projeto hidráulico aprovado e conferido com o local",True,1),
    ("inicio","Pré-execução","Pontos de água fria e esgoto marcados conforme projeto",True,2),
    ("conclusao","Execução","Tubulações de água fria instaladas (diâmetros conforme projeto)",True,3),
    ("conclusao","Execução","Rede de esgoto executada com caimento correto",True,4),
    ("conclusao","Execução","Esgoto a vácuo executado e aprovado pelo condomínio (se aplicável)",False,5),
    ("conclusao","Execução","Hidrômetro instalado (se aplicável)",False,6),
    ("conclusao","Execução","Registros de fechamento instalados e acessíveis",True,7),
    ("conclusao","Testes","Teste de pressão realizado",True,8),
    ("conclusao","Testes","Teste de estanqueidade hidrostático realizado",True,9),
    ("conclusao","Testes","Sem vazamentos após 72h do teste",True,10),
    ("conclusao","Testes","Validação pela empresa gestora do edifício (se exigido)",False,11),
    ("conclusao","Acabamento","Louças instaladas e funcionando",True,12),
    ("conclusao","Acabamento","Metais e acessórios instalados",True,13),
    ("conclusao","Acabamento","Ralos e sifões com caimento correto",True,14),
    ("conclusao","Acabamento","Sem pontos inacabados ou tubulação exposta",True,15),
],
"FVS_6": [
    ("inicio","Pré-execução","Projeto de sprinkler aprovado pela empresa gestora/corpo de bombeiros",True,1),
    ("inicio","Pré-execução","Rede existente mapeada antes de qualquer intervenção",True,2),
    ("inicio","Pré-execução","Solicitação de despressurização da rede formalizada ao condomínio/gestora",True,3),
    ("inicio","Pré-execução","Confirmação de data e horário de despressurização recebida",True,4),
    ("inicio","Pré-execução","Despressurização executada e confirmada antes do início dos serviços",True,5),
    ("conclusao","Execução","Adequação da rede executada conforme projeto",True,6),
    ("conclusao","Execução","Cabeçotes posicionados conforme layout (distâncias e alturas corretas)",True,7),
    ("conclusao","Execução","Conexões e ramais executados sem interferência com outros sistemas",True,8),
    ("conclusao","Testes e validação","Repressurização da rede realizada",True,9),
    ("conclusao","Testes e validação","Teste de estanqueidade realizado",True,10),
    ("conclusao","Testes e validação","Teste hidrostático realizado",True,11),
    ("conclusao","Testes e validação","Validação/aprovação pela empresa responsável",True,12),
    ("conclusao","Testes e validação","Laudo de aprovação emitido e arquivado",True,13),
    ("conclusao","Conclusão","Sistema funcional e sem vazamentos",True,14),
    ("conclusao","Conclusão","Planta as-built atualizada",True,15),
    ("conclusao","Conclusão","ART assinada pelo responsável técnico",True,16),
],
"FVS_7": [
    ("inicio","Pré-execução","Projeto de SDAI aprovado pelo corpo de bombeiros",True,1),
    ("inicio","Pré-execução","Sistema existente mapeado antes de qualquer intervenção",True,2),
    ("inicio","Pré-execução","Solicitação de desativação parcial do sistema formalizada ao condomínio/gestora",True,3),
    ("inicio","Pré-execução","Confirmação de data e horário de desativação recebida",True,4),
    ("conclusao","Execução","Adequação da rede de detecção executada conforme projeto",True,5),
    ("conclusao","Execução","Detectores posicionados conforme layout",True,6),
    ("conclusao","Execução","Acionadores manuais instalados nos locais previstos",True,7),
    ("conclusao","Execução","Cabeamento identificado e organizado",True,8),
    ("conclusao","Execução","Central de alarme atualizada/programada",True,9),
    ("conclusao","Testes e validação","Teste funcional do sistema realizado (acionamento de cada detector)",True,10),
    ("conclusao","Testes e validação","Integração com sistema do condomínio testada",True,11),
    ("conclusao","Testes e validação","Validação pela empresa responsável pelo sistema",True,12),
    ("conclusao","Testes e validação","Laudo de aprovação emitido e arquivado",True,13),
    ("conclusao","Testes e validação","Sistema reativado e operacional",True,14),
    ("conclusao","Conclusão","Planta as-built atualizada",True,15),
    ("conclusao","Conclusão","ART assinada pelo responsável técnico",True,16),
],
"FVS_8": [
    ("inicio","Pré-execução","Projeto de HVAC aprovado e conferido com o local",True,1),
    ("inicio","Pré-execução","BTU por ambiente conferido conforme projeto",True,2),
    ("inicio","Pré-execução","Equipamentos recebidos e especificação conferida (modelo, capacidade)",True,3),
    ("conclusao","Infraestrutura","Evaporadoras existentes remanejadas conforme projeto (se aplicável)",False,4),
    ("conclusao","Infraestrutura","Novas evaporadoras instaladas e niveladas",True,5),
    ("conclusao","Infraestrutura","Exaustores instalados",False,6),
    ("conclusao","Infraestrutura","Dutos de insuflamento, renovação e exaustão executados conforme projeto",True,7),
    ("conclusao","Infraestrutura","Percurso de dutos projetado no piso e compatibilizado antes de executar",True,8),
    ("conclusao","Infraestrutura","Rede frigorífica executada (tubulação cobre, isolamento térmico)",True,9),
    ("conclusao","Infraestrutura","Condensadoras instaladas em local adequado",True,10),
    ("conclusao","Infraestrutura","Drenos instalados com caimento correto",True,11),
    ("conclusao","Automação","Controladores/termostatos instalados conforme projeto",False,12),
    ("conclusao","Automação","Integração com sistema de automação predial (BMS) configurada",False,13),
    ("conclusao","Automação","App ou painel de controle configurado e testado",False,14),
    ("conclusao","Automação","Usuário treinado para operação do sistema",False,15),
    ("conclusao","Testes e startup","Carga de gás realizada conforme fabricante",True,16),
    ("conclusao","Testes e startup","Teste de operação realizado (frio/quente em todos os ambientes)",True,17),
    ("conclusao","Testes e startup","Temperatura e vazão de ar conferidas por ambiente",True,18),
    ("conclusao","Testes e startup","Ruído dentro do limite aceitável",True,19),
    ("conclusao","Testes e startup","Startup documentado pelo fornecedor",True,20),
    ("conclusao","Conclusão","Planta as-built atualizada",True,21),
    ("conclusao","Conclusão","Manual do fabricante entregue e arquivado",True,22),
    ("conclusao","Conclusão","ART assinada pelo responsável técnico",True,23),
],
"FVS_9": [
    ("inicio","1ª Fase — Estrutura","Marcações de paredes e septos conferidas no piso antes de iniciar",True,1),
    ("inicio","1ª Fase — Estrutura","Guias e montantes instalados conforme projeto (espaçamento e prumo)",True,2),
    ("inicio","1ª Fase — Estrutura","Reforços de madeira instalados (pontos de fixação de móveis, TVs, equipamentos)",True,3),
    ("inicio","1ª Fase — Estrutura","Passes de infraestrutura abertos antes do plaqueamento",True,4),
    ("inicio","1ª Fase — Estrutura","1º plaqueamento executado (placas sem defeitos, parafusagem correta)",True,5),
    ("inicio","1ª Fase — Estrutura","Fotos registradas antes do fechamento",True,6),
    ("conclusao","2ª Fase — Acabamento","Todas as infraestruturas internas concluídas e aprovadas antes de fechar",True,7),
    ("conclusao","2ª Fase — Acabamento","2º plaqueamento executado",True,8),
    ("conclusao","2ª Fase — Acabamento","Calafetação de juntas e encontros realizada",True,9),
    ("conclusao","2ª Fase — Acabamento","Prumo e alinhamento das paredes conferidos",True,10),
    ("conclusao","2ª Fase — Acabamento","Sem danos, furos indevidos ou placas quebradas",True,11),
    ("conclusao","2ª Fase — Acabamento","Arremates com outras vedações executados",True,12),
],
"FVS_10": [
    ("inicio","Estruturação","Nível do forro definido e marcado nas paredes (nível laser)",True,1),
    ("inicio","Estruturação","Modulação do forro compatibilizada com projeto (luminárias, difusores AC, sprinklers, detectores)",True,2),
    ("inicio","Estruturação","Estrutura metálica (tirantes, perfis) instalada e nivelada",True,3),
    ("inicio","Estruturação","Abertura de alçapões de manutenção previstas nos locais corretos",True,4),
    ("inicio","Estruturação","Fotos da estrutura registradas antes do plaqueamento",True,5),
    ("conclusao","Plaqueamento / Acabamento","Placas instaladas conforme modulação aprovada",True,6),
    ("conclusao","Plaqueamento / Acabamento","Placas sem manchas, defeitos ou trincas",True,7),
    ("conclusao","Plaqueamento / Acabamento","Juntas e arremates invisíveis",True,8),
    ("conclusao","Plaqueamento / Acabamento","Recortes para luminárias, difusores e sprinklers executados com precisão",True,9),
    ("conclusao","Plaqueamento / Acabamento","Alçapões instalados e funcionando",True,10),
    ("conclusao","Plaqueamento / Acabamento","Nível final conferido (sem ondulações)",True,11),
    ("conclusao","Forro Acústico / Baffles","Especificação do material conferida",False,12),
    ("conclusao","Forro Acústico / Baffles","Estruturação e fixação executadas conforme fabricante",False,13),
    ("conclusao","Forro Acústico / Baffles","Alinhamento e espaçamento dos baffles conferidos",False,14),
    ("conclusao","Forro Acústico / Baffles","Jateamento acústico aplicado com espessura correta (se aplicável)",False,15),
],
"FVS_11": [
    ("inicio","Pré-execução","Substrato limpo, seco e sem irregularidades",True,1),
    ("inicio","Pré-execução","Muretas de contenção e sóculo executados antes da impermeabilização",True,2),
    ("inicio","Pré-execução","Material especificado conforme projeto",True,3),
    ("conclusao","Execução","Primer aplicado conforme ficha técnica do fabricante",True,4),
    ("conclusao","Execução","Número de demãos aplicado conforme especificação",True,5),
    ("conclusao","Execução","Arremates em cantos, ralos e encontros com parede reforçados",True,6),
    ("conclusao","Execução","Espessura de aplicação conferida",True,7),
    ("conclusao","Testes","Teste de estanqueidade realizado (72h corridas — 3 dias de alagamento)",True,8),
    ("conclusao","Testes","Resultado do teste registrado com fotos",True,9),
    ("conclusao","Testes","Sem infiltrações ou pontos de falha identificados",True,10),
    ("conclusao","Conclusão","Proteção mecânica aplicada após cura total",True,11),
    ("conclusao","Conclusão","ART do responsável técnico assinada e arquivada",True,12),
],
"FVS_12": [
    ("inicio","Pré-execução","Material conferido conforme especificação (tipo, modelo, cor, lote — mesmo lote)",True,1),
    ("inicio","Pré-execução","Substrato limpo, nivelado e seco",True,2),
    ("inicio","Pré-execução","Caimento para ralos conferido (áreas molhadas)",False,3),
    ("inicio","Pré-execução","Impermeabilização aprovada antes de iniciar (áreas molhadas)",False,4),
    ("conclusao","Execução","Alinhamento e prumo conferidos (régua/nível laser)",True,5),
    ("conclusao","Execução","Juntas e espaçamento conforme projeto",True,6),
    ("conclusao","Execução","Rejunte aplicado conforme especificação (cor e tipo)",True,7),
    ("conclusao","Execução","Rodapés instalados (altura, fixação e alinhamento)",True,8),
    ("conclusao","Execução","Carpete / vinílico instalados sem bolhas, emendas visíveis ou defeitos",False,9),
    ("conclusao","Execução","Proteção de piso aplicada imediatamente após instalação",True,10),
    ("conclusao","Conclusão","Sem peças quebradas, manchas ou defeitos visíveis",True,11),
    ("conclusao","Conclusão","Caimento para ralos funcionando (teste com água)",False,12),
    ("conclusao","Conclusão","Limpeza realizada após conclusão",True,13),
],
"FVS_13": [
    ("inicio","Pré-execução","Superfícies limpas, secas e sem irregularidades",True,1),
    ("inicio","Pré-execução","Selante/primer aplicado conforme substrato",True,2),
    ("inicio","Pré-execução","Massa corrida aplicada e lixada (se especificado em projeto)",False,3),
    ("inicio","Pré-execução","Cor e acabamento aprovados pelo cliente (amostra física na parede)",True,4),
    ("inicio","Pré-execução","Proteção de piso, rodapés e esquadrias aplicada antes de pintar",True,5),
    ("conclusao","Paredes","1ª demão aplicada (cobertura uniforme)",True,6),
    ("conclusao","Paredes","2ª demão aplicada após secagem completa da 1ª",True,7),
    ("conclusao","Paredes","3ª demão aplicada (acabamento final)",True,8),
    ("conclusao","Forro e Tabeiras","Massa e pintura de forro executadas",True,9),
    ("conclusao","Forro e Tabeiras","Tabeiras pintadas conforme especificação",True,10),
    ("conclusao","Conclusão","Sem manchas, respingos, falhas de cobertura ou marcas de rolo",True,11),
    ("conclusao","Conclusão","Cantos e arremates executados com fita/pincel (sem sangramento)",True,12),
    ("conclusao","Conclusão","Proteções removidas e área limpa",True,13),
    ("conclusao","Conclusão","Cor final confere com amostra aprovada",True,14),
],
"FVS_14": [
    ("inicio","Medição e fabricação","Medição in loco realizada após paredes e forro concluídos",True,1),
    ("inicio","Medição e fabricação","Projeto de marcenaria aprovado pelo cliente antes da fabricação",True,2),
    ("inicio","Medição e fabricação","Amostra de material/acabamento aprovada pelo cliente",True,3),
    ("inicio","Medição e fabricação","Prazo de fabricação confirmado com o fornecedor",True,4),
    ("inicio","Recebimento","Peças conferidas na entrega (quantidade, modelo, acabamento)",True,5),
    ("inicio","Recebimento","Sem danos de transporte",True,6),
    ("inicio","Recebimento","Peças armazenadas com proteção até a instalação",True,7),
    ("conclusao","Instalação","Medidas conferidas in loco antes de fixar",True,8),
    ("conclusao","Instalação","Nivelamento e prumo verificados (nível laser)",True,9),
    ("conclusao","Instalação","Fixação adequada ao substrato",True,10),
    ("conclusao","Instalação","Dobradiças, corrediças e puxadores instalados e funcionando",True,11),
    ("conclusao","Instalação","Alinhamento com tomadas, interruptores e outros elementos conferido",True,12),
    ("conclusao","Instalação","Folgas adequadas em portas e gavetas",True,13),
    ("conclusao","Conclusão","Sem riscos, defeitos ou danos visíveis",True,14),
    ("conclusao","Conclusão","Acabamento conforme amostra aprovada",True,15),
    ("conclusao","Conclusão","Limpeza realizada após instalação",True,16),
    ("conclusao","Conclusão","Garantia do fornecedor registrada e arquivada",True,17),
],
"FVS_15": [
    ("inicio","Medição e fabricação","Medição in loco realizada após marcenaria e hidráulica concluídas",True,1),
    ("inicio","Medição e fabricação","Projeto/desenho aprovado pelo cliente antes da fabricação",True,2),
    ("inicio","Medição e fabricação","Amostra da pedra aprovada pelo cliente (cor, veio, acabamento)",True,3),
    ("inicio","Medição e fabricação","Prazo de fabricação confirmado com o fornecedor",True,4),
    ("inicio","Recebimento","Peças conferidas na entrega (quantidade, dimensões, acabamento)",True,5),
    ("inicio","Recebimento","Sem trincas, lascas ou defeitos visíveis",True,6),
    ("inicio","Recebimento","Peças armazenadas com proteção até a instalação",True,7),
    ("conclusao","Instalação","Substrato/marcenaria de apoio nivelado antes da instalação",True,8),
    ("conclusao","Instalação","Fixação com argamassa ou silicone conforme especificação",True,9),
    ("conclusao","Instalação","Nivelamento e alinhamento conferidos",True,10),
    ("conclusao","Instalação","Recortes para cubas, torneiras e ralos executados com precisão",True,11),
    ("conclusao","Instalação","Rejuntamento e vedação com silicone nas bordas e encontros",True,12),
    ("conclusao","Conclusão","Sem trincas, manchas ou defeitos após instalação",True,13),
    ("conclusao","Conclusão","Cubas e torneiras instaladas e sem vazamentos",True,14),
    ("conclusao","Conclusão","Proteção aplicada (selante para pedras porosas, se aplicável)",False,15),
    ("conclusao","Conclusão","Limpeza realizada após instalação",True,16),
],
"FVS_16": [
    ("inicio","Pré-execução","Especificação conferida (espessura, tipo — temperado/laminado/insulado)",True,1),
    ("inicio","Pré-execução","Medição in loco realizada antes da fabricação",True,2),
    ("inicio","Pré-execução","Projeto/desenho aprovado pelo cliente",True,3),
    ("inicio","Recebimento","Peças conferidas na entrega (quantidade, dimensões, tipo)",True,4),
    ("inicio","Recebimento","Sem riscos, trincas ou defeitos visíveis",True,5),
    ("inicio","Recebimento","Certificado de temperagem/laminação disponível (se exigido)",False,6),
    ("conclusao","Instalação","Esquadrias sem empenos ou deformações",True,7),
    ("conclusao","Instalação","Nivelamento e prumo verificados (nível laser)",True,8),
    ("conclusao","Instalação","Fixação adequada ao substrato",True,9),
    ("conclusao","Instalação","Vedação de silicone aplicada em toda a extensão (sem falhas)",True,10),
    ("conclusao","Instalação","Ferragens, fechaduras e dobradiças instaladas e funcionando",True,11),
    ("conclusao","Instalação","Folgas e batentes corretos",True,12),
    ("conclusao","Conclusão","Sem riscos, manchas ou imperfeições nos vidros",True,13),
    ("conclusao","Conclusão","Abertura e fechamento funcionando suavemente",True,14),
    ("conclusao","Conclusão","Estanqueidade testada (sem entrada de água/vento)",True,15),
    ("conclusao","Conclusão","Película de proteção removida e vidros limpos",True,16),
    ("conclusao","Conclusão","ABNT NBR 7199 atendida",True,17),
],
"FVS_17": [
    ("inicio","Medição e fabricação","Medição in loco realizada após piso e forro concluídos",True,1),
    ("inicio","Medição e fabricação","Projeto executivo emitido e aprovado antes da fabricação",True,2),
    ("inicio","Medição e fabricação","Especificação conferida (tipo, espessura, acabamento, vidro se aplicável)",True,3),
    ("inicio","Medição e fabricação","Prazo de fabricação confirmado com o fornecedor",True,4),
    ("inicio","Recebimento","Peças conferidas na entrega (quantidade, dimensões, acabamento)",True,5),
    ("inicio","Recebimento","Sem danos de transporte",True,6),
    ("inicio","Recebimento","Peças armazenadas com proteção até a instalação",True,7),
    ("conclusao","Instalação","Marcações de piso conferidas antes de instalar",True,8),
    ("conclusao","Instalação","Prumo e alinhamento verificados (nível laser)",True,9),
    ("conclusao","Instalação","Fixação no piso, teto e paredes conforme especificação do fabricante",True,10),
    ("conclusao","Instalação","Passes de elétrica e dados integrados às divisórias (se aplicável)",False,11),
    ("conclusao","Instalação","Portas, ferragens e fechaduras instaladas e funcionando",True,12),
    ("conclusao","Instalação","Vedação acústica aplicada (se especificado)",False,13),
    ("conclusao","Conclusão","Sem danos, riscos ou defeitos visíveis",True,14),
    ("conclusao","Conclusão","Abertura e fechamento de portas funcionando suavemente",True,15),
    ("conclusao","Conclusão","Alinhamento com forro e piso conferido",True,16),
    ("conclusao","Conclusão","Garantia do fornecedor registrada e arquivada",True,17),
],
"FVS_18": [
    ("conclusao","Remoção de resíduos","Entulho e embalagens removidos da obra",True,1),
    ("conclusao","Remoção de resíduos","Caçamba esvaziada e retirada",True,2),
    ("conclusao","Remoção de resíduos","Materiais sobressalentes organizados e identificados",True,3),
    ("conclusao","Limpeza geral","Pisos limpos (sem resíduos de argamassa, tinta, cola, fita)",True,4),
    ("conclusao","Limpeza geral","Paredes limpas (sem respingos, manchas ou marcas)",True,5),
    ("conclusao","Limpeza geral","Forro limpo (sem poeira, manchas ou resíduos)",True,6),
    ("conclusao","Limpeza geral","Vidros e espelhos limpos",True,7),
    ("conclusao","Limpeza geral","Esquadrias e trilhos limpos",True,8),
    ("conclusao","Limpeza geral","Rodapés limpos e sem resíduos",True,9),
    ("conclusao","Instalações","Luminárias e difusores de AC limpos",True,10),
    ("conclusao","Instalações","Filtros de AC limpos e substituídos (se necessário)",True,11),
    ("conclusao","Instalações","Banheiros higienizados",True,12),
    ("conclusao","Instalações","Ralos limpos e funcionando",True,13),
    ("conclusao","Conclusão","Obra em condições de vistoria com o cliente",True,14),
    ("conclusao","Conclusão","Nenhum item de obra esquecido no local",True,15),
    ("conclusao","Conclusão","Áreas comuns do condomínio limpas (corredor, elevador)",True,16),
],
"FVS_19": [
    ("inicio","Instalações","Todos os pontos elétricos funcionando (tomadas, interruptores, luminárias)",True,1),
    ("inicio","Instalações","Quadro elétrico identificado e organizado",True,2),
    ("inicio","Instalações","Todos os pontos hidráulicos sem vazamento",True,3),
    ("inicio","Instalações","AC funcionando em todos os ambientes",True,4),
    ("inicio","Instalações","Sprinkler e SDAI operacionais",True,5),
    ("inicio","Instalações","Controle de acesso funcionando",False,6),
    ("conclusao","Acabamentos","Paredes sem danos, manchas ou imperfeições pós-obra",True,7),
    ("conclusao","Acabamentos","Forro sem danos ou desnivelamentos",True,8),
    ("conclusao","Acabamentos","Pisos sem arranhões, manchas ou peças soltas",True,9),
    ("conclusao","Acabamentos","Marcenaria sem danos e funcionando",True,10),
    ("conclusao","Acabamentos","Vidros e esquadrias sem riscos e funcionando",True,11),
    ("conclusao","Acabamentos","Divisórias sem danos e funcionando",True,12),
    ("conclusao","Acabamentos","Persianas instaladas e funcionando",False,13),
    ("conclusao","Documentação","ARTs de todos os sistemas arquivadas",True,14),
    ("conclusao","Documentação","Manuais dos equipamentos organizados",True,15),
    ("conclusao","Documentação","Garantias dos fornecedores registradas",True,16),
    ("conclusao","Documentação","Planta as-built atualizada",True,17),
    ("conclusao","Documentação","Punch List interno concluído (pendências zeradas)",True,18),
    ("conclusao","Documentação","Obra aprovada pela equipe BÈR para receber o cliente",True,19),
],
"FVS_20": [
    ("conclusao","Retirada de equipamentos","Ferramentas e equipamentos retirados da obra",True,1),
    ("conclusao","Retirada de equipamentos","Materiais sobressalentes retirados ou descartados",True,2),
    ("conclusao","Retirada de equipamentos","Geladeira, mesa, TV e mobiliário do canteiro retirados",True,3),
    ("conclusao","Retirada de equipamentos","Almoxarifado esvaziado e limpo",True,4),
    ("conclusao","Áreas comuns","Delimitação/tapume leve retirado",True,5),
    ("conclusao","Áreas comuns","Proteções de piso das áreas comuns retiradas",True,6),
    ("conclusao","Áreas comuns","Corredor de acesso limpo e sem danos",True,7),
    ("conclusao","Áreas comuns","Elevador inspecionado (sem danos em paredes, portas ou piso)",True,8),
    ("conclusao","Áreas comuns","Áreas comuns entregues nas mesmas condições da vistoria inicial",True,9),
    ("conclusao","Encerramento com o condomínio","Chaves e acessos provisórios devolvidos",True,10),
    ("conclusao","Encerramento com o condomínio","Autorização de obras encerrada formalmente com a gestora",True,11),
    ("conclusao","Encerramento com o condomínio","Vistoria de desmobilização realizada com o síndico/gestora",True,12),
    ("conclusao","Encerramento com o condomínio","Termo de desmobilização assinado (se exigido pelo condomínio)",False,13),
],
}

# ─── Regras de migração ───────────────────────────────────────────────────────

# Códigos antigos com progresso real → código novo (pode renomear)
MIGRATE_WITH_PROGRESS = {
    "FVS_0":  "FVS_0",
    "FVS_1":  "FVS_1",
    "FVS_2":  "FVS_2",
    "FVS_3":  "FVS_3A",   # renomear FVS_3 → FVS_3A
    "FVS_6":  "FVS_6",
}

# Deletar tudo sem preservar (obra_fvs + itens)
# Se o código existe no novo seed, o template é mantido mas recriado do zero
# Se não existe no novo seed (FVS_5A), o template é deletado
DELETE_WITHOUT_MIGRATE = ["FVS_2B", "FVS_3B", "FVS_5A"]

NEW_CODES = {t["code"] for t in NEW_TEMPLATES}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def hr(ch="─", n=68):
    return ch * n

def section(title):
    print(f"\n{hr()}")
    print(f"  {title}")
    print(hr())

def connect():
    conn = psycopg2.connect(PROD_DB)
    conn.autocommit = False
    return conn

# ─── Coleta de estado atual ───────────────────────────────────────────────────

def fetch_current_state(cur):
    """Retorna lista de dicts com estado de cada template atual."""
    cur.execute("""
        SELECT
            t.id,
            t.code,
            t.name,
            t.disciplina,
            t.bloco,
            COUNT(DISTINCT fti.id)                           AS item_count,
            COUNT(DISTINCT o.id)                             AS fvs_total,
            COUNT(DISTINCT CASE
                WHEN EXISTS (
                    SELECT 1 FROM obra_fvs_items oi
                    WHERE oi.fvs_id = o.id
                      AND (oi.checked OR oi.na
                           OR oi.observacao IS NOT NULL
                           OR oi.foto_url IS NOT NULL)
                ) THEN o.id END)                             AS fvs_with_progress
        FROM fvs_templates t
        LEFT JOIN fvs_template_items fti ON fti.template_id = t.id
        LEFT JOIN obra_fvs o             ON o.template_id   = t.id
        GROUP BY t.id, t.code, t.name, t.disciplina, t.bloco
        ORDER BY t.code
    """)
    return [dict(row) for row in cur.fetchall()]

def fetch_it_fvs_codes(cur):
    """ITs que têm fvs_code apontando para códigos antigos que vão mudar."""
    old_codes = list(MIGRATE_WITH_PROGRESS.keys())
    cur.execute("""
        SELECT code, title, fvs_code
        FROM instrucoes_tecnicas
        WHERE fvs_code = ANY(%s)
        ORDER BY code
    """, (old_codes,))
    return [dict(row) for row in cur.fetchall()]

# ─── Determinação de ação ─────────────────────────────────────────────────────

def determine_action(code):
    if code in DELETE_WITHOUT_MIGRATE:
        return "DELETE_WITHOUT_MIGRATE"
    if code in MIGRATE_WITH_PROGRESS:
        return "MIGRATE_WITH_PROGRESS"
    if code in NEW_CODES:
        return "EMPTY_RECREATE"
    return "DELETE_ORPHAN"   # existe no DB mas não no novo seed

# ─── Relatório dry-run ────────────────────────────────────────────────────────

ACTION_LABELS = {
    "MIGRATE_WITH_PROGRESS":   "PRESERVAR progresso",
    "EMPTY_RECREATE":          "RECRIAR (vazio)",
    "DELETE_WITHOUT_MIGRATE":  "DELETAR tudo",
    "DELETE_ORPHAN":           "DELETAR (órfão)",
}

def print_report(state, it_rows):
    old_codes = {r["code"] for r in state}

    print()
    print("=" * 68)
    print("  RELATÓRIO DE MIGRAÇÃO FVS — DRY-RUN")
    print(f"  {len(state)} templates no banco  →  {len(NEW_TEMPLATES)} templates no novo seed")
    print("=" * 68)

    totals = {"DELETE_WITHOUT_MIGRATE": 0, "MIGRATE_WITH_PROGRESS": 0,
              "EMPTY_RECREATE": 0, "DELETE_ORPHAN": 0}

    for r in state:
        action   = determine_action(r["code"])
        new_code = MIGRATE_WITH_PROGRESS.get(r["code"], r["code"])
        n_items  = len(NEW_ITEMS.get(new_code, []))
        totals[action] += 1

        rename = f"  → renomear: {r['code']} → {new_code}" if new_code != r["code"] else ""

        print(f"\n  {r['code']:8s}  {r['name']}")
        print(f"    Ação    : [{ACTION_LABELS[action]}]{rename}")
        print(f"    Atual   : {r['item_count']} itens de template | "
              f"{r['fvs_total']} obra_fvs ({r['fvs_with_progress']} com progresso)")

        if action == "MIGRATE_WITH_PROGRESS":
            print(f"    Resultado: template atualizado → {n_items} itens novos")
            print(f"    obra_fvs : {r['fvs_total']} preservadas | itens preenchidos remapeados por descrição")
        elif action == "DELETE_WITHOUT_MIGRATE":
            print(f"    Resultado: {r['fvs_total']} obra_fvs deletadas (cascade)")
            if r["code"] in NEW_CODES:
                print(f"    Template : recriado com {n_items} itens novos")
            else:
                print(f"    Template : DELETADO (não existe no novo seed)")
        elif action == "EMPTY_RECREATE":
            print(f"    Resultado: {r['fvs_total']} obra_fvs deletadas | template atualizado → {n_items} itens novos")
        elif action == "DELETE_ORPHAN":
            print(f"    Resultado: {r['fvs_total']} obra_fvs deletadas (cascade) | template DELETADO")

    # Templates novos que não existem no banco
    new_only = [t for t in NEW_TEMPLATES if t["code"] not in old_codes]
    if new_only:
        print(f"\n  {hr('-')}")
        print("  Templates novos (não existem no banco — serão inseridos):")
        for t in new_only:
            n_items = len(NEW_ITEMS.get(t["code"], []))
            print(f"    {t['code']:8s}  {t['name']}  →  {n_items} itens")

    # Atualizações de fvs_code nas ITs
    it_changes = [(r, MIGRATE_WITH_PROGRESS[r["fvs_code"]])
                  for r in it_rows
                  if r["fvs_code"] != MIGRATE_WITH_PROGRESS.get(r["fvs_code"], r["fvs_code"])]
    print(f"\n  {hr('-')}")
    if it_changes:
        print(f"  Atualizações de fvs_code em instrucao_tecnicas ({len(it_changes)} registros):")
        for r, new in it_changes:
            print(f"    IT {r['code']:8s} {r['title'][:45]!s:45s}  {r['fvs_code']} → {new}")
    else:
        print("  Nenhuma atualização de fvs_code em instrucao_tecnicas.")

    print(f"\n  {hr()}")
    print(f"  Resumo: PRESERVAR={totals['MIGRATE_WITH_PROGRESS']}  "
          f"RECRIAR={totals['EMPTY_RECREATE']}  "
          f"DELETAR={totals['DELETE_WITHOUT_MIGRATE']}  "
          f"ÓRFÃO={totals['DELETE_ORPHAN']}  "
          f"NOVOS={len(new_only)}")
    print("=" * 68)

# ─── Aplicação ────────────────────────────────────────────────────────────────

def replace_template_items(cur, template_id, new_code, *, preserve_fvs_items=False):
    """
    Substitui os itens do template pelo novo seed.
    Se preserve_fvs_items=True, remapeia obra_fvs_items preenchidos por descrição.
    """
    if preserve_fvs_items:
        # Salva mapa: (momento, descricao) → item_id antigo
        cur.execute("""
            SELECT id, momento, descricao
            FROM fvs_template_items
            WHERE template_id = %s
        """, (template_id,))
        old_items = {(r["momento"], r["descricao"]): r["id"] for r in cur.fetchall()}

        # Desvincula obra_fvs_items dos itens que serão deletados
        cur.execute("""
            UPDATE obra_fvs_items
            SET template_item_id = NULL
            WHERE template_item_id IN (
                SELECT id FROM fvs_template_items WHERE template_id = %s
            )
        """, (template_id,))

    # Remove itens antigos
    cur.execute("DELETE FROM fvs_template_items WHERE template_id = %s", (template_id,))

    # Insere novos itens
    new_item_ids = {}  # (momento, descricao) → novo id
    for (momento, secao, descricao, obrigatorio, ordem) in NEW_ITEMS.get(new_code, []):
        cur.execute("""
            INSERT INTO fvs_template_items
                (template_id, momento, secao, descricao, obrigatorio, ordem)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (template_id, momento, secao, descricao, obrigatorio, ordem))
        new_id = cur.fetchone()["id"]
        new_item_ids[(momento, descricao)] = new_id

    if preserve_fvs_items:
        # Re-vincula obra_fvs_items que ainda têm template_item_id=NULL
        # (foram desvinculados acima) e cujos (momento,descricao) batem com novos itens
        for (momento, descricao), new_id in new_item_ids.items():
            if (momento, descricao) in old_items:
                old_id = old_items[(momento, descricao)]
                cur.execute("""
                    UPDATE obra_fvs_items
                    SET template_item_id = %s
                    WHERE template_item_id IS NULL
                      AND momento = %s
                      AND fvs_id IN (
                          SELECT id FROM obra_fvs WHERE template_id = %s
                      )
                      AND descricao = %s
                """, (new_id, momento, template_id, descricao))

    return len(NEW_ITEMS.get(new_code, []))


def apply_migration(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    state   = fetch_current_state(cur)
    it_rows = fetch_it_fvs_codes(cur)

    old_by_code = {r["code"]: r for r in state}
    old_codes   = set(old_by_code)

    log = []

    # ── 1. DELETE_WITHOUT_MIGRATE ─────────────────────────────────────────────
    for code in DELETE_WITHOUT_MIGRATE:
        r = old_by_code.get(code)
        if not r:
            log.append(f"  SKIP  {code} — não existe no banco")
            continue

        # Deleta obra_fvs (cascade deleta obra_fvs_items)
        cur.execute("DELETE FROM obra_fvs WHERE template_id = %s", (r["id"],))
        deleted_fvs = cur.rowcount

        if code in NEW_CODES:
            # Mantém template, recria itens do zero
            n = replace_template_items(cur, r["id"], code, preserve_fvs_items=False)
            # Garante que nome/disciplina/bloco estão atualizados
            new_t = next(t for t in NEW_TEMPLATES if t["code"] == code)
            cur.execute("""
                UPDATE fvs_templates
                SET name=%s, disciplina=%s, bloco=%s
                WHERE id=%s
            """, (new_t["name"], new_t["disciplina"], new_t["bloco"], r["id"]))
            log.append(f"  DELETE+RECREATE  {code} — {deleted_fvs} obra_fvs deletadas, {n} itens novos")
        else:
            # Deleta o template (itens já foram em cascade via FK template_id)
            cur.execute("DELETE FROM fvs_templates WHERE id = %s", (r["id"],))
            log.append(f"  DELETE           {code} — {deleted_fvs} obra_fvs deletadas, template removido")

    # ── 2. MIGRATE_WITH_PROGRESS ──────────────────────────────────────────────
    for old_code, new_code in MIGRATE_WITH_PROGRESS.items():
        r = old_by_code.get(old_code)
        if not r:
            # Template ainda não existe → inserir como novo
            pass
        else:
            if old_code != new_code:
                # Renomeia o código no template
                cur.execute("""
                    UPDATE fvs_templates SET code = %s WHERE id = %s
                """, (new_code, r["id"]))

            # Atualiza nome/disciplina/bloco para os novos valores do seed
            new_t = next((t for t in NEW_TEMPLATES if t["code"] == new_code), None)
            if new_t:
                cur.execute("""
                    UPDATE fvs_templates
                    SET name=%s, disciplina=%s, bloco=%s
                    WHERE id=%s
                """, (new_t["name"], new_t["disciplina"], new_t["bloco"], r["id"]))

            n = replace_template_items(cur, r["id"], new_code, preserve_fvs_items=True)
            log.append(f"  PRESERVE         {old_code}→{new_code} — {r['fvs_total']} obra_fvs mantidas, {n} itens novos")

    # ── 3. EMPTY_RECREATE ─────────────────────────────────────────────────────
    migrated_or_deleted = set(MIGRATE_WITH_PROGRESS.keys()) | set(DELETE_WITHOUT_MIGRATE)
    for t in NEW_TEMPLATES:
        code = t["code"]
        if code in migrated_or_deleted:
            continue

        r = old_by_code.get(code)
        if r:
            # Deleta obra_fvs (vazias ou não — são templates sem progresso real)
            cur.execute("DELETE FROM obra_fvs WHERE template_id = %s", (r["id"],))
            deleted_fvs = cur.rowcount
            n = replace_template_items(cur, r["id"], code, preserve_fvs_items=False)
            # Atualiza metadados
            cur.execute("""
                UPDATE fvs_templates
                SET name=%s, disciplina=%s, bloco=%s
                WHERE id=%s
            """, (t["name"], t["disciplina"], t["bloco"], r["id"]))
            log.append(f"  RECREATE         {code} — {deleted_fvs} obra_fvs deletadas, {n} itens novos")
        else:
            # Template novo — inserir
            cur.execute("""
                INSERT INTO fvs_templates (code, name, disciplina, bloco)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (code, t["name"], t["disciplina"], t["bloco"]))
            new_id = cur.fetchone()["id"]
            n = replace_template_items(cur, new_id, code, preserve_fvs_items=False)
            log.append(f"  INSERT           {code} — novo template, {n} itens")

    # ── 4. DELETE_ORPHAN ──────────────────────────────────────────────────────
    for code, r in old_by_code.items():
        action = determine_action(code)
        if action == "DELETE_ORPHAN":
            cur.execute("DELETE FROM obra_fvs   WHERE template_id = %s", (r["id"],))
            cur.execute("DELETE FROM fvs_templates WHERE id = %s",       (r["id"],))
            log.append(f"  DELETE_ORPHAN    {code} — template não existe no novo seed")

    # ── 5. Atualizar fvs_code nas ITs ─────────────────────────────────────────
    it_updated = 0
    for r in it_rows:
        new_fvs_code = MIGRATE_WITH_PROGRESS.get(r["fvs_code"])
        if new_fvs_code and new_fvs_code != r["fvs_code"]:
            cur.execute("""
                UPDATE instrucoes_tecnicas
                SET fvs_code = %s
                WHERE code = %s
            """, (new_fvs_code, r["code"]))
            it_updated += cur.rowcount

    if it_updated:
        log.append(f"  IT fvs_code      {it_updated} registro(s) atualizado(s)")

    return log

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{'='*68}")
    print(f"  migrate-fvs-prod.py  —  modo: {'DRY-RUN' if DRY_RUN else 'APPLY'}")
    print(f"{'='*68}")
    print(f"  Banco: {PROD_DB[:50]}...")

    conn = connect()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    state   = fetch_current_state(cur)
    it_rows = fetch_it_fvs_codes(cur)

    print_report(state, it_rows)

    if DRY_RUN:
        print("\n  Modo DRY-RUN — nenhuma alteração aplicada.")
        print("  Para aplicar: python3 migrate-fvs-prod.py --apply\n")
        conn.close()
        return

    # ── Confirmação ────────────────────────────────────────────────────────────
    print("\n" + "!" * 68)
    print("  ATENÇÃO: esta operação modifica o banco de PRODUÇÃO.")
    print("  A execução é feita dentro de uma única transação.")
    print("  Em caso de erro, tudo é revertido automaticamente.")
    print("!" * 68)
    resposta = input("\n  Digite CONFIRMAR para prosseguir: ").strip()
    if resposta != "CONFIRMAR":
        print("  Cancelado.\n")
        conn.close()
        return

    print("\n  Aplicando migração...")
    try:
        log = apply_migration(conn)
        conn.commit()
        print("\n  ✓ Migração concluída com sucesso!\n")
        for linha in log:
            print(linha)
        print()
    except Exception as e:
        conn.rollback()
        print(f"\n  ERRO — rollback executado.\n  {e}\n", file=sys.stderr)
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
