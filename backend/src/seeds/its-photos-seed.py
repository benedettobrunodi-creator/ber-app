#!/usr/bin/env python3
"""
Busca fotos ilustrativas via Tavily para steps específicos das ITs.
Atualiza o campo photoUrl no JSONB steps do banco.
"""
import subprocess, sys, json, time, urllib.request, urllib.parse

DB      = "postgresql://ber:ber2026@localhost:5432/ber_app"
TAVILY  = "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"

# Steps que devem ter foto: {code: [step_order, ...]}
TARGETS = {
    "IT-04": [3],    # Reforço de cantos e ralos
    "IT-05": [10],   # Teste e energização
    "IT-06": [4, 9], # Tubulação de cobre / Vácuo
    "IT-10": [5],    # Acabamento contrapiso
    "IT-11": [7],    # Fixação das placas drywall
    "IT-12": [7],    # Fixação das placas forro
    "IT-13": [10],   # Rejuntamento
    "IT-16": [3, 6], # Fixação módulos / Tampos e puxadores
    "IT-17": [3],    # Instalação vidro temperado
    "IT-18": [3],    # Torneiras e metais
}

# Queries de busca por step (IT-code, order)
QUERIES = {
    ("IT-04", 3):  "impermeabilização tela reforço canto ralo banheiro",
    ("IT-05", 10): "teste elétrico multímetro circuito tomada",
    ("IT-06", 4):  "tubulação cobre ar condicionado isolamento térmico",
    ("IT-06", 9):  "bomba vácuo ar condicionado manômetro instalação",
    ("IT-10", 5):  "desempenadeira contrapiso regularização piso obra",
    ("IT-11", 7):  "drywall fixação placa parafuso montante",
    ("IT-12", 7):  "forro gesso drywall fixação placa",
    ("IT-13", 10): "rejuntamento porcelanato epóxi banheiro",
    ("IT-16", 3):  "marcenaria armário fixação parede parafuso",
    ("IT-16", 6):  "bancada granito instalação cozinha silicone",
    ("IT-17", 3):  "divisória vidro temperado instalação ventosa",
    ("IT-18", 3):  "torneira instalação bancada tubo flexível teflon",
}

def psql_get(code):
    r = subprocess.run(["psql", DB, "-t", "-c",
        f"SELECT steps FROM instrucoes_tecnicas WHERE code='{code}';"],
        capture_output=True, text=True)
    return json.loads(r.stdout.strip())

def psql_update(code, steps):
    steps_json = json.dumps(steps, ensure_ascii=False)
    sql = f"UPDATE instrucoes_tecnicas SET steps = $s${steps_json}$s$::jsonb WHERE code='{code}';"
    r = subprocess.run(["psql", DB], input=sql, capture_output=True, text=True)
    return "UPDATE 1" in r.stdout

def tavily_image(query):
    """Busca imagem via Tavily search e retorna a primeira URL de imagem encontrada."""
    try:
        payload = json.dumps({
            "api_key": TAVILY,
            "query": query,
            "search_depth": "basic",
            "include_images": True,
            "max_results": 3,
        }).encode()
        req = urllib.request.Request(
            "https://api.tavily.com/search",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            images = data.get("images", [])
            if images:
                # Filtrar apenas URLs de imagem válidas
                for img in images:
                    url = img if isinstance(img, str) else img.get("url", "")
                    if url and any(url.lower().endswith(ext) for ext in [".jpg",".jpeg",".png",".webp"]):
                        return url
                # Se nenhuma tem extensão clara, pegar a primeira
                first = images[0]
                return first if isinstance(first, str) else first.get("url", "")
    except Exception as e:
        print(f"    Tavily err: {e}", file=sys.stderr)
    return None

print("=== Seed de fotos nas ITs (Tavily) ===\n")
total_ok = 0

for code, orders in TARGETS.items():
    steps = psql_get(code)
    changed = False
    for order in orders:
        idx = next((i for i, s in enumerate(steps) if s.get("order") == order), None)
        if idx is None:
            print(f"  ⚠ {code} step {order} — não encontrado")
            continue
        # Já tem foto?
        if steps[idx].get("photoUrl"):
            print(f"  → {code} step {order} — já tem foto, pulando")
            continue
        query = QUERIES.get((code, order), f"{code} passo {order} construção obra")
        print(f"  🔍 {code} step {order} — '{query}'")
        url = tavily_image(query)
        if url:
            steps[idx]["photoUrl"] = url
            changed = True
            total_ok += 1
            print(f"       ✓ {url[:70]}")
        else:
            print(f"       ✗ sem resultado")
        time.sleep(0.5)  # rate limit
    
    if changed:
        ok = psql_update(code, steps)
        print(f"  {'✓' if ok else '✗'} {code} atualizado no banco\n")

print(f"\n=== Concluído: {total_ok} fotos adicionadas ===")
