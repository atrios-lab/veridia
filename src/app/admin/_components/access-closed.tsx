import Image from "next/image";
import { ACCESS_CLOSED_NOTICE } from "@/core/auth/access-hours.ts";
import { signOut } from "../actions.ts";
import { AccessReleaseForm } from "./access-release-form.tsx";

/**
 * What a person outside the panel's hours sees instead of the panel
 * (decision of 11/11/2026): why it is closed, until when, and how to ask
 * the Tabelião/Registrador for a release.
 */
export function AccessClosed({
  seal,
  officeName,
  personName,
  start,
  end,
  pending,
}: {
  seal: string;
  officeName: string;
  personName: string;
  start: string;
  end: string;
  /** A request already waiting for the holder. */
  pending: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-admin-surface px-4 py-10">
      <div className="w-full max-w-[520px] rounded-[16px] border border-admin-border bg-admin-card px-7 py-8">
        <div className="flex items-center gap-3">
          <Image
            src={seal}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10"
          />
          <p className="font-serif text-[15px] font-semibold uppercase tracking-[0.04em] text-admin-primary">
            {officeName}
          </p>
        </div>
        <h1 className="mt-5 font-serif text-[24px] font-semibold leading-tight text-admin-primary">
          Acesso indisponível neste horário
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-admin-text">
          {personName.split(" ")[0]}, o painel da serventia fica aberto das{" "}
          <strong>{start}</strong> às <strong>{end}</strong> (horário de
          Brasília). Fora desse horário, o acesso depende de liberação do
          Tabelião/Registrador.
        </p>
        <p className="mt-3 rounded-[12px] bg-admin-input-bg px-4 py-3 text-[12.5px] leading-relaxed text-admin-muted">
          {ACCESS_CLOSED_NOTICE}
        </p>
        <h2 className="mt-5 text-[13.5px] font-bold text-admin-primary">
          Precisa acompanhar uma demanda agora?
        </h2>
        <p className="mt-1 text-[12.5px] text-admin-muted">
          Peça a liberação ao Tabelião/Registrador. Ele vê o pedido no painel e
          pode liberar só hoje ou de forma permanente. O pedido fica registrado
          na auditoria.
        </p>
        <AccessReleaseForm pending={pending} />
        <form
          action={signOut}
          className="mt-5 border-t border-admin-border pt-4"
        >
          <button
            type="submit"
            className="text-[12.5px] font-semibold text-admin-muted underline hover:text-admin-primary"
          >
            Sair do painel
          </button>
        </form>
      </div>
    </main>
  );
}
