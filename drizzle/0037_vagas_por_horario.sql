-- ⚠️ Remove o índice único "um agendamento por horário" e põe no lugar o
-- "um agendamento por vaga do horário". Nenhuma linha é apagada.
-- A ordem garante que nunca falta a regra: primeiro a coluna e o índice
-- novos (todas as linhas existentes ficam na vaga 1, e o índice antigo já
-- garantia um por horário, então o novo é criado sem conflito), e só então
-- sai o antigo.
-- Para desfazer: DROP INDEX "appointments_tenant_date_slot_seat_live"; e
-- CREATE UNIQUE INDEX "appointments_tenant_date_slot_live" ON "appointments"
-- ("tenant_slug","date","slot_time") WHERE status <> 'cancelled'; (só
-- funciona se nenhum horário tiver dois agendamentos vivos).
ALTER TABLE "appointments" ADD COLUMN "seat" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_tenant_date_slot_seat_live" ON "appointments" USING btree ("tenant_slug","date","slot_time","seat") WHERE "appointments"."status" <> 'cancelled';--> statement-breakpoint
DROP INDEX "appointments_tenant_date_slot_live";
