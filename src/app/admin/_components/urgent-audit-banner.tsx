import Link from "next/link";

/**
 * On every screen of the Tabelião/Registrador while an urgent act of the
 * last 30 days waits for his look: an exclusion, the Pix key, an account,
 * access. It goes away only when he marks them as seen in Auditoria.
 */
export function UrgentAuditBanner({ count }: { count: number }) {
  return (
    <output className="mx-[30px] mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-admin-error-border bg-admin-error-bg px-4 py-2.5 text-[13px] text-admin-error-text max-md:mx-4">
      <span className="flex items-center gap-2 font-semibold">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-admin-error-text"
        />
        {count === 1
          ? "1 ato urgente aguarda a sua verificação na auditoria."
          : `${count} atos urgentes aguardam a sua verificação na auditoria.`}
      </span>
      <Link
        href="/admin/auditoria?nivel=urgente&pendentes=1"
        className="btn btn-admin-danger btn-sm"
      >
        Verificar agora
      </Link>
    </output>
  );
}
