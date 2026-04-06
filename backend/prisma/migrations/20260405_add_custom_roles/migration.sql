-- CreateTable
CREATE TABLE "custom_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_name_key" ON "custom_roles"("name");

-- AlterTable: add custom_role_id to users
ALTER TABLE "users" ADD COLUMN "custom_role_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed system roles with default permissions
INSERT INTO "custom_roles" ("id", "name", "description", "permissions", "is_system") VALUES
  (gen_random_uuid(), 'diretoria', 'Diretoria — acesso total', '{"dashboard":true,"obras":true,"kanban":true,"sequenciamento":true,"checklists":true,"recebimentos":true,"pmo":true,"seguranca":true,"normas":true,"instrucoes":true,"ponto":true,"dre":true,"configuracoes":true}', true),
  (gen_random_uuid(), 'coordenacao', 'Coordenacao — gestao operacional', '{"dashboard":true,"obras":true,"kanban":true,"sequenciamento":true,"checklists":true,"recebimentos":true,"pmo":true,"seguranca":true,"normas":true,"instrucoes":true,"ponto":true,"dre":false,"configuracoes":true}', true),
  (gen_random_uuid(), 'gestor', 'Gestor — gestao de obras', '{"dashboard":true,"obras":true,"kanban":true,"sequenciamento":true,"checklists":true,"recebimentos":true,"pmo":true,"seguranca":true,"normas":true,"instrucoes":true,"ponto":true,"dre":false,"configuracoes":false}', true),
  (gen_random_uuid(), 'campo', 'Campo — registro de ponto', '{"dashboard":false,"obras":false,"kanban":false,"sequenciamento":false,"checklists":false,"recebimentos":false,"pmo":false,"seguranca":false,"normas":false,"instrucoes":false,"ponto":true,"dre":false,"configuracoes":false}', true);
