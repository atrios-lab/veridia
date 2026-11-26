import { Plus } from "lucide-react";
import Link from "next/link";
import { PARTY_ROLE_LABELS } from "@/core/ri/acts.ts";
import { AUX_ROLE_LABELS } from "@/core/ri/auxiliary.ts";
import { AUX_KINDS } from "@/core/ri/property.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Registro Auxiliar (Livro 3)" };

/**
 * The Livro 3 and its index: the registros that do not concern a
 * matrícula directly (Lei nº 6.015/1973, arts. 177 and 178). Its people
 * are in the Indicador Pessoal (art. 180); the imóveis it mentions, in the
 * matrículas it refers to.
 */
export default async function AuxiliaryBookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, tenant } = await requireRi();
  const q = ((await searchParams).q ?? "").trim().toLowerCase();
  const acervo = await loadAcervo(tenant.slug);
  const rows = acervo.properties
    .filter((p) => p.book === 3)
    .map((p) => {
      const parties = [
        ...p.aux.parties.map((x) => ({
          name: x.name,
          document: x.document,
          role: AUX_ROLE_LABELS[x.role],
        })),
        ...(acervo.acts.get(p.id) ?? []).flatMap((a) =>
          a.parties.map((x) => ({
            name: x.name,
            document: x.document,
            role: PARTY_ROLE_LABELS[x.role],
          })),
        ),
      ];
      return { p, parties };
    })
    .filter(
      ({ p, parties }) =>
        !q ||
        [
          p.number,
          p.auxKind,
          p.aux.title,
          p.linkedNumbers,
          ...parties.map((x) => `${x.name} ${x.document}`),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  return (
    <RiPage
      wide
      title="Registro Auxiliar (Livro 3)"
      description="Os registros que a lei manda fazer no Registro de Imóveis e que não dizem respeito diretamente a imóvel matriculado (Lei nº 6.015/1973, arts. 177 e 178): cédula de crédito industrial, penhor rural e industrial, pacto antenupcial, convenção de condomínio, debêntures, bem de família e título no inteiro teor. Não precisa ter imóvel; quando houver ato ligado numa matrícula, faz-se a remissão recíproca. As partes estão no Indicador Pessoal (art. 180)."
      actions={
        riCan(session, "ri.edit") && (
          <Link
            href="/admin/ri/matriculas/nova?livro=3"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-4" /> Novo registro auxiliar
          </Link>
        )
      }
    >
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
          Buscar por número, natureza, parte, CPF ou matrícula vinculada
          <input
            name="q"
            defaultValue={q}
            className="h-9 rounded-md border bg-background px-2.5 text-sm font-normal"
          />
        </label>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Buscar
        </button>
      </form>
      {rows.length === 0 ? (
        <Panel title="Nenhum registro no Livro 3">
          <p className="text-sm text-muted-foreground">
            O que vai no Livro 3 (art. 178):{" "}
            {AUX_KINDS.map((k) => `${k.name} (${k.source})`).join("; ")}.
          </p>
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nº</th>
                <th className="px-3 py-2 font-medium">Natureza</th>
                <th className="px-3 py-2 font-medium">Partes</th>
                <th className="px-3 py-2 font-medium">
                  Matrícula(s) relacionada(s)
                </th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ p, parties }) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/ri/matriculas/${p.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.number.toLocaleString("pt-BR")}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {p.auxKind || "não informada"}
                    {p.aux.title && (
                      <span className="block text-xs text-muted-foreground">
                        {p.aux.title}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {parties.length
                      ? parties.map((x) => `${x.name} (${x.role})`).join("; ")
                      : "nenhuma lançada"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.linkedNumbers || "nenhuma (não precisa de imóvel)"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {statusLabel(p.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RiPage>
  );
}
