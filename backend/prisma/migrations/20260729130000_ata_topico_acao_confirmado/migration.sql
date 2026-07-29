-- Item da ata ganha:
--   acao: texto livre da ação/informação (ex: "mandar email para fornecedor")
--   confirmado: item novo nasce false e fica fixo no fim até o usuário confirmar,
--               evitando que a linha "pule de lugar" ao inserir a 1ª data.
-- Linhas já existentes assumem confirmado = true (default), preservando a ordem atual.
ALTER TABLE "public"."obra_ata_topicos" ADD COLUMN "acao" TEXT;
ALTER TABLE "public"."obra_ata_topicos" ADD COLUMN "confirmado" BOOLEAN NOT NULL DEFAULT true;
