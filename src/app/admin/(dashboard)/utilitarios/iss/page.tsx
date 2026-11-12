import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  competenceTitle,
  formatDeclarationNumber,
  formatRate,
  issSettingsMissing,
} from "@/core/iss/declaration.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import {
  getIssSettings,
  listIssDeclarationsWith,
} from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";

export const metadata = { title: "Declaração de ISS" };

const date = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/**
 * Declaração de ISS (decision of 11/11/2026): the month's emolumentos to
 * the municipal tax office, with the book attached, to print or sign.
 */
export default async function IssPage({
  searchParams,
}: {
  searchParams: Promise<{ excluida?: string }>;
}) {
  const session = await getSession();
  const role = session?.user.role ?? "";
  if (!session || !can(role, "iss.manage", session.user.permissions)) {
    notFound();
  }
  const tenant = await getTenant();
  const [rows, settings, query] = await Promise.all([
    listIssDeclarationsWith(db, tenant.slug),
    getIssSettings(tenant),
    searchParams,
  ]);
  const missing = issSettingsMissing(settings);
  const canConfigure = can(role, "content.edit", session.user.permissions);

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Declaração de ISS"
        description="O ISS do mês sobre os emolumentos, para o fisco municipal, com o livro do caixa anexo. Imprima ou assine digitalmente."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/utilitarios/iss/nova"
              className={buttonVariants()}
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Nova declaração
            </Link>
          </div>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-4 py-7 md:px-8">
        {query.excluida === "1" && (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
            Declaração excluída da lista. O registro continua na auditoria.
          </p>
        )}
        {missing.length > 0 ? (
          <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-text">
            Falta informar na configuração: {missing.join(", ")}. A declaração
            sai sem esses dados até lá.{" "}
            {canConfigure && (
              <Link
                href="/admin/utilitarios/iss/configuracao"
                className="font-semibold underline"
              >
                Completar agora
              </Link>
            )}
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            ✓ Dados da serventia e da prefeitura completos (alíquota de{" "}
            {formatRate(settings.rateBasisPoints)}).
            {canConfigure && (
              <Link
                href="/admin/utilitarios/iss/configuracao"
                className="font-semibold text-primary underline"
              >
                Deseja alterar os dados?
              </Link>
            )}
          </p>
        )}
        <section className="overflow-hidden rounded-xl border bg-card">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhuma declaração ainda. Clique em &quot;Nova declaração&quot; e
              informe os emolumentos do mês.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Nº
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Competência
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground text-right">
                    Emolumentos
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground text-right max-md:hidden">
                    Alíquota
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground text-right">
                    ISS
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground max-md:hidden">
                    Recolhido
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Entregue
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="px-4 py-2.5 font-semibold tabular-nums">
                      <Link
                        href={`/admin/utilitarios/iss/${row.id}`}
                        className="text-primary underline"
                      >
                        {formatDeclarationNumber(row.year, row.sequence)}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {competenceTitle(row.competence)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right tabular-nums">
                      R$ {formatMoneyBRL(row.emolumentsCents)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right tabular-nums max-md:hidden">
                      {formatRate(row.rateBasisPoints)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      R$ {formatMoneyBRL(row.issCents)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 tabular-nums max-md:hidden">
                      {row.paidOn ? date(row.paidOn) : "Não informado"}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 tabular-nums">
                      {row.filedOn ? (
                        date(row.filedOn)
                      ) : (
                        <span className="font-semibold text-warning-text">
                          Pendente
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Base de cálculo: só os emolumentos, que são o preço do serviço (LC
          116/2003, art. 7º; STJ, REsp 1.328.384/RS). Não entram os repasses ao
          Estado e aos fundos nem o selo.
        </p>
      </main>
    </>
  );
}
