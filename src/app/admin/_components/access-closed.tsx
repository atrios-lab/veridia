import Image from "next/image";
import { ACCESS_CLOSED_NOTICE } from "@/core/auth/access-hours.ts";
import { Button } from "../_ui/button.tsx";
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
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border bg-card px-6 py-8 shadow-xs sm:px-8">
        {/* The office's seal (the light one) and its name, as OfficeMark in
            sidebar.tsx draws them: the only place the office shows here. */}
        <div className="flex items-center gap-2.5">
          <Image
            src={seal}
            alt=""
            width={32}
            height={32}
            className="size-8 flex-none object-contain"
          />
          <p className="text-sm leading-tight font-semibold text-foreground">
            {officeName}
          </p>
        </div>
        <h1 className="mt-6 text-2xl leading-tight font-semibold text-foreground">
          Acesso indisponível neste horário
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {personName.split(" ")[0]}, o painel da serventia fica aberto das{" "}
          <strong>{start}</strong> às <strong>{end}</strong> (horário de
          Brasília). Fora desse horário, o acesso depende de liberação do
          Tabelião/Registrador.
        </p>
        <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {ACCESS_CLOSED_NOTICE}
        </p>
        <h2 className="mt-6 text-base font-semibold text-foreground">
          Precisa acompanhar uma demanda agora?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Peça a liberação ao Tabelião/Registrador. Ele vê o pedido no painel e
          pode liberar só hoje ou de forma permanente. O pedido fica registrado
          na auditoria.
        </p>
        <AccessReleaseForm pending={pending} />
        <form action={signOut} className="mt-6 border-t pt-4">
          <Button
            type="submit"
            variant="link"
            className="h-auto px-0 text-muted-foreground underline hover:text-foreground"
          >
            Sair do painel
          </Button>
        </form>
      </div>
    </main>
  );
}
