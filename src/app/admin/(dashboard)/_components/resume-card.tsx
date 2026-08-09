import Link from "next/link";

export function ResumeCard({
  protocolNumber,
  description,
  href,
}: {
  protocolNumber: string;
  description: string;
  href: string;
}) {
  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
        Continuar de onde parou
      </span>
      <p className="mt-2.5 text-[13px] font-semibold text-admin-primary">
        {protocolNumber}
      </p>
      <p className="mt-0.5 text-[12px] text-admin-muted">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-block rounded-[8px] border border-admin-input-border bg-admin-card px-3.5 py-2 text-[12px] font-bold text-admin-primary"
      >
        Continuar
      </Link>
    </div>
  );
}
