import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  REPORT_SHORT,
  type ReportKind,
} from "@/core/security-paper/documents.ts";
import {
  brDate,
  kindName,
  lowStock,
  MOVEMENT_COLUMNS,
  monthLabel,
  pendingDuties,
  periodLabel,
  quarterLabel,
  rangeLabel,
  sheetNumber,
  sheetsIn,
  stockByKind,
  usageMissing,
} from "@/core/security-paper/stock.ts";
import { db } from "@/db/index.ts";
import {
  classifierWith,
  getSecurityPaperSettings,
  listReportsWith,
  reportNumber,
} from "@/lib/security-paper.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { PAPER_SENDING_HELP } from "../../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../../_components/screen-help-button.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { VoidMovementButton } from "./forms.tsx";

export const metadata = { title: "Papel de segurança" };

const DONE: Record<string, string> = {
  lote: "Lote cadastrado no classificador.",
  "lote-anulado": "Lote excluído. Ele continua guardado no classificador.",
  editado: "Lançamento corrigido.",
  "documento-excluido":
    "Documento excluído da lista. Ele continua guardado, com a justificativa.",
  utilizado: "Folhas utilizadas baixadas do estoque.",
  inutilizado: "Folhas inutilizadas lançadas.",
  avariado:
    "Avaria lançada. Ela entra na comunicação do fim do mês à Corregedoria.",
  extraviado:
    "Extravio lançado. Ele entra na comunicação do fim do mês à Corregedoria.",
  subtraido:
    "Subtração lançada. Ela entra na comunicação do fim do mês à Corregedoria.",
};

const TH = "px-4 text-xs font-medium text-muted-foreground";
const TD = "px-4 py-2.5 align-top whitespace-normal text-foreground";

