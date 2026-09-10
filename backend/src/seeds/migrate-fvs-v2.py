#!/usr/bin/env python3
"""
migrate-fvs-v2.py — BÈR App
Substitui os 23 templates FVS antigos pelo novo schema (fvs-seed.py).

Uso:
  python3 migrate-fvs-v2.py <DATABASE_URL> [--apply]

  Default: DRY-RUN — mostra tudo sem alterar nada.
  --apply : executa a migração real. Faça backup antes!
"""
import subprocess, sys
from collections import defaultdict

DB    = next((a for a in sys.argv[1:] if "postgres" in a), "")
APPLY = "--apply" in sys.argv

if not DB:
    print("Uso: python3 migrate-fvs-v2.py <DATABASE_URL> [--apply]")
    sys.exit(1)

MODE = "APPLY" if APPLY else "DRY-RUN"

def esc(s): return s.replace("'", "''") if s else ""

def run(sql):
    r = subprocess.run(["psql", DB, "-c", sql], capture_output=True, text=True)
    if r.returncode != 0 and "ERROR" in r.stderr:
        print(f"  !! SQL ERROR: {r.stderr[:500]}")
    return r.stdout

def val(sql):
    r = subprocess.run(["psql", DB, "-t", "-c", sql], capture_output=True, text=True)
    return r.stdout.strip()

def rows(sql):
    r = subprocess.run(["psql", DB, "-t", "-A", "-F", "\t", "-c", sql], capture_output=True, text=True)
    return [ln.split("\t") for ln in r.stdout.strip().splitlines() if ln.strip()]

counts = defaultdict(int)

def do(label, sql, count_key=None):
    if APPLY:
        run(sql)
        print(f"  ✓ {label}")
        if count_key:
            counts[count_key] += 1
    else:
        print(f"  · [DRY] {label}")
        if count_key:
            counts[count_key] += 1

# ═══════════════════════════════════════════════════════════════════════════════
# NOVO SCHEMA (fvs-seed.py)
# ═══════════════════════════════════════════════════════════════════════════════

NEW_TEMPLATES = [
  { "code": "FVS_0",  "name": "Mobilização de Canteiro",      "disciplina": "preparacao",   "bloco": 1 },
  { "code": "FVS_1",  "name": "Demolições / Alvenaria",       "disciplina": "demolicao",    "bloco": 1 },
  { "code": "FVS_2",  "name": "Vistoria Inicial / Estrutura", "disciplina": "vistoria",     "bloco": 1 },
  { "code": "FVS_2B", "name": "Layout / Marcações",           "disciplina": "marcacoes",    "bloco": 1 },
  { "code": "FVS_3A", "name": "Elétrica Bruta",               "disciplina": "eletrica",     "bloco": 2 },
  { "code": "FVS_3B", "name": "Elétrica Acabamento",          "disciplina": "eletrica",     "bloco": 4 },
  { "code": "FVS_4",  "name": "Cabeamento Estruturado",       "disciplina": "dados",        "bloco": 2 },
  { "code": "FVS_5",  "name": "Hidráulica",                   "disciplina": "hidraulica",   "bloco": 2 },
  { "code": "FVS_6",  "name": "Sprinkler",                    "disciplina": "sprinkler",    "bloco": 2 },
  { "code": "FVS_7",  "name": "SDAI",                         "disciplina": "sdai",         "bloco": 2 },
  { "code": "FVS_8",  "name": "HVAC / Ar Condicionado",       "disciplina": "hvac",         "bloco": 2 },
  { "code": "FVS_9",  "name": "Drywall",                      "disciplina": "drywall",      "bloco": 3 },
  { "code": "FVS_10", "name": "Forro",                        "disciplina": "forro",        "bloco": 3 },
  { "code": "FVS_11", "name": "Impermeabilização",            "disciplina": "impermeab",    "bloco": 1 },
  { "code": "FVS_12", "name": "Revestimentos e Pisos",        "disciplina": "revestimento", "bloco": 4 },
  { "code": "FVS_13", "name": "Pintura",                      "disciplina": "pintura",      "bloco": 4 },
  { "code": "FVS_14", "name": "Marcenaria",                   "disciplina": "marcenaria",   "bloco": 5 },
  { "code": "FVS_15", "name": "Pedras e Bancadas",            "disciplina": "pedras",       "bloco": 5 },
  { "code": "FVS_16", "name": "Vidros e Esquadrias",          "disciplina": "vidros",       "bloco": 5 },
  { "code": "FVS_17", "name": "Divisórias Industriais",       "disciplina": "divisorias",   "bloco": 4 },
  { "code": "FVS_18", "name": "Limpeza Técnica",              "disciplina": "limpeza",      "bloco": 6 },
  { "code": "FVS_19", "name": "Vistoria Final / Pré-entrega", "disciplina": "vistoria",     "bloco": 6 },
  { "code": "FVS_20", "name": "Desmobilização de Canteiro",   "disciplina": "preparacao",   "bloco": 6 },
]

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

