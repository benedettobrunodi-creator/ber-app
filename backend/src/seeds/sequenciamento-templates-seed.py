#!/usr/bin/env python3
"""Reseed dos templates de sequenciamento BÈR — Corporativo, Residencial, Hoteleiro."""
import subprocess, sys, json

DB = "postgresql://ber:ber2026@localhost:5432/ber_app"

def psql(sql):
    r = subprocess.run(["psql", DB, "-c", sql], capture_output=True, text=True)
    if r.returncode != 0 and "ERROR" in r.stderr:
        print(f"SQL ERR: {r.stderr[:300]}", file=sys.stderr)
    return r.stdout

def psql_val(sql):
    r = subprocess.run(["psql", DB, "-t", "-c", sql], capture_output=True, text=True)
    return r.stdout.strip()

def escape(s):
    return s.replace("'", "''")

# ─── Template data ─────────────────────────────────────────────────────────────
# Each etapa: (order, name, discipline, estimated_days, depends_on[])
# depends_on is list of 1-based orders

TEMPLATES = {
    "Corporativo": {
        "segment": "corporativo",
        "etapas": [
            (1,  "Vistoria e Relatório de Recebimento do Imóvel",          "estrutura",          1,  []),
            (2,  "Mobilização de Canteiro",                                 "outro",              2,  []),
            (3,  "Proteção de áreas comuns e rota de entulho",              "outro",              1,  []),
            (4,  "Demolições e remoções",                                   "alvenaria",          5,  [2,3]),
            (5,  "Regularização de piso / Contrapiso",                      "revestimento",       4,  [4]),
            (6,  "Impermeabilização (banheiros/copas)",                     "impermeabilizacao",  5,  [4]),
            (7,  "Hidráulica bruta",                                        "hidraulica",         8,  [4]),
            (8,  "Elétrica bruta",                                          "eletrica",           10, [4]),
            (9,  "Ar condicionado — infra e equipamentos",                  "ar_condicionado",    8,  [4]),
            (10, "Sprinkler — despressurização e adaptação",                "outro",              5,  [4]),
            (11, "SDAI/CFTV/Alarme — infra bruta",                         "eletrica",           4,  [4]),
            (12, "Cabeamento estruturado / TI",                             "eletrica",           5,  [4]),
            (13, "Drywall e vedações",                                      "alvenaria",          10, [5,6,7,8,9,10,11,12]),
            (14, "Forro (gesso/drywall/modular)",                           "acabamento",         8,  [13]),
            (15, "Revestimentos de parede (banheiros/copas)",               "revestimento",       6,  [6,13]),
            (16, "Piso (porcelanato/vinílico/carpete)",                     "revestimento",       10, [5,13]),
            (17, "Pintura (massa corrida + tinta)",                         "acabamento",         8,  [14,15,16]),
            (18, "Elétrica de acabamento (tomadas/interruptores/luminárias)","eletrica",          6,  [14,17]),
            (19, "AC — acabamento (difusores, fancoils)",                   "ar_condicionado",    3,  [14]),
            (20, "SDAI/CFTV — acabamento (rósulas/câmeras)",                "eletrica",           3,  [14]),
            (21, "Marcenaria e mobiliário fixo",                            "marcenaria",         12, [17]),
            (22, "Vidros e divisórias de vidro",                            "vidros",             5,  [17]),
            (23, "Louças, metais e bancadas",                               "hidraulica",         4,  [17,21]),
            (24, "Comissionamento de sistemas",                             "outro",              3,  [18,19,20,22,23]),
            (25, "Limpeza técnica",                                         "limpeza",            2,  [24]),
            (26, "Punch List e entrega ao cliente",                         "outro",              2,  [25]),
        ]
    },
    "Hoteleiro": {
        "segment": "hoteleiro",
        "etapas": [
            (1,  "Vistoria e Relatório de Recebimento do Imóvel",           "estrutura",         1,  []),
            (2,  "Mobilização de Canteiro",                                  "outro",             2,  []),
            (3,  "Proteção de áreas comuns",                                 "outro",             1,  []),
            (4,  "Demolições e remoções",                                    "alvenaria",         5,  [2,3]),
            (5,  "Impermeabilização (banheiros)",                            "impermeabilizacao", 5,  [4]),
            (6,  "Hidráulica bruta",                                         "hidraulica",        8,  [4]),
            (7,  "Elétrica bruta",                                           "eletrica",          10, [4]),
            (8,  "Ar condicionado — infra e fan coils",                      "ar_condicionado",   8,  [4]),
            (9,  "Sprinkler — despressurização e adaptação",                 "outro",             5,  [4]),
            (10, "SDAI/Alarme/CFTV — infra",                                "eletrica",          4,  [4]),
            (11, "Automação de quarto (controle de ambiente)",               "eletrica",          5,  [4]),
            (12, "Cabeamento estruturado / TV/Telefonia",                    "eletrica",          4,  [4]),
            (13, "Contrapiso e regularização",                               "revestimento",      4,  [4]),
            (14, "Drywall e vedações",                                       "alvenaria",         10, [5,6,7,8,9,10,11,12,13]),
            (15, "Forro",                                                    "acabamento",        8,  [14]),
            (16, "Revestimentos de parede (banheiros)",                      "revestimento",      8,  [5,14]),
            (17, "Piso (porcelanato/vinílico/carpete)",                      "revestimento",      10, [13,14]),
            (18, "Pintura",                                                  "acabamento",        8,  [15,16,17]),
            (19, "Elétrica de acabamento",                                   "eletrica",          6,  [15,18]),
            (20, "AC — acabamento",                                          "ar_condicionado",   3,  [15]),
            (21, "SDAI/CFTV — acabamento",                                   "eletrica",          3,  [15]),
            (22, "Marcenaria e mobiliário fixo (headboard, frigobar, bancadas)","marcenaria",    14, [18]),
            (23, "Vidros e box de banheiro",                                 "vidros",            5,  [18]),
            (24, "Louças, metais, acessórios de banheiro",                   "hidraulica",        5,  [18,22]),
            (25, "Iluminação de acabamento e cênica",                        "eletrica",          4,  [18]),
            (26, "Comissionamento de sistemas",                              "outro",             3,  [19,20,21,23,24,25]),
            (27, "Limpeza técnica",                                          "limpeza",           2,  [26]),
            (28, "Punch List e entrega",                                     "outro",             2,  [27]),
        ]
    },
    "Residencial": {
        "segment": "residencial",
        "etapas": [
            (1,  "Vistoria e Relatório de Recebimento do Imóvel",            "estrutura",         1, []),
            (2,  "Mobilização de Canteiro",                                   "outro",             1, []),
            (3,  "Demolições e remoções",                                     "alvenaria",         4, [2]),
            (4,  "Impermeabilização (banheiros/área de serviço)",             "impermeabilizacao", 5, [3]),
            (5,  "Hidráulica bruta",                                          "hidraulica",        7, [3]),
            (6,  "Elétrica bruta",                                            "eletrica",          8, [3]),
            (7,  "Ar condicionado (splits) — infra",                         "ar_condicionado",   4, [3]),
            (8,  "Contrapiso e regularização",                                "revestimento",      4, [3]),
            (9,  "Drywall e alvenaria complementar",                          "alvenaria",         8, [4,5,6,7,8]),
            (10, "Forro (onde houver)",                                       "acabamento",        5, [9]),
            (11, "Revestimentos de parede (banheiros/cozinha)",               "revestimento",      8, [4,9]),
            (12, "Piso",                                                      "revestimento",      8, [8,9]),
            (13, "Pintura (massa corrida + tinta)",                           "acabamento",        7, [10,11,12]),
            (14, "Elétrica de acabamento",                                    "eletrica",          5, [10,13]),
            (15, "AC — acabamento e testes",                                  "ar_condicionado",   2, [10]),
            (16, "Marcenaria e mobiliário fixo",                              "marcenaria",        10,[13]),
            (17, "Vidros e esquadrias",                                       "vidros",            4, [13]),
            (18, "Louças, metais e bancadas",                                 "hidraulica",        4, [13,16]),
            (19, "Limpeza",                                                   "limpeza",           2, [14,15,16,17,18]),
            (20, "Punch List e entrega",                                      "outro",             1, [19]),
        ]
    }
}

