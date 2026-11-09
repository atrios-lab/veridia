"use client";

import { createContext, useContext } from "react";
import { Icon } from "./icon.tsx";

// The demonstration office's warnings (see `demo` in core/tenant/schema.ts).
// The layout says once whether the office is a demonstration; every form
// asks here instead of being handed a prop, so a form that gains the notice
// does not change its signature, and a real office renders nothing at all.

const DemoContext = createContext(false);

export function DemoProvider({
  demo,
  children,
}: {
  demo: boolean;
  children: React.ReactNode;
}) {
  return <DemoContext value={demo}>{children}</DemoContext>;
}

/** The bar on top of every public page of a demonstration office. The
 * layout renders it only for one, so it reads no context. */
export function DemoBanner({ officeName }: { officeName: string }) {
  return (
    <div
      role="note"
      className="bg-brand-primary px-4 py-2 text-center text-[12.5px] leading-snug text-white md:text-[13px]"
    >
      <strong>Site de demonstração.</strong> O {officeName} não existe. Não
      envie dados reais.
    </div>
  );
}

/** Next to a public form's submit button. */
export function DemoFormNotice({ className = "" }: { className?: string }) {
  const demo = useContext(DemoContext);
  if (!demo) return null;
  return (
    <p
      role="note"
      className={`flex items-start gap-2.5 rounded-xl border border-brand-border bg-brand-tint px-3.5 py-3 text-[12.5px] leading-relaxed text-brand-primary ${className}`}
    >
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Demonstração:</strong> este cartório não existe e ninguém vai
        atender o envio. Use nome, CPF e contato inventados, nunca os seus.
      </span>
    </p>
  );
}
