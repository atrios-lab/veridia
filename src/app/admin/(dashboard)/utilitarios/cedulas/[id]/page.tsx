import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  ACT_WHERE_LABELS,
  CHARGE_LABELS,
  planActs,
} from "@/core/cedulas/analise.ts";
import { CHECKED_ON, KIND_INFO } from "@/core/cedulas/especies.ts";
import { suggestRequirements } from "@/core/cedulas/exigencias.ts";
import { db } from "@/db/index.ts";
import {
  feeTableReferenceWith,
  getAnalysisWith,
  getChargeNotesWith,
} from "@/lib/cedulas.ts";
import { modelsOf } from "@/lib/cedulas-files.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { FeeTableReminder } from "../../../../_components/fee-table-reminder.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireCedulas } from "../_access.ts";
import {
  CedulaDataForm,
  LinkRequestForm,
  ModelsPanel,
  RemoveAnalysis,
  RequirementsPanel,
  RestoreAnalysis,
} from "../cedula-forms.tsx";

export const metadata = { title: "Análise de cédula" };

const NATURE = {
  registro: "Registro",
  averbacao: "Averbação",
  remissao: "Remissão",
  fora: "Outro órgão",
} as const;

const HISTORY_WHAT = (what: string) =>
  what === "dados"
    ? "dados da cédula alterados"
    : what === "vinculo"
      ? "vínculo com o pedido alterado"
      : what.startsWith("modelo:")
        ? `modelo "${what.slice(7)}" editado`
        : what;

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <section
      className={
        tone === "warning"
          ? "flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning-soft px-5 py-4 text-sm text-warning-text"
          : "flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4"
      }
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function CedulaAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCedulas();
  const tenant = await getTenant();
  const analysis = await getAnalysisWith(db, tenant.slug, (await params).id);
  if (!analysis) notFound();
  const [notes, feeTable] = await Promise.all([
    getChargeNotesWith(db, tenant.slug),
    feeTableReferenceWith(db, tenant.slug),
  ]);
  const canUpdateTable = can(
    session.user.role ?? "",
    "transparency.manage",
    session.user.permissions,
  );
  const plan = planActs(analysis.data);
  const info = KIND_INFO[analysis.kind];
  const models = modelsOf(tenant, analysis);
  const suggestions = suggestRequirements(analysis.data, plan);
  const removed = Boolean(analysis.removedAt);
  const when = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      timeZone: OFFICE_TIME_ZONE,
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title={info.label}
        description={analysis.title}
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/cedulas"
          label="Análise de cédulas"
        />

        {removed && (
          <Card title="Análise apagada" tone="warning">
            <p>
              Motivo: {analysis.removedReason}. Ela continua guardada; restaure
              para alterar.
            </p>
            <RestoreAnalysis id={analysis.id} />
          </Card>
        )}

        {analysis.aiNote && (
          <p className="rounded-xl border border-border bg-muted px-5 py-3 text-sm text-foreground">
            <strong className="font-semibold">Leitura dos documentos:</strong>{" "}
            {analysis.aiNote}
          </p>
        )}

        <Card title="Onde a cédula entra">
          <p className="text-sm text-foreground">{plan.cedulaAct}</p>
          <p className="text-xs text-muted-foreground">
            Fundamento: {plan.cedulaBasis}
          </p>
          <p className="text-sm text-foreground">
            <strong className="font-semibold">Prazo:</strong> {plan.deadline}{" "}
            <span className="text-xs text-muted-foreground">
              ({plan.deadlineBasis})
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {info.law}. Regras conferidas no texto oficial em {CHECKED_ON}.
          </p>
        </Card>

        {plan.divergence && (
          <Card title="Atenção: a lei mudou" tone="warning">
            <p>
              <strong className="font-semibold">Como era:</strong>{" "}
              {plan.divergence.before}
            </p>
            <p>
              <strong className="font-semibold">O que vale hoje:</strong>{" "}
              {plan.divergence.now}
            </p>
            <div>
              <strong className="font-semibold">Como fazer agora:</strong>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                {plan.divergence.how.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        {plan.toConfirm && (
          <Card title="A conferir" tone="warning">
            <p>{plan.toConfirm}</p>
          </Card>
        )}

        {plan.warnings.length > 0 && (
          <Card title="Conferir" tone="warning">
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {plan.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Atos sugeridos">
          {plan.acts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum ato nesta serventia com os dados de agora. Confira a
              espécie e as garantias.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {plan.acts.map((act) => (
                <li key={act.id} className="flex flex-col gap-1 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-foreground">
                      {NATURE[act.nature]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ACT_WHERE_LABELS[act.where]}
                    </span>
                    {act.optional && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        A requerimento
                      </span>
                    )}
                    {act.elsewhere && (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-text">
                        Fora desta serventia
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-foreground">
                    {act.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {act.why}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Fundamento: {act.basis}
                  </span>
                  <span className="text-xs text-foreground">
                    <strong className="font-semibold">Cobrança:</strong>{" "}
                    {CHARGE_LABELS[act.charge]}
                    {act.charge !== "nenhum" && feeTable
                      ? `, pela ${feeTable.title}`
                      : ""}
                    {notes[act.charge] ? ` · ${notes[act.charge]}` : ""}
                  </span>
                  {(act.how ?? []).length > 0 && (
                    <details className="mt-1 text-sm" open={!act.elsewhere}>
                      <summary className="cursor-pointer font-medium text-foreground">
                        Como fazer
                      </summary>
                      <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
                        {(act.how ?? []).map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
          <FeeTableReminder table={feeTable} canUpdate={canUpdateTable} />
          {plan.rules.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-foreground">
                Regras desta espécie
              </summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                {plan.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card title="Nota de exigência">
          {analysis.data.noteIds.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {analysis.data.noteIds.map((noteId, i) => (
                <li key={noteId}>
                  <Link
                    href={`/admin/utilitarios/qualificacao/${noteId}`}
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    Abrir a nota de exigência {i + 1} na Qualificação de títulos
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <RequirementsPanel
            key={suggestions.map((r) => r.key).join(",")}
            id={analysis.id}
            suggestions={suggestions}
            presenter={
              analysis.data.people.find((p) => p.role === "credor")?.name ?? ""
            }
            canQualify={can(
              session.user.role ?? "",
              "qualificacao.manage",
              session.user.permissions,
            )}
            disabled={removed}
          />
        </Card>

        <Card title="Modelos">
          <ModelsPanel
            id={analysis.id}
            models={models.map((m) => ({
              id: m.id,
              title: m.title,
              group: m.group,
              text: m.text,
              generated: m.generated,
              edited: m.edited,
            }))}
            disabled={removed}
          />
        </Card>

        <Card title="Dados da cédula">
          <p className="text-sm text-muted-foreground">
            Confira e corrija. Ao salvar, os atos e os modelos são refeitos; os
            dados anteriores ficam no histórico.
          </p>
          <CedulaDataForm
            id={analysis.id}
            initial={analysis.data}
            disabled={removed}
          />
        </Card>

        <Card title="Pedido">
          <LinkRequestForm
            id={analysis.id}
            protocol={analysis.protocolNumber}
            requestHref={
              analysis.protocolNumber
                ? `/admin/pedidos/${analysis.protocolNumber}`
                : null
            }
          />
        </Card>

        <Card title="Arquivos lidos e histórico">
          <p className="text-sm text-foreground">
            {analysis.files.length > 0
              ? `Lidos e descartados: ${analysis.files.join(", ")}.`
              : "Nenhum arquivo lido: dados preenchidos à mão."}
          </p>
          {analysis.history.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {[...analysis.history].reverse().map((h, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
                <li key={i}>
                  {when(h.at)}: {HISTORY_WHAT(h.what)}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma alteração.</p>
          )}
          {!removed && (
            <div className="pt-2">
              <RemoveAnalysis id={analysis.id} />
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
