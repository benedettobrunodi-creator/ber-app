#!/usr/bin/env python3
"""
Seed completo para Railway. Roda todos os dados básicos no banco Railway.
Uso: python3 railway-seed.py [DATABASE_URL]
"""
import subprocess, sys, json, os

DB = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DATABASE_URL", "")
if not DB:
    print("Uso: python3 railway-seed.py <DATABASE_URL>")
    sys.exit(1)

def psql(sql):
    r = subprocess.run(["psql", DB, "-c", sql], capture_output=True, text=True)
    if r.returncode != 0 and "ERROR" in r.stderr:
        print(f"ERR: {r.stderr[:300]}", file=sys.stderr)
    return r.stdout

def psql_stdin(sql):
    r = subprocess.run(["psql", DB], input=sql, capture_output=True, text=True)
    if r.returncode != 0 and "ERROR" in r.stderr:
        print(f"ERR: {r.stderr[:300]}", file=sys.stderr)
    return r.stdout

def psql_val(sql):
    r = subprocess.run(["psql", DB, "-t", "-c", sql], capture_output=True, text=True)
    return r.stdout.strip()

def esc(s): return s.replace("'", "''") if s else ""
def arr(lst): return "ARRAY[" + ",".join(f"'{esc(x)}'" for x in lst) + "]::text[]" if lst else "ARRAY[]::text[]"

print(f"=== Railway Seed — {DB[:40]}... ===\n")

# ─── 1. USUÁRIOS ──────────────────────────────────────────────────────────────
print("1. Usuários...")
# bcrypt hash de 'ber2026' com salt 10
HASH = "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FCtsnr9vy9lQMj1RL1IhyD5AAj4bYlW"
users = [
    ("Bruno Di Benedetto", "bruno@ber-engenharia.com.br", "diretoria"),
    ("Luis Nuin", "luis.nuin@ber-engenharia.com.br", "coordenacao"),
]
for name, email, role in users:
    psql(f"INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (gen_random_uuid(), '{esc(name)}', '{esc(email)}', '{HASH}', '{role}', true) ON CONFLICT (email) DO NOTHING;")
count = psql_val("SELECT count(*) FROM users;")
print(f"   ✓ {count} usuários")

# ─── 2. OBRAS ─────────────────────────────────────────────────────────────────
print("2. Obras...")
obras = [
    ("BÈR — Obra | Higienópolis",    "Renata & Sérgio Almeida",  "Rua Peixoto Gomide, 1200 — Higienópolis, SP"),
    ("BÈR — Obra | Arbo Pinheiros",  "Alexandre Furlan",          "Rua Joaquim Antunes, 727 — Pinheiros, SP"),
    ("BÈR — Obra | Mackenzie",       "Universidade Mackenzie",    "Rua da Consolação, 896 — Consolação, SP"),
    ("BÈR — Obra | Igreja Taboão",   "Igreja Lagoinha Taboão",    "Av. das Nações Unidas, 22570 — Taboão da Serra, SP"),
    ("BÈR — Obra | Sérgio e Renata", "Sérgio e Renata Magalhães", "Rua Colômbia, 45 — Jardim América, SP"),
]
for name, client, address in obras:
    psql(f"INSERT INTO obras (id, name, client, address, status, progress_percent) VALUES (gen_random_uuid(), '{esc(name)}', '{esc(client)}', '{esc(address)}', 'em_andamento', 0) ON CONFLICT DO NOTHING;")
count = psql_val("SELECT count(*) FROM obras;")
print(f"   ✓ {count} obras")

