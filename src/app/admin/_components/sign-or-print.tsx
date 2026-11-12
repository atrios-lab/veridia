import { AdminIcon } from "./icon";

/**
 * Where "Assinar digitalmente" leads for any PDF the panel generates: the
 * assinador, with that PDF already on its list. Every new PDF route of the
 * panel offers it next to its print link (decision of 11/11/2026).
 */
export function signHref(pdfHref: string, title: string): string {
  // The digital version: a note in place of the line to sign by hand.
  const digital = `${pdfHref}${pdfHref.includes("?") ? "&" : "?"}assinatura=digital`;
  return `/admin/utilitarios/assinador?${new URLSearchParams({
    origem: digital,
    titulo: title,
  })}#assinar`;
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
  return (
    <span className="inline-flex flex-wrap gap-2">
      <a href={sign} className={`btn btn-admin-primary btn-${size}`}>
        <AdminIcon name="lock" className="h-4 w-4" /> Assinar digitalmente
      </a>
      <a
        href={pdfHref}
        target="_blank"
        rel="noreferrer"
        className={`btn btn-admin-secondary btn-${size}`}
        title="Abre o PDF para imprimir e assinar à mão"
      >
        <AdminIcon name="printer" className="h-4 w-4" /> Imprimir para assinar à
        mão
      </a>
    </span>
  );
}
