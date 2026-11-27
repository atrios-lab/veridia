import Link from "next/link";
import { SignOrPrint } from "@/app/admin/_components/sign-or-print.tsx";
import {
  ACQUIRER_KINDS,
  FOREIGN_KINDS,
  type ForeignKind,
  lastClosedQuarter,
  quarterOf,
  quarterRule,
  quarterSpan,
  recipientsFor,
} from "@/core/ri/foreign.ts";
import { db } from "@/db/index.ts";
import {
  entriesOfQuarter,
  entryOf,
  listForeignReportsWith,
  listForeignWith,
} from "@/lib/ri-foreign.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { Badge } from "../../_ui/badge.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { ConfirmButton } from "../_components/client.tsx";
import {
  ForeignAverbacaoForm,
  ForeignForm,
  ForeignReportForm,
} from "../_components/foreign-forms.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";
import {
  deleteForeignReportAction,
  setForeignDeletedAction,
} from "../actions.ts";

export const metadata = {
  title: "Aquisição de imóvel rural por estrangeiro",
};

const br = (iso: string | null) =>
  iso ? iso.split("-").reverse().join("/") : "";

/**
 * The Livro de Cadastro de Aquisição de Imóvel Rural por Estrangeiro and its
 * relação trimestral (decision of 27/11/2026; src/core/ri/foreign.ts).
 */