# ─── 3. FVS TEMPLATES ─────────────────────────────────────────────────────────
print("3. FVS Templates...")
fvs_templates = [
    ("FVS_0",  "Mobilização e Canteiro",                      "outro",              [
        ("inicio","Tapumes instalados e rota de entulho definida"),
        ("inicio","Proteção de corredores e elevadores realizada"),
        ("inicio","Quadro de energia provisório instalado"),
        ("inicio","Vistoria fotográfica inicial concluída"),
        ("conclusao","Canteiro desmobilizado e áreas comuns restauradas"),
        ("conclusao","Entulho retirado e caçamba devolvida"),
    ]),
    ("FVS_1",  "Demolições e Remoções",                       "alvenaria",          [
        ("inicio","Projeto executivo de demolição verificado"),
        ("inicio","Circuitos elétricos e hidráulicos desligados na área"),
        ("inicio","Paredes estruturais confirmadas como não-estruturais"),
        ("conclusao","Demolição executada conforme projeto"),
        ("conclusao","Entulho segregado e removido"),
        ("conclusao","Registro fotográfico antes/depois concluído"),
    ]),
    ("FVS_2",  "Contrapiso e Regularização",                  "revestimento",       [
        ("inicio","Substrato limpo e úmido"),
        ("inicio","Taliscas de nível instaladas"),
        ("conclusao","Desnivelamento máximo 3mm em régua de 2m verificado"),
        ("conclusao","Superfície rugosa (não polida)"),
        ("conclusao","Cura de 72h realizada"),
    ]),
    ("FVS_2B", "Regularização de Piso (Complementar)",        "revestimento",       [
        ("inicio","Substrato verificado e limpo"),
        ("conclusao","Nível conferido"),
        ("conclusao","Espessura mínima atingida"),
    ]),
    ("FVS_3",  "Drywall e Vedações",                          "alvenaria",          [
        ("inicio","Instalações embutidas concluídas"),
        ("inicio","Projeto de layout aprovado"),
        ("conclusao","Prumo máximo 3mm em 2m verificado"),
        ("conclusao","Placa correta para cada ambiente (RU em molhados)"),
        ("conclusao","Tratamento de juntas concluído"),
    ]),
    ("FVS_3A", "Forro",                                       "acabamento",         [
        ("inicio","Instalações de teto concluídas"),
        ("inicio","Nível do forro marcado"),
        ("conclusao","Desnivelamento máximo 3mm verificado"),
        ("conclusao","Furos para luminárias e difusores abertos"),
    ]),
    ("FVS_3B", "Drywall e Forro (Combinado)",                 "alvenaria",          [
        ("inicio","Instalações concluídas"),
        ("conclusao","Prumo e nível verificados"),
        ("conclusao","Juntas tratadas"),
    ]),
    ("FVS_4",  "Impermeabilização",                           "impermeabilizacao",  [
        ("inicio","Substrato limpo e sem fissuras >3mm"),
        ("inicio","Pontos hidráulicos posicionados"),
        ("conclusao","3 demãos aplicadas em áreas críticas"),
        ("conclusao","Tela de reforço em 100% dos cantos e ralos"),
        ("conclusao","Teste de estanqueidade 72h: zero perda de nível"),
        ("conclusao","Registro fotográfico do teste no app"),
    ]),
    ("FVS_5",  "Elétrica Bruta",                              "eletrica",           [
        ("inicio","Projeto elétrico aprovado"),
        ("inicio","Disjuntores desligados e verificados com multímetro"),
        ("conclusao","Eletrodutos instalados conforme projeto"),
        ("conclusao","Caixas de passagem niveladas"),
        ("conclusao","Condutores identificados por circuito"),
        ("conclusao","Aterramento instalado em 100% dos circuitos"),
    ]),
    ("FVS_5A", "Elétrica de Acabamento",                      "eletrica",           [
        ("inicio","Drywall e forro fechados"),
        ("inicio","Pintura concluída"),
        ("conclusao","QDC instalado e identificado com diagrama unifilar"),
        ("conclusao","Tomadas no padrão NBR 14136"),
        ("conclusao","Teste de continuidade em todos os circuitos"),
        ("conclusao","Energização progressiva realizada"),
    ]),
    ("FVS_6",  "Ar Condicionado",                             "ar_condicionado",    [
        ("inicio","Projeto de AC aprovado"),
        ("inicio","Circuito dedicado disponível"),
        ("conclusao","Vácuo mantido por 10 min sem queda"),
        ("conclusao","Delta T de 8–12°C verificado"),
        ("conclusao","Dreno escoando livremente"),
        ("conclusao","Tubulação de cobre 100% isolada"),
    ]),
    ("FVS_7",  "Sprinkler e SDAI",                            "outro",              [
        ("inicio","Autorização escrita para despressurização obtida"),
        ("inicio","Empresa especializada presente"),
        ("inicio","AVCB vigente verificado"),
        ("conclusao","Zero vazamentos após repressurização"),
        ("conclusao","Rósulas na temperatura correta"),
        ("conclusao","ART emitida e arquivada"),
    ]),
    ("FVS_8",  "Cabeamento Estruturado / TI",                 "eletrica",           [
        ("inicio","Projeto de TI aprovado"),
        ("inicio","Rack posicionado e aterrado"),
        ("conclusao","100% dos pontos certificados (wiremap, atenuação, NEXT)"),
        ("conclusao","Relatório de certificação emitido"),
        ("conclusao","Cabos identificados em ambas as extremidades"),
    ]),
    ("FVS_9",  "Automação e BMS",                             "eletrica",           [
        ("inicio","Projeto de automação aprovado"),
        ("inicio","Cabeamento estruturado certificado"),
        ("conclusao","100% dos cenários funcionando"),
        ("conclusao","Backup da programação entregue"),
        ("conclusao","Manual de operação entregue ao cliente"),
    ]),
    ("FVS_10", "Revestimentos (Cerâmica e Piso)",             "revestimento",       [
        ("inicio","Impermeabilização aprovada no teste"),
        ("inicio","Paginação definida e aprovada"),
        ("conclusao","100% das peças com som maciço (sem oco)"),
        ("conclusao","Desnivelamento máximo 3mm em 2m"),
        ("conclusao","Rejunte epóxi em áreas molhadas"),
    ]),
    ("FVS_11", "Pintura",                                     "acabamento",         [
        ("inicio","Drywall e revestimentos concluídos"),
        ("inicio","Proteções instaladas"),
        ("conclusao","Mínimo 2 demãos aplicadas"),
        ("conclusao","Cobertura uniforme sem emendas"),
        ("conclusao","Sem respingos em revestimentos e vidros"),
    ]),
    ("FVS_12", "Marcenaria e Mobiliário Fixo",                "marcenaria",         [
        ("inicio","Medidas conferidas vs. ambiente real"),
        ("inicio","Pintura concluída e curada"),
        ("conclusao","Todos os módulos fixados à parede (mín. 2 pontos)"),
        ("conclusao","Portas com folga uniforme de 2mm"),
        ("conclusao","Amortecedores funcionando em 100% das portas"),
    ]),
    ("FVS_13", "Vidros e Divisórias",                         "vidros",             [
        ("inicio","Vão real cotado (3 alturas × 3 larguras)"),
        ("conclusao","Vidro temperado em 100% das divisórias"),
        ("conclusao","Prumo máximo 2mm em 2m"),
        ("conclusao","Silicone neutro sem falhas"),
    ]),
    ("FVS_14", "Louças, Metais e Bancadas",                   "hidraulica",         [
        ("inicio","Revestimentos concluídos"),
        ("inicio","Água desligada no ramal"),
        ("conclusao","Zero vazamentos em 24h"),
        ("conclusao","Descargas funcionando sem refluxo"),
        ("conclusao","Silicone contínuo em todos os arremates"),
    ]),
    ("FVS_19", "Limpeza Técnica",                             "outro",              [
        ("inicio","Todas as instalações concluídas e testadas"),
        ("inicio","Materiais e entulho removidos"),
        ("conclusao","Zero respingos de tinta em revestimentos e vidros"),
        ("conclusao","Vidros sem marcas"),
        ("conclusao","Piso polido uniformemente"),
    ]),
    ("FVS_20", "Entrega ao Cliente",                          "outro",              [
        ("inicio","Limpeza técnica concluída"),
        ("inicio","Punch list zerado"),
        ("conclusao","Termo de entrega assinado pelo cliente"),
        ("conclusao","Documentação completa entregue"),
        ("conclusao","Áreas comuns devolvidas no estado original"),
        ("conclusao","Registro fotográfico final concluído"),
    ]),
]

