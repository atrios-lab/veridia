import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { formatVerificationCode } from "@/core/signature/policy.ts";
import {
  formatOfficeDate,
  formatOfficeDayMonthTime,
} from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  certificatesForSignerWith,
  listSignedDocumentsWith,
} from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { SignForm } from "./sign-forms.tsx";

export const metadata = { title: "Assinador digital" };

export default async function SignerPage() {
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (!session || !can(role, "desk.access", granted)) notFound();
  const tenant = await getTenant();
  const [certificates, documents] = await Promise.all([
    certificatesForSignerWith(db, tenant.slug, session.user.id),
    listSignedDocumentsWith(db, tenant.slug),
  ]);

  return (
    <>
      <AdminPageHeader title="Assinador digital" />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7">
        {certificates.length > 0 ? (
          <SignForm
            certificates={certificates.map(({ id, label, holderName }) => ({
              id,
              label,
              holderName,
            }))}
          />
        ) : (
          <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4 text-[13px] text-admin-text">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Assinar um documento
            </h2>
            <p className="mt-1.5">
              Você ainda não tem certificado liberado para assinar.{" "}
              {can(role, "user.manage", granted) ? (
                <>
                  Cadastre um certificado A1 e marque quem pode assinar em{" "}
                  <Link
                    href="/admin/configuracoes/certificados"
                    className="font-semibold text-admin-primary underline"
                  >
                    Configurações › Certificados
                  </Link>
                  .
                </>
              ) : (
                "Peça ao administrador da serventia para liberar um certificado A1 para você."
              )}
            </p>
          </section>
        )}

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Documentos assinados
          </h2>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            O arquivo assinado fica disponível por 6 meses. O registro e o
            manifesto de assinaturas ficam para sempre, para verificação no
            site.
          </p>
          {documents.length === 0 ? (
            <p className="mt-3 text-[13px] text-admin-muted">
              Nenhum documento assinado ainda.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-admin-border">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[13px]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/utilitarios/assinador/${document.id}`}
                      className="font-semibold text-admin-primary hover:underline [overflow-wrap:anywhere]"
                    >
                      {document.title}
                    </Link>
                    <p className="text-[12px] text-admin-muted">
                      {formatVerificationCode(document.code)} ·{" "}
                      {document.signatures.map((s) => s.holderName).join(", ")}{" "}
                      · {formatOfficeDayMonthTime(document.createdAt)}
                    </p>
                  </div>
                  <span className="text-[11.5px] text-admin-muted">
                    {document.filePath
                      ? `arquivo até ${formatOfficeDate(document.fileExpiresAt)}`
                      : "arquivo expirado, registro mantido"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