# ═══════════════════════════════════════════════════════════════════════════════
# MAPEAMENTO de fvs_code nas ITs (old_code → new_code)
# ═══════════════════════════════════════════════════════════════════════════════
IT_FVS_CODE_MAP = {
    "FVS_0":  "FVS_0",   # Mobilização → Mobilização ✓
    "FVS_1":  "FVS_1",   # Demolições → Demolições ✓
    "FVS_2":  "FVS_2",   # Contrapiso → Vistoria (código mantido, IT-10)
    "FVS_3":  "FVS_9",   # Drywall → Drywall (rename) ✓
    "FVS_3A": "FVS_10",  # Forro (old 3A) → Forro (new 10) ✓
    "FVS_4":  "FVS_11",  # Impermeab (old 4) → Impermeab (new 11) ✓
    "FVS_5":  "FVS_3A",  # Elétrica Bruta (old 5) → Elétrica Bruta (new 3A) ✓
    "FVS_6":  "FVS_8",   # AC (old 6) → HVAC/AC (new 8) ✓
    "FVS_7":  "FVS_7",   # Sprinkler+SDAI → SDAI (código mantido)
    "FVS_8":  "FVS_4",   # Cabeamento (old 8) → Cabeamento (new 4) ✓
    "FVS_9":  None,       # Automação — sem equivalente, zerar fvs_code
    "FVS_10": "FVS_12",  # Revestimentos (old 10) → Revestimentos (new 12) ✓
    "FVS_11": "FVS_13",  # Pintura (old 11) → Pintura (new 13) ✓
    "FVS_12": "FVS_14",  # Marcenaria (old 12) → Marcenaria (new 14) ✓
    "FVS_13": "FVS_16",  # Vidros/Divisórias (old 13) → Vidros (new 16) ✓
    "FVS_14": "FVS_14",  # Louças/Metais (old 14) → código mantido (Marcenaria no novo — revisar!)
    "FVS_15": "FVS_15",  # Pedras (old 15 = new 15) ✓ same
    "FVS_16": "FVS_16",  # Vidros (old 16 = new 16) ✓ same
    "FVS_19": "FVS_18",  # Limpeza (old 19) → Limpeza (new 18) ✓
    "FVS_20": "FVS_20",  # Entrega → Desmobilização (código mantido)
}

# Quais templates têm progresso real — PRESERVAR obra_fvs (não deletar)
WITH_PROGRESS = {"FVS_0", "FVS_1", "FVS_2", "FVS_3", "FVS_6"}

# Templates a deletar completamente (sem migrar)
DELETE_ENTIRELY = {"FVS_2B", "FVS_3B", "FVS_5A", "FVS_9"}  # antigos

# ═══════════════════════════════════════════════════════════════════════════════
# INÍCIO DA MIGRAÇÃO
# ═══════════════════════════════════════════════════════════════════════════════

new_codes = {t["code"] for t in NEW_TEMPLATES}

print(f"\n{'='*70}")
print(f"  MIGRAÇÃO FVS — {MODE}")
print(f"{'='*70}")

# ── Estado atual ───────────────────────────────────────────────────────────────
print("\n── ESTADO ATUAL ──────────────────────────────────────────────────────")
old_templates = rows("SELECT code, name FROM fvs_templates ORDER BY code")
print(f"  Templates no banco: {len(old_templates)}")
for row in old_templates:
    code, name = row[0], row[1]
    tag = ""
    if code in DELETE_ENTIRELY:
        tag = "  ← DELETAR"
    elif code not in new_codes and code != "FVS_3":
        tag = "  ← SEM EQUIVALENTE"
    elif code == "FVS_3":
        tag = "  ← RENOMEAR → FVS_9"
    print(f"    {code:<8} {name}{tag}")

