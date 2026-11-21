import Link from "next/link";
import { KIND_INFO } from "@/core/cedulas/especies.ts";
import { db } from "@/db/index.ts";
import { listAnalysesWith } from "@/lib/cedulas.ts";
import { buttonVariants } from "../../../../_ui/button.tsx";

/**
 * The análise de cédulas from the pedido (decision of 21/11/2026: "pelo
 * pedido do balcão online"): the analysis opens with the pedido's files
 * marked and stays linked to the protocol; the files stay in the pedido.
 */
export async function CedulaSection({
  tenantSlug,
  requestId,
}: {
  tenantSlug: string;
  requestId: string;
}) {
  const linked = await listAnalysesWith(db, tenantSlug, { requestId }).catch(
    () => [],
  );
  const base = "/admin/utilitarios/cedulas";
  return (
    <section className="rounded-xl border bg-card p-6">
      <h4 className="text-base font-semibold text-foreground">
        Análise de cédula
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Trouxe uma cédula de crédito ou um aditivo? A análise diz a espécie, o
        livro, os atos, o prazo e como cobrar, e gera os modelos.
      </p>
      {linked.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {linked.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="mr-auto font-medium text-foreground">
                {KIND_INFO[a.kind].label}
              </span>
              <Link
                href={`${base}/${a.id}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                Abrir
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`${base}/nova?pedido=${requestId}`}
        className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-3`}
      >
        Analisar cédula
      </Link>
    </section>
  );
}
