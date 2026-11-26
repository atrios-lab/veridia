import { buttonVariants } from "../_ui/button.tsx";
import { AdminIcon } from "./icon";

/**
 * Where "Assinar digitalmente" leads for any PDF the panel generates: the
 * assinador, with that PDF already on its list. Every new PDF route of the
 * panel offers it next to its print link (decision of 11/11/2026).
 */
export function signHref(pdfHref: string, title: string): string {
  return signBatchHref([{ pdf: pdfHref, title }]);
}

/** The digital version: a note in place of the line to sign by hand. */
const digitalOf = (pdfHref: string) =>
  `${pdfHref}${pdfHref.includes("?") ? "&" : "?"}assinatura=digital`;

/**
 * Several PDFs at once (up to 20, what the assinador takes in one go): the
 * fichas of a book, signed with the certificate and password typed once.
 */
export function signBatchHref(
  items: readonly { pdf: string; title: string }[],
): string {
  const params = new URLSearchParams();
  for (const item of items.slice(0, 20)) {
    params.append("origem", digitalOf(item.pdf));
    params.append("titulo", item.title);
  }
  return `/admin/utilitarios/assinador?${params}#assinar`;
}

/**
 * A document the panel generates, two ways (decision of 11/11/2026):
 * signed 100% digitally through the platform (band and QR on every page),
 * or printed to sign by hand. Either way it prints: the digital one opens
 * for printing with its QR once signed.
 */
export function SignOrPrint({
  pdfHref,
  title,
  size = "md",
}: {
  /** The panel route that generates the PDF. */
  pdfHref: string;
  /** How the signed document is called in the assinador. */
  title: string;
  size?: "sm" | "md";
}) {
  const sign = signHref(pdfHref, title);
  // "md" is the panel's default button size (36px).
  const buttonSize = size === "sm" ? "sm" : "default";
  return (
    <span className="inline-flex flex-wrap gap-2">
      <a href={sign} className={buttonVariants({ size: buttonSize })}>
        <AdminIcon name="lock" className="h-4 w-4" /> Assinar digitalmente
      </a>
      <a
        href={pdfHref}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "outline", size: buttonSize })}
        title="Abre o PDF para imprimir e assinar à mão"
      >
        <AdminIcon name="printer" className="h-4 w-4" /> Imprimir para assinar à
        mão
      </a>
    </span>
  );
}
