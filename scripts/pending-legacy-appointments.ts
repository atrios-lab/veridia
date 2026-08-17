/**
 * Lists the appointments filed under the old model that are still live and
 * still in the future — the ones a serventia has to resolve by hand before
 * `agendamento-direto` ships.
 *
 * The change moves appointments to their own table and stops consulting the
 * old `AGD.*` protocols. Nothing is migrated: the volume is single digits or
 * zero (the module was new), and a citizen holding a live protocol is better
 * served by the office calling the contact on the record than by a script
 * guessing at a service and a mode nobody chose.
 *
 * Read only. Run it before deploying:
 *
 *   pnpm tsx scripts/pending-legacy-appointments.ts
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL para consultar o banco.");
  process.exit(1);
}

const sql = postgres(url);

const rows = await sql`
  select tenant_slug,
         protocol_number,
         applicant_name,
         contact,
         status,
         details ->> 'date'     as date,
         details ->> 'slotHour' as slot_hour
  from service_requests
  where kind = 'appointment'
    and status in ('requested', 'proposed', 'confirmed')
    and details ->> 'date' >= to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
  order by tenant_slug, details ->> 'date', (details ->> 'slotHour')::int
`;

if (rows.length === 0) {
  console.log("Nenhum agendamento do modelo antigo vivo com data futura.");
} else {
  console.log(
    `${rows.length} agendamento(s) do modelo antigo a resolver pelo contato registrado:\n`,
  );
  console.table(
    rows.map((row) => ({
      serventia: row.tenant_slug,
      protocolo: row.protocol_number,
      dia: row.date,
      faixa: `${row.slot_hour}h`,
      situacao: row.status,
      cidadao: row.applicant_name,
      contato: row.contact,
    })),
  );
}

await sql.end();
