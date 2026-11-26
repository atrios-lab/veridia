import { notFound } from "next/navigation";
import { actLabel, nextSeq, situationOf } from "@/core/ri/acts.ts";
import { propertyTitle } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { loadAcervo, propertyDetailWith } from "@/lib/ri.ts";
import { listLearnedActsWith } from "@/lib/ri-learning.ts";
import { ActForm } from "../../../../_components/act-form.tsx";
import { RiPage } from "../../../../_components/page.tsx";
import { requireRi } from "../../../../_lib.ts";

export const metadata = { title: "Lançar ato" };

export default async function NewActPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const fromProtocol = /^\d{1,9}$/.test(query.protocolo ?? "")
    ? { number: String(query.protocolo), nature: query.natureza ?? "" }
    : undefined;
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
      title={
        p.book === 3
          ? `Lançar averbação no ${propertyTitle(p)}`
          : `Lançar ato na ${propertyTitle(p)}`
      }
      description={
        p.book === 3
          ? `Averbação à margem do registro: ${actLabel({ kind: "AV", seq }, p.number)}. Aditivo, endosso ou cessão, prorrogação, troca de garantia e a baixa (Lei nº 6.015/1973, art. 250).`
          : `O número será o ${seq}: ${actLabel({ kind: "R", seq }, p.number)} ou ${actLabel({ kind: "AV", seq }, p.number)}.`
      }
      back={
        fromProtocol && /^[0-9a-f-]{36}$/i.test(query.de ?? "")
          ? {
              href: `/admin/ri/protocolo/${query.de}`,
              label: `Protocolo nº ${fromProtocol.number}`,
            }
          : { href: `/admin/ri/matriculas/${id}`, label: propertyTitle(p) }
      }
    >
      <ActForm
        learned={await listLearnedActsWith(db, tenant.slug)}
        propertyId={id}
        nextLabel={p.book === 3 ? `AV-${seq}` : `R-${seq} ou AV-${seq}`}
        burdens={situationOf(detail.acts).burdens.map((b) => ({
          actId: b.actId,
          label: `${b.label} ${b.nature}`,
        }))}
        people={people}
        fromProtocol={fromProtocol}
        auxiliary={p.book === 3}
      />
    </RiPage>
  );
}
