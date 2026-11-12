import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { can } from "@/core/auth/roles.ts";
import {
  formatVerificationCode,
  maskHolderDocument,
} from "@/core/signature/policy.ts";
import {
  formatOfficeDate,
  formatOfficeDateTime,
} from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { requestOrigin, verifyUrlFor } from "@/lib/signature/documents.ts";
import {
  certificatesForSignerWith,
  findSignedDocumentWith,
} from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import {
  CoSignForm,
  RemoveDocumentButton,
  RestoreDocumentButton,
} from "../sign-forms.tsx";

export const metadata = { title: "Documento assinado" };

export default async function SignedDocumentAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assinado?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "signer.use", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [view, certificates] = await Promise.all([
    findSignedDocumentWith(db, tenant.slug, { id }),
    certificatesForSignerWith(db, tenant.slug, session.user.id),
  ]);
  if (!view) notFound();
  const justSigned = (await searchParams).assinado === "1";
  const verifyUrl = verifyUrlFor(tenant, await requestOrigin(), view.code);
  const base = `/admin/utilitarios/assinador/${view.id}`;
  const mayRemove =
    view.createdBy === session.user.id ||
    can(
      session.user.role ?? "",
      "certificates.manage",
      session.user.permissions,
    );

  return (
    <>
      <AdminPageHeader maxWidth={1000} title="Assinador digital" />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/assinador"
          label="Assinador digital"
        />
        {justSigned && (
          <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Documento assinado. Abra para imprimir, baixe o PDF assinado ou
            assine outro documento.
          </p>
        )}
        {view.removedAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            <span className="font-medium">
              Excluído da lista em {formatOfficeDate(view.removedAt)}. O arquivo
              não abre mais; a verificação do código continua.
            </span>
            {mayRemove && <RestoreDocumentButton documentId={view.id} />}
          </div>
        )}
        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground [overflow-wrap:anywhere]">
            {view.title}
          </h2>
          <p className="mt-1 text-sm text-foreground">
            Código de verificação{" "}
            <strong className="font-semibold tracking-wide tabular-nums">
              {formatVerificationCode(view.code)}
            </strong>{" "}
            ·{" "}
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener"
              className="font-medium text-primary underline underline-offset-4 [overflow-wrap:anywhere]"
            >
              {verifyUrl.replace(/^https?:\/\//, "")}
            </a>
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            {view.filePath && (
              <>
                <a
                  href={`${base}/arquivo?abrir=1`}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants()}
                >
                  Abrir para imprimir
                </a>
                <a
                  href={`${base}/arquivo`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Baixar PDF assinado
                </a>
              </>
            )}
            <a
              href={`${base}/manifesto`}
              className={buttonVariants({ variant: "outline" })}
            >
              Baixar manifesto de assinaturas
            </a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {view.filePath
              ? `O arquivo assinado fica no sistema até ${formatOfficeDate(view.fileExpiresAt)}. Salve uma cópia no arquivo da serventia.`
              : view.removedAt
                ? "Documento excluído da lista. O registro e o manifesto continuam."
                : "O arquivo assinado já saiu do sistema (6 meses). O registro e o manifesto continuam."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t pt-3.5">
            <Link
              href="/admin/utilitarios/assinador#assinar"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Assinar outro documento
            </Link>
            {mayRemove && !view.removedAt && (
              <RemoveDocumentButton documentId={view.id} title={view.title} />
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">Assinaturas</h3>
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {view.signatures.map((signature, index) => (
              <li
                key={`${signature.serialHex}-${signature.signedAt.toISOString()}`}
                className="rounded-lg bg-muted/50 px-3.5 py-2.5"
              >
                <strong className="font-semibold text-foreground">
                  {index + 1}. {signature.holderName}
                </strong>
                {signature.holderDocument &&
                  ` · ${signature.holderDocument.length === 14 ? "CNPJ" : "CPF"} ${maskHolderDocument(signature.holderDocument)}`}
                <p className="text-xs text-muted-foreground">
                  {formatOfficeDateTime(signature.signedAt)} · emitido por{" "}
                  {signature.issuerName} · série{" "}
                  {signature.serialHex.toUpperCase()}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            SHA-256 do original: {view.originalSha256}
          </p>
        </section>

        {view.filePath && (
          <CoSignForm
            documentId={view.id}
            certificates={certificates.map(
              ({ id: certId, label, holderName }) => ({
                id: certId,
                label,
                holderName,
              }),
            )}
          />
        )}
      </main>
    </>
  );
}
