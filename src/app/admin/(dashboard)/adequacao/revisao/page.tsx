import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  displayValue,
  isEmpty,
  progress,
  visibleFields,
} from "@/core/compliance/answers.ts";
import {
  detectPendencies,
  sectionTitle,
} from "@/core/compliance/pendencies.ts";
import {
  isVisible,
  type ListItem,
  SECTIONS,
} from "@/core/compliance/sections.ts";
import { loadIntake } from "@/lib/compliance.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { SubmitForm } from "./submit-form.tsx";

export const metadata = { title: "Revisão e envio" };

export default async function ReviewPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const tenant = await getTenant();
  const { intake, answers } = await loadIntake(tenant);
  const state = progress(answers, intake.sectionUpdatedAt);
  const pendencies = detectPendencies(answers).filter(
    (p) => p.severity !== "info",
  );
  const missing = SECTIONS.filter((s) => state.statuses[s.id] !== "complete");

  return (
    <>
      <AdminPageHeader
        title="Revisão e envio"
        back={{ href: "/admin/adequacao", label: "Adequação ao Provimento" }}
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7">
        {state.ready ? (
          <p className="flex items-start gap-2.5 rounded-[10px] bg-admin-success-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-admin-success-text">
            <AdminIcon
              name="checkCircle"
              className="mt-0.5 h-4 w-4 flex-none"
            />
            <span>
              <strong className="block font-bold">
                As {SECTIONS.length} seções estão respondidas.
              </strong>
              Confira abaixo. Tudo pode ser editado, inclusive depois do envio.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2.5 rounded-[10px] bg-admin-warning-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-admin-warning-text">
            <AdminIcon name="alert" className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              <strong className="block font-bold">
                Faltam {missing.length}{" "}
                {missing.length === 1 ? "seção" : "seções"} para enviar.
              </strong>
              {missing.map((s) => `${s.number} · ${s.title}`).join(", ")}. Você
              já pode conferir o que respondeu.
            </span>
          </p>
        )}

        {pendencies.length > 0 && (
          <section className="rounded-[14px] border border-admin-border bg-admin-card p-6">
            <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
              O que vai aparecer como pendência nos documentos
            </h2>
            <p className="mt-1.5 text-[12.5px] text-admin-muted">
              Nada disso impede o envio. São fatos que a Átrios registra com
              prazo de 30 dias no plano de continuidade.
            </p>
            <ul className="mt-3 flex flex-col">
              {pendencies.map((p) => (
                <li
                  key={p.code}
                  className="flex items-center gap-3 border-t border-admin-border py-2.5 text-[13px] first:border-t-0"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 flex-none rounded-full ${
                      p.severity === "critical"
                        ? "bg-admin-error-text"
                        : "bg-admin-accent"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-admin-text">
                      {p.title}
                    </span>
                    <span className="block text-[11.5px] text-admin-muted">
                      Seção {sectionTitle(p.sectionId)}
                    </span>
                  </span>
                  <Link
                    href={`/admin/adequacao/${p.sectionId}`}
                    className="btn btn-admin-secondary btn-sm"
                  >
                    Editar
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          {SECTIONS.map((section) => {
            const fields = visibleFields(section, answers).filter(
              (f) => !isEmpty(answers[section.id]?.[f.name]),
            );
            return (
              <div
                key={section.id}
                className="border-t border-admin-border py-4.5 first:border-t-0 first:pt-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-serif text-[15px] font-semibold text-admin-primary">
                    {section.number} · {section.title}
                  </h3>
                  <Link
                    href={`/admin/adequacao/${section.id}`}
                    className="btn btn-admin-secondary btn-sm"
                  >
                    Editar
                  </Link>
                </div>
                {section.id === "anexos" ? (
                  <p className="mt-2 text-[13px] text-admin-text">
                    {intake.attachments.length === 0
                      ? "Nenhum arquivo anexado."
                      : intake.attachments.map((a) => a.displayName).join(", ")}
                  </p>
                ) : fields.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-admin-faint">
                    Nada respondido ainda.
                  </p>
                ) : (
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[220px_1fr]">
                    {fields.map((field) => {
                      const value = answers[section.id][field.name];
                      return (
                        <div key={field.name} className="contents">
                          <dt className="text-admin-muted">{field.label}</dt>
                          <dd className="font-semibold text-admin-text">
                            {field.type === "list" ? (
                              <ul className="flex flex-col gap-1">
                                {(value as ListItem[]).map((item, index) => (
                                  <li
                                    // biome-ignore lint/suspicious/noArrayIndexKey: items have no id.
                                    key={index}
                                    className="font-normal"
                                  >
                                    {(field.items ?? [])
                                      .filter(
                                        (sub) =>
                                          isVisible(sub, { answers, item }) &&
                                          !isEmpty(item[sub.name]),
                                      )
                                      .map((sub) =>
                                        displayValue(sub, item[sub.name], {
                                          answers,
                                          item,
                                        }),
                                      )
                                      .join(" · ")}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              displayValue(field, value, { answers })
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </div>
            );
          })}
        </section>

        <SubmitForm
          ready={state.ready}
          officeEmail={tenant.contacts.email}
          submittedAt={intake.submittedAt?.toISOString() ?? null}
        />
      </main>
    </>
  );
}
