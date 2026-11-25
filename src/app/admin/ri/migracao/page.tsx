import Link from "next/link";
import { situationOf } from "@/core/ri/acts.ts";
import { cnsDigits } from "@/core/ri/cnm.ts";
import {
  PENDENCY_HOW_TO,
  PENDENCY_LABELS,
  type PendencyKind,
  pendenciesOf,
} from "@/core/ri/pendencies.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { ImportForm } from "../_components/import-form.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Pendências e importação" };

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
  const pendencies = pendenciesOf(
    cns,
    acervo.properties.map((p) => ({
      ...p,
      ownerCount: situationOf(acervo.acts.get(p.id) ?? []).owners.length,
    })),
  );
  return (
    <RiPage
      wide
      title="Pendências e importação"
      description="A migração do acervo para fichas (CNN, arts. 336 a 339): o que precisa de decisão antes do lote de CNM e do envio dos indicadores à ONR. Cada pendência traz o passo a passo e a regra de onde vem."
    >
      {riCan(session, "ri.import") && (
        <section id="importar">
          <Panel
            title="Importar a planilha do índice"
            description="O índice de matrículas que a serventia já mantém em planilha. Primeiro o sistema confere e mostra o que leu; só depois importa. Use só a planilha da própria serventia."
          >
            <ImportForm />
          </Panel>
        </section>
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
                        <span className="flex flex-wrap gap-2 text-xs">
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
    </RiPage>
  );
}
