# BRIEF — Módulo de Fotos BÈR App
> Aprovado por Bruno Di Benedetto em 29/03/2026

---

## Conceito

Banco de evidências visuais por ambiente + categoria + evolução temporal.
NÃO é diário de obra (o ERP já tem isso). É documentação de qualidade e rastreabilidade.

---

## Fluxo completo

### 1. Setup da obra (uma vez, na criação ou configuração)

- Upload da planta baixa (PDF ou imagem JPG/PNG)
- Modo "Mapear ambientes": clica em qualquer ponto da planta e nomeia o ambiente
- Cada ambiente vira um pin numerado/colorido na planta
- Exemplos: Sala de Reunião 1, Copa, Corredor Principal, Recepção, Banheiro M, Banheiro F, Sala TI, etc.
- Pins podem ser editados ou removidos depois

### 2. Adicionar foto

- Botão "+ Foto" na aba Fotos
- Fluxo:
  1. Upload da foto (câmera ou galeria, múltiplas de uma vez)
  2. Escolher ambiente: clica no pin na planta (miniatura)
  3. Escolher categoria: Geral | Canteiro | Demolição | Elétrica | Hidráulica | AC/HVAC | Drywall | Forro | Piso | Pintura | Marcenaria | Entrega | Sem categoria
  4. Legenda opcional
  5. Data: automática (hoje), editável
  6. Se já existe foto desse ambiente + categoria: mostrar a foto anterior como referência ("foto anterior — mesmo ângulo")

### 3. Visualização

**Vista Planta (padrão):**
- Mostra a planta com os pins
- Cada pin tem badge com número de fotos
- Clica no pin → abre painel lateral com todas as fotos daquele ambiente
- Dentro do painel: filtro por categoria + timeline cronológica

**Vista Grid:**
- Toggle para ver todas as fotos em grid
- Filtros: por ambiente + por categoria + por data

**Fullscreen:**
- Clica em qualquer foto → abre fullscreen
- Mostra: foto, ambiente, categoria, data, quem enviou, legenda
- Seta para navegar entre fotos do mesmo ambiente
- Botão excluir (com confirmação)

---

## Banco de dados

```
obra_plantas (id, obra_id, file_url, created_at)
obra_ambientes (id, obra_id, planta_id, nome, pos_x FLOAT, pos_y FLOAT, cor)
obra_fotos (id, obra_id, ambiente_id, categoria, file_url, legenda, tirada_por, tirada_em, created_at)
```

---

## Categorias padrão

- Geral / Diário
- Canteiro / Mobilização
- Demolição
- Elétrica
- Hidráulica
- AC / HVAC
- Drywall / Vedações
- Forro
- Piso / Revestimento
- Pintura
- Marcenaria
- Acabamento Final
- Entrega
- Sem categoria

---

## Regras de implementação

1. Planta: renderizar como imagem no canvas, com pins clicáveis em posições relativas (% do tamanho)
2. Compressão automática no upload (max 1MB por foto, qualidade 80%)
3. "Foto anterior de referência": ao adicionar foto de ambiente+categoria já existente, mostrar a última foto desse combo
4. Pins com cores: verde = tem fotos recentes (+7 dias), amarelo = fotos antigas (>7 dias), cinza = sem fotos
5. Mobile-first: upload via câmera nativa do celular
