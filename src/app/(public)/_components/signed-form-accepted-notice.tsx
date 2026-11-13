import { SIGNED_FORM_MESSAGES } from "@/core/request/signed-form-check.ts";
import { Icon } from "./icon.tsx";

/**
 * The requerimento was accepted (decision of 13/11/2026): said plainly, in
 * the site's own success ink, wherever the citizen sees the pedido right
 * after it, so nobody is left wondering whether it went through.
 */
export function SignedFormAcceptedNotice() {
  return (
    <section
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-[10px] border-[1.5px] border-brand-primary bg-brand-tint px-3.5 py-3"
    >
      <Icon
        name="check"
        className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
        strokeWidth={2.4}
      />
      <span className="flex flex-col gap-1">
        <span className="text-[13px] font-bold text-brand-primary">
          Requerimento aceito
        </span>
        <span className="text-[12.5px] leading-relaxed text-brand-text">
          {SIGNED_FORM_MESSAGES.accepted}
        </span>
      </span>
    </section>
  );
}
