import Link from "next/link";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";

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
    <section className="rounded-xl border bg-card p-6 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">
        Continuar de onde parou
      </h2>
      <p className="mt-3 text-sm font-medium text-foreground tabular-nums">
        {protocolNumber}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-4",
        )}
      >
        Continuar
      </Link>
    </section>
  );
}