export default async function SecurityPaperPage({
  searchParams,
}: {
  searchParams: Promise<{ feito?: string; excluidos?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "security-paper.manage",
      session.user.permissions,
    )
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const now = today();
  const [{ lots, movements, lotRows, movementRows }, reports, settings, query] =
    await Promise.all([
      classifierWith(db, tenant.slug),
      listReportsWith(db, tenant.slug),
      getSecurityPaperSettings(tenant),
      searchParams,
    ]);
  const stock = stockByKind(lots, movements);
  const duties = pendingDuties({
    today: now,
    lots,
    movements,
    reports: reports.map((r) => ({
      kind: r.kind as ReportKind,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      movementIds: r.movementIds,
    })),
  });
  const lotById = new Map(lots.map((l) => [l.id, l]));
  // Excluded rows stay stored; they show only when asked for.
  const showRemoved = query.excluidos === "1";
  const recent = movementRows
    .filter((m) => showRemoved || m.voidedAt === null)
    .slice(0, 60);
  const shownLots = lots.filter((l) => showRemoved || !l.voided);
  const low = lowStock(lots, movements, settings.lowStock);
  // In the first half of the month: the month before has no use yet.
  const missingUse =
    Number(now.slice(8, 10)) <= 15
      ? usageMissing({ today: now, lots, movements })
      : null;
  const canOrder = can(
    session.user.role ?? "",
    "paper-orders.manage",
    session.user.permissions,
  );
  const done = query.feito ? DONE[query.feito] : undefined;
  const occurrenceMonth = duties.occurrences[0]?.occurredOn.slice(0, 7);
  const canConfigure = !settings.authority.trim();

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Papel de segurança"
        description="O classificador das folhas de segurança: lotes recebidos, folhas usadas, extravios e os ofícios à Corregedoria, com a planilha das folhas."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/utilitarios/papel-seguranca/novo-lote"
              className={buttonVariants({ variant: "outline" })}
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Cadastrar lote
            </Link>
            <Link
              href="/admin/utilitarios/papel-seguranca/lancar"
              className={buttonVariants()}
            >
              <AdminIcon name="check" className="h-4 w-4" /> Lançar uso ou
              ocorrência
            </Link>
          </div>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        {done && (
          <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            {done}
          </p>
        )}

        {missingUse && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
            <AdminIcon
              name="clipboard"
              className="h-5 w-5 shrink-0 text-primary"
            />
            <div className="mr-auto min-w-[240px] flex-1">
              <p className="text-sm font-semibold text-foreground">
                Lance o uso de {monthLabel(missingUse.start)}
              </p>
              <p className="text-xs text-foreground">
                Ainda não há folhas utilizadas lançadas nesse mês. Basta
                informar a última folha usada, com a data de{" "}
                {brDate(missingUse.end)}. Se não houve uso, ignore este aviso.
              </p>
            </div>
            <Link
              href="/admin/utilitarios/papel-seguranca/lancar?tipo=utilizado"
              className={buttonVariants()}
            >
              Lançar o uso do mês
            </Link>
          </div>
        )}

        {low.map((l) => (
          <div
            key={l.kind}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4"
          >
            <AdminIcon
              name="alert"
              className="h-5 w-5 shrink-0 text-warning-text"
            />
            <div className="mr-auto min-w-[240px] flex-1">
              <p className="text-sm font-semibold text-warning-text">
                {l.kind}:{" "}
                {l.remaining === 0
                  ? "o estoque acabou"
                  : `faltam ${l.remaining.toLocaleString("pt-BR")} folhas para acabar`}
              </p>
              <p className="text-xs text-foreground">
                O aviso aparece com {settings.lowStock.toLocaleString("pt-BR")}{" "}
                folhas ou menos. Providencie o pedido de um novo lote.
              </p>
            </div>
            {canOrder && (
              <Link
                href="/admin/utilitarios/solicitacao-papeis"
                className={buttonVariants()}
              >
                Solicitar novo lote
              </Link>
            )}
          </div>
        ))}

        {(duties.quarter || duties.occurrences.length > 0) && (
          <section className="flex flex-col gap-3">
            {duties.quarter && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4">
                <AdminIcon
                  name="calendar"
                  className="h-5 w-5 shrink-0 text-warning-text"
                />
                <div className="mr-auto min-w-[240px] flex-1">
                  <p className="text-sm font-semibold text-warning-text">
                    Prestação de contas do {quarterLabel(duties.quarter, false)}{" "}
                    pendente
                  </p>
                  <p className="text-xs text-foreground">
                    {quarterLabel(duties.quarter)}. O ofício sai pronto, com o
                    demonstrativo e a numeração; quem não presta contas não pode
                    requisitar novos lotes.
                    {settings.deadlineDay
                      ? ` Prazo: dia ${settings.deadlineDay} do mês seguinte ao trimestre.`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/utilitarios/papel-seguranca/gerar?tipo=prestacao&trimestre=${duties.quarter.year}-${duties.quarter.quarter}`}
                  className={buttonVariants()}
                >
                  Gerar a prestação de contas
                </Link>
              </div>
            )}
            {duties.occurrences.length > 0 && occurrenceMonth && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive-soft px-5 py-4">
                <AdminIcon
                  name="alert"
                  className="h-5 w-5 shrink-0 text-destructive"
                />
                <div className="mr-auto min-w-[240px] flex-1">
                  <p className="text-sm font-semibold text-destructive">
                    {duties.occurrences.length === 1
                      ? "1 extravio, subtração ou avaria a comunicar"
                      : `${duties.occurrences.length} extravios, subtrações ou avarias a comunicar`}
                  </p>
                  <p className="text-xs text-foreground">
                    De {monthLabel(`${occurrenceMonth}-01`)} em diante. A
                    comunicação vai à Corregedoria no fim de cada mês, com a
                    numeração, para publicação no DJe.
                  </p>
                </div>
                <Link
                  href={`/admin/utilitarios/papel-seguranca/gerar?tipo=extravio&mes=${occurrenceMonth}`}
                  className={buttonVariants()}
                >
                  Gerar o ofício de comunicação
                </Link>
              </div>
            )}
          </section>
        )}

        {canConfigure && (
          <p className="text-xs text-muted-foreground">
            Antes do primeiro ofício, confira a quem ele vai em{" "}
            <Link
              href="/admin/utilitarios/papel-seguranca/configuracao"
              className="font-medium text-primary underline underline-offset-4"
            >
              Configurar
            </Link>
            .
          </p>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Estoque agora
            </h2>
            <Link
              href="/admin/utilitarios/papel-seguranca/gerar"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Gerar ofício ou relatório
            </Link>
          </div>
          {stock.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-5 py-6 text-sm text-foreground">
              <p className="font-semibold text-foreground">
                Comece cadastrando os lotes que a serventia tem.
              </p>
              <p className="mt-1 text-muted-foreground">
                Para folhas compradas antes deste controle, marque{" "}
                <em>Estoque que a serventia já tinha</em> e informe só as que
                ainda estão na gaveta. A nota fiscal e a gráfica são opcionais.
              </p>
              <Link
                href="/admin/utilitarios/papel-seguranca/novo-lote"
                className={buttonVariants({ className: "mt-3" })}
              >
                Cadastrar o primeiro lote
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stock.map((s) => (
                <div
                  key={s.kind}
                  className="flex flex-col gap-2 rounded-xl border bg-card px-5 py-4"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {s.kind}
                  </p>
                  <p className="text-3xl leading-none font-semibold text-foreground tabular-nums">
                    {s.remaining.toLocaleString("pt-BR")}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      folha{s.remaining === 1 ? "" : "s"}
                    </span>
                  </p>
                  <ul className="flex flex-col gap-1 text-xs text-foreground">
                    {s.lots
                      .filter((l) => l.remaining > 0)
                      .map(({ lot, remaining, next }) => (
                        <li key={lot.id} className="flex justify-between gap-2">
                          <Link
                            href={`/admin/utilitarios/papel-seguranca/lotes/${lot.id}`}
                            className="font-mono underline decoration-border underline-offset-2 hover:text-primary"
                          >
                            {rangeLabel(lot, lot.first, lot.last)}
                          </Link>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            próxima{" "}
                            {next !== null ? sheetNumber(lot, next) : "-"}
                            {" · "}
                            {remaining.toLocaleString("pt-BR")}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <h2 className="text-lg font-semibold text-foreground">
              Lançamentos
            </h2>
            <Link
              href={`/admin/utilitarios/papel-seguranca${showRemoved ? "" : "?excluidos=1"}`}
              className="text-xs font-medium text-primary underline underline-offset-4"
            >
              {showRemoved
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum lançamento ainda. Use{" "}
              <strong>Lançar uso ou ocorrência</strong> para baixar folhas
              usadas, inutilizadas, avariadas, extraviadas ou subtraídas.
            </p>
          ) : (
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Data</TableHead>
                  <TableHead className={TH}>Ocorrência</TableHead>
                  <TableHead className={TH}>Espécie</TableHead>
                  <TableHead className={TH}>Folhas</TableHead>
                  <TableHead className={TH}>Referência</TableHead>
                  <TableHead className={TH}>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((row) => {
                  const lot = lotById.get(row.lotId);
                  const voided = row.voidedAt !== null;
                  const range = {
                    first: row.firstNumber,
                    last: row.lastNumber,
                  };
                  return (
                    <TableRow
                      key={row.id}
                      className={voided ? "opacity-55" : undefined}
                    >
                      <TableCell className={`${TD} tabular-nums`}>
                        {brDate(row.occurredOn)}
                      </TableCell>
                      <TableCell className={TD}>
                        <span className={voided ? "line-through" : ""}>
                          {
                            MOVEMENT_COLUMNS[
                              row.type as keyof typeof MOVEMENT_COLUMNS
                            ]
                          }
                        </span>
                        {voided && (
                          <span className="block text-xs text-muted-foreground">
                            Excluído: {row.voidReason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={TD}>
                        {lot ? kindName(lot) : ""}
                      </TableCell>
                      <TableCell className={`${TD} font-mono text-xs`}>
                        {lot ? rangeLabel(lot, range.first, range.last) : ""}
                        <span className="block font-sans text-muted-foreground tabular-nums">
                          {sheetsIn(range).toLocaleString("pt-BR")} folha
                          {sheetsIn(range) === 1 ? "" : "s"}
                        </span>
                      </TableCell>
                      <TableCell className={TD}>
                        {[row.reference, row.notes].filter(Boolean).join(" · ")}
                      </TableCell>
                      <TableCell className={`${TD} text-right`}>
                        {!voided && (
                          <span className="inline-flex gap-1.5">
                            <Link
                              href={`/admin/utilitarios/papel-seguranca/lancamentos/${row.id}`}
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                              })}
                            >
                              Editar
                            </Link>
                            <VoidMovementButton id={row.id} />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="border-b px-5 py-3.5 text-lg font-semibold text-foreground">
            Lotes do classificador
          </h2>
          {lotRows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum lote cadastrado.
            </p>
          ) : (
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Recebido</TableHead>
                  <TableHead className={TH}>Espécie</TableHead>
                  <TableHead className={TH}>Numeração</TableHead>
                  <TableHead className={TH}>Gráfica / nota</TableHead>
                  <TableHead className={TH}>Restam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownLots.map((lot) => {
                  const row = stock
                    .flatMap((s) => s.lots)
                    .find((l) => l.lot.id === lot.id);
                  return (
                    <TableRow
                      key={lot.id}
                      className={lot.voided ? "opacity-55" : undefined}
                    >
                      <TableCell className={`${TD} tabular-nums`}>
                        {brDate(lot.receivedOn)}
                        {lot.opening && (
                          <span className="block text-xs text-muted-foreground">
                            estoque anterior
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={TD}>{kindName(lot)}</TableCell>
                      <TableCell className={`${TD} font-mono text-xs`}>
                        <Link
                          href={`/admin/utilitarios/papel-seguranca/lotes/${lot.id}`}
                          className={`text-primary underline ${lot.voided ? "line-through" : ""}`}
                        >
                          {rangeLabel(lot, lot.first, lot.last)}
                        </Link>
                        <span className="block font-sans text-muted-foreground tabular-nums">
                          {sheetsIn(lot).toLocaleString("pt-BR")} folhas
                        </span>
                      </TableCell>
                      <TableCell className={TD}>
                        {[lot.supplier, lot.invoice && `NF ${lot.invoice}`]
                          .filter(Boolean)
                          .join(" · ") || (
                          <span className="text-muted-foreground">
                            Não informado
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`${TD} tabular-nums`}>
                        {lot.voided
                          ? "Excluído"
                          : (row?.remaining ?? 0).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        {/* No overflow-hidden here: the "!" opens over the list below. */}
        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">
                Ofícios e relatórios
              </h2>
              <ScreenHelpButton
                help={PAPER_SENDING_HELP}
                canConfigure={false}
                label="O que enviar à Corregedoria e quando"
              />
            </div>
            <Link
              href="/admin/utilitarios/papel-seguranca/gerar"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <AdminIcon name="file" className="h-4 w-4" /> Gerar
            </Link>
          </div>
          {reports.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum ofício gerado ainda. Tudo o que for gerado fica guardado
              aqui, como foi gerado.
            </p>
          ) : (
            <ul>
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b px-5 py-3 last:border-0"
                >
                  <Link
                    href={`/admin/utilitarios/papel-seguranca/oficios/${r.id}`}
                    className="mr-auto text-sm font-medium text-primary underline underline-offset-4"
                  >
                    {reportNumber(r) ? `Ofício nº ${reportNumber(r)} · ` : ""}
                    {REPORT_SHORT[r.kind as ReportKind]}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {periodLabel({ start: r.periodStart, end: r.periodEnd })}
                  </span>
                  <Badge
                    variant={r.kind === "relatorio" ? "secondary" : "default"}
                    className={
                      r.kind === "relatorio"
                        ? undefined
                        : r.sentOn
                          ? "bg-success text-success-foreground"
                          : "bg-warning text-warning-foreground"
                    }
                  >
                    {r.kind === "relatorio"
                      ? "Arquivo da serventia"
                      : r.sentOn
                        ? `Enviado em ${brDate(r.sentOn)}`
                        : "Envio não registrado"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
