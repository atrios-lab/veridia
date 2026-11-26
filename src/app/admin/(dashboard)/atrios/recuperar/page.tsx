import { notFound } from "next/navigation";
import { plainValue } from "@/core/ri/history-text.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { listChangesWith, listRemovedWith } from "@/lib/recovery.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { RecoverButton } from "./recover-button.tsx";

export const metadata = { title: "Recuperar" };

/**
 * The super admin recovers anything deleted, removed or changed (decision
 * of 26/11/2026), in the office being served.
 */
export default async function RecoverPage() {
  const session = await getSession();
  if (!session || session.user.role !== "superadmin") notFound();
  const tenant = await getTenant();
  const [removed, changes] = await Promise.all([
    listRemovedWith(db, tenant.slug),
    listChangesWith(db, tenant.slug),
  ]);
  return (
    <>
      <AdminPageHeader
        title="Recuperar apagados e alterações"
        maxWidth={1000}
      />
      <main className="flex max-w-[1000px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <p className="text-sm text-muted-foreground">
          Serventia: {tenant.name}. Nada é tirado do banco: o que foi apagado,
          removido ou anulado volta às listas, e uma alteração pode ser desfeita
          (o valor anterior volta e a troca fica no histórico). Tudo vai para a
          auditoria com a sua justificativa.
        </p>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">
            Apagados, removidos e anulados ({removed.length})
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {removed.map((r) => (
              <li
                key={`${r.table}-${r.id}-${r.flag}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{r.summary}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.tableName} · {r.flagLabel} em{" "}
                    {formatOfficeDateTime(r.at)}
                  </span>
                </span>
                <RecoverButton
                  fields={{ table: r.table, id: r.id, flag: r.flag }}
                  label="Recuperar"
                  question={`Recuperar "${r.summary}"?`}
                />
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">
            Alterações ({changes.length})
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {changes.map((c) => (
              <li
                key={`${c.table}-${c.id}-${c.index}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{c.summary}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.tableName}
                    {c.at ? ` · ${formatOfficeDateTime(new Date(c.at))}` : ""}
                  </span>
                  {c.changes.map((x) => (
                    <span key={x.field} className="block text-xs">
                      {x.field}: era {plainValue(x.before).slice(0, 80)}, passou
                      a {plainValue(x.after).slice(0, 80)}
                    </span>
                  ))}
                </span>
                <RecoverButton
                  fields={{
                    table: c.table,
                    id: c.id,
                    index: String(c.index),
                    op: "revert",
                  }}
                  label="Voltar ao valor anterior"
                  question="Desfazer esta alteração?"
                />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
