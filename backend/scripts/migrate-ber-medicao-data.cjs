#!/usr/bin/env node
/**
 * Migra dados do ber-medicao (Supabase) pro ber-app (Railway).
 *
 * Idempotente: ON CONFLICT (id) DO NOTHING em tudo.
 * Preserva UUIDs originais → tokens públicos das medições e do portal cliente
 * continuam funcionando após cutover.
 *
 * Uso:
 *   MEDICAO_DIRECT_URL=postgresql://... \
 *   BERAPP_DATABASE_URL=postgresql://... \
 *   node backend/scripts/migrate-ber-medicao-data.cjs [--dry-run]
 *
 * Mapeamento de obras confirmado pelo Bruno em 2026-06-22.
 */

const { Client } = require('pg');

const OBRA_MAP = {
  'd0a67caf-9a7e-48e0-9e81-e26b3c693684': 'e9a5785d-d76e-4c0e-bd36-93689a85d15a', // Blue Tree Morumbi
  'e1582e4b-0d6d-49c6-b744-618d12f2e993': '102fa4a9-d381-4e8c-8323-370776f59e1c', // 576.26 Stonex campinas
  'db463388-6609-4402-85a0-e9b50858bb23': '25450fa8-c04d-404d-aab9-3212227f5732', // 586.26 Ifood Sala Propus
  'ed5df9eb-5744-42d0-8cc1-021c065b40e9': 'cb6d648b-79d9-4052-8599-515a399f5084', // 445.25 → 442.25 Diogo e Nathalia
  '462ad2da-1ee3-49ff-b43a-a4ffd98bdad3': 'be42b46f-0a1d-414d-b7f7-b3e45de6a3dc', // Duo → 573.26 Leila e Orlando
};

const DRY_RUN = process.argv.includes('--dry-run');

function mapObra(id) {
  return OBRA_MAP[id] ?? null;
}

