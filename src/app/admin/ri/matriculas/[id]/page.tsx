import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ACT_EFFECT_LABELS,
  actLabel,
  PARTY_ROLE_LABELS,
  situationOf,
} from "@/core/ri/acts.ts";
import {
  CNM_PROBLEM_LABELS,
  cnmOf,
  cnmProblems,
  cnsDigits,
  formatCnm,
} from "@/core/ri/cnm.ts";
import {
  LOCATIONS,
  PROPERTY_KINDS,
  RECORD_KINDS,
  STREET_KINDS,
} from "@/core/ri/codes.ts";
import {
  brDate,
  CONDO_LABELS,
  type CondoData,
  propertyTitle,
  RURAL_LABELS,
  type RuralData,
} from "@/core/ri/property.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { db } from "@/db/index.ts";
import { loadAcervo, propertyDetailWith } from "@/lib/ri.ts";
import { riSignerFor } from "@/lib/ri-docs.ts";
import { listFilesWith, riFolder } from "@/lib/ri-files.ts";
import {
  currentGeometriesWith,
  geometriesOfWith,
  overlapsOf,
} from "@/lib/ri-geo.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { buttonVariants } from "../../../_ui/button.tsx";
import { AuxPanel } from "../../_components/aux-panel.tsx";
import { ConfirmButton } from "../../_components/client.tsx";
import { FilesPanel } from "../../_components/files-panel.tsx";
import { GeoPanel } from "../../_components/geo-panel.tsx";
import { Field, Panel, RiPage } from "../../_components/page.tsx";
import { PrintPanel } from "../../_components/print-panel.tsx";
import { requireRi, riCan, stamp } from "../../_lib.ts";
import {
  setActDeletedAction,
  setPropertyDeletedAction,
} from "../../actions.ts";

export const metadata = { title: "Matrícula" };

const FIELD_NAMES: Record<string, string> = {
  book: "Livro",
  number: "Número",
  recordKind: "Tipo de registro",
  status: "Situação",
  cnm: "CNM",
  cnmInPgv: "CNM no PGV",
  openedOn: "Data de abertura",
  origin: "Origem",
  ficha: "Ficha",
  location: "Localização",
  propertyKind: "Tipo de imóvel",
  streetKind: "Tipo de logradouro",
  street: "Logradouro",
  streetNumber: "Número do logradouro",
  district: "Bairro",
  cep: "CEP",
  complement: "Complemento",
  quadra: "Quadra",
  setor: "Setor",
  conjunto: "Conjunto",
  lote: "Lote",
  loteamento: "Loteamento",
  contributors: "Inscrição imobiliária",
  rural: "Dados rurais",
  condo: "Condomínio",
  area: "Área",
  priorActs: "Atos já lançados na ficha",
  description: "Descrição",
  notes: "Observações",
};

