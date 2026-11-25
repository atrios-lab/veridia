import { Plus } from "lucide-react";
import Link from "next/link";
import { formatTaxId } from "@/core/tax-id.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Pessoas" };

const LIMIT = 300;

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, tenant } = await requireRi();
  const q = ((await searchParams).q ?? "").trim();
  const acervo = await loadAcervo(tenant.slug);
  const numbers = new Map<string, Set<number>>();
  for (const p of acervo.properties) {
    for (const act of acervo.acts.get(p.id) ?? []) {
      for (const party of act.parties) {
        const set = numbers.get(party.personId) ?? new Set<number>();
        set.add(p.number);
        numbers.set(party.personId, set);
      }
    }
  }
  const digits = q.replace(/\D/g, "");
  const words = fold(q).split(/\s+/).filter(Boolean);
  const people = [...acervo.people.values()]
    .filter((person) => !person.deletedAt)
    .filter((person) => {
      if (!q) return true;
      if (digits.length >= 3 && person.document.includes(digits)) return true;
      const name = fold(person.name);
      return words.every((word) => name.includes(word));
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return (
    <RiPage
      wide
      title="Pessoas"
      description="O cadastro único das pessoas que aparecem nos atos: é daqui que sai o Indicador Pessoal (Livro 5)."
      actions={
        riCan(session, "ri.edit") && (
          <Link
            href="/admin/ri/pessoas/nova"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-4" /> Nova pessoa
          </Link>
        )
      }
    >
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
          Buscar por nome ou CPF/CNPJ
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
      <p className="text-sm text-muted-foreground">
        {people.length.toLocaleString("pt-BR")}{" "}
        {people.length === 1 ? "pessoa" : "pessoas"}
        {people.length > LIMIT ? `; mostrando as ${LIMIT} primeiras.` : "."}
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {people.slice(0, LIMIT).map((person) => {
          const list = [...(numbers.get(person.id) ?? [])].sort(
            (a, b) => a - b,
          );
          return (
            <li key={person.id}>
              <Link
                href={`/admin/ri/pessoas/${person.id}`}
                className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3 shadow-xs transition-colors hover:border-primary/40"
              >
                <span className="font-medium text-foreground">
                  {person.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {person.document
                    ? formatTaxId(person.document)
                    : "sem CPF/CNPJ"}{" "}
                  ·{" "}
                  {list.length
                    ? `matrícula${list.length > 1 ? "s" : ""} ${list.map((n) => n.toLocaleString("pt-BR")).join(", ")}`
                    : "em nenhum ato"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </RiPage>
  );
}
