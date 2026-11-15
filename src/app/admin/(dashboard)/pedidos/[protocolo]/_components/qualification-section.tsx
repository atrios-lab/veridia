import Link from "next/link";
import { actName, STATUS_LABELS } from "@/core/qualificacao/qualificacao.ts";
import { db } from "@/db/index.ts";
import { qualificationsOfProtocolWith } from "@/lib/qualificacao.ts";
import { buttonVariants } from "../../../../_ui/button.tsx";

/**
 * The qualificação of the título this pedido brought (change
 * qualificacao-de-titulos): open it with the pedido's data, follow its
 * notes. Only for who holds the qualificação's permission.
 */
export async function QualificationSection({
  tenantSlug,
  protocol,
}: {
  tenantSlug: string;
  protocol: string;
}) {
  const linked = await qualificationsOfProtocolWith(
    db,
    tenantSlug,
    protocol,
  ).catch(() => []);
  const base = "/admin/utilitarios/qualificacao";
  return (
    <section className="rounded-xl border bg-card p-6">
      <h4 className="text-base font-semibold text-foreground">
        Qualificação do título
      </h4>
      <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
        Examine o título e responda com a nota devolutiva (as exigências) ou com
        a qualificação positiva. A nota assinada pode ser entregue ao cidadão em
        “Entrega ao cidadão”.
      </p>
      {linked.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {linked.map((q) => (
            <li
              key={q.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="mr-auto font-medium text-foreground">
                {actName(q.data)} · {STATUS_LABELS[q.status]}
                {q.notes.length
                  ? ` · ${q.notes
                      .map((n) =>
                        n.kind === "positiva"
                          ? `positiva nº ${n.number}`
                          : `nota nº ${n.number}`,
                      )
                      .join(", ")}`
                  : ""}
              </span>
              <Link
                href={`${base}/${q.id}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                Abrir
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`${base}/nova?pedido=${encodeURIComponent(protocol)}`}
        className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-3`}
      >
        {linked.length
          ? "Abrir outra qualificação"
          : "Qualificar o título deste pedido"}
      </Link>
    </section>
  );
}
