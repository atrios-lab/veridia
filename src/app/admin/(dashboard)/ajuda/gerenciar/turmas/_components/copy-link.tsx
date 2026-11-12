"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "../../../../../_ui/button.tsx";
import { Input } from "../../../../../_ui/input.tsx";

/**
 * A cohort's link, on screen and one click from the clipboard. Shown and
 * not only copied for the same reason as the reset link in Usuários: a
 * clipboard write can fail silently, and the person sending the link over
 * WhatsApp has to be able to select it by hand.
 */
export function CopyLink({ url }: { url: string }) {
  const field = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input
        ref={field}
        readOnly
        value={url}
        aria-label="Link da turma"
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 font-mono text-xs md:text-xs"
      />
      <Button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Link copiado.");
          } catch {
            field.current?.focus();
            toast.error("Não deu para copiar. Selecione o link e copie.");
          }
        }}
        variant="outline"
        size="sm"
        className="shrink-0"
      >
        Copiar
      </Button>
    </div>
  );
}