psql("DELETE FROM fvs_template_items; DELETE FROM fvs_templates;")
for code, name, discipline, items in fvs_templates:
    psql(f"INSERT INTO fvs_templates (id, code, name, disciplina) VALUES (gen_random_uuid(), '{code}', '{esc(name)}', '{discipline}');")
    tid = psql_val(f"SELECT id FROM fvs_templates WHERE code='{code}';")
    for i, (momento, descricao) in enumerate(items):
        psql(f"INSERT INTO fvs_template_items (id, template_id, momento, descricao, ordem) VALUES (gen_random_uuid(), '{tid}', '{momento}', '{esc(descricao)}', {i+1});")
count = psql_val("SELECT count(*) FROM fvs_templates;")
items_count = psql_val("SELECT count(*) FROM fvs_template_items;")
print(f"   ✓ {count} FVS templates, {items_count} items")

# ─── 4. SEQUENCIAMENTO TEMPLATES ─────────────────────────────────────────────
print("4. Sequenciamento templates...")
templates = {
    "Corporativo": ("corporativo", [
        (1,"Vistoria e Relatório de Recebimento do Imóvel","estrutura",1,[]),
        (2,"Mobilização de Canteiro","outro",2,[]),
        (3,"Proteção de áreas comuns e rota de entulho","outro",1,[]),
        (4,"Demolições e remoções","alvenaria",5,[2,3]),
        (5,"Regularização de piso / Contrapiso","revestimento",4,[4]),
        (6,"Impermeabilização (banheiros/copas)","impermeabilizacao",5,[4]),
        (7,"Hidráulica bruta","hidraulica",8,[4]),
        (8,"Elétrica bruta","eletrica",10,[4]),
        (9,"Ar condicionado — infra e equipamentos","ar_condicionado",8,[4]),
        (10,"Sprinkler — despressurização e adaptação","outro",5,[4]),
        (11,"SDAI/CFTV/Alarme — infra bruta","eletrica",4,[4]),
        (12,"Cabeamento estruturado / TI","eletrica",5,[4]),
        (13,"Drywall e vedações","alvenaria",10,[5,6,7,8,9,10,11,12]),
        (14,"Forro (gesso/drywall/modular)","acabamento",8,[13]),
        (15,"Revestimentos de parede (banheiros/copas)","revestimento",6,[6,13]),
        (16,"Piso (porcelanato/vinílico/carpete)","revestimento",10,[5,13]),
        (17,"Pintura (massa corrida + tinta)","acabamento",8,[14,15,16]),
        (18,"Elétrica de acabamento","eletrica",6,[14,17]),
        (19,"AC — acabamento (difusores, fancoils)","ar_condicionado",3,[14]),
        (20,"SDAI/CFTV — acabamento","eletrica",3,[14]),
        (21,"Marcenaria e mobiliário fixo","marcenaria",12,[17]),
        (22,"Vidros e divisórias de vidro","vidros",5,[17]),
        (23,"Louças, metais e bancadas","hidraulica",4,[17,21]),
        (24,"Comissionamento de sistemas","outro",3,[18,19,20,22,23]),
        (25,"Limpeza técnica","limpeza",2,[24]),
        (26,"Punch List e entrega ao cliente","outro",2,[25]),
    ]),
    "Residencial": ("residencial", [
        (1,"Vistoria e Relatório de Recebimento do Imóvel","estrutura",1,[]),
        (2,"Mobilização de Canteiro","outro",1,[]),
        (3,"Demolições e remoções","alvenaria",4,[2]),
        (4,"Impermeabilização (banheiros/área de serviço)","impermeabilizacao",5,[3]),
        (5,"Hidráulica bruta","hidraulica",7,[3]),
        (6,"Elétrica bruta","eletrica",8,[3]),
        (7,"Ar condicionado (splits) — infra","ar_condicionado",4,[3]),
        (8,"Contrapiso e regularização","revestimento",4,[3]),
        (9,"Drywall e alvenaria complementar","alvenaria",8,[4,5,6,7,8]),
        (10,"Forro (onde houver)","acabamento",5,[9]),
        (11,"Revestimentos de parede (banheiros/cozinha)","revestimento",8,[4,9]),
        (12,"Piso","revestimento",8,[8,9]),
        (13,"Pintura (massa corrida + tinta)","acabamento",7,[10,11,12]),
        (14,"Elétrica de acabamento","eletrica",5,[10,13]),
        (15,"AC — acabamento e testes","ar_condicionado",2,[10]),
        (16,"Marcenaria e mobiliário fixo","marcenaria",10,[13]),
        (17,"Vidros e esquadrias","vidros",4,[13]),
        (18,"Louças, metais e bancadas","hidraulica",4,[13,16]),
        (19,"Limpeza","limpeza",2,[14,15,16,17,18]),
        (20,"Punch List e entrega","outro",1,[19]),
    ]),
    "Hoteleiro": ("hoteleiro", [
        (1,"Vistoria e Relatório de Recebimento do Imóvel","estrutura",1,[]),
        (2,"Mobilização de Canteiro","outro",2,[]),
        (3,"Proteção de áreas comuns","outro",1,[]),
        (4,"Demolições e remoções","alvenaria",5,[2,3]),
        (5,"Impermeabilização (banheiros)","impermeabilizacao",5,[4]),
        (6,"Hidráulica bruta","hidraulica",8,[4]),
        (7,"Elétrica bruta","eletrica",10,[4]),
        (8,"Ar condicionado — infra e fan coils","ar_condicionado",8,[4]),
        (9,"Sprinkler — despressurização e adaptação","outro",5,[4]),
        (10,"SDAI/Alarme/CFTV — infra","eletrica",4,[4]),
        (11,"Automação de quarto (controle de ambiente)","eletrica",5,[4]),
        (12,"Cabeamento estruturado / TV/Telefonia","eletrica",4,[4]),
        (13,"Contrapiso e regularização","revestimento",4,[4]),
        (14,"Drywall e vedações","alvenaria",10,[5,6,7,8,9,10,11,12,13]),
        (15,"Forro","acabamento",8,[14]),
        (16,"Revestimentos de parede (banheiros)","revestimento",8,[5,14]),
        (17,"Piso (porcelanato/vinílico/carpete)","revestimento",10,[13,14]),
        (18,"Pintura","acabamento",8,[15,16,17]),
        (19,"Elétrica de acabamento","eletrica",6,[15,18]),
        (20,"AC — acabamento","ar_condicionado",3,[15]),
        (21,"SDAI/CFTV — acabamento","eletrica",3,[15]),
        (22,"Marcenaria e mobiliário fixo (headboard, frigobar, bancadas)","marcenaria",14,[18]),
        (23,"Vidros e box de banheiro","vidros",5,[18]),
        (24,"Louças, metais, acessórios de banheiro","hidraulica",5,[18,22]),
        (25,"Iluminação de acabamento e cênica","eletrica",4,[18]),
        (26,"Comissionamento de sistemas","outro",3,[19,20,21,23,24,25]),
        (27,"Limpeza técnica","limpeza",2,[26]),
        (28,"Punch List e entrega","outro",2,[27]),
    ]),
}

