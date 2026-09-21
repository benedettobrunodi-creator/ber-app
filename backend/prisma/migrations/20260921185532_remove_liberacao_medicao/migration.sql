-- DropForeignKey
ALTER TABLE "liberacao_medicao_overrides" DROP CONSTRAINT "liberacao_medicao_overrides_criado_por_fkey";

-- DropForeignKey
ALTER TABLE "liberacao_medicao_overrides" DROP CONSTRAINT "liberacao_medicao_overrides_obra_id_fkey";

-- DropForeignKey
ALTER TABLE "liberacao_medicao_overrides" DROP CONSTRAINT "liberacao_medicao_overrides_plano_id_fkey";

-- DropTable
DROP TABLE "liberacao_medicao_overrides";

