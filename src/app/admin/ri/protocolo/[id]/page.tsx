import { Pencil, PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeeTableReminder } from "@/app/admin/_components/fee-table-reminder.tsx";
import { SignOrPrint } from "@/app/admin/_components/sign-or-print.tsx";
import { can } from "@/core/auth/roles.ts";
import { planActs } from "@/core/ri/act-plan.ts";
import { situationOf } from "@/core/ri/acts.ts";
import { volumeLetter, volumeOfNumber } from "@/core/ri/books.ts";
import { PROTOCOL_FIELD_NAMES, plainValue } from "@/core/ri/history-text.ts";
import { brDate, propertyTitle } from "@/core/ri/property.ts";
import { type Requirement, registryChecks } from "@/core/ri/protocol.ts";
import { faceLabel, placeOf } from "@/core/ri/protocol-sheets.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { db } from "@/db/index.ts";
import { feeTableReferenceWith } from "@/lib/fee-tables.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { signatureSettingsWith } from "@/lib/ri-files.ts";
import { listLearnedActsWith } from "@/lib/ri-learning.ts";
import { bookSheetsWith } from "@/lib/ri-protocol-sheets.ts";
import {
  officeToday,
  type ProtocolHistoryEntry,
  protocolActsWith,
  protocolWith,
} from "@/lib/ri-protocols.ts";
import { buttonVariants } from "../../../_ui/button.tsx";
import { ActionButton, ConfirmButton } from "../../_components/client.tsx";
import { Field, Panel, RiPage } from "../../_components/page.tsx";
import {
  ReentryForm,
  RequirementsForm,
} from "../../_components/protocol-form.tsx";
import { requireRi, riCan, stamp } from "../../_lib.ts";
import {
  exportMatriculaToOnrAction,
  fulfillRequirementAction,
  issueRequirementsAction,
  protocolStatusAction,
  registerProtocolAction,
  setProtocolVoidedAction,
} from "../../actions.ts";
import { dueOf, statusText } from "../_shared.ts";

export const metadata = { title: "Protocolo" };

