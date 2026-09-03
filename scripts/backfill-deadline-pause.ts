/**
 * Stops the clock of the requests that were already waiting on the citizen
 * when the automatic pause shipped (change `pausar-prazo-na-exigencia`).
 *
 * A request with a pending exigência is paused from the day the oldest
 * pending one was registered, which is the day the clock should have stopped.
 * A request in "Aguardando pagamento" with a value and no exigência is paused
 * from its last update, a declared approximation: nothing else records when
 * the value was set. The term is materialised the way the panel would
 * (`effectiveDeadline`), and each write is audited without an actor.
 *
 * Lists by default; writes only with `--apply`. Run it once, on Homolog
 * first:
 *
 *   node --env-file-if-exists=.env.local scripts/backfill-deadline-pause.ts
 *   node --env-file-if-exists=.env.local scripts/backfill-deadline-pause.ts --apply
 */
import postgres from "postgres";
import { getAct } from "../src/core/acts/catalog.ts";
import {
  effectiveDeadline,
  readDeadline,
} from "../src/core/request/deadline.ts";
import { toIsoDate } from "../src/core/scheduling/calendar.ts";
import { applyTenantOverrides } from "../src/core/tenant/overrides.ts";
import { TENANTS } from "../src/core/tenant/resolve.ts";

const TIME_ZONE = "America/Sao_Paulo";
const apply = process.argv.includes("--apply");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL para consultar o banco.");
  process.exit(1);
}
// Sem prepared statements: o pooler do Supabase (modo transação) não os aceita.
const sql = postgres(url, { prepare: false });

const overrides = await sql`
  select tenant_slug, published from tenant_content where key = 'office-deadline'
`;
const defaultDays = (slug: string): number => {
  const tenant = TENANTS[slug];
  if (!tenant) throw new Error(`Serventia desconhecida: ${slug}`);
  const row = overrides.find((o) => o.tenant_slug === slug);
  return applyTenantOverrides(tenant, { deadline: row?.published })
    .requestDeadlineDays;
};

const rows = await sql`
  select r.id, r.tenant_slug, r.protocol_number, r.act_id, r.status,
         r.amount_cents, r.created_at, r.updated_at, r.details,
         min(q.created_at) filter (where q.status = 'pending') as first_pending
  from service_requests r
  left join service_request_requirements q on q.request_id = r.id
  where r.kind = 'service-request'
    and r.status not in ('done', 'rejected', 'cancelled', 'archived')
    and r.details -> 'deadline' ->> 'pausedOn' is null
  group by r.id
  having count(q.id) filter (where q.status = 'pending') > 0
      or (r.status = 'awaiting-payment' and r.amount_cents is not null)
  order by r.tenant_slug, r.protocol_number
`;

const plan = rows.map((row) => {
  const act = row.act_id ? getAct(row.act_id) : undefined;
  const term = effectiveDeadline(
    toIsoDate(row.created_at, TIME_ZONE),
    readDeadline(row.details),
    act?.legalDeadlineDays,
    defaultDays(row.tenant_slug),
  );
  const pausedOn = toIsoDate(row.first_pending ?? row.updated_at, TIME_ZONE);
  return {
    id: row.id as string,
    serventia: row.tenant_slug as string,
    protocolo: row.protocol_number as string,
    motivo: row.first_pending ? "exigência" : "pagamento",
    deadline: { ...term, pausedOn },
  };
});

if (plan.length === 0) {
  console.log("Nenhum pedido aberto esperando o cidadão sem pausa gravada.");
} else {
  console.table(
    plan.map((p) => ({
      serventia: p.serventia,
      protocolo: p.protocolo,
      motivo: p.motivo,
      inicio: p.deadline.startedOn,
      dias: p.deadline.days,
      pausadoEm: p.deadline.pausedOn,
    })),
  );
}

if (apply) {
  for (const p of plan) {
    // `sql.json`, never a stringified object: the driver reads the `::jsonb`
    // cast and would serialise a string as a JSON string, turning the merge
    // into an array of the old details and the new text.
    await sql.begin(async (tx) => {
      await tx`
        update service_requests
        set details = details || ${sql.json({ deadline: p.deadline })}::jsonb,
            updated_at = now()
        where id = ${p.id}
      `;
      await tx`
        insert into audit_log (tenant_slug, actor_id, action, target_type, target_id)
        values (${p.serventia}, null, 'service-request.deadline.pause', 'service-request', ${p.id})
      `;
    });
  }
  console.log(`${plan.length} pedido(s) pausado(s).`);
} else if (plan.length > 0) {
  console.log("Nada gravado. Rode com --apply para pausar esses pedidos.");
}

await sql.end();
