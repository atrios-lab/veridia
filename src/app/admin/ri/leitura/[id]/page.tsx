import { notFound } from "next/navigation";
import { ACT_EFFECT_LABELS, PARTY_ROLE_LABELS } from "@/core/ri/acts.ts";
import { AUX_ROLE_LABELS } from "@/core/ri/auxiliary.ts";
import { brDate } from "@/core/ri/property.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { db } from "@/db/index.ts";
import { propertyDetailWith } from "@/lib/ri.ts";
import { fileWith, type ReadingResult } from "@/lib/ri-files.ts";
import { ApplyForm } from "../../_components/apply-form.tsx";
import { ActionButton } from "../../_components/client.tsx";
import { Field, Panel, RiPage } from "../../_components/page.tsx";
import { requireRi } from "../../_lib.ts";
import { readFileAction } from "../../actions.ts";

export const metadata = { title: "Conferir a leitura" };

/**
 * What was read from a file, for the clerk to confer before anything is
 * saved (decision of 25/11/2026): the assistente virtual proposes, the
 * office decides.
 */
export default async function ReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireRi("ri.edit");
  const { id } = await params;
  const file = await fileWith(db, tenant.slug, id);
  if (!file || file.deletedAt) notFound();
  const stored = file.reading as ReadingResult | null;
  const detail = file.propertyId
    ? await propertyDetailWith(db, tenant.slug, file.propertyId)
    : null;
  const aux = stored?.reading?.book === 3;
  const back = detail
    ? {
        href: `/admin/ri/matriculas/${detail.property.id}`,
        label: detail.property.book === 3 ? "Registro auxiliar" : "Matrícula",
      }
    : aux
      ? {
          href: "/admin/ri/matriculas/nova?livro=3",
          label: "Novo registro auxiliar",
        }
      : { href: "/admin/ri/matriculas/nova", label: "Nova matrícula" };
  if (!stored?.reading) {
    return (
      <RiPage title="Conferir a leitura" back={back}>
        <Panel title={file.name}>
          <p className="mb-3 text-sm text-muted-foreground">
            Este arquivo ainda não foi lido.
          </p>
          <ActionButton
            action={readFileAction}
            fields={{ id }}
            label="Ler com o Assistente Virtual"
            pendingLabel="Lendo… pode levar um minuto"
            variant="default"
          />
        </Panel>
      </RiPage>
    );
  }
  const r = stored.reading;
  const taken = new Set(detail?.acts.map((a) => a.seq) ?? []);
  const people = (list: { name: string; document: string; role: string }[]) =>
    list
      .map(
        (p) =>
          `${PARTY_ROLE_LABELS[p.role as keyof typeof PARTY_ROLE_LABELS] ?? p.role}: ${p.name}${p.document ? ` (${formatTaxId(p.document)})` : ""}`,
      )
      .join("; ");
  return (
    <RiPage
      wide
      title="Conferir a leitura"
      back={back}
      description={
        stored.source === "assistente"
          ? "Lido pelo Assistente Virtual. Confira com o documento: nada foi salvo ainda. Só entram os campos vazios e os lançamentos marcados."
          : "Lido do texto do arquivo, sem o Assistente Virtual. Confira com o documento: nada foi salvo ainda."
      }
      actions={
        <ActionButton
          action={readFileAction}
          fields={{ id }}
          label="Ler de novo"
          pendingLabel="Lendo…"
        />
      }
    >
      {stored.notes.length > 0 && (
        <ul className="rounded-lg border border-warning/50 bg-warning-soft px-4 py-3 text-sm text-warning-text">
          {stored.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title={
              detail
                ? `Completar ${detail.property.book === 3 ? "o registro auxiliar" : "a matrícula"} ${detail.property.number.toLocaleString("pt-BR")}`
                : r.book === 3
                  ? "Criar o registro auxiliar (Livro 3)"
                  : "Criar a matrícula"
            }
            description="Marque os lançamentos que conferiu. Cada um entra com o número que tem na ficha."
          >
            <ApplyForm
              fileId={id}
              number={r.number}
              book={r.book}
              isNew={!detail}
              acts={r.acts.map((a) => ({
                seq: a.seq,
                label: `${a.kind}-${a.seq}`,
                nature: a.nature || ACT_EFFECT_LABELS[a.effect],
                date: a.registeredOn ? brDate(a.registeredOn) : "",
                parties: people(a.parties),
                summary: a.summary,
                exists: taken.has(a.seq),
              }))}
            />
          </Panel>
        </div>
        {r.book === 3 ? (
          <Panel title="O que foi lido do registro (Livro 3)">
            <dl className="grid gap-3">
              <Field label="Arquivo" value={file.name} />
              <Field
                label="Número no Livro 3"
                value={r.number?.toLocaleString("pt-BR") ?? ""}
              />
              <Field label="Natureza" value={r.auxKind} />
              <Field label="Título" value={r.aux?.title} />
              <Field
                label="Partes"
                value={(r.aux?.parties ?? [])
                  .map(
                    (p) =>
                      `${AUX_ROLE_LABELS[p.role]}: ${p.name}${p.document ? ` (${formatTaxId(p.document)})` : ""}`,
                  )
                  .join("; ")}
              />
              <Field
                label="Valor"
                value={
                  r.aux?.valueCents != null
                    ? (r.aux.valueCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : ""
                }
              />
              <Field label="Vencimento" value={brDate(r.aux?.dueOn)} />
              <Field label="Garantias" value={r.aux?.guarantees} />
              <Field label="Onde estão os bens" value={r.aux?.goodsPlace} />
              <Field label="Regime de bens" value={r.aux?.regime} />
              <Field
                label="Matrícula(s) relacionada(s)"
                value={r.linkedNumbers}
              />
              <Field
                label="Protocolo"
                value={
                  r.aux?.protocolNumber
                    ? `nº ${r.aux.protocolNumber}${r.aux.protocolOn ? `, em ${brDate(r.aux.protocolOn)}` : ""}`
                    : ""
                }
              />
            </dl>
          </Panel>
        ) : (
          <Panel title="O que foi lido da abertura">
            <dl className="grid gap-3">
              <Field label="Arquivo" value={file.name} />
              <Field
                label="Número"
                value={r.number?.toLocaleString("pt-BR") ?? ""}
              />
              <Field label="CNM" value={r.cnm} />
              <Field label="Abertura" value={brDate(r.openedOn)} />
              <Field label="Denominação" value={r.denomination} />
              <Field label="Área" value={r.area} />
              <Field label="CCIR" value={r.ccir} />
              <Field label="NIRF" value={r.nirf} />
              <Field label="Registro anterior" value={r.origin} />
              <Field label="Proprietários" value={people(r.owners)} />
              <Field
                label="Descrição"
                value={
                  <span className="whitespace-pre-line">
                    {r.description.slice(0, 1500)}
                  </span>
                }
              />
            </dl>
          </Panel>
        )}
      </div>
      {stored.markdown && (
        <Panel
          title={
            file.path ? "Texto lido (Markdown)" : "Texto guardado (Markdown)"
          }
          description={
            file.path
              ? "O texto do arquivo, para conferir."
              : "O arquivo original foi descartado; o documento ficou guardado só neste texto."
          }
        >
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
            {stored.markdown.slice(0, 20000)}
          </pre>
        </Panel>
      )}
    </RiPage>
  );
}