# ── Conflitos de código ────────────────────────────────────────────────────────
print("\n── ATENÇÃO: MUDANÇAS DE PROPÓSITO (mesmo código, disciplina diferente) ──")
warnings = [
    ("FVS_2",  "Contrapiso e Regularização",    "Vistoria Inicial / Estrutura",  "1 obra_fvs com progresso"),
    ("FVS_3A", "Forro (old)",                   "Elétrica Bruta (new)",          "sem progresso — ok"),
    ("FVS_4",  "Impermeabilização (old)",        "Cabeamento Estruturado (new)",  "sem progresso — ok"),
    ("FVS_5",  "Elétrica Bruta (old)",           "Hidráulica (new)",              "sem progresso — ok"),
    ("FVS_6",  "Ar Condicionado (old)",          "Sprinkler (new)",               "1 obra_fvs com progresso"),
    ("FVS_7",  "Sprinkler e SDAI (old)",         "SDAI (new)",                    "sem progresso — ok"),
    ("FVS_8",  "Cabeamento Estruturado (old)",   "HVAC / Ar Condicionado (new)",  "sem progresso — ok"),
    ("FVS_10", "Revestimentos Cerâmica (old)",   "Forro (new)",                   "sem progresso — ok"),
    ("FVS_11", "Pintura (old)",                  "Impermeabilização (new)",       "sem progresso — ok"),
    ("FVS_19", "Limpeza Técnica (old)",          "Vistoria Final (new)",          "sem progresso — ok"),
    ("FVS_20", "Entrega ao Cliente (old)",       "Desmobilização de Canteiro (new)", "sem progresso — ok"),
]
for code, old_name, new_name, note in warnings:
    flag = "⚠️ " if "progresso" in note and "sem" not in note else "  "
    print(f"  {flag}{code}: '{old_name}' → '{new_name}' [{note}]")

print(f"\n  ⚠️  FVS_2 e FVS_6 têm progresso real e MUDAM de propósito.")
print(f"     Os dados preenchidos (checked/observação) são preservados,")
print(f"     mas template_item_id ficará NULL até reabrir a FVS.")

# ── Mapeamento ITs ─────────────────────────────────────────────────────────────
print("\n── MAPEAMENTO fvs_code NAS ITs ───────────────────────────────────────")
its = rows("SELECT code, title, fvs_code FROM instrucoes_tecnicas WHERE fvs_code IS NOT NULL ORDER BY fvs_code, code")
for row in its:
    it_code, title, old_fvs = row[0], row[1], row[2]
    new_fvs = IT_FVS_CODE_MAP.get(old_fvs, old_fvs)
    arrow = "→ NULL  ⚠️ " if new_fvs is None else f"→ {new_fvs}"
    changed = " (mudou)" if new_fvs != old_fvs else " (mantido)"
    print(f"  {it_code}: {old_fvs} {arrow}{changed}  [{title[:40]}]")

print(f"\n{'='*70}")
print(f"  PASSOS DA MIGRAÇÃO")
print(f"{'='*70}")

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 1 — Deletar templates obsoletos (FVS_2B, FVS_3B, FVS_5A, FVS_9-antigo)
# ═══════════════════════════════════════════════════════════════════════════════
print("\nPASSO 1 — Deletar templates obsoletos (FVS_2B, FVS_3B, FVS_5A, FVS_9-Automação)")

