import { notFound } from "next/navigation";
import { actLabel, situationOf } from "@/core/ri/acts.ts";
import { brDate, propertyTitle } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { actSealImageWith, loadAcervo, propertyDetailWith } from "@/lib/ri.ts";
import { listLearnedActsWith } from "@/lib/ri-learning.ts";
import { ActForm } from "../../../../_components/act-form.tsx";
import { RiPage } from "../../../../_components/page.tsx";
import { requireRi } from "../../../../_lib.ts";

export const metadata = { title: "Alterar ato" };

export default async function EditActPage({
  params,
}: {
  params: Promise<{ id: string; actId: string }>;
}) {
  const { tenant } = await requireRi("ri.edit");
  const { id, actId } = await params;
  const [detail, acervo] = await Promise.all([
    propertyDetailWith(db, tenant.slug, id),
    loadAcervo(tenant.slug),
  ]);
  if (!detail || detail.property.deletedAt) notFound();
  const act = detail.acts.find((a) => a.id === actId);
  if (!act) notFound();
  const p = detail.property;
  const others = detail.acts.filter((a) => a.id !== actId);
  const burdens = situationOf(others).burdens;
  const target = detail.acts.find((a) => a.id === act.cancelsActId);
  if (target && !burdens.some((b) => b.actId === target.id)) {
    burdens.push({
      actId: target.id,
      label: actLabel(target),
      nature: target.nature,
      registeredOn: target.registeredOn,
      parties: target.parties,
    });
  }
  const people = [...acervo.people.values()]
    .filter((person) => !person.deletedAt)
    .map((person) => ({ name: person.name, document: person.document }));
  return (
    <RiPage
      title={`Alterar ${actLabel(act, p.number)}`}
      description="O número do ato não muda. O que era antes fica guardado no histórico e na auditoria."
      back={{ href: `/admin/ri/matriculas/${id}`, label: propertyTitle(p) }}
    >
      <ActForm
        learned={await listLearnedActsWith(db, tenant.slug)}
        propertyId={id}
        nextLabel={actLabel(act, p.number)}
        act={{
          id: act.id,
          kind: act.kind,
          effect: act.effect,
          nature: act.nature,
          registeredOn: brDate(act.registeredOn),
          summary: act.summary,
          cancelsActId: act.cancelsActId ?? "",
          protocol: act.protocol,
          seal: act.seal,
          hasSealImage: Boolean(
            await actSealImageWith(db, tenant.slug, act.id),
          ),
          value:
            act.valueCents === null
              ? ""
              : (act.valueCents / 100).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                }),
          parties: act.parties.map((party) => ({ ...party, key: 0 })),
        }}
        burdens={burdens.map((b) => ({
          actId: b.actId,
          label: `${b.label} ${b.nature}`,
        }))}
        people={people}
      />
    </RiPage>
  );
}
