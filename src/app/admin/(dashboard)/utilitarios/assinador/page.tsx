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
import {
  RemoveDocumentButton,
  RestoreDocumentButton,
  SignForm,
} from "./sign-forms.tsx";

export const metadata = { title: "Assinador digital" };

export default async function SignerPage({
  searchParams,
}: {
  searchParams: Promise<{ excluidos?: string; retirado?: string }>;
}) {
  const query = await searchParams;
  const showRemoved = query.excluidos === "1";
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (!session || !can(role, "desk.access", granted)) notFound();
  const tenant = await getTenant();
  const [certificates, documents] = await Promise.all([
    certificatesForSignerWith(db, tenant.slug, session.user.id),
    listSignedDocumentsWith(db, tenant.slug, undefined, {
      removed: showRemoved,
    }),
  ]);
  const holder = can(role, "user.manage", granted);

  return (
    <>
      <AdminPageHeader title="Assinador digital" />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7">
        {query.retirado === "1" && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Documento excluído da lista. O registro da assinatura continua
            respondendo à verificação; ele pode voltar em "Excluídos".
          </p>
        )}
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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              {showRemoved ? "Excluídos da lista" : "Documentos assinados"}
            </h2>
            <Link
              href={
                showRemoved
                  ? "/admin/utilitarios/assinador"
                  : "/admin/utilitarios/assinador?excluidos=1"
              }
              className={
                showRemoved
                  ? "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-admin-primary bg-admin-primary/10 px-4 text-[13.5px] font-semibold text-admin-primary hover:bg-admin-primary hover:text-white"
                  : "text-[12.5px] font-semibold text-admin-muted underline hover:text-admin-primary"
              }
            >
              {showRemoved ? "← Voltar aos assinados" : "Ver excluídos"}
            </Link>
          </div>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            {showRemoved
              ? "Não abrem mais, aqui nem na página pública. O registro da assinatura continua respondendo à verificação."
              : "Clique no título para ver os detalhes, ou em Abrir para ler e imprimir de novo. O arquivo assinado fica disponível por 6 meses; o registro e o manifesto, para sempre."}
          </p>
          {documents.length === 0 ? (
            <p className="mt-3 text-[13px] text-admin-muted">
              {showRemoved
                ? "Nenhum documento excluído."
                : "Nenhum documento assinado ainda."}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-admin-border">
              {documents.map((document) => {
                const mayRemove =
                  holder || document.createdBy === session.user.id;
                return (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/utilitarios/assinador/${document.id}`}
                        className="font-semibold text-admin-primary hover:underline [overflow-wrap:anywhere]"
                      >
                        {document.title}
                      </Link>
                      <p className="text-[12px] text-admin-muted [overflow-wrap:anywhere]">
                        {formatVerificationCode(document.code)} ·{" "}
                        {document.signatures
                          .map((s) => s.holderName)
                          .join(", ")}{" "}
                        · {formatOfficeDayMonthTime(document.createdAt)}
                        {" · "}
                        {document.removedAt
                          ? `excluído em ${formatOfficeDate(document.removedAt)}`
                          : document.filePath
                            ? `arquivo até ${formatOfficeDate(document.fileExpiresAt)}`
                            : "arquivo expirado, registro mantido"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {document.filePath && (
                        <a
                          href={`/admin/utilitarios/assinador/${document.id}/arquivo?abrir=1`}
                          target="_blank"
                          rel="noopener"
                          className="btn btn-admin-secondary btn-sm"
                        >
                          Abrir
                        </a>
                      )}
                      {mayRemove &&
                        (showRemoved ? (
                          <RestoreDocumentButton documentId={document.id} />
                        ) : (
                          <RemoveDocumentButton
                            documentId={document.id}
                            title={document.title}
                          />
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
