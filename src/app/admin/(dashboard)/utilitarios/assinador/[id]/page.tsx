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
    !can(session.user.role ?? "", "desk.access", session.user.permissions)
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
    can(session.user.role ?? "", "user.manage", session.user.permissions);

  return (
    <>
      <AdminPageHeader title="Assinador digital" />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7">
        <BackLink
          href="/admin/utilitarios/assinador"
          label="Assinador digital"
        />
        {justSigned && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Documento assinado. Abra para imprimir, baixe o PDF assinado ou
            assine outro documento.
          </p>
        )}
        {view.removedAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-admin-warning-bg px-4 py-3 text-[13px] text-admin-warning-text">
            <span className="font-semibold">
              Excluído da lista em {formatOfficeDate(view.removedAt)}. O arquivo
              não abre mais; a verificação do código continua.
            </span>
            {mayRemove && <RestoreDocumentButton documentId={view.id} />}
          </div>
        )}
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[18px] font-semibold text-admin-primary [overflow-wrap:anywhere]">
            {view.title}
          </h2>
          <p className="mt-1 text-[13px] text-admin-text">
            Código de verificação{" "}
            <strong className="tracking-[0.06em]">
              {formatVerificationCode(view.code)}
            </strong>{" "}
            ·{" "}
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener"
              className="font-semibold text-admin-primary underline [overflow-wrap:anywhere]"
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
                  className="btn btn-admin-primary btn-md"
                >
                  Abrir para imprimir
                </a>
                <a
                  href={`${base}/arquivo`}
                  className="btn btn-admin-secondary btn-md"
                >
                  Baixar PDF assinado
                </a>
              </>
            )}
            <a
              href={`${base}/manifesto`}
              className="btn btn-admin-secondary btn-md"
            >
              Baixar manifesto de assinaturas
            </a>
          </div>
          <p className="mt-2 text-[12px] text-admin-muted">
            {view.filePath
              ? `O arquivo assinado fica no sistema até ${formatOfficeDate(view.fileExpiresAt)}. Salve uma cópia no arquivo da serventia.`
              : view.removedAt
                ? "Documento excluído da lista. O registro e o manifesto continuam."
                : "O arquivo assinado já saiu do sistema (6 meses). O registro e o manifesto continuam."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-admin-border pt-3.5">
            <Link
              href="/admin/utilitarios/assinador#assinar"
              className="btn btn-admin-primary btn-sm"
            >
              Assinar outro documento
            </Link>
            {mayRemove && !view.removedAt && (
              <RemoveDocumentButton documentId={view.id} title={view.title} />
            )}
          </div>
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
            Assinaturas
          </h3>
          <ol className="mt-2 flex flex-col gap-2 text-[13px]">
            {view.signatures.map((signature, index) => (
              <li
                key={`${signature.serialHex}-${signature.signedAt.toISOString()}`}
                className="rounded-lg bg-admin-input-bg px-3.5 py-2.5"
              >
                <strong className="text-admin-primary">
                  {index + 1}. {signature.holderName}
                </strong>
                {signature.holderDocument &&
                  ` · ${signature.holderDocument.length === 14 ? "CNPJ" : "CPF"} ${maskHolderDocument(signature.holderDocument)}`}
                <p className="text-[12px] text-admin-muted">
                  {formatOfficeDateTime(signature.signedAt)} · emitido por{" "}
                  {signature.issuerName} · série{" "}
                  {signature.serialHex.toUpperCase()}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11.5px] text-admin-muted [overflow-wrap:anywhere]">
            SHA-256 do original: {view.originalSha256}
          </p>
        </section>

        {view.filePath && certificates.length > 0 && (
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
