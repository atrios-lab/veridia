import type { ReactNode } from "react";
import { BackLink } from "../../_components/back-link.tsx";

/** A screen of the RI system: title, one line under it, the action. */
export function RiPage({
  title,
  description,
  actions,
  back,
  children,
  wide,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Absent: back to the Mesa do RI. `null`: none (the Mesa itself). */
  back?: { href: string; label: string } | null;
  children: ReactNode;
  /** Tables use the whole width; forms stay readable. */
  wide?: boolean;
}) {
  const way =
    back === undefined ? { href: "/admin/ri", label: "Mesa do RI" } : back;
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-5 px-4 py-6 md:px-8 ${wide ? "max-w-7xl" : "max-w-5xl"}`}
    >
      {way && <BackLink href={way.href} label={way.label} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </main>
  );
}

/** A white block of the screen with its heading. */
export function Panel({
  id,
  title,
  description,
  actions,
  children,
}: {
  /** The anchor a link can point at ("#encerrar"). */
  id?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-xl border bg-card px-4 py-4 shadow-xs md:px-5"
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** A row of "label: value" for the detail screens. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-foreground">
        {value === "" || value === null || value === undefined ? (
          <span className="text-muted-foreground">não informado</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
