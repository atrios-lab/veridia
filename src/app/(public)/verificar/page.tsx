import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/index.ts";
import { isVerifyRateLimited } from "@/lib/rate-limit.ts";
import { findSignedDocumentWith } from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";
import { Icon } from "../_components/icon.tsx";
import { publicMetadata } from "../_lib/metadata.ts";
import { TooManyLookups } from "./limited.tsx";
import { VerifyForm } from "./verify-form.tsx";

export const generateMetadata = publicMetadata("/verificar");

/**
 * Verificar documento assinado: by the code (or the QR, which opens
 * /verificar/CODE) or by the PDF itself, whose SHA-256 the browser works out
 * and sends here alone.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivo?: string; codigo?: string }>;
}) {
  const tenant = await getTenant();
  const { arquivo, codigo } = await searchParams;
  // Only a lookup counts: opening the page is free.
  if ((arquivo || codigo) && (await isVerifyRateLimited(await headers()))) {
    return <TooManyLookups />;
  }
  let notFound: "code" | "file" | null = codigo ? "code" : null;
  if (arquivo && /^[0-9a-f]{64}$/i.test(arquivo)) {
    const found = await findSignedDocumentWith(db, tenant.slug, {
      sha256: arquivo,
    });
    if (found) redirect(`/verificar/${found.code}?arquivo=${arquivo}`);
    notFound = "file";
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent-ink">
        Assinatura digital ICP-Brasil
      </p>
      <h1 className="mt-1 font-serif text-3xl font-semibold text-brand-primary">
        Verificar documento assinado
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
        Confira se um documento assinado digitalmente pelo {tenant.name} é
        autêntico, veja quem assinou e quando, e baixe o manifesto de
        assinaturas.
      </p>
      <div className="mt-6">
        <VerifyForm notFound={notFound} />
      </div>
      <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-brand-tint px-4 py-3">
        <Icon
          name="info"
          className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-soft"
          strokeWidth={1.9}
        />
        <p className="text-[12.5px] leading-relaxed text-brand-primary">
          A assinatura também pode ser conferida no validador oficial do
          Instituto Nacional de Tecnologia da Informação, em{" "}
          <a
            href="https://validar.iti.gov.br"
            target="_blank"
            rel="noopener"
            className="font-semibold underline"
          >
            validar.iti.gov.br
          </a>
          , ou no Adobe Acrobat Reader, no painel de assinaturas do PDF.
        </p>
      </div>
    </div>
  );
}
