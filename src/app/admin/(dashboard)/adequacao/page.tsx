import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  changedAfterSubmit,
  formatMoney,
  progress,
  resumeSection,
  type SectionStatus,
} from "@/core/compliance/answers.ts";
import { classificationOf } from "@/core/compliance/classification.ts";
import {
  detectPendencies,
  pendencyCounts,
  sectionTitle,
  unknownAnswers,
} from "@/core/compliance/pendencies.ts";
import { SECTIONS, text } from "@/core/compliance/sections.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import { loadIntake } from "@/lib/compliance.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { buttonVariants } from "../../_ui/button.tsx";

export const metadata = { title: "Adequação ao Provimento" };

const STATUS_LABEL: Record<SectionStatus, string> = {
  "not-started": "não iniciada",
  "in-progress": "em andamento",
  complete: "concluída",
};
const STATUS_PILL: Record<SectionStatus, string> = {
  "not-started": "bg-muted text-muted-foreground",
  "in-progress": "bg-primary text-primary-foreground",
  complete: "bg-success-soft text-success-text",
};

function stamp(date: Date): string {
  const iso = toIsoDate(date, OFFICE_TIME_ZONE);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: OFFICE_TIME_ZONE,
  }).format(date);
  return `${formatDate(iso)} às ${time}`;
}

