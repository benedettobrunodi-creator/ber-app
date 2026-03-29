#!/usr/bin/env python3
"""Seed BÈR Checklists — 5 templates completos."""
import subprocess, sys

DB = "postgresql://ber:ber2026@localhost:5432/ber_app"

def psql(sql):
    r = subprocess.run(["psql", DB, "-c", sql], capture_output=True, text=True)
    if r.returncode != 0: print(f"ERR: {r.stderr[:200]}", file=sys.stderr)
    return r.stdout

def get_id(table, where):
    r = subprocess.run(["psql", DB, "-t", "-c", f"SELECT id FROM {table} WHERE {where} LIMIT 1;"], capture_output=True, text=True)
    return r.stdout.strip()

TEMPLATES = [
  ("CL_1", "Relatório de Recebimento do Imóvel", False),
  ("CL_2", "Check List de Visitas de Qualidade",  True),
  ("CL_3", "Check List de Visitas de Segurança",  True),
  ("CL_4", "Check List de Antecipação de Pendências", False),
  ("CL_5", "Check List de Pendências com o Cliente (Punch List)", False),
]

# items: (secao, descricao, foto_obrigatoria, ordem)
ITEMS = {
"CL_1": [
  ("Identificação","Data e hora do recebimento registradas",True,1),
  ("Identificação","Presentes: engenheiro BÈR, representante do condomínio/gestora, cliente ou representante",False,2),
  ("Estado geral do imóvel","Paredes (manchas, trincas, umidade)",True,3),
  ("Estado geral do imóvel","Pisos (arranhões, peças quebradas, desnivelamentos)",True,4),
  ("Estado geral do imóvel","Teto/forro (manchas, trincas, peças faltando)",True,5),
  ("Estado geral do imóvel","Esquadrias e vidros (riscos, danos, funcionamento)",True,6),
  ("Estado geral do imóvel","Portas e fechaduras (funcionamento, danos)",True,7),
  ("Estado geral do imóvel","Banheiros (louças, metais, vazamentos, funcionamento)",True,8),
  ("Instalações existentes","Elétrica (QDL identificado, pontos funcionando)",True,9),
  ("Instalações existentes","Hidráulica (sem vazamentos visíveis)",True,10),
  ("Instalações existentes","AC (equipamentos existentes identificados)",True,11),
  ("Instalações existentes","SDAI e sprinkler (estado visual)",True,12),
  ("Acessos e infraestrutura","Elevador de carga disponível e em bom estado",True,13),
  ("Acessos e infraestrutura","Área para canteiro identificada",False,14),
  ("Acessos e infraestrutura","Acesso de materiais mapeado",False,15),
  ("Conclusão","Não conformidades existentes listadas",False,16),
  ("Conclusão","Relatório assinado pelo cliente e pelo condomínio",False,17),
],
"CL_2": [
  ("Identificação da visita","Data e hora da visita",False,1),
  ("Identificação da visita","Responsável pela visita (nome + função)",False,2),
  ("Identificação da visita","Fase atual da obra (bloco do sequenciamento)",False,3),
  ("Segurança e organização","EPI's sendo utilizados por toda a equipe",True,4),
  ("Segurança e organização","Área de obra organizada e limpa",True,5),
  ("Segurança e organização","Materiais armazenados corretamente",True,6),
  ("Segurança e organização","Sinalização de segurança no local",True,7),
  ("Qualidade de execução","Serviços em andamento conferidos com o projeto",True,8),
  ("Qualidade de execução","Alinhamento, nivelamento e prumo verificados",True,9),
  ("Qualidade de execução","Materiais utilizados conferem com a especificação",True,10),
  ("Qualidade de execução","Proteções de áreas concluídas estão mantidas (pisos, vidros)",True,11),
  ("Pendências e não conformidades","Não conformidades identificadas fotografadas e registradas",True,12),
  ("Pendências e não conformidades","Prazo de correção definido para cada NC",False,13),
  ("Pendências e não conformidades","NCs da visita anterior foram resolvidas?",False,14),
  ("Conclusão","Responsável técnico ciente das observações",False,15),
  ("Conclusão","Próxima visita agendada",False,16),
],
"CL_3": [
  ("Identificação da visita","Data e hora da visita",False,1),
  ("Identificação da visita","Responsável pela visita (nome + função)",False,2),
  ("Identificação da visita","Número de trabalhadores no local no momento da visita",False,3),
  ("EPI e equipamentos","Capacetes sendo utilizados por todos",True,4),
  ("EPI e equipamentos","Botas de segurança sendo utilizadas",True,5),
  ("EPI e equipamentos","Luvas disponíveis e em uso nas atividades que exigem",True,6),
  ("EPI e equipamentos","Óculos de proteção em uso nas atividades que exigem",True,7),
  ("EPI e equipamentos","Extintores no local, dentro do prazo e acessíveis",True,8),
  ("EPI e equipamentos","Kit de primeiros socorros completo e acessível",True,9),
  ("Condições do ambiente","Passagens desobstruídas e iluminadas",True,10),
  ("Condições do ambiente","Piso sem entulho ou materiais soltos que causem queda",True,11),
  ("Condições do ambiente","Cabos e fiações elétricas provisórias seguras (sem exposição)",True,12),
  ("Condições do ambiente","Escadas e andaimes em bom estado e fixados",True,13),
  ("Condições do ambiente","Área delimitada e sinalizada corretamente",True,14),
  ("Riscos específicos","Trabalho em altura com EPI adequado (cinto, trava-queda)",True,15),
  ("Riscos específicos","Ferramentas elétricas em bom estado (sem fios expostos)",True,16),
  ("Riscos específicos","Armazenamento de produtos químicos/inflamáveis adequado",True,17),
  ("Conclusão","Não conformidades de segurança registradas e responsável notificado",False,18),
  ("Conclusão","Prazo de correção definido (NCs de segurança: correção imediata)",False,19),
  ("Conclusão","Próxima visita agendada",False,20),
],
"CL_4": [
  ("Identificação","Data da vistoria interna",False,1),
  ("Identificação","Responsável (Gestor + Coordenador)",False,2),
  ("Identificação","Data prevista de entrega ao cliente",False,3),
  ("Instalações","Todos os pontos elétricos testados e funcionando",True,4),
  ("Instalações","Todos os pontos hidráulicos sem vazamento",True,5),
  ("Instalações","AC testado em todos os ambientes (frio/quente)",True,6),
  ("Instalações","Luminárias 100% instaladas e funcionando",True,7),
  ("Instalações","SDAI e sprinkler operacionais",True,8),
  ("Instalações","Controle de acesso funcionando",True,9),
  ("Acabamentos","Paredes sem danos, manchas ou retoques pendentes",True,10),
  ("Acabamentos","Forro sem trincas, manchas ou desnivelamentos",True,11),
  ("Acabamentos","Pisos sem arranhões, peças soltas ou manchas",True,12),
  ("Acabamentos","Marcenaria funcionando (portas, gavetas, puxadores)",True,13),
  ("Acabamentos","Vidros e esquadrias sem riscos, funcionando",True,14),
  ("Acabamentos","Divisórias sem danos, portas funcionando",True,15),
  ("Acabamentos","Persianas instaladas e funcionando",True,16),
  ("Acabamentos","Louças e metais instalados e sem vazamentos",True,17),
  ("Limpeza","Limpeza fina concluída em todos os ambientes",True,18),
  ("Limpeza","Vidros limpos (sem manchas de cimento ou silicone)",True,19),
  ("Limpeza","Áreas comuns do condomínio limpas",True,20),
  ("Documentação","ARTs de todos os sistemas emitidas e arquivadas",False,21),
  ("Documentação","Manuais dos equipamentos organizados",False,22),
  ("Documentação","Garantias dos fornecedores registradas",False,23),
  ("Documentação","Planta as-built atualizada",False,24),
  ("Lista de pendências","Pendências identificadas listadas com responsável e prazo de correção",False,25),
  ("Lista de pendências","Prazo de correção dentro do cronograma de entrega",False,26),
],
"CL_5": [
  ("Identificação","Data e hora da vistoria com o cliente",False,1),
  ("Identificação","Presentes: Gestor BÈR, Coordenador BÈR, cliente ou representante",False,2),
  ("Identificação","Obra: nome, endereço, número do contrato",False,3),
  ("Vistoria por ambiente","Paredes — estado geral aprovado pelo cliente",True,4),
  ("Vistoria por ambiente","Piso — estado geral aprovado pelo cliente",True,5),
  ("Vistoria por ambiente","Forro — estado geral aprovado pelo cliente",True,6),
  ("Vistoria por ambiente","Esquadrias e vidros — funcionamento aprovado",True,7),
  ("Vistoria por ambiente","Elétrica — tomadas, interruptores e luminárias testados na presença do cliente",True,8),
  ("Vistoria por ambiente","Hidráulica — torneiras, ralos e descargas testados na presença do cliente",True,9),
  ("Vistoria por ambiente","AC — testado na presença do cliente",True,10),
  ("Vistoria por ambiente","Marcenaria — aberturas, gavetas e puxadores testados",True,11),
  ("Vistoria por ambiente","Divisórias — portas e fechaduras testadas",True,12),
  ("Pendências identificadas pelo cliente","Cada pendência apontada registrada com: descrição, foto, ambiente, prazo de correção",True,13),
  ("Pendências identificadas pelo cliente","Prazo global de correção acordado com o cliente",False,14),
  ("Entrega formal","Chaves e acessos entregues ao cliente",False,15),
  ("Entrega formal","Manuais e garantias entregues ao cliente",False,16),
  ("Entrega formal","Termo de Aceite Provisório assinado pelo cliente",False,17),
  ("Entrega formal","Próximo contato agendado (verificação das pendências corrigidas)",False,18),
],
}

