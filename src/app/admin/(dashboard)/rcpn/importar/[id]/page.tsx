import { notFound } from "next/navigation";
import { BLOCKING, PROBLEM_LABELS } from "@/core/rcpn/conference.ts";
import {
  formatIsoDate,
  RCPN_KIND_LABELS,
  RCPN_KIND_PLURALS,
  RCPN_KINDS,
  type RcpnRecord,
} from "@/core/rcpn/record.ts";
import { rcpn } from "@/lib/rcpn.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { Badge } from "../../../../_ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../_ui/table.tsx";
import { requireRcpn } from "../../_lib/access.ts";
import { statusOf, when } from "../../_lib/status.ts";
import { type ChangedItem, DiscardForm, PublishForm } from "../../forms.tsx";

export const metadata = { title: "Conferir arquivo do Registro Civil" };

/** How a registro reads in a list: who, and where in the books. */
function labelOf(record: RcpnRecord): string {
  const names = record.people.map((p) => p.name || "(sem nome)").join(" e ");
  const place = [
    record.book && `livro ${record.book}`,
    record.page && `fl. ${record.page}`,
    record.term && `termo ${record.term}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `${RCPN_KIND_LABELS[record.kind]}: ${names}${place ? ` (${place})` : ""}`;
}

export default async function ImportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publicados?: string }>;
}) {
  await requireRcpn("rcpn.import");
  const tenant = await getTenant();
  const { id } = await params;
  const { publicados } = await searchParams;
  const row = await rcpn.getImport(tenant.slug, id);
  if (!row) notFound();
  const status = statusOf(row.status);
  const notes = (row.notes ?? []) as string[];
  const open = row.status === "lida";
  const conference = open ? await rcpn.conference(tenant.slug, row) : null;
  const changed: ChangedItem[] =
    conference?.checked
      .filter(
        (c) =>
          c.comparison === "alterado" &&
          !c.problems.some((p) => BLOCKING.includes(p)),
      )
      .map((c) => ({
        key: c.key,
        label: labelOf(c.record),
        changes: c.details.map(
          (d) => `${d.label}: ${d.before || "(vazio)"} → ${d.after}`,
        ),
      })) ?? [];
  const newCount =
    conference?.checked.filter(
      (c) =>
        c.comparison === "novo" &&
        !c.problems.some((p) => BLOCKING.includes(p)),
    ).length ?? 0;
  const withProblems =
    conference?.checked.filter((c) => c.problems.length > 0) ?? [];

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Conferir arquivo"
        back={{ href: "/admin/rcpn/importar", label: "Importar arquivos" }}
        description={`${row.fileName} · enviado em ${when(row.createdAt)}`}
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {row.closedAt && (
            <span className="text-sm text-muted-foreground">
              Encerrado em {when(row.closedAt)}
            </span>
          )}
        </div>

        {publicados !== undefined && row.status === "publicada" && (
          <p className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            {Number(publicados) === 1
              ? "1 registro publicado"
              : `${Number(publicados)} registros publicados`}{" "}
            no índice. O arquivo foi apagado do painel.
          </p>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            O que o sistema leu
          </h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-foreground">
            {notes.map((note) => (
              <li key={note} className="break-words">
                {note}
              </li>
            ))}
          </ul>
          {row.status === "nao-lida" && (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum registro foi lido deste arquivo. Se ele veio do sistema do
              registro civil, exporte em outro formato (banco do Cartosoft,
              carga XML ou pacote com eles) ou envie um exemplo para incluirmos
              a leitura.
            </p>
          )}
        </section>

        {conference && (
          <>
            <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-3">
              {RCPN_KINDS.map((kind) => {
                const s = conference.byKind[kind];
                return (
                  <div key={kind} className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                      {RCPN_KIND_PLURALS[kind]}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {s.count.toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.count > 0
                        ? `${s.firstYear ?? "?"} a ${s.lastYear ?? "?"}${s.books.length > 0 ? ` · ${s.books.length} livro(s)` : ""}`
                        : "Nenhum neste arquivo"}
                    </p>
                    {kind === "obito" && s.natimortos > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dos quais {s.natimortos} natimorto(s) (Livro C Auxiliar)
                      </p>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="rounded-xl border bg-card p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-foreground">
                Comparado com o índice
              </h2>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <li>
                  <span className="font-semibold text-foreground">
                    {conference.counts.novo}
                  </span>{" "}
                  novo(s), entram ao publicar
                </li>
                <li>
                  <span className="font-semibold text-foreground">
                    {conference.counts.igual}
                  </span>{" "}
                  já no índice, sem mudança
                </li>
                <li>
                  <span className="font-semibold text-foreground">
                    {conference.counts.alterado}
                  </span>{" "}
                  já no índice com dados diferentes
                </li>
                <li>
                  <span className="font-semibold text-foreground">
                    {conference.counts.blocked}
                  </span>{" "}
                  fora da publicação (sem nome ou repetido)
                </li>
              </ul>
              <div className="mt-5 flex flex-col gap-4">
                <PublishForm
                  id={row.id}
                  newCount={newCount}
                  changed={changed}
                />
                <DiscardForm id={row.id} />
              </div>
            </section>

            {withProblems.length > 0 && (
              <section className="rounded-xl border bg-card shadow-xs">
                <h2 className="border-b px-6 py-3 text-lg font-semibold text-foreground">
                  Registros com pendência ({withProblems.length})
                </h2>
                <p className="px-6 pt-3 text-sm text-muted-foreground">
                  Sem nome e repetidos ficam fora da publicação. Os demais
                  entram, com a pendência anotada: corrija no sistema do
                  registro civil e envie de novo quando puder.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registro</TableHead>
                      <TableHead>Registrado em</TableHead>
                      <TableHead>Pendência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withProblems.slice(0, 200).map((item, index) => (
                      <TableRow key={`${item.key}-${index}`}>
                        <TableCell className="whitespace-normal text-sm">
                          {labelOf(item.record)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatIsoDate(item.record.registeredOn) ||
                            "não informado"}
                        </TableCell>
                        <TableCell className="whitespace-normal text-sm">
                          {item.problems
                            .map((p) => PROBLEM_LABELS[p])
                            .join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {withProblems.length > 200 && (
                  <p className="px-6 py-3 text-xs text-muted-foreground">
                    Mostrando os 200 primeiros.
                  </p>
                )}
              </section>
            )}
          </>
        )}

        {row.status === "nao-lida" && <DiscardForm id={row.id} />}
      </main>
    </>
  );
}