for old_code in sorted(DELETE_ENTIRELY):
    tid = val(f"SELECT id FROM fvs_templates WHERE code='{old_code}' LIMIT 1")
    if not tid:
        print(f"  · {old_code}: não encontrado, ignorado")
        continue
    n_ofvs = val(f"SELECT COUNT(*) FROM obra_fvs WHERE template_id='{tid}'")
    n_items = val(f"SELECT COUNT(*) FROM fvs_template_items WHERE template_id='{tid}'")
    do(
        f"DELETE obra_fvs ({n_ofvs}) + template_items ({n_items}) + template {old_code}",
        f"DELETE FROM obra_fvs WHERE template_id='{tid}'",
        "deleted_templates"
    )
    do(
        f"DELETE fvs_templates {old_code}",
        f"DELETE FROM fvs_templates WHERE id='{tid}'",
    )

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 2 — Renomear FVS_3 → FVS_9 (Drywall, tem progresso)
# ═══════════════════════════════════════════════════════════════════════════════
print("\nPASSO 2 — Renomear FVS_3 (Drywall, tem progresso) → FVS_9")

tid3 = val("SELECT id FROM fvs_templates WHERE code='FVS_3' LIMIT 1")
if tid3:
    n_ofvs = val(f"SELECT COUNT(*) FROM obra_fvs WHERE template_id='{tid3}'")
    n_preench = val(f"""
        SELECT COUNT(DISTINCT o.id) FROM obra_fvs o
        WHERE o.template_id='{tid3}'
        AND EXISTS (SELECT 1 FROM obra_fvs_items i WHERE i.fvs_id=o.id AND (i.checked OR i.na OR i.observacao IS NOT NULL))
    """)
    print(f"  FVS_3: {n_ofvs} obra_fvs ({n_preench} com progresso) — preservando tudo")
    t = next(t for t in NEW_TEMPLATES if t["code"] == "FVS_9")
    do(
        f"UPDATE fvs_templates: FVS_3 → code=FVS_9, name='{t['name']}'",
        f"UPDATE fvs_templates SET code='FVS_9', name='{esc(t['name'])}', disciplina='{t['disciplina']}', bloco={t['bloco']} WHERE id='{tid3}'"
    )
    do(
        f"DELETE template_items antigos do FVS_3/9",
        f"DELETE FROM fvs_template_items WHERE template_id='{tid3}'"
    )
    items = NEW_ITEMS.get("FVS_9", [])
    for (momento, secao, descricao, obrig, ordem) in items:
        do(
            f"  INSERT item {ordem}: {descricao[:50]}",
            f"INSERT INTO fvs_template_items (template_id, momento, secao, descricao, obrigatorio, ordem, foto_obrigatoria) "
            f"VALUES ('{tid3}', '{momento}', '{esc(secao)}', '{esc(descricao)}', {'true' if obrig else 'false'}, {ordem}, false)"
        )
    counts["items_inserted"] += len(items)
    print(f"  → {len(items)} novos itens para FVS_9 {'inseridos' if APPLY else 'planejados'}")
else:
    print("  FVS_3: não encontrado no banco")

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 3 — Atualizar templates existentes (mesmo código, novo conteúdo)
# ═══════════════════════════════════════════════════════════════════════════════
print("\nPASSO 3 — Atualizar templates existentes (metadata + itens)")

# Obras ativas que recebem obra_fvs (as 4 que já têm)
obra_ids = [r[0] for r in rows(
    "SELECT DISTINCT obra_id FROM obra_fvs"
)]
print(f"  Obras ativas para recriar obra_fvs: {len(obra_ids)}")

# Códigos que permanecem no banco (não foram deletados nem renomeados)
OLD_CODES = [r[0] for r in rows("SELECT code FROM fvs_templates ORDER BY code")]
update_codes = [c for c in OLD_CODES if c not in DELETE_ENTIRELY and c != "FVS_3"]
# Também inclui FVS_9 se o rename já aconteceu (step2), mas não processar duas vezes
# FVS_9 já foi tratado no step2 — skip aqui
update_codes = [c for c in update_codes if c in new_codes and c != "FVS_9"]

