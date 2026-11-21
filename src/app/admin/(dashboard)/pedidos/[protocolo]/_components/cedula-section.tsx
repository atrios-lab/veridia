import Link from "next/link";
import { KIND_INFO } from "@/core/cedulas/especies.ts";
import { db } from "@/db/index.ts";
import {
  cedulaInRequestWith,
  listAnalysesWith,
  type RequestFileRef,
} from "@/lib/cedulas.ts";
import { buttonVariants } from "../../../../_ui/button.tsx";

const SEEN = {
  ato: "pelo ato pedido",
  nome: "pelo nome do arquivo",
  texto: "pelo texto do arquivo",
} as const;

/**
 * The análise de cédulas from the pedido (decisions of 21/11/2026): shown
 * only when the pedido brought a cédula, which the system sees by itself
 * (the act, a file's name, a file's text) even when the person chose
 * another act at the protocol; or when an analysis is already linked.
 */
export async function CedulaSection({
  tenantSlug,
  requestId,
  details,
  actName,
  files,
}: {
  tenantSlug: string;
  requestId: string;
  details: unknown;
  actName: string;
  files: RequestFileRef[];
}) {
  const [linked, seen] = await Promise.all([
    listAnalysesWith(db, tenantSlug, { requestId }).catch(() => []),
    cedulaInRequestWith(db, tenantSlug, {
      requestId,
      details,
      actName,
      files,
    }).catch(() => null),
  ]);
  if (!seen && linked.length === 0) return null;
  const base = "/admin/utilitarios/cedulas";
  return (
    <section className="rounded-xl border-2 border-primary/30 bg-card p-6">
      <h4 className="text-base font-semibold text-foreground">
        Análise de cédula
      </h4>
      {seen && (
        <p className="mt-1 text-sm text-foreground">
          O sistema viu uma{" "}
          <strong className="font-semibold">
            {KIND_INFO[seen.kind].label}
          </strong>{" "}
          neste pedido, {SEEN[seen.from]}
          {seen.from === "ato" ? "" : ` (${seen.file})`}. A análise diz o livro,
          os atos, o prazo e como cobrar, e gera os modelos e a nota de
          exigência.
        </p>
      )}
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
        className={`${buttonVariants({ variant: linked.length ? "outline" : "default", size: "sm" })} mt-3`}
      >
        {linked.length ? "Analisar de novo" : "Analisar cédula"}
      </Link>
    </section>
  );
}
