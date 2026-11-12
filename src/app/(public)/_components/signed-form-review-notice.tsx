import {
  GOVBR_SIGNER_URL,
  SIGNED_FORM_DIRECT_PATH,
  SIGNED_FORM_MESSAGES,
  SIGNED_FORM_REPLACE_QUESTION,
} from "@/core/request/signed-form-check.ts";
import { Icon } from "./icon.tsx";

/**
 * The requerimento sent was not accepted on its own (decision of
 * 12/11/2026): why, the right requerimento beside it, and the two ways
 * on: send another file, or download it, sign it digitally on gov.br and
 * send it back, which is accepted there and then. Every screen that shows
 * a requerimento under review shows this, the same words.
 */
export function SignedFormReviewNotice({
  protocolNumber,
  accessKey,
  onReplace,
}: {
  protocolNumber: string;
  accessKey: string;
  /** Opens the upload again, where the screen has it right here. */
  onReplace?: () => void;
}) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-2.5 rounded-[10px] border-[1.5px] border-brand-accent bg-brand-accent-soft px-3.5 py-3"
    >
      <span className="text-[13px] font-bold text-brand-primary">
        Requerimento em análise
      </span>
      <span className="text-[12.5px] leading-relaxed text-brand-accent-ink">
        {SIGNED_FORM_MESSAGES.review}
      </span>
      <span className="text-[12.5px] font-semibold text-brand-primary">
        {SIGNED_FORM_REPLACE_QUESTION}
      </span>
      <span className="text-[12px] leading-relaxed text-brand-text-soft">
        {SIGNED_FORM_DIRECT_PATH}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <form
          action="/solicitar/requerimento"
          method="post"
          target="_blank"
          rel="noopener"
        >
          <input type="hidden" name="protocolNumber" value={protocolNumber} />
          <input type="hidden" name="accessKey" value={accessKey} />
          <input type="hidden" name="documento" value="requerimento" />
          <button type="submit" className="btn btn-primary btn-sm">
            <Icon name="download" className="h-3.5 w-3.5" strokeWidth={2} />
            Baixar o requerimento correto
          </button>
        </form>
        <a
          href={GOVBR_SIGNER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          Assinar no gov.br
        </a>
        {onReplace && (
          <button
            type="button"
            onClick={onReplace}
            className="btn btn-ghost btn-sm"
          >
            Anexar outro arquivo
          </button>
        )}
      </span>
    </section>
  );
}
