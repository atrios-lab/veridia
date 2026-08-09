import Link from "next/link";

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
    <div className="rounded-[14px] bg-admin-primary p-5 text-white">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 flex-none rounded-full bg-admin-on-dark-muted" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-on-dark-subtitle">
          Acontecendo agora
        </span>
      </div>
      <p className="mt-3 text-[14px] font-semibold">
        {citizenName} aguarda no chat
      </p>
      <p className="mt-0.5 text-[12.5px] text-admin-on-dark-subtitle">
        {subject} · esperando há {waitMinutes} min
      </p>
      <Link
        href="/admin/atendimento"
        className="mt-3.5 block rounded-[9px] bg-admin-on-dark-accent py-2.5 text-center text-[12.5px] font-bold text-admin-primary"
      >
        Assumir conversa
      </Link>
    </div>
  );
}
