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
      <Link href={href} className="btn btn-admin-secondary btn-sm mt-3">
        Continuar
      </Link>
    </div>
  );
}
