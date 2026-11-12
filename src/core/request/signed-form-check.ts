import { z } from "zod";

/**
 * The signed requerimento, read when the citizen sends it (decision of
 * 12/11/2026). The pedido made on the site reaches the office only after
 * it: first the requerimento, signed; then the documents.
 *
 * - "accepted": the requerimento of this very protocol, with a digital
 *   signature in the PDF (gov.br's or any ICP-Brasil signer): the pedido
 *   goes on by itself.
 * - "review": the signature is not one the system recognises (a photo, a
 *   scan, a PDF signed by hand): the office checks it, and the citizen is
 *   told that a requerimento signed by hand must have the signature
 *   recognised (firma reconhecida) and asked whether to send another file.
 * - "wrong": a PDF that reads, and is not the requerimento of this
 *   protocol: refused there and then.
 *
 * The digital signature is recognised by the PDF's own signature field
 * (its ByteRange), the way the office's signer marks it; the system does
 * not judge a signature made by hand on paper.
 */

export type SignedFormVerdict = "accepted" | "review" | "wrong";

export interface SignedFormReading {
  mimeType: string;
  /** The PDF's text, empty for an image or a scan without text. */
  text: string;
  digitallySigned: boolean;
  protocolNumber: string;
}

/** Spaces and line breaks out: a protocol may come split in the text. */
const squeeze = (text: string) => text.replace(/\s+/g, "").toUpperCase();

/** Enough text to say what the PDF is: a scan carries none. */
const MIN_TEXT = 40;

export function judgeSignedForm(r: SignedFormReading): {
  verdict: SignedFormVerdict;
  /** For the office and the history: why. */
  reason: string;
} {
  const isPdf = r.mimeType === "application/pdf";
  const text = squeeze(r.text);
  if (!isPdf || text.length < MIN_TEXT) {
    return {
      verdict: "review",
      reason: isPdf
        ? "PDF sem texto legível (escaneado): assinatura não reconhecida pelo sistema."
        : "Foto ou imagem: assinatura não reconhecida pelo sistema.",
    };
  }
  const ours =
    text.includes("REQUERIMENTO") && text.includes(squeeze(r.protocolNumber));
  if (!ours) {
    const other = /REQ\.\d{4}\.\d{3,}/.exec(text)?.[0];
    return {
      verdict: "wrong",
      reason: other
        ? `É o requerimento de outro protocolo (${other}).`
        : "Não é o requerimento deste pedido.",
    };
  }
  return r.digitallySigned
    ? {
        verdict: "accepted",
        reason: "Requerimento deste protocolo, com assinatura digital.",
      }
    : {
        verdict: "review",
        reason:
          "Requerimento deste protocolo, sem assinatura digital reconhecida.",
      };
}

/** What the request keeps of the last reading and of the office's check. */
export const signedFormCheckSchema = z.object({
  verdict: z.enum(["accepted", "review", "returned"]),
  reason: z.string().max(1000),
  checkedAt: z.string(),
  /** The office's reason when it sent the file back. */
  returnedReason: z.string().max(5000).optional(),
});
export type SignedFormCheck = z.infer<typeof signedFormCheckSchema>;

export function readSignedFormCheck(details: unknown): SignedFormCheck | null {
  const raw = (details as { signedFormCheck?: unknown } | null)
    ?.signedFormCheck;
  const parsed = signedFormCheckSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** What the citizen reads, by verdict. */
export const SIGNED_FORM_MESSAGES = {
  accepted:
    "Requerimento conferido: é o requerimento deste protocolo e a assinatura digital foi reconhecida. O pedido seguiu para o cartório. Agora anexe os documentos pedidos.",
  review:
    "Seu requerimento está em análise pelo cartório porque não segue o padrão correto ou não contém assinatura digital. Requerimento assinado a punho deve ter firma reconhecida.",
  wrong:
    "Anexe primeiro o requerimento gerado para este protocolo, devidamente assinado; os demais documentos são anexados depois. Se preferir, faça isso em outro momento: o link e a chave de acesso estão no e-mail informado no pedido.",
} as const;

/** Asked after a "review", next to the right requerimento (decision of
 * 12/11/2026). */
export const SIGNED_FORM_REPLACE_QUESTION =
  "Deseja anexar outro arquivo ou baixar o requerimento correto e assiná-lo agora digitalmente?";

/** How to be accepted there and then. */
export const SIGNED_FORM_DIRECT_PATH =
  "Baixe o requerimento deste protocolo, assine pelo gov.br e anexe o arquivo assinado: seguindo esses passos, ele é aceito na hora e o pedido segue para o cartório.";

/** The gov.br signer, where the citizen signs the PDF for free. */
export const GOVBR_SIGNER_URL = "https://assinador.iti.br/";
