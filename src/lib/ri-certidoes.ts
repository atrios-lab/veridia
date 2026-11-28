import "server-only";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import { situationOf } from "@/core/ri/acts.ts";
import {
  CERTIDAO_LABELS,
  type CertidaoKind,
  certidaoSections,
} from "@/core/ri/certidao.ts";
import { LGPD_ATTENTION } from "@/core/ri/closing-notes.ts";
import { formatCnm } from "@/core/ri/cnm.ts";
import { fichaContent } from "@/core/ri/ficha.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { recordAuditWith } from "./audit.ts";
import { type Actor, loadAcervo, propertyDetailWith, RiError } from "./ri.ts";
import { listBooksWith } from "./ri-books.ts";
import { riSignerFor } from "./ri-docs.ts";

/**
 * The certidões of the RI as documents (decision of 26/11/2026): PDF ready
 * or Word to adjust, the selo (number and, if attached, its image) chosen
 * at each emission. Nothing is stored but the audit of who issued what.
 */

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export interface CertidaoRequest {
  kind: CertidaoKind;
  propertyId?: string;
  questions?: string[];
  searched?: { name: string; document: string };
  requester?: string;
  seal?: { number: string; image?: Uint8Array };
  withSignatureImage?: boolean;
  /** The custas note the staff member inserted (none when not clicked). */
  custas?: string | null;
}

/** Matrículas where the person is an owner today (for the negativa). */
async function ownedBy(
  tenantSlug: string,
  searched: { name: string; document: string },
): Promise<number[]> {
  const acervo = await loadAcervo(tenantSlug);
  const doc = searched.document.replace(/\D/g, "");
  const name = norm(searched.name);
  const out: number[] = [];
  for (const p of acervo.properties) {
    if (p.book !== 2) continue;
    const owners = situationOf(acervo.acts.get(p.id) ?? []).owners;
    if (
      owners.some(
        (o) =>
          (doc && o.document.replace(/\D/g, "") === doc) ||
          (name && norm(o.name) === name),
      )
    ) {
      out.push(p.number);
    }
  }
  return out;
}

export async function certidaoDocumentFor(
  tenant: Tenant,
  request: CertidaoRequest,
  actor: Actor,
): Promise<{ document: RequerimentoDocument; fileName: string }> {
  const { signer, settings } = await riSignerFor(tenant);
  const office = officialName(tenant);
  const place = `${tenant.location.city}/${tenant.location.state}`;
  const dateText = LONG_DATE.format(new Date());
  let reference: string | undefined;
  let fileName: string = request.kind;
  let ficha: ReturnType<typeof fichaContent> | undefined;
  let situation: ReturnType<typeof situationOf> | undefined;
  let bookRef: { volume: string; ficha: string } | undefined;
  let headline: string | undefined;
  let idLabel: string | undefined;

  if (request.kind === "negativa") {
    const searched = request.searched ?? { name: "", document: "" };
    if (!searched.name.trim() && !searched.document.trim()) {
      throw new RiError("Informe o nome ou o CPF/CNPJ pesquisado.");
    }
    const found = await ownedBy(tenant.slug, searched);
    if (found.length) {
      throw new RiError(
        `Não dá para emitir a negativa: consta(m) imóvel(is) em nome desta pessoa, na(s) matrícula(s) nº ${found.join(", ")}. Emita a certidão de inteiro teor ou de ônus dessas matrículas.`,
      );
    }
  } else {
    const detail = request.propertyId
      ? await propertyDetailWith(db, tenant.slug, request.propertyId)
      : null;
    if (!detail || detail.property.deletedAt) {
      throw new RiError("Escolha a matrícula da certidão.");
    }
    if (request.kind === "quesitos" && !request.questions?.length) {
      throw new RiError("Escreva os quesitos, um por linha.");
    }
    const p = detail.property;
    ficha = fichaContent({
      office: {
        name: office,
        city: tenant.location.city,
        state: tenant.location.state,
      },
      property: p,
      acts: detail.acts,
      signer,
    });
    situation = situationOf(detail.acts);
    const n = String(p.number).padStart(3, "0");
    const open = (await listBooksWith(db, tenant.slug)).find(
      (b) => b.book === p.book && !b.deletedAt && !b.closedOn,
    );
    bookRef = {
      volume: open?.volume ?? String(p.book),
      ficha: (p.ficha || String(p.number)).padStart(3, "0"),
    };
    idLabel = p.location === 1 ? "IMÓVEL RURAL" : "IMÓVEL URBANO";
    headline = `${p.book === 3 ? "REGISTRO" : "MATRÍCULA"} Nº ${p.number.toLocaleString("pt-BR")}${p.openedOn ? ` - Data: ${p.openedOn.split("-").reverse().join("/")}` : ""}${p.cnm ? ` - CNM: ${formatCnm(p.cnm)}` : ""}.`;
    reference =
      p.book === 3
        ? `o registro nº ${n} do Livro 3 (Registro Auxiliar)`
        : `a matrícula nº ${n} do Livro 2 (Registro Geral)`;
    fileName = `${request.kind}-matricula-${n}`;
  }

  const sections = certidaoSections({
    kind: request.kind,
    place,
    dateText,
    reference,
    ficha,
    situation,
    questions: request.questions,
    searched: request.searched,
    requester: request.requester?.trim() || undefined,
    book: bookRef,
    headline,
    idLabel,
  });

  await recordAuditWith(db, {
    tenantSlug: tenant.slug,
    actorId: actor.id,
    action: "ri.certidao-issue",
    targetType: "ri-property",
    targetId: request.propertyId ?? null,
    reason: `${CERTIDAO_LABELS[request.kind]}${request.seal?.number ? `, selo ${request.seal.number}` : ""}`,
  });

  return {
    fileName,
    document: {
      // Only the name of the certidão on top (decision of 26/11/2026).
      eyebrow: "",
      title: CERTIDAO_LABELS[request.kind],
      subtitle: "",
      dateLine: `${place}, ${dateText}.`,
      office: [office, tenant.subtitle],
      sections: sections.map((x) => ({
        heading: x.heading ?? "",
        paragraphs: x.paragraphs,
      })),
      seal: request.seal,
      compactSignature: true,
      closingNotes: [
        ...(request.custas ? [{ text: request.custas }] : []),
        { heading: "ATENÇÃO!", text: LGPD_ATTENTION },
      ],
      signee: signer?.name,
      signatureImage: request.withSignatureImage
        ? (settings.signatureImage ?? undefined)
        : undefined,
      signature: signer ? [signer.title] : [],
      footer: `${office} · ${tenant.legalFooter}`,
    },
  };
}