for name, (segment, etapas) in templates.items():
    tid = psql_val(f"SELECT id FROM sequenciamento_templates WHERE name='{esc(name)}';")
    if tid:
        psql(f"DELETE FROM sequenciamento_etapas WHERE template_id='{tid}';")
        psql(f"UPDATE sequenciamento_templates SET segment='{segment}' WHERE id='{tid}';")
    else:
        psql(f"INSERT INTO sequenciamento_templates (id, name, segment) VALUES (gen_random_uuid(), '{esc(name)}', '{segment}');")
        tid = psql_val(f"SELECT id FROM sequenciamento_templates WHERE name='{esc(name)}';")
    for order, ename, disc, days, deps in etapas:
        deps_lit = "ARRAY[" + ",".join(f"'{d}'" for d in deps) + "]::text[]" if deps else "ARRAY[]::text[]"
        psql(f"INSERT INTO sequenciamento_etapas (id, template_id, name, discipline, \"order\", estimated_days, depends_on) VALUES (gen_random_uuid(), '{tid}', '{esc(ename)}', '{disc}', {order}, {days}, {deps_lit});")
    count = psql_val(f"SELECT count(*) FROM sequenciamento_etapas WHERE template_id='{tid}';")
    print(f"   ✓ {name}: {count} etapas")

