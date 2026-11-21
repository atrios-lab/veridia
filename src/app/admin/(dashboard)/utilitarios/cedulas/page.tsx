import Link from "next/link";
import { KIND_INFO } from "@/core/cedulas/especies.ts";
import { db } from "@/db/index.ts";
import { listAnalysesWith } from "@/lib/cedulas.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { requireCedulas } from "./_access.ts";

export const metadata = { title: "Análise de cédulas" };

const BASE = "/admin/utilitarios/cedulas";
const SOURCE = {
  assistente: "Lida pelo Assistente Virtual",
  leitura: "Lida pelo texto",
  manual: "Preenchida à mão",
} as const;

const dateOf = (date: Date) =>
  date.toLocaleDateString("pt-BR", { timeZone: OFFICE_TIME_ZONE });

export default async function CedulasPage({
  searchParams,
}: {
  searchParams: Promise<{ apagadas?: string; apagada?: string }>;
}) {
  await requireCedulas();
  const { apagadas, apagada } = await searchParams;
  const removedView = apagadas === "1";
  const tenant = await getTenant();
  const analyses = await listAnalysesWith(db, tenant.slug, {
    removed: removedView,
  });

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Análise de cédulas"
        description="Para cada cédula de crédito e seus aditivos: a espécie, o livro, os atos (registro, averbação, remissão), o cartório competente, o prazo, como cobrar e os modelos dos atos, conforme a lei em vigor."
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        {apagada === "1" && (
          <output className="block rounded-xl border border-border bg-muted px-5 py-3 text-sm text-foreground">
            Análise apagada. Ela continua guardada em Apagadas e pode ser
            restaurada.
          </output>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`${BASE}/nova`} className={buttonVariants()}>
            Nova análise
          </Link>
          <Link
            href={`${BASE}/configuracao`}
            className={buttonVariants({ variant: "outline" })}
          >
            Aprendizado e cobrança
          </Link>
          <Link
            href={removedView ? BASE : `${BASE}?apagadas=1`}
            className={buttonVariants({ variant: "ghost" })}
          >
            {removedView ? "Voltar à lista" : "Ver apagadas"}
          </Link>
        </div>

        {analyses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            {removedView
              ? "Nenhuma análise apagada."
              : "Nenhuma cédula analisada ainda. Clique em Nova análise e anexe a cédula e os aditivos."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {analyses.map((a) => (
              <li key={a.id}>
                <Link
                  href={`${BASE}/${a.id}`}
                  className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-muted/60 md:flex-row md:items-center md:justify-between"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                      {KIND_INFO[a.kind].label}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {a.title}
                      {a.data.addenda.length > 0
                        ? ` · ${a.data.addenda.length} ${a.data.addenda.length === 1 ? "aditivo" : "aditivos"}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {a.protocolNumber && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-foreground">
                        Pedido {a.protocolNumber}
                      </span>
                    )}
                    <span>{SOURCE[a.source]}</span>
                    <span>{dateOf(a.createdAt)}</span>
                    {a.removedReason && <span>Motivo: {a.removedReason}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
