/**
 * The platform's mark where a signature is verified (decision of
 * 11/11/2026): the Átrios "chapéu", the arch of its logo alone, with
 * "Assinador digital ÁTRIOS" and the support line, the same as at the end
 * of the band on every signed page.
 */
export function AtriosMark() {
  return (
    <div className="mt-6 flex items-center gap-3 border-t border-brand-border pt-4 text-atrios-navy">
      <svg
        viewBox="0 0 100 100"
        className="h-7 w-7 flex-none opacity-85"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M0 100 L0 22 L46 0 L46 28 L28 37 L28 100 Z" />
        <path d="M54 0 L100 22 L100 100 L72 100 L72 37 L54 28 Z" />
      </svg>
      <p className="text-[12.5px] leading-tight">
        Assinador digital <span className="font-semibold">ÁTRIOS</span>
        <br />
        <a href="tel:08008780304" className="font-bold">
          0800 878 0304
        </a>
      </p>
    </div>
  );
}
