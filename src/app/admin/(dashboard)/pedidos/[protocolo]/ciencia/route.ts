import { getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import {
  buildCienciaDocument,
  type CienciaItem,
  shortText,
} from "@/core/request/ciencia-document.ts";
import {
  isOfficeDocumentKind,
  type ViewTarget,
  viewKey,
} from "@/core/request/citizen-view.ts";
import { deliveryLabel } from "@/core/request/delivery-name.ts";
import { readSearchAnswer } from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import {
  formatOfficeDate,
  formatOfficeDateTime,
} from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import {
  type CitizenViewRecord,
  listCitizenViewsWith,
} from "@/lib/citizen-views.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import {
  findByProtocol,
  listAttachments,
  listRequirementMessages,
  listRequirements,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** "formulario-exigencia" is the stored name of a form nobody named. */
function documentName(displayName: string): string {
  return /^formulario-exigencia(-\d+)?$/.test(displayName)
    ? "Formulário da exigência"
    : deliveryLabel(displayName);
}

/**
 * The comprovante de ciência of a request (decision of 16/11/2026): what the
 * office put on it, and when the citizen saw and opened each thing.
 */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ protocolo: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "requests.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const request = await findByProtocol(
    tenant.slug,
    decodeURIComponent((await params).protocolo),
  );
  if (!request || request.kind !== "service-request") {
    return new Response("Não encontrado", { status: 404 });
  }
  const [attachments, requirements, views] = await Promise.all([
    listAttachments(tenant.slug, request.id),
    listRequirements(tenant.slug, request.id),
    listCitizenViewsWith(db, tenant.slug, request.id),
  ]);
  const messages = await Promise.all(
    requirements.map((r) => listRequirementMessages(tenant.slug, r.id)),
  );
  const rows = new Map<string, CitizenViewRecord[]>();
  for (const view of views) {
    const key = viewKey(view.target, view.targetId);
    rows.set(key, [...(rows.get(key) ?? []), view]);
  }
  const item = (
    target: ViewTarget,
    id: string,
    label: string,
    document: boolean,
  ): CienciaItem => {
    const marks = rows.get(viewKey(target, id)) ?? [];
    const viewed = marks.find((m) => m.action === "viewed");
    const opened = marks.find((m) => m.action === "downloaded");
    const first = [viewed, opened]
      .filter((m): m is CitizenViewRecord => Boolean(m))
      .sort((a, b) => a.firstAt.getTime() - b.firstAt.getTime())[0];
    return {
      label,
      document,
      viewed: first ? formatOfficeDateTime(first.firstAt) : undefined,
      opened: opened ? formatOfficeDateTime(opened.firstAt) : undefined,
      ip: first?.firstIp ?? undefined,
    };
  };

  const items: CienciaItem[] = [];
  requirements.forEach((r, index) => {
    items.push(
      item(
        "requirement",
        r.id,
        `Exigência registrada em ${formatOfficeDate(r.createdAt)}: "${shortText(r.text)}"`,
        false,
      ),
    );
    for (const a of attachments.filter(
      (a) => a.requirementId === r.id && !a.heldForSignatureAt,
    )) {
      items.push(
        item(
          "document",
          a.id,
          `Documento da exigência "${documentName(a.displayName)}"`,
          true,
        ),
      );
    }
    for (const m of messages[index].filter((m) => m.author === "staff")) {
      for (const a of m.attachments) {
        items.push(
          item(
            "document",
            a.id,
            `Documento enviado na conversa da exigência "${a.displayName}"`,
            true,
          ),
        );
      }
    }
  });
  for (const a of attachments.filter(
    (a) =>
      isOfficeDocumentKind(a.kind) &&
      !a.requirementId &&
      !a.requirementMessageId &&
      !a.heldForSignatureAt,
  )) {
    items.push(
      item(
        "document",
        a.id,
        `Documento "${documentName(a.displayName)}"`,
        true,
      ),
    );
  }
  if (request.amountCents != null) {
    items.push(
      item(
        "amount",
        String(request.amountCents),
        `Valor do pedido de ${formatCents(request.amountCents)}`,
        false,
      ),
    );
  }
  const answer = readSearchAnswer(request.details);
  if (answer?.answeredAt) {
    items.push(item("answer", answer.answeredAt, "Resposta da busca", false));
  }

  const act = request.actId
    ? getActForTenant(tenant, request.actId)
    : undefined;
  const document = buildCienciaDocument(tenant, {
    protocolNumber: request.protocolNumber,
    actName: act?.name ?? "Pedido",
    applicantName: request.applicantName ?? undefined,
    issuedOn: today(),
    items,
    signee: session.user.name,
  });
  const pdf = await renderDocument(document, await brandFor(tenant));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ciencia-${request.protocolNumber.replace(/[^\w-]+/g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * "Assinar digitalmente" asks for the version without the line to sign by
 * hand (`?assinatura=digital`); printing gets the line.
 */
export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
