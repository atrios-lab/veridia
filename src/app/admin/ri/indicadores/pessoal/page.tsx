import Link from "next/link";
import { actLabel, PARTY_ROLE_LABELS } from "@/core/ri/acts.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { buttonVariants } from "../../../_ui/button.tsx";
import { RiPage } from "../../_components/page.tsx";
import { requireRi } from "../../_lib.ts";

export const metadata = { title: "Indicador Pessoal (Livro 5)" };

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export default async function PersonalIndicatorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await requireRi();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const letter = (params.letra ?? "").toUpperCase().slice(0, 1);
  const acervo = await loadAcervo(tenant.slug);
  type Line = {
    property: string;
    propertyId: string;
    role: string;
    act: string;
  };
  const byPerson = new Map<string, Line[]>();
  for (const p of acervo.properties) {
    if (p.status === 4) continue;
    for (const act of acervo.acts.get(p.id) ?? []) {
      for (const party of act.parties) {
        const list = byPerson.get(party.personId) ?? [];
        list.push({
          property: p.number.toLocaleString("pt-BR"),
          propertyId: p.id,
          role: PARTY_ROLE_LABELS[party.role],
          act: actLabel(act),
        });
        byPerson.set(party.personId, list);
      }
    }
  }
  const digits = q.replace(/\D/g, "");
  const people = [...acervo.people.values()]
    .filter((person) => byPerson.has(person.id))
    .filter((person) => !letter || fold(person.name).startsWith(letter))
    .filter(
      (person) =>
        !q ||
        (digits.length >= 3 && person.document.includes(digits)) ||
        fold(person.name).includes(fold(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return (
    <RiPage
      wide
      title="Indicador Pessoal (Livro 5)"
      description="Os nomes de todas as pessoas que aparecem nos atos, ativa ou passivamente, em ordem alfabética, com as matrículas (Lei nº 6.015/1973, art. 180). A busca só por nome ou CPF pede a identificação de quem pediu e a finalidade (CNN, art. 126)."
      actions={
        <>
          <Link
            href="/admin/ri/importar-exportar"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Planilha, JSON e importação
          </Link>
          <Link href="/admin/ri/onr" className={buttonVariants({ size: "sm" })}>
            Gerar o arquivo para a ONR
          </Link>
        </>
      }
    >
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
          Nome ou CPF/CNPJ
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
      <nav aria-label="Letra" className="flex flex-wrap gap-1">
        <Link
          href="/admin/ri/indicadores/pessoal"
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${letter ? "bg-background" : "bg-primary text-primary-foreground"}`}
        >
          Todas
        </Link>
        {letters.map((l) => (
          <Link
            key={l}
            href={`/admin/ri/indicadores/pessoal?letra=${l}`}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${letter === l ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <ul className="divide-y rounded-xl border bg-card shadow-xs">
        {people.map((person) => (
          <li key={person.id} className="flex flex-col gap-1 px-4 py-2.5">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/admin/ri/pessoas/${person.id}`}
                className="font-medium text-foreground hover:text-primary"
              >
                {person.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {person.document
                  ? formatTaxId(person.document)
                  : "sem CPF/CNPJ"}
              </span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {(byPerson.get(person.id) ?? []).map((line, i) => (
                <Link
                  key={`${line.propertyId}-${i}`}
                  href={`/admin/ri/matriculas/${line.propertyId}`}
                  className="rounded-full border bg-background px-2 py-0.5 text-xs hover:border-primary/40"
                >
                  Mat. {line.property} · {line.role} · {line.act}
                </Link>
              ))}
            </span>
          </li>
        ))}
        {people.length === 0 && (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            Nenhuma pessoa.
          </li>
        )}
      </ul>
    </RiPage>
  );
}