print("=== Reseed Sequenciamento Templates ===\n")

for tmpl_name, tmpl_data in TEMPLATES.items():
    segment = tmpl_data["segment"]
    etapas  = tmpl_data["etapas"]

    # Check if exists
    tid = psql_val(f"SELECT id FROM sequenciamento_templates WHERE name='{escape(tmpl_name)}';")

    if tid:
        # Delete existing etapas and update
        psql(f"DELETE FROM sequenciamento_etapas WHERE template_id='{tid}';")
        psql(f"UPDATE sequenciamento_templates SET segment='{segment}' WHERE id='{tid}';")
        print(f"  Updated: {tmpl_name} (id={tid[:8]})")
    else:
        psql(f"INSERT INTO sequenciamento_templates (id, name, segment) VALUES (gen_random_uuid(), '{escape(tmpl_name)}', '{segment}');")
        tid = psql_val(f"SELECT id FROM sequenciamento_templates WHERE name='{escape(tmpl_name)}';")
        print(f"  Created: {tmpl_name} (id={tid[:8]})")

    # Build depends_on as postgres array
    # We'll insert by order, and depends_on stores order numbers as strings
    for (order, name, discipline, days, deps) in etapas:
        # depends_on is text[] storing order numbers as strings
        if deps:
            deps_literal = "ARRAY[" + ",".join(f"'{d}'" for d in deps) + "]::text[]"
        else:
            deps_literal = "ARRAY[]::text[]"
        sql = f"""
        INSERT INTO sequenciamento_etapas
          (id, template_id, name, discipline, "order", estimated_days, depends_on)
        VALUES (
          gen_random_uuid(), '{tid}',
          '{escape(name)}', '{discipline}',
          {order}, {days}, {deps_literal}
        );"""
        psql(sql)

    # Verify
    count = psql_val(f"SELECT count(*) FROM sequenciamento_etapas WHERE template_id='{tid}';")
    print(f"    → {count} etapas inseridas")

print("\n=== Verificação final ===")
r = subprocess.run(["psql", DB, "-c",
    "SELECT t.name, t.segment, count(e.id) as etapas FROM sequenciamento_templates t LEFT JOIN sequenciamento_etapas e ON e.template_id=t.id GROUP BY t.id, t.name, t.segment ORDER BY t.name;"],
    capture_output=True, text=True)
print(r.stdout)