for code in update_codes:
    tid = val(f"SELECT id FROM fvs_templates WHERE code='{code}' LIMIT 1")
    if not tid:
        continue
    t = next((x for x in NEW_TEMPLATES if x["code"] == code), None)
    if not t:
        continue

    has_progress = code in WITH_PROGRESS
    n_ofvs = val(f"SELECT COUNT(*) FROM obra_fvs WHERE template_id='{tid}'")
    n_preench = val(f"""
        SELECT COUNT(DISTINCT o.id) FROM obra_fvs o
        WHERE o.template_id='{tid}'
        AND EXISTS (SELECT 1 FROM obra_fvs_items i WHERE i.fvs_id=o.id AND (i.checked OR i.na OR i.observacao IS NOT NULL))
    """) if has_progress else "0"

    mode_tag = "PRESERVA obra_fvs" if has_progress else "RECRIA obra_fvs"
    print(f"\n  {code} [{mode_tag}] — {n_ofvs} obra_fvs, {n_preench} com progresso")

    # Update template metadata
    do(
        f"UPDATE metadata: {code} → '{t['name']}' / {t['disciplina']} / bloco {t['bloco']}",
        f"UPDATE fvs_templates SET name='{esc(t['name'])}', disciplina='{t['disciplina']}', bloco={t['bloco']} WHERE id='{tid}'"
    )

    # Replace template items (CASCADE SET NULL on obra_fvs_items.template_item_id)
    do(
        f"DELETE template_items antigos de {code}",
        f"DELETE FROM fvs_template_items WHERE template_id='{tid}'"
    )
    items = NEW_ITEMS.get(code, [])
    for (momento, secao, descricao, obrig, ordem) in items:
        do(
            f"  INSERT item {ordem}: {descricao[:50]}",
            f"INSERT INTO fvs_template_items (template_id, momento, secao, descricao, obrigatorio, ordem, foto_obrigatoria) "
            f"VALUES ('{tid}', '{momento}', '{esc(secao)}', '{esc(descricao)}', {'true' if obrig else 'false'}, {ordem}, false)"
        )
    counts["items_inserted"] += len(items)

    if not has_progress:
        # Recriar obra_fvs (as antigas tinham 0 progresso)
        do(
            f"DELETE obra_fvs antigas de {code} ({n_ofvs} registros)",
            f"DELETE FROM obra_fvs WHERE template_id='{tid}'"
        )
        for obra_id in obra_ids:
            do(
                f"INSERT obra_fvs para obra {obra_id[:8]}… → {code}",
                f"INSERT INTO obra_fvs (obra_id, template_id, status) VALUES ('{obra_id}', '{tid}', 'pendente')"
            )
            counts["obra_fvs_created"] += 1
    else:
        print(f"    → Mantendo {n_ofvs} obra_fvs com progresso de {n_preench} delas")
        print(f"    → obra_fvs_items.template_item_id ficará NULL (dados preservados)")

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 4 — Inserir templates novos (FVS_2B, FVS_3B, FVS_17, FVS_18)
# ═══════════════════════════════════════════════════════════════════════════════
# Quais existem no new mas não no banco atual (após steps 1-3)?
current_codes_after = set(r[0] for r in rows("SELECT code FROM fvs_templates"))
insert_codes = [t["code"] for t in NEW_TEMPLATES if t["code"] not in current_codes_after]
# No dry-run o banco não mudou, então simulamos:
simulated_existing = (set(r[0] for r in rows("SELECT code FROM fvs_templates"))
                      - DELETE_ENTIRELY
                      - {"FVS_3"}) | {"FVS_9"}
insert_codes = [t["code"] for t in NEW_TEMPLATES if t["code"] not in simulated_existing]

print(f"\nPASSO 4 — Inserir templates novos: {insert_codes}")