export default async function ForeignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, tenant } = await requireRi();
  const showDeleted = (await searchParams).apagados === "1";
  const canEdit = riCan(session, "ri.edit");
  const all = await listForeignWith(db, tenant.slug);
  const deleted = await listForeignWith(db, tenant.slug, { deleted: true });
  const rows = showDeleted ? deleted : all;
  const reports = await listForeignReportsWith(db, tenant.slug);
  const today = officeToday();
  const quarters = [lastClosedQuarter(today), quarterOf(today)];
  return (
    <RiPage
      wide
      title="Aquisição de imóvel rural por estrangeiro"
      description="Livro auxiliar obrigatório: cadastro especial das aquisições e dos arrendamentos de imóvel rural por estrangeiro e por pessoa jurídica brasileira equiparada (Lei nº 5.709/1971, art. 10; Decreto nº 74.965/1974, art. 15; Prov. nº 156/2016 CGJ/RN, arts. 68, § 1º, e 274). Imóvel urbano não entra aqui: o registro é o comum, na matrícula."
      actions={
        deleted.length > 0 && (
          <Link
            href={
              showDeleted
                ? "/admin/ri/estrangeiros"
                : "/admin/ri/estrangeiros?apagados=1"
            }
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {showDeleted ? "Ver os assentos" : `Apagados (${deleted.length})`}
          </Link>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel
            title="Comunicação trimestral"
            description="A relação vai à Corregedoria e ao INCRA (Ministério da Agricultura) a cada trimestre; quando o imóvel está em área indispensável à segurança nacional, também ao Conselho (Prov. 156/RN, art. 275; Lei nº 5.709/1971, art. 11)."
          >
            <div className="flex flex-col gap-4">
              {quarters.map(({ year, quarter }) => {
                const span = quarterSpan(year, quarter);
                const inQuarter = entriesOfQuarter(all, year, quarter);
                const sent = reports.filter(
                  (r) => r.year === year && r.quarter === quarter,
                );
                const closed = span.to < today;
                const href = `/admin/ri/estrangeiros/trimestre?ano=${year}&trimestre=${quarter}`;
                return (
                  <div
                    key={`${year}-${quarter}`}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {span.label}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({br(span.from)} a {br(span.to)})
                        </span>
                      </p>
                      <Badge
                        variant={
                          sent.length
                            ? "secondary"
                            : closed && inQuarter.length
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {sent.length
                          ? `Enviada em ${br(sent[sent.length - 1]?.sentOn ?? null)}`
                          : !closed
                            ? "Trimestre em curso"
                            : inQuarter.length
                              ? "Falta enviar"
                              : "Sem aquisição"}
                      </Badge>
                    </div>
                    <p className="text-sm">
                      {inQuarter.length}{" "}
                      {inQuarter.length === 1 ? "assento" : "assentos"} no
                      período.{" "}
                      {quarterRule(inQuarter.length, tenant.location.state)}
                    </p>
                    <SignOrPrint
                      pdfHref={href}
                      title={`${inQuarter.length ? "Relação" : "Certidão negativa"} de estrangeiros, ${span.label}`}
                      size="sm"
                    />
                    {sent.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
                      >
                        <span>
                          {r.kind === "negativa"
                            ? "Certidão negativa"
                            : "Relação"}{" "}
                          enviada em {br(r.sentOn)} a{" "}
                          {((r.recipients as string[]) ?? []).join("; ")}
                          {r.notes ? ` (${r.notes})` : ""}
                        </span>
                        {canEdit && (
                          <ConfirmButton
                            action={deleteForeignReportAction}
                            fields={{ id: r.id }}
                            trigger="Desfazer"
                            question="Desfazer o registro deste envio?"
                            consequence="O envio volta a aparecer como pendente. O registro fica no histórico."
                            confirmLabel="Desfazer"
                            pendingLabel="Desfazendo..."
                          />
                        )}
                      </div>
                    ))}
                    {canEdit && sent.length === 0 && closed && (
                      <ForeignReportForm
                        year={year}
                        quarter={quarter}
                        recipients={recipientsFor(
                          inQuarter.map((r) => entryOf(r)),
                        )}
                        negative={inQuarter.length === 0}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title={
              showDeleted ? "Assentos apagados" : `Assentos (${rows.length})`
            }
            description="Colunas do modelo: Nº, Adquirente e Transmitente, Descrição do Imóvel, Certidões e Autorizações, Averbações (Decreto nº 74.965/1974, art. 15)."
          >
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {showDeleted
                  ? "Nenhum assento apagado."
                  : "Nenhum assento lançado."}
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {rows.map((r) => {
                  const e = entryOf(r);
                  return (
                    <li key={r.id} className="flex flex-col gap-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          Nº {r.number} · {FOREIGN_KINDS[r.kind as ForeignKind]}{" "}
                          · {r.acquirerName}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Registro em {br(r.registeredOn)}
                          {r.matricula ? ` · matrícula nº ${r.matricula}` : ""}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ACQUIRER_KINDS[e.acquirerKind]}
                        {r.nationality ? ` · ${r.nationality}` : ""} · {r.area}{" "}
                        ha em {r.municipality}
                        {r.securityArea ? " · área de segurança nacional" : ""}
                      </p>
                      {e.averbacoes.length > 0 && (
                        <ul className="text-sm">
                          {e.averbacoes.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      )}
                      {canEdit && !showDeleted && (
                        <div className="flex flex-col gap-2">
                          <details className="rounded-lg border p-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              Alterar este assento
                            </summary>
                            <div className="pt-3">
                              <ForeignForm
                                id={r.id}
                                value={{
                                  ...e,
                                  registeredOn: br(r.registeredOn),
                                  authorizationDate: br(r.authorizationDate),
                                  matricula: r.matricula
                                    ? String(r.matricula)
                                    : "",
                                }}
                              />
                            </div>
                          </details>
                          <ForeignAverbacaoForm id={r.id} />
                        </div>
                      )}
                      {canEdit && (
                        <div>
                          <ConfirmButton
                            action={setForeignDeletedAction}
                            fields={{
                              id: r.id,
                              op: showDeleted ? "restore" : "delete",
                            }}
                            trigger={showDeleted ? "Restaurar" : "Apagar"}
                            question={
                              showDeleted
                                ? `Restaurar o assento nº ${r.number}?`
                                : `Apagar o assento nº ${r.number}?`
                            }
                            consequence={
                              showDeleted
                                ? "Ele volta ao livro."
                                : "Sai do livro e da relação trimestral, mas fica guardado. Quem não é o Tabelião envia o pedido para ele aprovar."
                            }
                            confirmLabel={showDeleted ? "Restaurar" : "Apagar"}
                            pendingLabel="Salvando..."
                            destructive={!showDeleted}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel
            title="Imprimir, assinar e exportar"
            description="O livro inteiro num PDF, para assinar com o certificado digital ou imprimir e assinar à mão."
          >
            <div className="flex flex-col gap-3">
              <SignOrPrint
                pdfHref="/admin/ri/estrangeiros/pdf"
                title="Livro de Cadastro de Aquisição por Estrangeiro"
                size="sm"
              />
              <div className="flex flex-wrap gap-2">
                <a
                  href="/admin/ri/estrangeiros/tabela?formato=xlsx"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Baixar planilha (Excel)
                </a>
                <a
                  href="/admin/ri/estrangeiros/tabela?formato=csv"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Baixar CSV
                </a>
              </div>
            </div>
          </Panel>
          {canEdit && !showDeleted && (
            <Panel
              title="Lançar assento"
              description="Faça primeiro o registro comum na matrícula (Livro 2). Depois lance aqui, com a data desse registro."
            >
              <ForeignForm />
            </Panel>
          )}
          <Panel title="Como fazer">
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              <li>
                Confira se o imóvel é rural e se o adquirente é estrangeiro ou
                pessoa jurídica equiparada (Prov. 156/RN, art. 274, na redação
                do Prov. nº 223/2020). Imóvel urbano não entra neste livro.
              </li>
              <li>
                Confira a autorização: a pessoa jurídica estrangeira ou
                equiparada depende de aprovação do INCRA, qualquer que seja a
                área (Prov. 156/RN, art. 539); a pessoa física, acima de 3
                módulos (art. 538). Em faixa de fronteira, o assentimento
                prévio.
              </li>
              <li>
                Confira o limite do município: as áreas de estrangeiros não
                passam de um quarto da superfície do município (Prov. 156/RN,
                art. 540).
              </li>
              <li>
                Registre na matrícula e lance o assento aqui, com documento,
                nacionalidade, cônjuge brasileiro, área, CCIR e a autorização
                (Decreto nº 74.965/1974, art. 15).
              </li>
              <li>
                Ao fim de cada trimestre, gere a relação, assine e envie à
                Corregedoria e ao INCRA; registre o envio aqui (Prov. 156/RN,
                art. 275). Sem aquisição no trimestre, no RN a comunicação é
                dispensada (§ 2º).
              </li>
            </ol>
            <p className="pt-3 text-xs text-muted-foreground">
              A Lei nº 5.709/1971 e o Decreto nº 74.965/1974 estão em
              planalto.gov.br: confira o texto vigente antes de decidir um caso
              difícil.
            </p>
          </Panel>
        </div>
      </div>
    </RiPage>
  );
}
