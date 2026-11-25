import Link from "next/link";
import {
  CNM_PROBLEM_LABELS,
  cnmOf,
  cnmProblems,
  cnsDigits,
  formatCnm,
} from "@/core/ri/cnm.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { CnmTable } from "../_components/cnm-table.tsx";
import { RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "CNM" };

export default async function CnmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, tenant } = await requireRi();
  const filter = (await searchParams).filtro ?? "fora";
  const cns = cnsDigits(tenant.cns) ?? tenant.cns;
  const acervo = await loadAcervo(tenant.slug);
  const all = acervo.properties
    .filter((p) => p.recordKind !== 4 && p.book === 2)
    .map((p) => {
      const problems = p.cnm
        ? cnmProblems(p.cnm, { cns, book: 2, number: p.number })
        : [];
      return {
        id: p.id,
        number: p.number,
        status: statusLabel(p.status),
        cnm: p.cnm ? formatCnm(p.cnm) : "",
        expected: cnmOf(cns, 2, p.number),
        problem: problems.map((x) => CNM_PROBLEM_LABELS[x]).join("; "),
        inPgv: p.cnmInPgv,
      };
    });
  const rows =
    filter === "todas"
      ? all
      : filter === "problema"
        ? all.filter((r) => r.problem)
        : all.filter((r) => !r.inPgv);
  const tabs = [
    ["fora", `Fora do PGV (${all.filter((r) => !r.inPgv).length})`],
    ["problema", `Não conferem (${all.filter((r) => r.problem).length})`],
    ["todas", `Todas (${all.length})`],
  ];
  return (
    <RiPage
      wide
      title="Código Nacional de Matrícula"
      description={
        <>
          CCCCCC.L.NNNNNNN-DD, com o dígito pelo módulo 97 (CNN, art. 330). O
          que vale é o CNM que o PGV-CNM do ONR devolve (art. 333). Marque aqui
          o que já está lá; o resto vai no próximo lote, em{" "}
          <Link
            href="/admin/ri/onr"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Arquivos para a ONR
          </Link>
          .
        </>
      }
    >
      <nav className="flex flex-wrap gap-2" aria-label="Filtro">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/ri/cnm?filtro=${key}`}
            className={buttonVariants({
              size: "sm",
              variant: filter === key ? "default" : "outline",
            })}
          >
            {label}
          </Link>
        ))}
      </nav>
      <CnmTable rows={rows} canEdit={riCan(session, "ri.edit")} />
    </RiPage>
  );
}