const money = (cents: number | null) =>
  cents === null
    ? ""
    : (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, tenant } = await requireRi();
  const { id } = await params;
  const row = await protocolWith(db, tenant.slug, id);
  if (!row) notFound();
  const [acervo, acts, table, signature, books] = await Promise.all([
    loadAcervo(tenant.slug),
    protocolActsWith(db, tenant.slug, row),
    feeTableReferenceWith(db, tenant.slug).catch(() => null),
    signatureSettingsWith(db, tenant.slug),
    listBooksWith(db, tenant.slug),
  ]);
  // The letter of the volume it was written in (1, 1-B…).
  const volume =
    row.kind === "prenotacao"
      ? volumeOfNumber(
          row.number,
          books.filter((b) => b.book === 1 && !b.deletedAt),
        )
      : null;
  // The folha it fell on, in the book whose folhas the system prints.
  const inBook = volume
    ? books.find((b) => b.book === 1 && !b.deletedAt && b.volume === volume)
    : undefined;
  const sheets = inBook ? await bookSheetsWith(db, tenant, inBook.id) : null;
  const sheetPlace = sheets ? placeOf(sheets.pagination, row.number) : null;
  const today = officeToday();
  const canEdit = riCan(session, "ri.edit") && !row.voidedAt;
  const exam = row.kind === "exame";
  const label = `${exam ? "Exame e cálculo" : "Protocolo"} nº ${row.number.toLocaleString("pt-BR")}`;
  const open = ["prenotado", "exigencia", "duvida"].includes(row.status);
  const plan = planActs(
    row.actsSummary || row.titleKind,
    await listLearnedActsWith(db, tenant.slug),
  );
  const ids = (row.propertyIds as string[]) ?? [];
  const properties = acervo.properties.filter((p) => ids.includes(p.id));
  const suggested = [
    ...properties.flatMap((p) => {
      const situation = situationOf(acervo.acts.get(p.id) ?? []);
      return registryChecks(
        { ...situation, closed: situation.closed || p.status !== 0 },
        [],
      )
        .filter((c) => !c.ok)
        .map((c) => `${propertyTitle(p)}: ${c.text} | ${c.source}`);
    }),
  ];
  const requirements = (row.requirements as Requirement[]) ?? [];
  const history = [
    ...((row.history as ProtocolHistoryEntry[]) ?? []),
  ].reverse();
  const qualify =
    open && row.status === "prenotado" ? dueOf(row.qualifyBy, today) : null;
  const ends = open ? dueOf(row.prenotationEnds, today) : null;
  const note = `/admin/ri/protocolo/${row.id}/nota`;
  const natureza = encodeURIComponent(row.actsSummary.split(/[;\n]/)[0] ?? "");

  return (
    <RiPage
      wide
      title={label}
      back={{ href: "/admin/ri/protocolo", label: "Protocolo" }}
      description={
        <>
          <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {row.voidedAt ? "Apagado" : statusText(row)}
          </span>
          {volume
            ? `Livro 1${volumeLetter(volume) ? `, letra ${volumeLetter(volume)}` : ""}${sheetPlace ? `, folha ${faceLabel(sheetPlace.sheet, sheetPlace.side)}` : ""}. `
            : ""}
          Apresentado em {brDate(row.presentedOn)} por {row.presenterName}.
        </>
      }
      actions={
        <>
          {canEdit && (
            <Link
              href={`/admin/ri/protocolo/${row.id}/alterar`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Pencil className="size-4" /> Alterar dados
            </Link>
          )}
          {riCan(session, "ri.edit") && (
            <ConfirmButton
              action={setProtocolVoidedAction}
              fields={{ id: row.id, op: row.voidedAt ? "restore" : "delete" }}
              trigger={row.voidedAt ? "Restaurar" : "Apagar"}
              question={
                row.voidedAt
                  ? `Restaurar o ${label}?`
                  : `Apagar o ${label}, lançado por engano?`
              }
              consequence={
                row.voidedAt
                  ? "Ele volta a valer, com os prazos que tinha."
                  : "Ele continua no Livro 1, marcado como lançado por engano, e o número não é usado de novo. Escreva o motivo."
              }
              confirmLabel={row.voidedAt ? "Restaurar" : "Apagar"}
              pendingLabel="Salvando…"
              destructive={!row.voidedAt}
            />
          )}
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {!exam && open && (
            <Panel title="Prazos (em dias úteis)">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Qualificar até"
                  value={
                    qualify ? (
                      <span
                        className={`rounded-full px-2 py-0.5 ${qualify.tone}`}
                      >
                        {qualify.text}
                      </span>
                    ) : (
                      brDate(row.qualifyBy)
                    )
                  }
                />
                <Field
                  label="Prenotação até"
                  value={
                    ends ? (
                      <span className={`rounded-full px-2 py-0.5 ${ends.tone}`}>
                        {ends.text}
                      </span>
                    ) : (
                      brDate(row.prenotationEnds)
                    )
                  }
                />
                {row.reentryOn && (
                  <Field label="Reingresso" value={brDate(row.reentryOn)} />
                )}
              </dl>
              <details className="mt-3 rounded-lg border bg-background px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium">
                  Como fazer
                </summary>
                <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
                  <li>
                    Qualifique o título: confira a continuidade, a
                    disponibilidade, a CNIB e os documentos. Registre ou emita a
                    nota devolutiva até a data de qualificação.
                    <span className="block text-xs text-muted-foreground">
                      Fonte: Lei nº 6.015/1973, art. 188; CNN (Provimento CNJ nº
                      149/2023), art. 320-F
                    </span>
                  </li>
                  <li>
                    Havendo exigências, liste todas de uma vez na nota
                    devolutiva, com a fonte de cada uma.
                    <span className="block text-xs text-muted-foreground">
                      Fonte: Lei nº 6.015/1973, art. 198
                    </span>
                  </li>
                  <li>
                    Se o apresentante cumprir as exigências dentro da
                    prenotação, lance o reingresso: o registro fica para 5 dias
                    úteis. Se a prenotação terminar sem o cumprimento, marque
                    como cessada.
                    <span className="block text-xs text-muted-foreground">
                      Fonte: Lei nº 6.015/1973, arts. 188, § 1º, III, e 205
                    </span>
                  </li>
                  <li>
                    Para registrar, lance o ato na matrícula com este número de
                    protocolo e o selo; depois conclua aqui como registrado.
                    <span className="block text-xs text-muted-foreground">
                      Fonte: Lei nº 6.015/1973, arts. 176 e 232
                    </span>
                  </li>
                </ol>
              </details>
            </Panel>
          )}

          <Panel
            title="Conferência nas matrículas"
            description="O que dá para conferir pela matrícula. O restante da qualificação é do oficial."
          >
            {properties.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Nenhuma matrícula ligada. Informe em Alterar dados. Se o
                  título é do Livro 3 (Registro Auxiliar), anexe e digitalize em{" "}
                  <Link
                    href="/admin/ri/livro-3"
                    className="text-primary underline underline-offset-2"
                  >
                    Registro Auxiliar (Livro 3)
                  </Link>
                  .
                </p>
                {!exam && canEdit && (
                  <div className="mt-3 rounded-lg border bg-background p-3">
                    <p className="text-sm font-semibold">
                      Título do Livro 3: digitalizar aqui
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Anexe o título. O sistema lê, guarda em texto, preenche o
                      registro e avisa se o número já tem registro (aí é
                      averbação). Se preferir, lance à mão em Registro Auxiliar.
                    </p>
                    <div className="mt-2">
                      <Link
                        href={`/admin/ri/matriculas/nova?livro=3&protocolo=${row.number}`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Digitalizar o título do Livro 3
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <ul className="flex flex-col gap-4">
                {properties.map((p) => {
                  const situation = situationOf(acervo.acts.get(p.id) ?? []);
                  const checks = registryChecks(
                    {
                      ...situation,
                      closed: situation.closed || p.status !== 0,
                    },
                    [],
                  );
                  return (
                    <li
                      key={p.id}
                      className="rounded-lg border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/admin/ri/matriculas/${p.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {propertyTitle(p)}
                        </Link>
                        {canEdit && !exam && open && (
                          <Link
                            href={`/admin/ri/matriculas/${p.id}/ato/novo?protocolo=${row.number}&de=${row.id}&natureza=${natureza}`}
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                            })}
                          >
                            Lançar outro ato
                          </Link>
                        )}
                      </div>
                      {!exam && plan.length > 0 && (
                        <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                          <p className="text-xs font-semibold">
                            Atos a fazer, na ordem (proposta do assistente
                            virtual; confira cada um antes de salvar)
                          </p>
                          <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5 text-sm">
                            {plan.map((a) => (
                              <li key={a.nature}>
                                <span className="font-medium">
                                  {a.kind
                                    ? `${a.kind === "R" ? "Registro (R)" : "Averbação (AV)"}: `
                                    : "A conferir: "}
                                  {a.nature}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {a.basis === "aprendido"
                                    ? "Aprendido com os atos do cartório. "
                                    : ""}
                                  {a.source}
                                </span>
                                {canEdit && open && (
                                  <Link
                                    href={`/admin/ri/matriculas/${p.id}/ato/novo?protocolo=${row.number}&de=${row.id}&natureza=${encodeURIComponent(a.nature)}`}
                                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                                  >
                                    Fazer este ato (consolidar na matrícula)
                                  </Link>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Proprietário(s):{" "}
                        {situation.owners
                          .map(
                            (o) =>
                              `${o.name}${o.document ? ` (${formatTaxId(o.document)})` : ""}`,
                          )
                          .join("; ") || "nenhum lançado"}
                      </p>
                      <ul className="mt-2 flex flex-col gap-1 text-sm">
                        {checks.map((c) => (
                          <li
                            key={c.text}
                            className={`rounded-md px-2.5 py-1.5 ${c.ok ? "bg-muted" : "bg-warning-soft text-warning-text"}`}
                          >
                            {c.ok ? "✓ " : "! "}
                            {c.text}
                            <span className="block text-xs opacity-80">
                              Fonte: {c.source}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {!exam && (
            <Panel
              title="Atos lançados com este protocolo"
              description="Cada ato precisa do selo, informado pela serventia."
              actions={
                canEdit &&
                open &&
                acts.length > 0 && (
                  <ActionButton
                    action={registerProtocolAction}
                    fields={{ id: row.id }}
                    label="Concluir: registrado"
                    pendingLabel="Conferindo…"
                    variant="default"
                  />
                )
              }
            >
              {acts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum ato lançado com o protocolo nº {row.number}.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {acts.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap justify-between gap-2 py-2"
                    >
                      <Link
                        href={`/admin/ri/matriculas/${a.propertyId}`}
                        className="font-medium hover:text-primary"
                      >
                        {a.kind}-{a.seq}-{a.number.toLocaleString("pt-BR")} ·{" "}
                        {a.nature}
                      </Link>
                      <span
                        className={`text-xs ${a.seal ? "text-muted-foreground" : "font-medium text-destructive"}`}
                      >
                        {a.seal ? `Selo ${a.seal}` : "sem selo"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {row.status === "registrado" && (
            <Panel
              title="Próximos passos"
              description="O título foi registrado. Faça o que falta, na ordem."
            >
              <p className="mb-3 rounded-md border border-warning/50 bg-warning-soft px-3 py-2 text-sm text-warning-text">
                A ficha da matrícula mudou: imprima a ficha nova e substitua a
                folha anterior no livro físico. No livro digital, gere de novo a
                imagem para a ONR.
              </p>
              <ul className="flex flex-col gap-3">
                {properties.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3 text-sm"
                  >
                    <span className="mr-auto font-semibold">
                      {propertyTitle(p)}
                    </span>
                    <a
                      href={`/admin/ri/matriculas/${p.id}/ficha`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      Imprimir a ficha nova
                    </a>
                    {p.book === 2 && riCan(session, "ri.export") && (
                      <ActionButton
                        action={exportMatriculaToOnrAction}
                        fields={{ id: p.id }}
                        label="Gerar a imagem para a ONR"
                        pendingLabel="Gerando…"
                      />
                    )}
                    <Link
                      href={`/admin/ri/certidoes?matricula=${p.id}`}
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      Emitir certidão
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/admin/ri/onr"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Indicadores e lote de CNM para a ONR
                </Link>
                <Link
                  href="/admin/ri/livros"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Livros (digital e físico, termos)
                </Link>
                <Link
                  href="/admin/ri/protocolo/dias"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Encerrar o Protocolo do dia
                </Link>
              </div>
            </Panel>
          )}

          <Panel
            title={exam ? "Exigências do exame" : "Nota devolutiva"}
            description="Lei nº 6.015/1973, art. 198: todas as exigências de uma vez, de forma clara, com a fonte."
          >
            {requirements.length > 0 && (
              <div className="mb-4 flex flex-col gap-3">
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
                  {requirements.map((r, index) => (
                    <li key={r.text}>
                      <span
                        className={r.fulfilled ? "line-through opacity-70" : ""}
                      >
                        {r.text}
                      </span>
                      {r.source && (
                        <span className="block text-xs text-muted-foreground">
                          Fonte: {r.source}
                        </span>
                      )}
                      {r.fulfilled ? (
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-success-text">
                          ✓ Cumprida em {stamp(new Date(r.fulfilled.at))}
                          {r.fulfilled.note ? `: ${r.fulfilled.note}` : ""}
                          {canEdit && (
                            <ActionButton
                              action={fulfillRequirementAction}
                              fields={{
                                id: row.id,
                                index: String(index),
                                op: "undo",
                              }}
                              label="Voltar para pendente"
                              pendingLabel="Salvando…"
                            />
                          )}
                        </span>
                      ) : (
                        canEdit &&
                        row.status !== "registrado" && (
                          <span className="mt-1 block">
                            <ConfirmButton
                              action={fulfillRequirementAction}
                              fields={{ id: row.id, index: String(index) }}
                              trigger="Já foi cumprida"
                              question="Marcar esta exigência como cumprida?"
                              consequence="Escreva como foi cumprida (o documento apresentado, por exemplo). Fica no histórico do protocolo e na auditoria, e dá para voltar atrás."
                              confirmLabel="Marcar cumprida"
                              pendingLabel="Salvando…"
                              destructive={false}
                            />
                          </span>
                        )
                      )}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <SignOrPrint
                    pdfHref={note}
                    title={`Nota devolutiva do ${label}`}
                    size="sm"
                  />
                  {signature.signatureImage && (
                    <a
                      href={`${note}?assinatura=imagem`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      <PenLine className="size-4" /> PDF com a minha assinatura
                    </a>
                  )}
                </div>
              </div>
            )}
            {canEdit &&
              row.status !== "registrado" &&
              requirements.length === 0 &&
              (suggested.length > 0 || plan.some((a) => a.kind === null)) && (
                <div className="mb-4 rounded-lg border border-warning/50 bg-warning-soft p-3 text-sm text-warning-text">
                  <p className="font-semibold">
                    O sistema achou o que conferir antes de registrar:
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {suggested.map((t) => (
                      <li key={t}>{t.split(" | ")[0]}</li>
                    ))}
                    {plan
                      .filter((a) => a.kind === null)
                      .map((a) => (
                        <li key={a.nature}>
                          Ato não reconhecido: {a.nature}. Confira a natureza do
                          título.
                        </li>
                      ))}
                  </ul>
                  <div className="mt-2">
                    <ActionButton
                      action={issueRequirementsAction}
                      fields={{
                        id: row.id,
                        exigencias: [
                          ...suggested,
                          ...plan
                            .filter((a) => a.kind === null)
                            .map(
                              (a) =>
                                `Esclarecer a natureza do ato pedido ("${a.nature}"). | Lei nº 6.015/1973, art. 167`,
                            ),
                        ].join("\n"),
                      }}
                      label="Abrir a exigência com isso"
                      pendingLabel="Abrindo…"
                    />
                  </div>
                  <p className="mt-1 text-xs">
                    Se estiver tudo certo, ignore. Depois de aberta, cada
                    exigência pode ser marcada como cumprida.
                  </p>
                </div>
              )}
            {canEdit && row.status !== "registrado" && (
              <RequirementsForm
                id={row.id}
                current={requirements
                  .map((r) => (r.source ? `${r.text} | ${r.source}` : r.text))
                  .join("\n")}
              />
            )}
            {canEdit && row.status === "exigencia" && (
              <div className="mt-4 border-t pt-4">
                <ReentryForm id={row.id} />
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Título">
            <dl className="grid gap-3">
              <Field label="Natureza" value={row.titleKind} />
              <Field label="Atos pedidos" value={row.actsSummary} />
              <Field
                label="Apresentante"
                value={`${row.presenterName}${row.presenterDocument ? ` · ${formatTaxId(row.presenterDocument)}` : ""}`}
              />
              <Field label="Contato" value={row.presenterContact} />
              <Field label="Apresentado em" value={stamp(row.presentedAt)} />
              {row.fast && (
                <Field label="Prazo" value="5 dias úteis (art. 188, § 1º)" />
              )}
              {row.reurb && (
                <Field
                  label="Prenotação"
                  value="40 dias úteis (Reurb social, art. 205, parágrafo único)"
                />
              )}
            </dl>
          </Panel>
          <Panel title="Emolumentos">
            <FeeTableReminder
              table={table}
              canUpdate={can(
                session.user.role ?? "",
                "transparency.manage",
                session.user.permissions,
              )}
            />
            <dl className="mt-3 grid gap-3">
              <Field label="Códigos e valores" value={row.fees} />
              <Field label="Total recebido" value={money(row.feeCents)} />
            </dl>
          </Panel>
          {canEdit && (
            <Panel
              title="Situação"
              description="Cada mudança pede o motivo e vai para a auditoria."
            >
              <div className="flex flex-wrap gap-2">
                {(exam
                  ? ([["exame-concluido", "Exame concluído"]] as const)
                  : ([
                      ["desistencia", "Desistência"],
                      ["duvida", "Dúvida suscitada"],
                      ["cessado", "Prenotação cessada"],
                    ] as const)
                )
                  .filter(
                    ([s]) => s !== row.status && row.status !== "registrado",
                  )
                  .map(([s, name]) => (
                    <ConfirmButton
                      key={s}
                      action={protocolStatusAction}
                      fields={{ id: row.id, status: s }}
                      trigger={name}
                      question={`Marcar o ${label} como "${name}"?`}
                      consequence="Escreva o motivo. A mudança fica no histórico e pode ser desfeita reabrindo."
                      confirmLabel="Confirmar"
                      pendingLabel="Salvando…"
                      destructive={false}
                    />
                  ))}
                {!open && row.status !== "registrado" && (
                  <ConfirmButton
                    action={protocolStatusAction}
                    fields={{ id: row.id, status: "prenotado" }}
                    trigger="Reabrir"
                    question={`Reabrir o ${label}?`}
                    consequence="Ele volta a correr com os prazos que tinha. Escreva o motivo."
                    confirmLabel="Reabrir"
                    pendingLabel="Salvando…"
                    destructive={false}
                  />
                )}
              </div>
            </Panel>
          )}
          {row.notes && (
            <Panel title="Observações internas">
              <p className="text-sm whitespace-pre-line">{row.notes}</p>
            </Panel>
          )}
          <Panel title="Histórico">
            <ul className="flex flex-col gap-2 text-xs">
              {history.map((h) => (
                <li
                  key={`${h.at}-${h.what}`}
                  className="rounded-md bg-muted px-2.5 py-2"
                >
                  <p className="font-medium text-foreground">{h.what}</p>
                  <p className="text-muted-foreground">
                    {stamp(new Date(h.at))}
                    {h.reason ? ` · Motivo: ${h.reason}` : ""}
                  </p>
                  {h.changes?.map((c) => (
                    <p key={c.field} className="text-muted-foreground">
                      {PROTOCOL_FIELD_NAMES[c.field] ?? c.field}: era{" "}
                      {plainValue(c.before).slice(0, 120)}, passou a{" "}
                      {plainValue(c.after).slice(0, 120)}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </RiPage>
  );
}
