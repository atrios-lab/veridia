import { type RequestKind, statusLabel } from "@/core/request/kinds.ts";
import { verifyProtocolProofSeal } from "@/core/request/protocol-proof.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { protocolledDocumentsWith, serviceOf } from "@/lib/access-receipt.ts";
import { proofLinkKey } from "@/lib/proof-link-key.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { requireSection } from "../../_lib/section.ts";

// One URL per request ever made, and personal data on it: never indexed.
export const metadata = {
  title: "Comprovante de apresentação para protocolo",
  robots: { index: false, follow: false },
};

/**
 * What the shareable proof's QR opens (decision of 22/11/2026): the
 * request's summary and andamento, for a bank or another office to check.
 * Read only: no key, no documents to open, no action, and no ciência is
 * recorded (that is the requerente's own consult, with the key).
 */
export default async function ProtocolProofPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string; selo?: string }>;
}) {
  const tenant = await requireSection("consulta-protocolo");
  const { numero, selo } = await searchParams;
  const protocolNumber = (numero ?? "").trim().slice(0, 40);
  const seal = (selo ?? "").trim().slice(0, 40);

  let found:
    | {
        protocolNumber: string;
        createdAt: Date;
        updatedAt: Date;
        applicantName: string;
        service: string;
        status: string;
        documents: string[];
      }
    | undefined;
  if (protocolNumber && seal) {
    try {
      const request = await findByProtocol(tenant.slug, protocolNumber);
      if (
        request &&
        verifyProtocolProofSeal(
          proofLinkKey,
          tenant.slug,
          request.protocolNumber,
          seal,
        )
      ) {
        const service = serviceOf(tenant, request);
        if (service && request.applicantName) {
          found = {
            protocolNumber: request.protocolNumber,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            applicantName: request.applicantName,
            service,
            status: statusLabel(request.kind as RequestKind, request.status),
            documents: await protocolledDocumentsWith(
              db,
              tenant.slug,
              request.id,
            ),
          };
        }
      }
    } catch (error) {
      console.error("protocolo.comprovante", error);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-10 md:py-16">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        {tenant.name}
      </span>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
        Comprovante de apresentação para protocolo
      </h1>
      {!found ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-brand-alert px-4 py-3 text-sm leading-relaxed text-brand-text-soft"
        >
          Comprovante não encontrado. Confira se o QR Code foi lido por inteiro
          ou fale com a serventia.
        </p>
      ) : (
        <>
          <p className="mt-4 rounded-xl border border-brand-border bg-brand-tint px-4 py-3 text-sm leading-relaxed text-brand-text">
            Esta página confirma que o pedido abaixo foi apresentado a esta
            serventia. Ela só mostra os dados: não dá acesso aos documentos nem
            permite movimentar o protocolo.
          </p>
          <dl className="mt-5 grid gap-3 rounded-2xl border border-brand-border bg-brand-card p-5 text-sm">
            {(
              [
                ["Protocolo", found.protocolNumber],
                [
                  "Data e hora do protocolo",
                  formatOfficeDateTime(found.createdAt),
                ],
                ["Requerente", found.applicantName],
                ["Serviço pedido", found.service],
                ["Andamento atual", found.status],
                ["Última atualização", formatOfficeDateTime(found.updatedAt)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-brand-faint">{label}</dt>
                <dd className="font-semibold text-brand-text">{value}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-6 font-serif text-lg font-semibold text-brand-primary">
            Documentos apresentados
          </h2>
          {found.documents.length === 0 ? (
            <p className="mt-2 text-sm text-brand-muted">
              Nenhum documento anexado no protocolo.
            </p>
          ) : (
            <ol className="mt-2 list-decimal pl-5 text-sm text-brand-text">
              {found.documents.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ol>
          )}
          <p className="mt-6 text-xs leading-relaxed text-brand-muted">
            A apresentação para protocolo não significa que o ato já foi
            praticado. Em caso de dúvida, confirme com a serventia.
          </p>
        </>
      )}
    </div>
  );
}