export default async function CompliancePage() {
  // The layout proved the session and admin.access; this screen needs
  // content.edit and checks for itself. A 404, not an explanation: same rule
  // as Configurações.
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  // The Átrios platform account. Its extra: the pendências ledger and the
  // export. The route behind the button checks the role again.
  const atrios = session.user.role === "superadmin";

  const { intake, answers } = await loadIntake(tenant);
  const state = progress(answers, intake.sectionUpdatedAt);
  const resume = resumeSection(state, intake.sectionUpdatedAt);
  const pendencies = detectPendencies(answers);
  const counts = pendencyCounts(pendencies);
  const unknowns = unknownAnswers(answers);
  const classification = classificationOf(answers);
  const submittedIso = intake.submittedAt?.toISOString() ?? null;
  const changed = new Set(
    changedAfterSubmit(intake.sectionUpdatedAt, submittedIso),
  );
  const revenue = text(answers, "serventia", "revenueLastSemester");

  return (
    <>
      <AdminPageHeader title="Adequação ao Provimento" />
      <main className="flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_348px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {intake.submittedAt && (
              <p className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success-soft p-4 text-sm text-success-text">
                <AdminIcon
                  name="checkCircle"
                  className="mt-0.5 h-4 w-4 flex-none"
                />
                <span>
                  <strong className="block font-semibold">
                    Enviado à Átrios em {stamp(intake.submittedAt)}
                    {intake.submittedVersion > 1
                      ? ` (versão ${intake.submittedVersion})`
                      : ""}
                    .
                  </strong>
                  A Átrios revisa as respostas, confirma o que precisar com você
                  pelo WhatsApp e entrega os documentos pessoalmente. As
                  respostas continuam abertas para correção.
                </span>
              </p>
            )}

            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Responda aos poucos. O painel guarda cada resposta.
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                São {SECTIONS.length} seções curtas sobre a serventia, a equipe
                e os equipamentos. A Átrios usa as respostas para montar a
                documentação do Provimento 243 e entrega em mãos. Nada é
                publicado no site.
              </p>
              <div className="mt-5 flex items-center gap-4">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={state.complete}
                  aria-valuemin={0}
                  aria-valuemax={state.total}
                  aria-label={`${state.complete} de ${state.total} seções respondidas`}
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{
                      width: `${(state.complete / state.total) * 100}%`,
                    }}
                  />
                </div>
                <span className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground">
                  {state.complete} de {state.total} seções
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {state.ready ? (
                  <Link
                    href="/admin/adequacao/revisao"
                    className={buttonVariants({ size: "lg" })}
                  >
                    Revisar e enviar
                  </Link>
                ) : (
                  <Link
                    href={`/admin/adequacao/${resume.id}`}
                    className={buttonVariants({ size: "lg" })}
                  >
                    {state.complete === 0
                      ? "Começar pela Seção 1"
                      : "Continuar de onde parei"}
                  </Link>
                )}
                {!state.ready && state.complete > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Próxima: Seção {resume.number} · {resume.title}
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                As {SECTIONS.length} seções
              </h3>
              <ol className="mt-2 flex flex-col">
                {SECTIONS.map((section) => {
                  const status = state.statuses[section.id];
                  const count = counts[section.id] ?? 0;
                  return (
                    <li
                      key={section.id}
                      className="border-t border-border first:border-t-0"
                    >
                      <Link
                        href={`/admin/adequacao/${section.id}`}
                        className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3 text-sm text-foreground hover:text-primary"
                      >
                        <span className="text-right text-xs font-medium tabular-nums text-muted-foreground">
                          {section.number}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {section.title}
                          </span>
                          {section.prefilled && status === "not-started" && (
                            <span className="block text-xs text-muted-foreground">
                              Já vem preenchida com o que o painel sabe. Abra
                              para confirmar.
                            </span>
                          )}
                          {atrios && changed.has(section.id) && (
                            <span className="block text-xs text-muted-foreground">
                              Editada em{" "}
                              {formatDate(
                                toIsoDate(
                                  new Date(intake.sectionUpdatedAt[section.id]),
                                  OFFICE_TIME_ZONE,
                                ),
                              )}
                              , depois do envio.
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          {atrios && changed.has(section.id) && (
                            <span className="rounded-full bg-warning px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
                              alterada após o envio
                            </span>
                          )}
                          {count > 0 && (
                            <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-medium text-destructive-foreground">
                              {count} {count === 1 ? "aviso" : "avisos"}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[status]}`}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            {atrios && (
              <section className="rounded-xl border border-primary bg-card p-5">
                <span className="text-xs font-medium text-muted-foreground">
                  Perfil Átrios
                </span>
                <p className="mt-2 text-xs text-foreground">
                  {intake.submittedAt
                    ? `Versão ${intake.submittedVersion}, enviada em ${stamp(intake.submittedAt)}.`
                    : "A serventia ainda não enviou. O JSON já sai com o que existe."}
                </p>
                <a
                  href="/admin/adequacao/exportar"
                  className={buttonVariants({ className: "mt-3" })}
                >
                  Exportar JSON · {tenant.slug}.json
                </a>
                <p className="mt-2 text-xs text-muted-foreground">
                  Só este perfil vê o botão. A serventia vê a mesma lista sem
                  ele.
                </p>
              </section>
            )}

            <section className="rounded-xl border border-border bg-card p-5">
              <span className="text-xs font-medium text-muted-foreground">
                Classe da serventia
              </span>
              {classification ? (
                <>
                  <p className="mt-2.5 text-xl font-semibold text-foreground">
                    Classe {classification.classe} · subclasse{" "}
                    {classification.subclasse}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Receita bruta de {formatMoney(revenue)} no último semestre,
                    pela tabela do art. 16 do Provimento 243.
                  </p>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Etapa 1 até</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatDate(classification.stage1Deadline)}
                    </dd>
                    <dt className="text-muted-foreground">Conclusão até</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatDate(classification.completionDeadline)}
                    </dd>
                  </dl>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Aparece assim que a receita bruta do último semestre for
                  informada na Seção 1.
                </p>
              )}
            </section>

            {atrios && (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pendências detectadas
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pelas regras de derivação. Quem aplica no documento é o
                    gerador.
                  </p>
                  {pendencies.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nenhuma até agora.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col">
                      {pendencies.map((p) => (
                        <li
                          key={p.code}
                          className="flex items-start gap-2.5 border-t border-border py-2.5 text-xs first:border-t-0"
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                              p.severity === "critical"
                                ? "bg-destructive"
                                : p.severity === "warning"
                                  ? "bg-warning"
                                  : "bg-muted-foreground"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-foreground">
                              {p.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {p.detail}
                            </span>
                          </span>
                          <Link
                            href={`/admin/adequacao/${p.sectionId}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {sectionTitle(p.sectionId)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <span className="text-xs font-medium text-muted-foreground">
                    "Não sei" a confirmar
                  </span>
                  {unknowns.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nenhum.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                      {unknowns.map((u) => (
                        <li key={`${u.sectionId}.${u.field}`}>
                          <Link
                            href={`/admin/adequacao/${u.sectionId}`}
                            className="hover:underline"
                          >
                            <span className="text-muted-foreground">
                              {u.sectionTitle}:
                            </span>{" "}
                            {u.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}

            <section className="rounded-xl border border-border bg-card p-5">
              <span className="text-xs font-medium text-muted-foreground">
                Como funciona
              </span>
              <ol className="mt-2.5 list-decimal pl-4.5 text-sm leading-relaxed text-foreground">
                <li>
                  Você responde as seções, na ordem que quiser, pelo celular ou
                  computador. Cada resposta salva sozinha.
                </li>
                <li>Revisa tudo numa tela só e envia para a Átrios.</li>
                <li>
                  A Átrios confirma o que faltar pelo WhatsApp e entrega os
                  documentos pessoalmente.
                </li>
              </ol>
              <p className="mt-2.5 text-xs text-muted-foreground">
                Cada pergunta tem um "?" explicando onde achar a resposta. Se
                travar, marque "não sei" e siga.
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