print("Seeding BÈR Checklist templates...")
for (code, name, recorrente) in TEMPLATES:
    psql(f"""
      INSERT INTO ber_checklist_templates (code, name, recorrente)
      VALUES ('{code}', $${name}$$, {'true' if recorrente else 'false'})
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, recorrente=EXCLUDED.recorrente;
    """)
    print(f"  {code}: {name}")

print("\nSeeding items...")
for code, items in ITEMS.items():
    tid = get_id("ber_checklist_templates", f"code='{code}'")
    if not tid: print(f"  SKIP {code}"); continue
    psql(f"DELETE FROM ber_checklist_template_items WHERE template_id='{tid}';")
    for (secao, descricao, foto_obr, ordem) in items:
        s = secao.replace("'","''")
        d = descricao.replace("'","''")
        psql(f"INSERT INTO ber_checklist_template_items (template_id,secao,descricao,foto_obrigatoria,ordem) VALUES ('{tid}','{s}','{d}',{'true' if foto_obr else 'false'},{ordem});")
    print(f"  {code}: {len(items)} itens")

r = subprocess.run(["psql", DB, "-c",
  "SELECT t.code, count(i.id) as items FROM ber_checklist_templates t LEFT JOIN ber_checklist_template_items i ON i.template_id=t.id GROUP BY t.code ORDER BY t.code;"],
  capture_output=True, text=True)
print("\n=== Verification ===")
print(r.stdout)
