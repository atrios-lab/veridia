import Link from "next/link";
import { RCPN_KIND_LABELS, type RcpnKind } from "@/core/rcpn/record.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { certidaoSubject, listCertidoesWith } from "@/lib/rcpn-certidao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { requireRcpn } from "../_lib/access.ts";

export const metadata = { title: "Certidões do Registro Civil" };

export default async function CertidoesPage({
  searchParams,
}: {
  searchParams: Promise<{ excluida?: string }>;
}) {
  await requireRcpn("rcpn.certidao");
  const tenant = await getTenant();
  const query = await searchParams;
  const rows = await listCertidoesWith(db, tenant.slug);

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Certidões do Registro Civil"
        description="Certidões de nascimento, casamento e óbito no modelo nacional, com matrícula. Emita a partir de um registro do índice ou em branco, cole o selo do lote, imprima ou assine digitalmente e anexe a assinada."
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/rcpn" label="Registro Civil" />
        {query.excluida && (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
            Certidão excluída. Ela continua guardada na auditoria.
          </p>
        )}
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Emitir certidão
          </h2>
          <p className="text-sm text-muted-foreground">
            O jeito mais rápido é pesquisar o registro em Registro Civil e
            clicar em Emitir certidão: os dados do índice já vêm preenchidos.
            Para um registro que ainda não está no índice, comece em branco:
          </p>
          <div className="flex flex-wrap gap-2">
            {(["nascimento", "casamento", "obito"] as RcpnKind[]).map((k) => (
              <Link
                key={k}
                href={`/admin/rcpn/certidoes/nova?tipo=${k}`}
                className={buttonVariants({ variant: "outline" })}
              >
                {RCPN_KIND_LABELS[k]} em branco
              </Link>
            ))}
            {(["nascimento", "casamento", "obito"] as RcpnKind[]).map((k) => (
              <Link
                key={`${k}-it`}
                href={`/admin/rcpn/certidoes/nova?tipo=${k}&via=inteiro-teor`}
                className={buttonVariants({ variant: "ghost" })}
              >
                {RCPN_KIND_LABELS[k]} em inteiro teor
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-xl border bg-card shadow-xs">
          <p className="border-b px-6 py-3 text-sm text-muted-foreground">
            {rows.length === 0
              ? "Nenhuma certidão emitida pelo painel ainda."
              : rows.length === 1
                ? "1 certidão emitida."
                : `${rows.length} certidões emitidas (as mais recentes primeiro).`}
          </p>
          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certidão</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Selo</TableHead>
                  <TableHead>Emitida em</TableHead>
                  <TableHead>Assinada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="align-top">
                      <Link
                        href={`/admin/rcpn/certidoes/${row.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {RCPN_KIND_LABELS[row.kind as RcpnKind]}
                        {row.subtype === "natimorto" ? " · Natimorto" : ""}
                        {row.form === "inteiro-teor" ? " · Inteiro teor" : ""}
                      </Link>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {certidaoSubject(row) || "Sem nome"}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {row.seal || (
                        <span className="font-sans text-muted-foreground">
                          Sem selo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {formatOfficeDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      {row.attachmentPath ? (
                        <Badge variant="secondary">Anexada</Badge>
                      ) : (
                        <Badge variant="outline">Falta anexar</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </>
  );
}
