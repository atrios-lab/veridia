-- Revisado a mao. O SQL gerado era uma linha so:
--   ALTER TABLE "user" ADD COLUMN "tenant_slug" text NOT NULL;
-- que falha em qualquer banco com usuario ja criado, porque nao ha o que
-- gravar na coluna nova. Os tres passos abaixo rodam na mesma transacao:
-- adicionar anulavel, preencher, tornar obrigatoria.
ALTER TABLE "user" ADD COLUMN "tenant_slug" text;--> statement-breakpoint

-- Backfill dos usuarios que nasceram antes do vinculo existir. Eles entravam
-- em qualquer painel; passam a pertencer a serventia piloto, que e o
-- DEFAULT_TENANT. Operar outra serventia agora exige usuario proprio nela.
UPDATE "user" SET "tenant_slug" = 'cartorio-marinho' WHERE "tenant_slug" IS NULL;--> statement-breakpoint

ALTER TABLE "user" ALTER COLUMN "tenant_slug" SET NOT NULL;
