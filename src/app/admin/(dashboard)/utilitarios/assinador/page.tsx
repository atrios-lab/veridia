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
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import {
  RemoveDocumentButton,
  RestoreDocumentButton,
  SignForm,
} from "./sign-forms.tsx";

export const metadata = { title: "Assinador digital" };

export default async function SignerPage({
  searchParams,
}: {
  searchParams: Promise<{
    excluidos?: string;
    retirado?: string;
    /** A panel route that generates a PDF (guia, declaração) to sign. */
    origem?: string;
    titulo?: string;
  }>;
}) {
  const query = await searchParams;
  const showRemoved = query.excluidos === "1";
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (!session || !can(role, "signer.use", granted)) notFound();
  const tenant = await getTenant();
  const [certificates, documents] = await Promise.all([
    certificatesForSignerWith(db, tenant.slug, session.user.id),
    listSignedDocumentsWith(db, tenant.slug, undefined, {
      removed: showRemoved,
    }),
  ]);
  const holder = can(role, "certificates.manage", granted);

  return (
    <>
      <AdminPageHeader maxWidth={1000} title="Assinador digital" />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-4 py-7 md:px-8">
        {query.retirado === "1" && (
          <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Documento excluído da lista. O registro da assinatura continua
            respondendo à verificação; ele pode voltar em "Excluídos".
          </p>
        )}
        {/* A1 from the platform or A3 from a token on this computer: the
            form offers both, A3 even with no A1 cadastrado. */}
        <SignForm
          preload={preloadFrom(query.origem, query.titulo)}
          certificates={certificates.map(({ id, label, holderName }) => ({
            id,
            label,
            holderName,
          }))}
        />
        {certificates.length === 0 &&
          can(role, "certificates.manage", granted) && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Para assinar com certificado A1, cadastre o arquivo e marque quem
              pode assinar em{" "}
              <Link
                href="/admin/configuracoes/certificados"
                className="font-medium text-primary underline underline-offset-4"
              >
                Configurações › Certificados
              </Link>
              .
            </p>
          )}

        {/* Minimized until opened (decision of 11/11/2026): the page
            starts with the form; the list is one click away. The removed
            view, asked for on purpose, opens already. */}
        <details
          open={showRemoved}
          className="group rounded-xl border bg-card px-5 py-4"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <AdminIcon
                name="chevronDown"
                className="h-4 w-4 -rotate-90 text-muted-foreground transition-transform group-open:rotate-0"
              />
              <span className="text-lg font-semibold text-foreground">
                {showRemoved ? "Excluídos da lista" : "Documentos assinados"}
              </span>
              <Badge variant="secondary" className="tabular-nums">
                {documents.length}
              </Badge>
            </span>
            <span className="text-xs font-medium text-muted-foreground group-open:hidden">
              Mostrar
            </span>
            <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">
              Recolher
            </span>
          </summary>
          <div className="mt-2 flex flex-wrap items-baseline justify-end gap-2">
            <Link
              href={
                showRemoved
                  ? "/admin/utilitarios/assinador"
                  : "/admin/utilitarios/assinador?excluidos=1"
              }
              className={
                showRemoved
                  ? buttonVariants({ variant: "outline" })
                  : "text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-primary"
              }
            >
              {showRemoved ? "← Voltar aos assinados" : "Ver excluídos"}
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {showRemoved
              ? "Não abrem mais, aqui nem na página pública. O registro da assinatura continua respondendo à verificação."
              : "Clique no título para ver os detalhes, ou em Abrir para ler e imprimir de novo. O arquivo assinado fica disponível por 6 meses; o registro e o manifesto, para sempre."}
          </p>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {showRemoved
                ? "Nenhum documento excluído."
                : "Nenhum documento assinado ainda."}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y">
              {documents.map((document) => {
                const mayRemove =
                  holder || document.createdBy === session.user.id;
                return (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/utilitarios/assinador/${document.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                      >
                        {document.title}
                      </Link>
                      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
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
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
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
        </details>
      </main>
    </>
  );
}

/**
 * Only the panel's own routes may be preloaded: a path under /admin/, on
 * this site, never another host.
 */
function preloadFrom(origem?: string, titulo?: string) {
  if (!origem?.startsWith("/admin/") || origem.startsWith("//")) {
    return undefined;
  }
  const title = (titulo ?? "").trim().slice(0, 120) || "Documento";
  const name = `${
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "documento"
  }.pdf`;
  return { url: origem, name, title };
}
