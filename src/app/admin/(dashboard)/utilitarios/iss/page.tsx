import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  competenceTitle,
  formatDeclarationNumber,
  formatRate,
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
  if (!session || !can(role, "requests.manage", session.user.permissions)) {
    notFound();
  }
  const tenant = await getTenant();
  const [rows, settings, query] = await Promise.all([
    listIssDeclarationsWith(db, tenant.slug),
    getIssSettings(tenant),
    searchParams,
  ]);
  const missing = [
    !settings.municipalLaw.trim() && "a lei municipal do ISS",
    !settings.cnpj.trim() && "o CNPJ da serventia",
    !settings.municipalRegistration.trim() && "a inscrição municipal",
  ].filter(Boolean);
  const canConfigure = can(role, "content.edit", session.user.permissions);

  return (
    <>
      <AdminPageHeader
        title="Declaração de ISS"
        description="O ISS do mês sobre os emolumentos, para o fisco municipal, com o livro do caixa anexo. Imprima ou assine digitalmente."
        actions={
          <div className="flex flex-wrap gap-2">
            {canConfigure && (
              <Link
                href="/admin/utilitarios/iss/configuracao"
                className="btn btn-admin-secondary btn-md"
              >
                <AdminIcon name="settings" className="h-4 w-4" /> Configuração
              </Link>
            )}
            <Link
              href="/admin/utilitarios/iss/nova"
              className="btn btn-admin-primary btn-md"
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Nova declaração
            </Link>
          </div>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {query.excluida === "1" && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Declaração excluída da lista. O registro continua na auditoria.
          </p>
        )}
        {missing.length > 0 && (
          <p className="rounded-[12px] bg-admin-warning-bg px-4 py-3 text-[13px] text-admin-warning-text">
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
        )}
        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
              Nenhuma declaração ainda. Clique em &quot;Nova declaração&quot; e
              informe os emolumentos do mês.
            </p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-admin-border text-[11px] font-bold uppercase tracking-[0.06em] text-admin-faint">
                <tr>
                  <th className="px-4 py-2.5">Nº</th>
                  <th className="px-4 py-2.5">Competência</th>
                  <th className="px-4 py-2.5 text-right">Emolumentos</th>
                  <th className="px-4 py-2.5 text-right max-md:hidden">
                    Alíquota
                  </th>
                  <th className="px-4 py-2.5 text-right">ISS</th>
                  <th className="px-4 py-2.5 max-md:hidden">Recolhido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-admin-border last:border-0 hover:bg-admin-input-bg"
                  >
                    <td className="px-4 py-2.5 font-semibold">
                      <Link
                        href={`/admin/utilitarios/iss/${row.id}`}
                        className="text-admin-primary underline"
                      >
                        {formatDeclarationNumber(row.year, row.sequence)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {competenceTitle(row.competence)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      R$ {formatMoneyBRL(row.emolumentsCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right max-md:hidden">
                      {formatRate(row.rateBasisPoints)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      R$ {formatMoneyBRL(row.issCents)}
                    </td>
                    <td className="px-4 py-2.5 max-md:hidden">
                      {row.paidOn ? date(row.paidOn) : "Não informado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <p className="text-[12px] leading-relaxed text-admin-muted">
          Base de cálculo: só os emolumentos, que são o preço do serviço (LC
          116/2003, art. 7º; STJ, REsp 1.328.384/RS). Não entram os repasses ao
          Estado e aos fundos nem o selo.
        </p>
      </main>
    </>
  );
}
