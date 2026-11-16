"use client";

import { Popover, PopoverContent, PopoverTrigger } from "../_ui/popover.tsx";

/**
 * The discreet "!" beside each service in the sidebar (decision of
 * 16/11/2026: "exclamações discretas onde ensine todos os nossos
 * serviços"): what the service is for, in the words of the screen's own
 * help, so the two never say different things. The step by step stays on
 * the screen, in the "!" beside its title. Opens on hover with a mouse and
 * on tap on a phone; it sits beside the link, never inside it, so opening
 * it does not navigate.
 */
export function NavHint({
  label,
  text,
  className = "",
}: {
  /** The service's name, as the menu shows it. */
  label: string;
  /** What it is for (ScreenHelp.purpose). */
  text: string;
  /** Where it sits in the row (absolute, right side). */
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={250}
        aria-label={`O que é: ${label}`}
        className={`absolute top-1/2 z-10 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-current text-xs leading-none font-bold text-sidebar-label opacity-55 transition-opacity group-data-[collapsible=icon]:hidden hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-sidebar-ring aria-expanded:opacity-100 ${className}`}
      >
        !
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={14}
        className="w-80 gap-2 text-left"
      >
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-sm leading-relaxed text-foreground">{text}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          Para o passo a passo, abra a tela e clique no ! ao lado do título.
        </span>
      </PopoverContent>
    </Popover>
  );
}