for code in insert_codes:
    t = next(x for x in NEW_TEMPLATES if x["code"] == code)
    items = NEW_ITEMS.get(code, [])
    print(f"\n  {code} — '{t['name']}' ({len(items)} itens, {len(obra_ids)} obra_fvs)")
    new_tid = f"(novo UUID para {code})"
    do(
        f"INSERT fvs_templates {code} '{t['name']}'",
        f"INSERT INTO fvs_templates (code, name, disciplina, bloco) "
        f"VALUES ('{code}', '{esc(t['name'])}', '{t['disciplina']}', {t['bloco']}) "
        f"ON CONFLICT DO NOTHING"
    )
    counts["new_templates"] += 1
    # Items e obra_fvs são inseridos após confirmar o tid
    # No apply, buscamos o tid logo após o INSERT
    for (momento, secao, descricao, obrig, ordem) in items:
        do(
            f"  INSERT item {ordem}: {descricao[:50]}",
            f"DO $$ DECLARE tid uuid; BEGIN "
            f"SELECT id INTO tid FROM fvs_templates WHERE code='{code}'; "
            f"INSERT INTO fvs_template_items (template_id, momento, secao, descricao, obrigatorio, ordem, foto_obrigatoria) "
            f"VALUES (tid, '{momento}', '{esc(secao)}', '{esc(descricao)}', {'true' if obrig else 'false'}, {ordem}, false); "
            f"END $$"
        )
    counts["items_inserted"] += len(items)
    for obra_id in obra_ids:
        do(
            f"INSERT obra_fvs para obra {obra_id[:8]}… → {code}",
            f"DO $$ DECLARE tid uuid; BEGIN "
            f"SELECT id INTO tid FROM fvs_templates WHERE code='{code}'; "
            f"INSERT INTO obra_fvs (obra_id, template_id, status) VALUES ('{obra_id}', tid, 'pendente') "
            f"ON CONFLICT DO NOTHING; END $$"
        )
        counts["obra_fvs_created"] += 1

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 5 — Atualizar fvs_code nas ITs
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\nPASSO 5 — Atualizar fvs_code nas instrucoes_tecnicas")

its = rows("SELECT id, code, title, fvs_code FROM instrucoes_tecnicas WHERE fvs_code IS NOT NULL ORDER BY fvs_code")
for row in its:
    it_id, it_code, title, old_fvs = row
    new_fvs = IT_FVS_CODE_MAP.get(old_fvs, old_fvs)
    if new_fvs == old_fvs:
        print(f"  · {it_code} {old_fvs} → {new_fvs} (sem mudança)")
        continue
    if new_fvs is None:
        do(
            f"SET NULL fvs_code: {it_code} ({old_fvs} — Automação sem equivalente)",
            f"UPDATE instrucoes_tecnicas SET fvs_code=NULL WHERE id='{it_id}'"
        )
    else:
        do(
            f"UPDATE {it_code}: fvs_code {old_fvs} → {new_fvs}  [{title[:40]}]",
            f"UPDATE instrucoes_tecnicas SET fvs_code='{new_fvs}' WHERE id='{it_id}'"
        )
    counts["its_updated"] += 1

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMO
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{'='*70}")
print(f"  RESUMO — {MODE}")
print(f"{'='*70}")
print(f"  Templates deletados (FVS_2B, FVS_3B, FVS_5A, FVS_9-antigo): 4")
print(f"  Templates renomeados (FVS_3 → FVS_9):                        1")
print(f"  Templates atualizados (mesmo código, novo conteúdo):         {len(update_codes)}")
print(f"  Templates novos inseridos (FVS_2B, FVS_3B, FVS_17, FVS_18): {counts['new_templates']}")
print(f"  Total template_items inseridos:                               {counts['items_inserted']}")
print(f"  obra_fvs recriadas / criadas:                                 {counts['obra_fvs_created']}")
print(f"  ITs com fvs_code atualizado:                                  {counts['its_updated']}")

if not APPLY:
    print(f"\n  ⚡ Modo DRY-RUN — nenhuma alteração foi feita.")
    print(f"  Para executar: python3 migrate-fvs-v2.py <DATABASE_URL> --apply")
else:
    print(f"\n  ✅ Migração concluída.")

# Verificação final (só no apply)
if APPLY:
    print(f"\n── VERIFICAÇÃO FINAL ──────────────────────────────────────────────")
    result = rows("""
        SELECT t.code, t.name,
          (SELECT COUNT(*) FROM fvs_template_items i WHERE i.template_id=t.id) AS n_items,
          (SELECT COUNT(*) FROM obra_fvs o WHERE o.template_id=t.id) AS n_obra_fvs
        FROM fvs_templates t ORDER BY t.code
    """)
    print(f"  {'CODE':<8} {'NAME':<35} {'ITEMS':>6} {'OBRA_FVS':>9}")
    print(f"  {'-'*8} {'-'*35} {'-'*6} {'-'*9}")
    for r in result:
        print(f"  {r[0]:<8} {r[1]:<35} {r[2]:>6} {r[3]:>9}")
    total = val("SELECT COUNT(*) FROM fvs_templates")
    print(f"\n  Total templates: {total} (esperado: 23)")
