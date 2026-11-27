import { notFound } from "next/navigation";
import { decidesDeletions, OFFICIAL_KINDS } from "@/core/deletion/official.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { listDeletionRequestsWith } from "@/lib/deletion-requests.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { DecideButtons } from "./decide-buttons.tsx";

export const metadata = { title: "Autorizações de exclusão" };

const STATUS: Record<string, string> = {
  pendente: "Esperando o Tabelião",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

import { APPROVABLE } from "./registry.ts";

/**
 * The requests to delete anything on the platform (decision of 26/11/2026): the
 * Tabelião approves or refuses each, confirming the reason.
 */
export default async function DeletionRequestsPage() {
  const session = await getSession();
  if (!session) notFound();
  const tenant = await getTenant();
  const decides = decidesDeletions(
    session.user.role ?? "",
    session.user.permissions,
  );
  const all = await listDeletionRequestsWith(db, tenant.slug);
  const rows = decides
    ? all
    : all.filter((r) => r.requestedBy === session.user.id);
  const pending = rows.filter((r) => r.status === "pendente");
  const done = rows.filter((r) => r.status !== "pendente");
  return (
    <>
      <AdminPageHeader title="Autorizações de exclusão" maxWidth={900} />
      <main className="flex max-w-[900px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <p className="text-sm text-muted-foreground">
          Toda exclusão na plataforma (documento, ato, anexo, lançamento, guia,
          certidão, conta…) só é feita com a aprovação do Tabelião. Quem pede
          escreve o motivo; quem decide confirma o motivo ao aprovar ou diz por
          que recusou. O Tabelião pode autorizar um substituto a decidir em
          Configurações › Perfis e permissões (item &quot;Autorizações de
          exclusão&quot;). Nada sai do banco: o que foi aprovado fica guardado e
          pode ser recuperado.
        </p>
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">
            Esperando decisão ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
          ) : (
            pending.map((r) => (
              <article
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs"
              >
                <p className="text-sm font-semibold">
                  {r.kind in OFFICIAL_KINDS ? (
                    <>
                      {OFFICIAL_KINDS[r.kind as keyof typeof OFFICIAL_KINDS]}:{" "}
                      {r.label}
                    </>
                  ) : (
                    (APPROVABLE[r.kind]?.label ?? r.label)
                  )}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Motivo:</span> {r.reason}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pedido em {formatOfficeDateTime(r.requestedAt)}
                </p>
                {decides && <DecideButtons id={r.id} />}
              </article>
            ))
          )}
        </section>
        {done.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">Decididos</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {done.map((r) => (
                <li key={r.id} className="px-4 py-2 text-sm">
                  <span className="font-medium">{r.label}</span> ·{" "}
                  {STATUS[r.status] ?? r.status}
                  {r.decidedAt
                    ? ` em ${formatOfficeDateTime(r.decidedAt)}`
                    : ""}
                  <span className="block text-xs text-muted-foreground">
                    Motivo do pedido: {r.reason}
                    {r.decisionNote ? ` · Decisão: ${r.decisionNote}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
