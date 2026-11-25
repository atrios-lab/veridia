import { notFound } from "next/navigation";
import { actLabel, nextSeq, situationOf } from "@/core/ri/acts.ts";
import { propertyTitle } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { loadAcervo, propertyDetailWith } from "@/lib/ri.ts";
import { ActForm } from "../../../../_components/act-form.tsx";
import { RiPage } from "../../../../_components/page.tsx";
import { requireRi } from "../../../../_lib.ts";

export const metadata = { title: "Lançar ato" };

export default async function NewActPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireRi("ri.edit");
  const { id } = await params;
  const [detail, acervo] = await Promise.all([
    propertyDetailWith(db, tenant.slug, id),
    loadAcervo(tenant.slug),
  ]);
  if (!detail || detail.property.deletedAt) notFound();
  const p = detail.property;
  const all = [
    ...detail.acts.map((a) => ({ seq: a.seq })),
    ...detail.deletedActs.map((a) => ({
      seq: Number(/-(\d+)/.exec(a.label)?.[1] ?? 0),
    })),
  ];
  const seq = nextSeq(all, p.priorActs);
  const people = [...acervo.people.values()]
    .filter((person) => !person.deletedAt)
    .map((person) => ({ name: person.name, document: person.document }));
  return (
    <RiPage
      title={`Lançar ato na ${propertyTitle(p)}`}
      description={`O número será o ${seq}: ${actLabel({ kind: "R", seq }, p.number)} ou ${actLabel({ kind: "AV", seq }, p.number)}.`}
      back={{ href: `/admin/ri/matriculas/${id}`, label: propertyTitle(p) }}
    >
      <ActForm
        propertyId={id}
        nextLabel={`R-${seq} ou AV-${seq}`}
        burdens={situationOf(detail.acts).burdens.map((b) => ({
          actId: b.actId,
          label: `${b.label} ${b.nature}`,
        }))}
        people={people}
      />
    </RiPage>
  );
}
