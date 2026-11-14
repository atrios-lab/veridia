import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMatricula } from "@/core/rcpn/certidao.ts";
import {
  formatIsoDate,
  RCPN_KIND_LABELS,
  RCPN_KINDS,
  type RcpnKind,
} from "@/core/rcpn/record.ts";
import { rcpn } from "@/lib/rcpn.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { Badge } from "../../../../../_ui/badge.tsx";
import { buttonVariants } from "../../../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../_ui/table.tsx";
import { canIssue, requireRcpn } from "../../../_lib/access.ts";

export const metadata = { title: "Índice do livro" };

export default async function RcpnBookPage({
  params,
}: {
  params: Promise<{ kind: string; book: string }>;
}) {
  const session = await requireRcpn();
  const { kind, book: raw } = await params;
  if (!(RCPN_KINDS as readonly string[]).includes(kind)) notFound();
  const book = decodeURIComponent(raw) === "-" ? "" : decodeURIComponent(raw);
  const tenant = await getTenant();
  const entries = await rcpn.bookIndex(tenant.slug, kind as RcpnKind, book);
  if (entries.length === 0) notFound();
  const issue = canIssue(session);

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title={`Livro ${book || "sem número"} · ${RCPN_KIND_LABELS[kind as RcpnKind]}`}
        description={`${entries.length} ${entries.length === 1 ? "registro" : "registros"}, por folha e termo. Abra o registro para ver todos os dados ou emita a certidão já preenchida.`}
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/rcpn/livros" label="Livros" />
        <section className="rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folha</TableHead>
                <TableHead>Termo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Data do registro</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="align-top tabular-nums">
                    {e.page || "-"}
                  </TableCell>
                  <TableCell className="align-top tabular-nums">
                    {e.term || "-"}
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <span className="font-medium text-foreground">
                      {e.names.join(" e ") || "Sem nome"}
                    </span>
                    {!e.complete && (
                      <Badge variant="outline" className="ml-2">
                        Só índice
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {formatIsoDate(e.registeredOn) || "-"}
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs">
                    {e.matricula ? formatMatricula(e.matricula) : "-"}
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="inline-flex flex-wrap gap-2">
                      <Link
                        href={`/admin/rcpn/registro/${e.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Abrir
                      </Link>
                      {issue && (
                        <Link
                          href={`/admin/rcpn/certidoes/nova?registro=${e.id}`}
                          className={buttonVariants({ size: "sm" })}
                        >
                          Emitir certidão
                        </Link>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </main>
    </>
  );
}
