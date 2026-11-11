import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  competenceLabel,
  competenceTitle,
  formatDeclarationNumber,
} from "@/core/iss/declaration.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { findIssDeclarationWith } from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../_components/sign-or-print.tsx";
import { IssForm } from "../iss-form.tsx";
import { RemoveIssButton } from "../remove-button.tsx";

export const metadata = { title: "Declaração de ISS" };

export default async function IssDeclarationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    emitida?: string;
    corrigida?: string;
    boletim?: string;
  }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "requests.manage", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const row = await findIssDeclarationWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const query = await searchParams;
  const number = formatDeclarationNumber(row.year, row.sequence);
  const month = competenceLabel(row.competence);

  return (
    <>
      <AdminPageHeader title={`Declaração de ISS nº ${number}`} />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        <BackLink href="/admin/utilitarios/iss" label="Declaração de ISS" />
        {(query.emitida || query.corrigida) && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            {query.emitida ? "Declaração gerada." : "Correção salva."}{" "}
            {query.boletim === "updated"
              ? `O ISS foi lançado no boletim mensal de ${month}.`
              : query.boletim === "pending"
                ? `O boletim de ${month} ainda não foi publicado: o ISS já vai preenchido quando você abrir o boletim desse mês.`
                : ""}
          </p>
        )}
        <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-[13px] font-bold text-admin-primary">
              {competenceTitle(row.competence)}
            </p>
            <p className="text-[12px] text-admin-muted">
              Emolumentos R$ {formatMoneyBRL(row.emolumentsCents)} · ISS R${" "}
              {formatMoneyBRL(row.issCents)}
              {row.attachmentName ? " · livro anexo" : " · sem livro anexo"}
            </p>
          </div>
          <SignOrPrint
            pdfHref={`/admin/utilitarios/iss/${row.id}/arquivo`}
            title={`Declaração de ISS nº ${number} (${month})`}
          />
          <RemoveIssButton id={row.id} />
        </section>
        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          Corrigir
        </h2>
        <IssForm
          initial={{
            today: today(),
            id: row.id,
            competence: row.competence,
            emoluments: formatMoneyBRL(row.emolumentsCents),
            rate: (row.rateBasisPoints / 100).toFixed(2).replace(".", ","),
            damNumber: row.damNumber,
            dueDate: row.dueDate,
            paidOn: row.paidOn,
            notes: row.notes,
            attachmentName: row.attachmentName,
          }}
        />
      </main>
    </>
  );
}