async function run() {
  if (!process.env.MEDICAO_DIRECT_URL || !process.env.BERAPP_DATABASE_URL) {
    console.error('Defina MEDICAO_DIRECT_URL e BERAPP_DATABASE_URL');
    process.exit(1);
  }

  const src = new Client({ connectionString: process.env.MEDICAO_DIRECT_URL });
  const dst = new Client({ connectionString: process.env.BERAPP_DATABASE_URL });
  await src.connect();
  await dst.connect();

  console.log(`[migrate] dry-run=${DRY_RUN}`);

  await dst.query('BEGIN');
  try {
    // ── 1. Estender Obra com contratoValor / prazoPagamentoDias / retencaoPercentual ──
    const obras = (await src.query(
      'SELECT id, contrato_valor, prazo_pagamento_dias, retencao_percentual FROM obras WHERE id = ANY($1)',
      [Object.keys(OBRA_MAP)],
    )).rows;
    for (const o of obras) {
      const tid = mapObra(o.id);
      console.log(`[obra] ${o.id} → ${tid} valor=${o.contrato_valor} prazo=${o.prazo_pagamento_dias} ret=${o.retencao_percentual}`);
      if (!DRY_RUN) {
        await dst.query(
          `UPDATE obras
             SET valor_contrato       = COALESCE(valor_contrato, $1),
                 prazo_pagamento_dias = $2,
                 retencao_percentual  = $3
           WHERE id = $4`,
          [o.contrato_valor, o.prazo_pagamento_dias, o.retencao_percentual, tid],
        );
      }
    }

    // ── 2. Etapas ──
    const etapas = (await src.query(
      'SELECT id, obra_id, ordem, nome, descricao, contrato_valor, fornecedores_completos, excel_linha FROM etapas WHERE obra_id = ANY($1)',
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[etapas] ${etapas.length}`);
    for (const e of etapas) {
      const tid = mapObra(e.obra_id);
      if (!tid || DRY_RUN) continue;
      await dst.query(
        `INSERT INTO etapas (id, obra_id, ordem, nome, descricao, contrato_valor, fornecedores_completos, excel_linha)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, tid, e.ordem, e.nome, e.descricao, e.contrato_valor, e.fornecedores_completos, e.excel_linha],
      );
    }

    // ── 3. Fornecedores ──
    const fornecedores = (await src.query(
      'SELECT id, obra_id, razao_social, cnpj, contato FROM fornecedores WHERE obra_id = ANY($1)',
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[fornecedores] ${fornecedores.length}`);
    for (const f of fornecedores) {
      const tid = mapObra(f.obra_id);
      if (!tid || DRY_RUN) continue;
      await dst.query(
        `INSERT INTO fornecedores (id, obra_id, razao_social, cnpj, contato)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, tid, f.razao_social, f.cnpj, f.contato],
      );
    }

    // ── 4. EtapaFornecedores ──
    const ef = (await src.query(
      `SELECT ef.id, ef.etapa_id, ef.fornecedor_id, ef.escopo, ef.tipo, ef.valor_contratado
         FROM etapa_fornecedores ef
         JOIN etapas e ON e.id = ef.etapa_id
        WHERE e.obra_id = ANY($1)`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[etapa_fornecedores] ${ef.length}`);
    for (const x of ef) {
      if (DRY_RUN) continue;
      await dst.query(
        `INSERT INTO etapa_fornecedores (id, etapa_id, fornecedor_id, escopo, tipo, valor_contratado)
         VALUES ($1,$2,$3,$4,$5::"EtapaFornecedorTipo",$6)
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.etapa_id, x.fornecedor_id, x.escopo, x.tipo, x.valor_contratado],
      );
    }

    // ── 5. Medições (preserva token_publico → magic links continuam) ──
    const medicoes = (await src.query(
      `SELECT id, obra_id, numero, periodo_inicio, periodo_fim, status, token_publico,
              data_pagamento_prevista, data_pagamento_realizado, created_at
         FROM medicoes WHERE obra_id = ANY($1)`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[medicoes] ${medicoes.length}`);
    for (const m of medicoes) {
      const tid = mapObra(m.obra_id);
      if (!tid || DRY_RUN) continue;
      await dst.query(
        `INSERT INTO medicoes (id, obra_id, numero, periodo_inicio, periodo_fim, status, token_publico,
                               data_pagamento_prevista, data_pagamento_realizado, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::"MedicaoStatus",$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          m.id, tid, m.numero, m.periodo_inicio, m.periodo_fim, m.status,
          m.token_publico, m.data_pagamento_prevista, m.data_pagamento_realizado, m.created_at,
        ],
      );
    }

    // ── 6. MedicaoItens ──
    const itens = (await src.query(
      `SELECT mi.id, mi.medicao_id, mi.etapa_fornecedor_id, mi.valor_quinzena, mi.percentual_acumulado
         FROM medicao_itens mi
         JOIN medicoes m ON m.id = mi.medicao_id
        WHERE m.obra_id = ANY($1)`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[medicao_itens] ${itens.length}`);
    for (const i of itens) {
      if (DRY_RUN) continue;
      await dst.query(
        `INSERT INTO medicao_itens (id, medicao_id, etapa_fornecedor_id, valor_quinzena, percentual_acumulado)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [i.id, i.medicao_id, i.etapa_fornecedor_id, i.valor_quinzena, i.percentual_acumulado],
      );
    }

    // ── 7. Evidências ──
    const ev = (await src.query(
      `SELECT me.id, me.medicao_id, me.etapa_id, me.storage_key, me.visivel_cliente, me.created_at
         FROM medicao_evidencias me
         JOIN medicoes m ON m.id = me.medicao_id
        WHERE m.obra_id = ANY($1)`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[medicao_evidencias] ${ev.length}`);
    for (const e of ev) {
      if (DRY_RUN) continue;
      await dst.query(
        `INSERT INTO medicao_evidencias (id, medicao_id, etapa_id, storage_key, visivel_cliente, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.medicao_id, e.etapa_id, e.storage_key, e.visivel_cliente, e.created_at],
      );
    }

    // ── 8. Transições (user_id nulled — auth do ber-medicao não casa com ber-app) ──
    const tr = (await src.query(
      `SELECT mt.id, mt.medicao_id, mt.de_status, mt.para_status, mt.comentario, mt.created_at
         FROM medicao_transicoes mt
         JOIN medicoes m ON m.id = mt.medicao_id
        WHERE m.obra_id = ANY($1)`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[medicao_transicoes] ${tr.length}`);
    for (const t of tr) {
      if (DRY_RUN) continue;
      await dst.query(
        `INSERT INTO medicao_transicoes (id, medicao_id, user_id, de_status, para_status, comentario, created_at)
         VALUES ($1,$2,NULL,$3::"MedicaoStatus",$4::"MedicaoStatus",$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.medicao_id, t.de_status, t.para_status, t.comentario, t.created_at],
      );
    }

    // ── 9. MedicaoFornecedor ──
    const mf = (await src.query(
      `SELECT mf.id, mf.medicao_id, mf.fornecedor_id, mf.valor_quinzena, mf.status, mf.liberada_em, mf.created_at
         FROM medicoes_fornecedor mf
         JOIN medicoes m ON m.id = mf.medicao_id
        WHERE m.obra_id = ANY($1)`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[medicoes_fornecedor] ${mf.length}`);
    for (const x of mf) {
      if (DRY_RUN) continue;
      await dst.query(
        `INSERT INTO medicoes_fornecedor (id, medicao_id, fornecedor_id, valor_quinzena, status, liberada_em, created_at)
         VALUES ($1,$2,$3,$4,$5::"MedicaoFornecedorStatus",$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.medicao_id, x.fornecedor_id, x.valor_quinzena, x.status, x.liberada_em, x.created_at],
      );
    }

    // ── 10. Notas Fiscais ──
    const nfs = (await src.query(
      `SELECT nf.id, nf.medicao_id, nf.medicao_fornecedor_id, nf.emissor_tipo, nf.emissor_id,
              nf.numero, nf.data_emissao, nf.data_pagamento_prevista, nf.valor, nf.arquivo_key,
              nf.status, nf.created_at
         FROM notas_fiscais nf
    LEFT JOIN medicoes m ON m.id = nf.medicao_id
    LEFT JOIN medicoes_fornecedor mf ON mf.id = nf.medicao_fornecedor_id
    LEFT JOIN medicoes m2 ON m2.id = mf.medicao_id
        WHERE (m.obra_id = ANY($1) OR m2.obra_id = ANY($1))`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[notas_fiscais] ${nfs.length}`);
    for (const nf of nfs) {
      if (DRY_RUN) continue;
      await dst.query(
        `INSERT INTO notas_fiscais (id, medicao_id, medicao_fornecedor_id, emissor_tipo, emissor_id, numero,
                                    data_emissao, data_pagamento_prevista, valor, arquivo_key, status, created_at)
         VALUES ($1,$2,$3,$4::"NfEmissorTipo",$5,$6,$7,$8,$9,$10,$11::"NfStatus",$12)
         ON CONFLICT (id) DO NOTHING`,
        [
          nf.id, nf.medicao_id, nf.medicao_fornecedor_id, nf.emissor_tipo, nf.emissor_id,
          nf.numero, nf.data_emissao, nf.data_pagamento_prevista, nf.valor, nf.arquivo_key,
          nf.status, nf.created_at,
        ],
      );
    }

    // ── 11. ChangeOrders + ChangeOrderItens ──
    const cos = (await src.query(
      'SELECT id, obra_id, numero, titulo, created_at FROM change_orders WHERE obra_id = ANY($1)',
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[change_orders] ${cos.length}`);
    for (const c of cos) {
      const tid = mapObra(c.obra_id);
      if (!tid || DRY_RUN) continue;
      await dst.query(
        `INSERT INTO change_orders (id, obra_id, numero, titulo, created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, tid, c.numero, c.titulo, c.created_at],
      );
    }

    const coitens = (await src.query(
      `SELECT coi.id, coi.change_order_id, coi.tipo, coi.descricao, coi.valor
         FROM change_order_itens coi
         JOIN change_orders co ON co.id = coi.change_order_id
        WHERE co.obra_id = ANY($1)`,
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[change_order_itens] ${coitens.length}`);
    for (const i of coitens) {
      if (DRY_RUN) continue;
      await dst.query(
        `INSERT INTO change_order_itens (id, change_order_id, tipo, descricao, valor)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [i.id, i.change_order_id, i.tipo, i.descricao, i.valor],
      );
    }

    // ── 12. ClienteAcesso (preserva token → links mágicos antigos continuam) ──
    const acessos = (await src.query(
      'SELECT id, obra_id, email, nome, token, expira_em, created_at FROM clientes_acesso WHERE obra_id = ANY($1)',
      [Object.keys(OBRA_MAP)],
    )).rows;
    console.log(`[clientes_acesso] ${acessos.length}`);
    for (const a of acessos) {
      const tid = mapObra(a.obra_id);
      if (!tid || DRY_RUN) continue;
      await dst.query(
        `INSERT INTO clientes_acesso (id, obra_id, email, nome, token, expira_em, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, tid, a.email, a.nome, a.token, a.expira_em, a.created_at],
      );
    }

    if (DRY_RUN) {
      await dst.query('ROLLBACK');
      console.log('[migrate] DRY RUN — nenhuma escrita commitada');
    } else {
      await dst.query('COMMIT');
      console.log('[migrate] COMMIT OK');
    }
  } catch (err) {
    await dst.query('ROLLBACK');
    console.error('[migrate] ROLLBACK por erro:', err);
    process.exitCode = 1;
  } finally {
    await src.end();
    await dst.end();
  }
}

run();