# ─── 5. BÈR CHECKLISTS TEMPLATES ─────────────────────────────────────────────
print("5. BÈR Checklist templates...")
psql("DELETE FROM ber_checklist_template_items; DELETE FROM ber_checklist_templates;")
checklists = [
    ("CL_1","Relatório de Recebimento do Imóvel","unico","estrutura",[
        "Estado geral das paredes (fissuras, manchas, umidade)",
        "Estado do piso (tipo, nivelamento, danos)",
        "Estado do teto (infiltrações, manchas, fissuras)",
        "Instalações elétricas existentes (quadro, tomadas, pontos de luz)",
        "Instalações hidráulicas existentes (torneiras, vasos, ralos)",
        "Esquadrias (portas e janelas — estado e funcionamento)",
        "Vidros (estado, tipo, presença de películas)",
        "Revestimentos de banheiros e cozinha",
        "Estado de armários e marcenaria existente",
        "Condições do piso do corredor de acesso",
        "Estado do elevador de serviço",
        "Existência de itens a preservar pelo cliente",
        "Registro de medidas dos ambientes (L × C × H)",
        "Documentação do condomínio recebida (regulamento interno)",
        "Horários de obra autorizados pelo condomínio",
        "Ponto de abastecimento de água aprovado",
        "Rota de entulho aprovada com síndico",
    ]),
    ("CL_2","Visita de Qualidade","recorrente","outro",[
        "Canteiro organizado e limpo",
        "EPIs em uso por toda a equipe",
        "Proteção de áreas comuns íntegra",
        "Andamento conforme cronograma",
        "Ausência de materiais danificados ou mal armazenados",
        "Instalações elétricas e hidráulicas sem improvisações perigosas",
        "Registro fotográfico do avanço realizado",
        "Comunicação com síndico/gestora em dia",
        "Equipe identificada com colete BÈR",
        "Rota de entulho livre e sinalizada",
        "Ponto de água e energia aprovados em uso correto",
        "Ausência de reclamações abertas do condomínio",
        "Qualidade de execução visual: prumo, nível, acabamento",
        "Quadro de horários de obra afixado na entrada",
        "Limpeza do corredor ao final do dia",
        "Itens pendentes da última visita resolvidos",
    ]),
    ("CL_3","Visita de Segurança","recorrente","seguranca",[
        "Capacetes em uso em toda a equipe",
        "Botas de segurança em uso",
        "Óculos de proteção disponíveis e em uso quando necessário",
        "Luvas adequadas disponíveis",
        "Máscaras disponíveis (PFF2 para demolição/poeira)",
        "Extintores presentes e com validade",
        "Kit de primeiros socorros disponível",
        "Sinalização de segurança afixada",
        "Proteções de borda/queda instaladas onde necessário",
        "Ferramentas em bom estado (sem cabo quebrado, fio exposto)",
        "Quadro elétrico provisório com disjuntor e tampa",
        "Ausência de fios elétricos expostos ou improvisados",
        "Andaimes e escadas em bom estado e estabilizados",
        "Área de demolição isolada",
        "Descarte correto de resíduos químicos",
        "Colaboradores treinados para a atividade em execução",
        "NR-18 básica afixada no canteiro",
        "Contatos de emergência visíveis na entrada da obra",
        "Botão de corte geral de energia identificado e acessível",
        "Planilha de controle de EPIs atualizada",
    ]),
    ("CL_4","Antecipação de Pendências","unico","outro",[
        "Projetos executivos completos e aprovados (elétrico, hidráulico, AC)",
        "ART/RRT assinado e entregue",
        "Aprovação do condomínio por escrito",
        "Cronograma detalhado aprovado pelo cliente",
        "Fornecedores de materiais críticos confirmados (prazo de entrega)",
        "Marcenaria: medição confirmada e produção iniciada",
        "AC: especificação e compra realizadas",
        "Louças e metais: especificação e compra realizadas",
        "Revestimentos: especificação e quantidade confirmada",
        "Piso: especificação e quantidade confirmada com 10% de sobra",
        "Elétrica: materiais para quadro e circuitos disponíveis",
        "Impermeabilização: materiais disponíveis",
        "Telas e perfis de drywall: pedido colocado",
        "Forro: pedido colocado e prazo confirmado",
        "Vidros e divisórias: medição realizada e pedido colocado",
        "Pintura: cores aprovadas pelo cliente por escrito",
        "Iluminação: pontos e modelos definidos e aprovados",
        "Automação: projeto detalhado aprovado",
        "Limpeza técnica: empresa contratada ou equipe interna alocada",
        "Vistoria de entrega: data confirmada com cliente",
        "Manual de garantias: preparado para entrega",
        "Documentação final (ART, laudos, certificados): organizada",
        "Punch list preliminar: elaborado e validado internamente",
        "Fotos do antes: arquivadas no módulo Fotos",
        "Cliente informado sobre processo de entrega",
        "Chaves e acessórios: listados e preparados para entrega",
    ]),
    ("CL_5","Punch List com Cliente","unico","outro",[
        "Paredes: sem manchas, marcas ou danos",
        "Pintura: cobertura uniforme, sem emendas ou respingos",
        "Piso: nivelado, sem peças soltas ou sonoras, sem riscos",
        "Revestimentos: sem peças soltas, rejunte completo",
        "Forro: nivelado, sem manchas ou furos",
        "Elétrica: todas as tomadas e interruptores funcionando",
        "Iluminação: todas as luminárias funcionando",
        "Quadro elétrico: identificado, diagramado e com disjuntores corretos",
        "AC: funcionando, sem ruído anormal, dreno ok",
        "Hidráulica: sem vazamentos em 24h, descargas funcionando",
        "Louças e metais: fixos, sem manchas, sem vazamentos",
        "Marcenaria: portas e gavetas reguladas, amortecedores ok",
        "Vidros: sem marcas, riscados ou trincados",
        "Esquadrias: funcionando, sem folga excessiva",
        "Limpeza: piso brilhando, vidros limpos, sem respingos",
        "Documentação: manual de garantias, ARTs, laudos entregues",
        "Demonstração dos sistemas realizada ao cliente",
        "Áreas comuns: devolvidas no estado original",
    ]),
]