const money = (cents: number | null) =>
  cents === null
    ? ""
    : (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, tenant } = await requireRi();
  const { id } = await params;
  const detail = await propertyDetailWith(db, tenant.slug, id);
  if (!detail) notFound();
  const { property: p, acts, deletedActs } = detail;
  const [files, signing, geometries, allGeometries, acervo] = await Promise.all(
    [
      listFilesWith(db, tenant.slug, id),
      riSignerFor(tenant),
      geometriesOfWith(db, tenant.slug, id),
      currentGeometriesWith(db, tenant.slug),
      loadAcervo(tenant.slug),
    ],
  );
  const overlaps = overlapsOf(allGeometries);
  const labels = new Map(
    acervo.properties.map((x) => [x.id, propertyTitle(x)]),
  );
  const cns = cnsDigits(tenant.cns) ?? tenant.cns;
  const situation = situationOf(acts);
  const canEdit = riCan(session, "ri.edit") && !p.deletedAt;
  const title = propertyTitle(p);
  const expected = p.recordKind !== 4 ? cnmOf(cns, p.book, p.number) : "";
  const cnmIssues =
    p.cnm && p.recordKind !== 4
      ? cnmProblems(p.cnm, { cns, book: p.book, number: p.number })
      : [];

  return (
    <RiPage
      wide
      title={title}
      back={
        p.book === 3
          ? { href: "/admin/ri/livro-3", label: "Registro Auxiliar" }
          : { href: "/admin/ri/matriculas", label: "Matrículas" }
      }
      description={
        <>
          <span
            className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 0 ? "bg-success-soft text-success-text" : "bg-muted text-muted-foreground"}`}
          >
            {statusLabel(p.status)}
          </span>
          {p.deletedAt
            ? `Apagada do sistema em ${stamp(p.deletedAt)}.`
            : `CNM ${p.cnm ? formatCnm(p.cnm) : `não lançado (calculado: ${expected || "não se aplica"})`}${p.cnmInPgv ? " · cadastrado no PGV" : ""}`}
        </>
      }
      actions={
        <>
          {canEdit && (
            <>
              <Link
                href={`/admin/ri/matriculas/${p.id}/ato/novo`}
                className={buttonVariants({ size: "sm" })}
              >
                <Plus className="size-4" />{" "}
                {p.book === 3 ? "Lançar averbação" : "Lançar ato"}
              </Link>
              <Link
                href={`/admin/ri/matriculas/${p.id}/alterar`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                <Pencil className="size-4" /> Alterar dados
              </Link>
            </>
          )}
          {riCan(session, "ri.edit") &&
            (p.deletedAt ? (
              <ConfirmButton
                action={setPropertyDeletedAction}
                fields={{ id: p.id, op: "restore" }}
                trigger="Restaurar"
                question={`Restaurar a ${title}?`}
                consequence="Ela volta para a lista, para os indicadores e para os arquivos da ONR."
                confirmLabel="Restaurar"
                pendingLabel="Restaurando…"
                destructive={false}
              />
            ) : (
              <ConfirmButton
                action={setPropertyDeletedAction}
                fields={{ id: p.id, op: "delete" }}
                trigger="Apagar"
                question={`Apagar a ${title} do sistema?`}
                consequence="Ela sai das listas, dos indicadores e dos arquivos da ONR. Nada é tirado do banco: os dados e os atos ficam guardados, e dá para restaurar. A ficha física não muda."
                confirmLabel="Apagar"
                pendingLabel="Apagando…"
              />
            ))}
        </>
      }
    >
      {cnmIssues.length > 0 && (
        <p className="rounded-lg border border-warning/50 bg-warning-soft px-4 py-3 text-sm text-warning-text">
          O CNM lançado não confere:{" "}
          {cnmIssues.map((i) => CNM_PROBLEM_LABELS[i]).join("; ")}. O calculado
          é {expected}. Confira no PGV-CNM (CNN, art. 333).
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {p.book === 3 ? (
            <AuxPanel
              kind={p.auxKind}
              aux={p.aux}
              linked={p.linkedNumbers}
              propertyId={p.id}
              canEdit={canEdit}
            />
          ) : (
            <Panel
              title="Situação atual"
              description="Calculada a partir dos atos lançados (CNN, art. 125: descrição, titularidade e ônus não cancelados)."
            >
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Proprietários
              </h3>
              {situation.owners.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Nenhum proprietário lançado.{" "}
                  {canEdit && (
                    <Link
                      href={`/admin/ri/matriculas/${p.id}/ato/novo`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Lançar o ato
                    </Link>
                  )}
                </p>
              ) : (
                <ul className="mt-1 divide-y">
                  {situation.owners.map((o) => (
                    <li
                      key={o.personId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <Link
                        href={`/admin/ri/pessoas/${o.personId}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {o.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {o.document ? formatTaxId(o.document) : "sem CPF/CNPJ"}
                        {o.share ? ` · ${o.share}` : ""} · desde {o.since}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Ônus em vigor
              </h3>
              {situation.burdens.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Nenhum ônus em vigor.
                </p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {situation.burdens.map((b) => (
                    <li
                      key={b.actId}
                      className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-text"
                    >
                      <span className="font-semibold">{b.label}</span>{" "}
                      {b.nature}
                      {b.registeredOn ? ` · ${brDate(b.registeredOn)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {situation.cancelledBurdens.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cancelados:{" "}
                  {situation.cancelledBurdens
                    .map((b) => `${b.label} ${b.nature} (por ${b.cancelledBy})`)
                    .join("; ")}
                </p>
              )}
            </Panel>
          )}

          <Panel
            title={p.book === 3 ? "Averbações à margem" : "Atos da matrícula"}
            description={
              p.book === 3
                ? "Aditivo, endosso, cessão, quitação e cancelamento se averbam à margem do registro; o cancelamento segue a Lei nº 6.015/1973, art. 250."
                : "Numeração única para registros e averbações (Lei nº 6.015/1973, art. 232)."
            }
            actions={
              canEdit && (
                <Link
                  href={`/admin/ri/matriculas/${p.id}/ato/novo`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  <Plus className="size-4" />{" "}
                  {p.book === 3 ? "Lançar averbação" : "Lançar ato"}
                </Link>
              )
            }
          >
            {p.priorActs > 0 && (
              <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                A ficha já tinha {p.priorActs} lançamento(s) antes do sistema; o
                próximo continua a partir do {p.priorActs + 1}.
              </p>
            )}
            {acts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum ato lançado no sistema.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {acts.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border bg-background p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {actLabel(a, p.number)} {a.kind !== "M" && a.nature}
                          {a.edited && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              alterado
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            a.registeredOn ? brDate(a.registeredOn) : "",
                            ACT_EFFECT_LABELS[a.effect],
                            a.protocol ? `protocolo ${a.protocol}` : "",
                            a.seal ? `selo ${a.seal}` : "",
                            money(a.valueCents),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            href={`/admin/ri/matriculas/${p.id}/ato/${a.id}`}
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                            })}
                          >
                            Alterar
                          </Link>
                          <ConfirmButton
                            action={setActDeletedAction}
                            fields={{ actId: a.id, op: "delete" }}
                            trigger="Apagar"
                            question={`Apagar o ${actLabel(a, p.number)}?`}
                            consequence="Ele sai da situação atual e dos indicadores. Nada é tirado do banco; o número dele não volta a ser usado e dá para restaurar."
                            confirmLabel="Apagar"
                            pendingLabel="Apagando…"
                          />
                        </div>
                      )}
                    </div>
                    {a.parties.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {a.parties.map((party) => (
                          <li
                            key={`${party.personId}-${party.role}`}
                            className="rounded-full border bg-card px-2.5 py-0.5 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {PARTY_ROLE_LABELS[party.role]}:
                            </span>{" "}
                            {party.name}
                            {party.share ? ` (${party.share})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {a.summary && (
                      <p className="mt-2 text-sm whitespace-pre-line text-foreground">
                        {a.summary}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {deletedActs.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Atos apagados (guardados)
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {deletedActs.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
                    >
                      <span>
                        {a.label} · apagado em {stamp(a.deletedAt)}
                      </span>
                      {canEdit && (
                        <ConfirmButton
                          action={setActDeletedAction}
                          fields={{ actId: a.id, op: "restore" }}
                          trigger="Restaurar"
                          question="Restaurar este ato?"
                          consequence="Ele volta para a situação atual e para os indicadores."
                          confirmLabel="Restaurar"
                          pendingLabel="Restaurando…"
                          destructive={false}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {p.book !== 3 && (
            <GeoPanel
              propertyId={p.id}
              title={title}
              area={p.area}
              rows={geometries}
              overlaps={overlaps}
              labels={labels}
              acts={acts
                .filter((a) => a.kind !== "M")
                .map((a) => ({
                  id: a.id,
                  label: `${actLabel(a, p.number)} ${a.nature}`,
                }))}
              canEdit={canEdit}
            />
          )}

          <FilesPanel
            propertyId={p.id}
            book={p.book}
            files={files}
            canEdit={canEdit}
            direct={blobUploadEnabled()}
            folder={riFolder(tenant.slug)}
          />

          {p.description && (
            <Panel
              title={p.book === 3 ? "Texto do registro" : "Descrição do imóvel"}
            >
              <p className="text-sm whitespace-pre-line">{p.description}</p>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {!p.deletedAt && (
            <PrintPanel
              propertyId={p.id}
              title={title}
              signer={signing.signer}
              hasImage={Boolean(signing.settings.signatureImage)}
            />
          )}
          <Panel title="Identificação">
            <dl className="grid gap-3">
              {p.book !== 3 && (
                <Field label="Tipo" value={RECORD_KINDS.get(p.recordKind)} />
              )}
              <Field
                label="Livro"
                value={
                  p.book === 3 ? "3 · Registro Auxiliar" : "2 · Registro Geral"
                }
              />
              <Field
                label={p.book === 3 ? "Data do registro" : "Abertura"}
                value={brDate(p.openedOn)}
              />
              <Field label="Ficha" value={p.ficha} />
              {p.book !== 3 && (
                <>
                  <Field label="Origem" value={p.origin} />
                  <Field label="Área" value={p.area} />
                </>
              )}
              {p.book === 3 && (
                <>
                  <Field label="Natureza (Livro 3)" value={p.auxKind} />
                  <Field
                    label="Matrícula(s) relacionada(s)"
                    value={
                      p.linkedNumbers ||
                      "nenhuma (o Livro 3 não precisa de imóvel)"
                    }
                  />
                </>
              )}
            </dl>
          </Panel>
          {p.book !== 3 && (
            <Panel title="Localização (Livro 4)">
              <dl className="grid gap-3">
                <Field label="Localização" value={LOCATIONS.get(p.location)} />
                <Field
                  label="Tipo de imóvel"
                  value={
                    p.propertyKind ? PROPERTY_KINDS.get(p.propertyKind) : ""
                  }
                />
                <Field
                  label="Logradouro"
                  value={[
                    p.streetKind && p.streetKind !== 177
                      ? STREET_KINDS.get(p.streetKind)
                      : "",
                    p.street,
                    p.streetNumber,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                <Field label="Bairro" value={p.district} />
                <Field label="CEP" value={p.cep} />
                {p.contributors.length > 0 && (
                  <Field
                    label="Inscrição imobiliária"
                    value={p.contributors.join("; ")}
                  />
                )}
                {(Object.keys(RURAL_LABELS) as (keyof RuralData)[])
                  .filter((k) => p.rural[k])
                  .map((k) => (
                    <Field key={k} label={RURAL_LABELS[k]} value={p.rural[k]} />
                  ))}
                {(Object.keys(CONDO_LABELS) as (keyof CondoData)[])
                  .filter((k) => p.condo[k])
                  .map((k) => (
                    <Field key={k} label={CONDO_LABELS[k]} value={p.condo[k]} />
                  ))}
              </dl>
            </Panel>
          )}
          {p.notes && (
            <Panel title="Observações internas">
              <p className="text-sm whitespace-pre-line">{p.notes}</p>
            </Panel>
          )}
          <Panel
            title="Histórico de alterações"
            description="Cadastro e cada alteração dos dados, com o que era antes."
          >
            <ul className="flex flex-col gap-2 text-xs">
              <li className="text-muted-foreground">
                Cadastrada em {stamp(p.createdAt)}
                {p.source === "planilha"
                  ? " pela planilha do índice"
                  : p.source === "importacao"
                    ? " pela importação (Importar e exportar)"
                    : p.source === "leitura"
                      ? " pela leitura de um documento"
                      : ""}
                .
              </li>
              {[...p.history].reverse().map((entry) => (
                <li key={entry.at} className="rounded-md bg-muted px-2.5 py-2">
                  <p className="font-medium text-foreground">
                    {stamp(new Date(entry.at))}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                    {entry.changes.map((c) => (
                      <li key={c.field}>
                        {FIELD_NAMES[c.field] ?? c.field}: era{" "}
                        <span className="text-foreground">
                          {typeof c.before === "object"
                            ? JSON.stringify(c.before)
                            : String(c.before ?? "vazio") || "vazio"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </RiPage>
  );
}
