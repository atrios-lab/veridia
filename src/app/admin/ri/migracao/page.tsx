import Link from "next/link";
import { cnsDigits } from "@/core/ri/cnm.ts";
import {
  PENDENCY_HOW_TO,
  PENDENCY_LABELS,
  type PendencyKind,
  pendenciesOf,
} from "@/core/ri/pendencies.ts";
import { db } from "@/db/index.ts";
import { loadAcervo } from "@/lib/ri.ts";
import {
  markedPendenciesWith,
  ownerCountOf,
  pendencyKey,
} from "@/lib/ri-pendencies.ts";
import { ActionButton, ConfirmButton } from "../_components/client.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan, stamp } from "../_lib.ts";
import { markPendencyAction } from "../actions.ts";

export const metadata = { title: "Pendências da migração" };

const ORDER: PendencyKind[] = [
  "repetido",
  "duplicidade",
  "salto",
  "cnm",
  "proprietario",
  "indicador",
];

const SHOWN = 50;

export default async function MigrationPage() {
  const { session, tenant } = await requireRi();
  const acervo = await loadAcervo(tenant.slug);
  const cns = cnsDigits(tenant.cns) ?? tenant.cns;
  const marked = await markedPendenciesWith(db, tenant.slug);
  const canEdit = riCan(session, "ri.edit");
  const all = pendenciesOf(
    cns,
    acervo.properties.map((p) => ({
      ...p,
      ownerCount: ownerCountOf(acervo.acts.get(p.id) ?? []),
    })),
  );
  const pendencies = all.filter((p) => !marked.has(pendencyKey(p.kind, p.ids)));
  const done = all.filter((p) => marked.has(pendencyKey(p.kind, p.ids)));
  return (
    <RiPage
      wide
      title="Pendências da migração"
      description="A migração do acervo para fichas (CNN, arts. 336 a 339): o que precisa de decisão antes do lote de CNM e do envio dos indicadores à ONR. Cada pendência traz o passo a passo e a regra de onde vem."
    >
      {riCan(session, "ri.import") && (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm shadow-xs">
          Para trazer o índice de matrículas, os atos ou os indicadores que a
          serventia já tem (planilha, JSON ou os arquivos da ONR), use{" "}
          <Link
            href="/admin/ri/importar-exportar"
            className="font-medium text-primary underline underline-offset-2"
          >
            Importar e exportar
          </Link>
          : o sistema confere e mostra o que leu antes de importar.
        </p>
      )}

      {pendencies.length === 0 ? (
        <Panel title="Pendências">
          <p className="text-sm text-muted-foreground">
            Nenhuma pendência no acervo cadastrado.
          </p>
        </Panel>
      ) : (
        ORDER.map((kind) => {
          const list = pendencies.filter((p) => p.kind === kind);
          if (list.length === 0) return null;
          return (
            <section key={kind} id={kind}>
              <Panel
                title={`${PENDENCY_LABELS[kind]} (${list.length})`}
                description="Como fazer:"
              >
                <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                  {PENDENCY_HOW_TO[kind].map((step) => (
                    <li key={step.step}>
                      {step.step}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({step.source})
                      </span>
                    </li>
                  ))}
                </ol>
                <ul className="divide-y rounded-lg border bg-background">
                  {list.slice(0, SHOWN).map((p) => (
                    <li
                      key={`${p.title}-${p.ids.join()}`}
                      className="flex flex-col gap-0.5 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{p.title}</span>
                      <span className="text-xs break-words text-muted-foreground">
                        {p.detail}
                      </span>
                      {p.ids.length > 0 && (
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          {kind === "proprietario" && canEdit && (
                            <Link
                              href={`/admin/ri/matriculas/${p.ids[0]}/ato/novo?natureza=${encodeURIComponent("Abertura de matrícula")}`}
                              className="rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground"
                            >
                              Lançar o ato que falta
                            </Link>
                          )}
                          {p.ids.map((id, i) => (
                            <Link
                              key={id}
                              href={`/admin/ri/matriculas/${id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              Abrir{" "}
                              {p.ids.length > 1 ? `a ${i + 1}ª` : "a matrícula"}
                            </Link>
                          ))}
                          {canEdit && (
                            <ConfirmButton
                              action={markPendencyAction}
                              fields={{ key: pendencyKey(p.kind, p.ids) }}
                              trigger="Concluído"
                              question="Marcar esta pendência como concluída?"
                              consequence="Ela sai da lista e das notificações. Fica no histórico abaixo e na auditoria, e dá para voltar."
                              confirmLabel="Concluído"
                              pendingLabel="Salvando…"
                              destructive={false}
                            />
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {list.length > SHOWN && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mostrando {SHOWN} de {list.length}. Resolva estas e as
                    próximas aparecem.
                  </p>
                )}
              </Panel>
            </section>
          );
        })
      )}
      {done.length > 0 && (
        <Panel
          title={`Concluídas (${done.length})`}
          description="Marcadas pelo cartório. Se voltar a acontecer, volte para a lista."
        >
          <ul className="divide-y rounded-lg border bg-background">
            {done.map((p) => {
              const key = pendencyKey(p.kind, p.ids);
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span>
                    {p.title}
                    <span className="block text-xs text-muted-foreground">
                      Concluída em {stamp(marked.get(key)?.at ?? new Date())}
                      {marked.get(key)?.note
                        ? `: ${marked.get(key)?.note}`
                        : ""}
                    </span>
                  </span>
                  {canEdit && (
                    <ActionButton
                      action={markPendencyAction}
                      fields={{ key, op: "undo" }}
                      label="Voltar para a lista"
                      pendingLabel="Salvando…"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </RiPage>
  );
}
