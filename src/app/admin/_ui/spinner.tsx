import { Loader2Icon } from "lucide-react";
import { cn } from "@/app/admin/_ui/cn.ts";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: an icon that announces the wait; an <output> cannot draw the spinner.
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Carregando"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
