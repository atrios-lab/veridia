-- Revisado a mao: nao ha mudanca de schema, e drizzle-kit generate nao
-- produz nada para um backfill puro. Faz parte da change enxugar-status-
-- pedido (ver design.md): encolhe SERVICE_REQUEST_STATUSES de vinte para
-- onze valores, e todo protocolo ja gravado num dos nove que saem ou se
-- fundem precisa do valor novo antes do deploy do codigo que nao reconhece
-- mais o antigo.
--
-- "status" e coluna de texto livre compartilhada pelas quatro naturezas de
-- pedido (kind), e alguns dos valores antigos coincidem por acaso com o
-- vocabulario de outro kind (ombudsman tambem usa "in-review", com outro
-- significado). Por isso todo UPDATE abaixo filtra kind = 'service-request'.
UPDATE "service_requests" SET "status" = 'new' WHERE "kind" = 'service-request' AND "status" = 'filed';--> statement-breakpoint
UPDATE "service_requests" SET "status" = 'processing' WHERE "kind" = 'service-request' AND "status" IN ('in-review', 'pre-noted', 'in-qualification', 'registered', 'annotated', 'granted');--> statement-breakpoint
UPDATE "service_requests" SET "status" = 'awaiting-compliance' WHERE "kind" = 'service-request' AND "status" = 'with-requirement';--> statement-breakpoint
UPDATE "service_requests" SET "status" = 'archived' WHERE "kind" = 'service-request' AND "status" = 'inactive';