for code, name, tipo, discipline, items in checklists:
    psql(f"INSERT INTO ber_checklist_templates (id, code, name, tipo, discipline) VALUES (gen_random_uuid(), '{code}', '{esc(name)}', '{tipo}', '{discipline}');")
    tid = psql_val(f"SELECT id FROM ber_checklist_templates WHERE code='{code}';")
    for i, item in enumerate(items):
        psql(f"INSERT INTO ber_checklist_template_items (id, template_id, descricao, \"order\", requires_photo) VALUES (gen_random_uuid(), '{tid}', '{esc(item)}', {i+1}, false);")
count = psql_val("SELECT count(*) FROM ber_checklist_templates;")
items_count = psql_val("SELECT count(*) FROM ber_checklist_template_items;")
print(f"   ✓ {count} checklists, {items_count} itens")

# ─── 6. INSTRUÇÕES TÉCNICAS ───────────────────────────────────────────────────
print("6. Instruções Técnicas...")
# Reusa os dados do its-seed.py — importar o array ITS
import importlib.util, sys as _sys
seed_path = os.path.join(os.path.dirname(__file__), "its-seed.py")
if os.path.exists(seed_path):
    spec = importlib.util.spec_from_file_location("its_seed", seed_path)
    mod  = importlib.util.module_from_spec(spec)
    # Substituir DB e não executar o print/loop principal — apenas pegar ITS
    with open(seed_path) as f:
        src = f.read()
    # Extrair apenas a lista ITS
    exec_globals = {}
    # Find and exec only the ITS = [...] part
    start = src.find("ITS = [")
    end   = src.find("\nprint(", start)
    exec(src[start:end], exec_globals)
    ITS = exec_globals["ITS"]
    
    UID = psql_val("SELECT id FROM users WHERE email='luis.nuin@ber-engenharia.com.br';")
    psql("DELETE FROM instrucoes_tecnicas;")
    for it in ITS:
        code = it["code"]
        steps_json = json.dumps(it.get("steps", []), ensure_ascii=False)
        sql = f"""
        INSERT INTO instrucoes_tecnicas (
          id, code, title, discipline, fvs_code,
          normas, epis, pre_requisitos, criterios_qualidade, erros_comuns,
          steps, materials, tools, attention_points, approval_criteria,
          status, created_by, updated_by
        ) VALUES (
          gen_random_uuid(), '{it["code"]}', '{esc(it["title"])}',
          '{esc(it["discipline"])}', '{esc(it.get("fvs_code","") or "")}',
          {arr(it.get("normas",[]))}, {arr(it.get("epis",[]))},
          '{esc(it.get("pre_requisitos","") or "")}',
          '{esc(it.get("criterios_qualidade","") or "")}',
          '{esc(it.get("erros_comuns","") or "")}',
          $steps${steps_json}$steps$::jsonb,
          '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
          'publicada', '{UID}', '{UID}'
        );"""
        psql_stdin(sql)
    
    # Apply steps fix for ITs with encoding issues
    fix_path = os.path.join(os.path.dirname(__file__), "its-steps-fix.py")
    if os.path.exists(fix_path):
        exec_globals2 = {}
        with open(fix_path) as f:
            src2 = f.read()
        start2 = src2.find("STEPS = {")
        end2   = src2.find("\nprint(", start2)
        exec(src2[start2:end2], exec_globals2)
        STEPS = exec_globals2["STEPS"]
        for fix_code, steps in STEPS.items():
            steps_json = json.dumps(steps, ensure_ascii=False)
            sql = f"UPDATE instrucoes_tecnicas SET steps = $s${steps_json}$s$::jsonb WHERE code='{fix_code}';"
            psql_stdin(sql)
    
    count = psql_val("SELECT count(*) FROM instrucoes_tecnicas;")
    print(f"   ✓ {count} ITs")
else:
    print("   ⚠ its-seed.py não encontrado, pulando ITs")

# ─── RESUMO ───────────────────────────────────────────────────────────────────
print("\n=== Resumo final ===")
for table in ["users","obras","fvs_templates","fvs_template_items","sequenciamento_templates","sequenciamento_etapas","ber_checklist_templates","ber_checklist_template_items","instrucoes_tecnicas"]:
    count = psql_val(f"SELECT count(*) FROM {table};")
    print(f"  {table}: {count}")
print("\n✅ Seed Railway concluído!")
