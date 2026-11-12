import Link from "next/link";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";

export function LiveChatCard({
  citizenName,
  subject,
  waitMinutes,
}: {
  citizenName: string;
  subject: string;
  waitMinutes: number;
}) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 flex-none rounded-full bg-success" />
        <span className="text-xs font-medium text-muted-foreground">
          Acontecendo agora
        </span>
      </div>
      <h2 className="mt-2 text-base font-semibold text-foreground">
        {citizenName} aguarda no chat
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {subject} · esperando há {waitMinutes} min
      </p>
      <Link
        href="/admin/atendimento"
        className={cn(buttonVariants(), "mt-4 w-full")}
      >
        Assumir conversa
      </Link>
    </section>
  );
}
