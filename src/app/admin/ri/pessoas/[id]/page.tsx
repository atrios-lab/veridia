import Link from "next/link";
import { notFound } from "next/navigation";
import { actLabel, PARTY_ROLE_LABELS, situationOf } from "@/core/ri/acts.ts";
import { brDate, propertyTitle } from "@/core/ri/property.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { db } from "@/db/index.ts";
import { loadAcervo, personWith } from "@/lib/ri.ts";
import { ConfirmButton } from "../../_components/client.tsx";
import { Panel, RiPage } from "../../_components/page.tsx";
import { PersonForm } from "../../_components/person-form.tsx";
import { requireRi, riCan, stamp } from "../../_lib.ts";
import { setPersonDeletedAction } from "../../actions.ts";

export const metadata = { title: "Pessoa" };

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, tenant } = await requireRi();
  const { id } = await params;
  const person = await personWith(db, tenant.slug, id).catch(() => null);
  if (!person) notFound();
  const acervo = await loadAcervo(tenant.slug);
  const appearances: {
    propertyId: string;
    title: string;
    act: string;
    role: string;
    date: string;
    owner: boolean;
  }[] = [];
  for (const p of acervo.properties) {
    const acts = acervo.acts.get(p.id) ?? [];
    const owner = situationOf(acts).owners.some((o) => o.personId === id);
    for (const act of acts) {
      for (const party of act.parties) {
        if (party.personId !== id) continue;
        appearances.push({
          propertyId: p.id,
          title: propertyTitle(p),
          act:
            act.kind === "M" ? actLabel(act) : `${actLabel(act)} ${act.nature}`,
          role: PARTY_ROLE_LABELS[party.role],
          date: brDate(act.registeredOn),
          owner,
        });
      }
    }
  }
  const canEdit = riCan(session, "ri.edit");
  const history =
    (person.history as {
      at: string;
      changes: { field: string; before: unknown }[];
    }[]) ?? [];
  return (
    <RiPage
      title={person.name}
      description={`${person.document ? formatTaxId(person.document) : "Sem CPF/CNPJ"}${person.deletedAt ? ` · apagada do cadastro em ${stamp(person.deletedAt)}` : ""}`}
      back={{ href: "/admin/ri/pessoas", label: "Pessoas" }}
      actions={
        canEdit &&
        (person.deletedAt ? (
          <ConfirmButton
            action={setPersonDeletedAction}
            fields={{ id, op: "restore" }}
            trigger="Restaurar"
            question="Restaurar esta pessoa?"
            consequence="Ela volta para o cadastro e para as buscas."
            confirmLabel="Restaurar"
            pendingLabel="Restaurando…"
            destructive={false}
          />
        ) : (
          <ConfirmButton
            action={setPersonDeletedAction}
            fields={{ id, op: "delete" }}
            trigger="Apagar"
            question="Apagar esta pessoa do cadastro?"
            consequence="Ela some da lista de pessoas. Os atos em que aparece não mudam e continuam com o nome dela. Nada é tirado do banco e dá para restaurar."
            confirmLabel="Apagar"
            pendingLabel="Apagando…"
          />
        ))
      }
    >
      <Panel
        title="Matrículas em que aparece"
        description="Livro 5 (Lei nº 6.015/1973, art. 180): ativa ou passivamente, em qualquer ato."
      >
        {appearances.length === 0 ? (
          <p className="text-sm text-muted-foreground">Em nenhum ato.</p>
        ) : (
          <ul className="divide-y">
            {appearances.map((a, i) => (
              <li key={`${a.propertyId}-${i}`}>
                <Link
                  href={`/admin/ri/matriculas/${a.propertyId}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:text-primary"
                >
                  <span className="font-medium">
                    {a.title}
                    {a.owner && (
                      <span className="ml-2 rounded-full bg-success-soft px-2 text-xs font-medium text-success-text">
                        proprietário hoje
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.role} · {a.act}
                    {a.date ? ` · ${a.date}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {canEdit && !person.deletedAt && (
        <PersonForm
          person={{
            id,
            name: person.name,
            document: person.document,
            notes: person.notes,
          }}
        />
      )}
      {history.length > 0 && (
        <Panel title="Histórico de alterações">
          <ul className="flex flex-col gap-2 text-xs">
            {[...history].reverse().map((entry) => (
              <li key={entry.at} className="rounded-md bg-muted px-2.5 py-2">
                <p className="font-medium">{stamp(new Date(entry.at))}</p>
                {entry.changes.map((c) => (
                  <p key={c.field} className="text-muted-foreground">
                    {c.field === "name"
                      ? "Nome"
                      : c.field === "document"
                        ? "CPF/CNPJ"
                        : "Observações"}
                    : era {String(c.before ?? "") || "vazio"}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </RiPage>
  );
}
