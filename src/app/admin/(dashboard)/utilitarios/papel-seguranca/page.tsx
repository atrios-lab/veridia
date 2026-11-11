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

const TH =
  "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-admin-muted";
const TD = "px-4 py-2.5 align-top text-[13px] text-admin-text";

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
        title="Papel de segurança"
        description="O classificador das folhas de segurança: lotes recebidos, folhas usadas, extravios e os ofícios à Corregedoria, com a planilha das folhas."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/utilitarios/papel-seguranca/novo-lote"
              className="btn btn-admin-secondary btn-md"
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Cadastrar lote
            </Link>
            <Link
              href="/admin/utilitarios/papel-seguranca/lancar"
              className="btn btn-admin-primary btn-md"
            >
              <AdminIcon name="check" className="h-4 w-4" /> Lançar uso ou
              ocorrência
            </Link>
          </div>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-[30px] py-7 max-md:px-4">
        {done && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            {done}
          </p>
        )}

        {missingUse && (
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
            <AdminIcon
              name="clipboard"
              className="h-5 w-5 shrink-0 text-admin-primary"
            />
            <div className="mr-auto min-w-[240px] flex-1">
              <p className="text-[13.5px] font-bold text-admin-primary">
                Lance o uso de {monthLabel(missingUse.start)}
              </p>
              <p className="text-[12.5px] text-admin-text">
                Ainda não há folhas utilizadas lançadas nesse mês. Basta
                informar a última folha usada, com a data de{" "}
                {brDate(missingUse.end)}. Se não houve uso, ignore este aviso.
              </p>
            </div>
            <Link
              href="/admin/utilitarios/papel-seguranca/lancar?tipo=utilizado"
              className="btn btn-admin-primary btn-md"
            >
              Lançar o uso do mês
            </Link>
          </div>
        )}

        {low.map((l) => (
          <div
            key={l.kind}
            className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-5 py-4"
          >
            <AdminIcon
              name="alert"
              className="h-5 w-5 shrink-0 text-admin-warning-text"
            />
            <div className="mr-auto min-w-[240px] flex-1">
              <p className="text-[13.5px] font-bold text-admin-warning-text">
                {l.kind}:{" "}
                {l.remaining === 0
                  ? "o estoque acabou"
                  : `faltam ${l.remaining.toLocaleString("pt-BR")} folhas para acabar`}
              </p>
              <p className="text-[12.5px] text-admin-text">
                O aviso aparece com {settings.lowStock.toLocaleString("pt-BR")}{" "}
                folhas ou menos. Providencie o pedido de um novo lote.
              </p>
            </div>
            {canOrder && (
              <Link
                href="/admin/utilitarios/solicitacao-papeis"
                className="btn btn-admin-primary btn-md"
              >
                Solicitar novo lote
              </Link>
            )}
          </div>
        ))}

        {(duties.quarter || duties.occurrences.length > 0) && (
          <section className="flex flex-col gap-3">
            {duties.quarter && (
              <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-5 py-4">
                <AdminIcon
                  name="calendar"
                  className="h-5 w-5 shrink-0 text-admin-warning-text"
                />
                <div className="mr-auto min-w-[240px] flex-1">
                  <p className="text-[13.5px] font-bold text-admin-warning-text">
                    Prestação de contas do {quarterLabel(duties.quarter, false)}{" "}
                    pendente
                  </p>
                  <p className="text-[12.5px] text-admin-text">
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
                  className="btn btn-admin-primary btn-md"
                >
                  Gerar a prestação de contas
                </Link>
              </div>
            )}
            {duties.occurrences.length > 0 && occurrenceMonth && (
              <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-error-border bg-admin-error-bg px-5 py-4">
                <AdminIcon
                  name="alert"
                  className="h-5 w-5 shrink-0 text-admin-error-text"
                />
                <div className="mr-auto min-w-[240px] flex-1">
                  <p className="text-[13.5px] font-bold text-admin-error-text">
                    {duties.occurrences.length === 1
                      ? "1 extravio, subtração ou avaria a comunicar"
                      : `${duties.occurrences.length} extravios, subtrações ou avarias a comunicar`}
                  </p>
                  <p className="text-[12.5px] text-admin-text">
                    De {monthLabel(`${occurrenceMonth}-01`)} em diante. A
                    comunicação vai à Corregedoria no fim de cada mês, com a
                    numeração, para publicação no DJe.
                  </p>
                </div>
                <Link
                  href={`/admin/utilitarios/papel-seguranca/gerar?tipo=extravio&mes=${occurrenceMonth}`}
                  className="btn btn-admin-primary btn-md"
                >
                  Gerar o ofício de comunicação
                </Link>
              </div>
            )}
          </section>
        )}

        {canConfigure && (
          <p className="text-[12.5px] text-admin-muted">
            Antes do primeiro ofício, confira a quem ele vai em{" "}
            <Link
              href="/admin/utilitarios/papel-seguranca/configuracao"
              className="font-semibold text-admin-primary underline"
            >
              Configurar
            </Link>
            .
          </p>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-[19px] font-semibold text-admin-primary">
              Estoque agora
            </h2>
            <Link
              href="/admin/utilitarios/papel-seguranca/gerar"
              className="text-[13px] font-semibold text-admin-primary underline"
            >
              Gerar ofício ou relatório
            </Link>
          </div>
          {stock.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-admin-border bg-admin-card px-5 py-6 text-[13.5px] text-admin-text">
              <p className="font-semibold text-admin-primary">
                Comece cadastrando os lotes que a serventia tem.
              </p>
              <p className="mt-1 text-admin-muted">
                Para folhas compradas antes deste controle, marque{" "}
                <em>Estoque que a serventia já tinha</em> e informe só as que
                ainda estão na gaveta. A nota fiscal e a gráfica são opcionais.
              </p>
              <Link
                href="/admin/utilitarios/papel-seguranca/novo-lote"
                className="btn btn-admin-primary btn-md mt-3 inline-flex"
              >
                Cadastrar o primeiro lote
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stock.map((s) => (
                <div
                  key={s.kind}
                  className="flex flex-col gap-2 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
                >
                  <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-admin-muted">
                    {s.kind}
                  </p>
                  <p className="font-serif text-[30px] leading-none font-semibold text-admin-primary">
                    {s.remaining.toLocaleString("pt-BR")}
                    <span className="ml-1.5 font-sans text-[13px] font-normal text-admin-muted">
                      folha{s.remaining === 1 ? "" : "s"}
                    </span>
                  </p>
                  <ul className="flex flex-col gap-1 text-[12px] text-admin-text">
                    {s.lots
                      .filter((l) => l.remaining > 0)
                      .map(({ lot, remaining, next }) => (
                        <li key={lot.id} className="flex justify-between gap-2">
                          <Link
                            href={`/admin/utilitarios/papel-seguranca/lotes/${lot.id}`}
                            className="font-mono underline decoration-admin-border"
                          >
                            {rangeLabel(lot, lot.first, lot.last)}
                          </Link>
                          <span className="shrink-0 text-admin-muted">
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

        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-5 py-3.5">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Lançamentos
            </h2>
            <Link
              href={`/admin/utilitarios/papel-seguranca${showRemoved ? "" : "?excluidos=1"}`}
              className="text-[12.5px] font-semibold text-admin-primary underline"
            >
              {showRemoved
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-admin-muted">
              Nenhum lançamento ainda. Use{" "}
              <strong>Lançar uso ou ocorrência</strong> para baixar folhas
              usadas, inutilizadas, avariadas, extraviadas ou subtraídas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-admin-border bg-admin-input-bg">
                  <tr>
                    <th className={TH}>Data</th>
                    <th className={TH}>Ocorrência</th>
                    <th className={TH}>Espécie</th>
                    <th className={TH}>Folhas</th>
                    <th className={TH}>Referência</th>
                    <th className={TH}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => {
                    const lot = lotById.get(row.lotId);
                    const voided = row.voidedAt !== null;
                    const range = {
                      first: row.firstNumber,
                      last: row.lastNumber,
                    };
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-admin-border last:border-0 ${voided ? "opacity-55" : ""}`}
                      >
                        <td className={TD}>{brDate(row.occurredOn)}</td>
                        <td className={TD}>
                          <span className={voided ? "line-through" : ""}>
                            {
                              MOVEMENT_COLUMNS[
                                row.type as keyof typeof MOVEMENT_COLUMNS
                              ]
                            }
                          </span>
                          {voided && (
                            <span className="block text-[11.5px] text-admin-muted">
                              Excluído: {row.voidReason}
                            </span>
                          )}
                        </td>
                        <td className={TD}>{lot ? kindName(lot) : ""}</td>
                        <td className={`${TD} font-mono text-[12px]`}>
                          {lot ? rangeLabel(lot, range.first, range.last) : ""}
                          <span className="block font-sans text-admin-muted">
                            {sheetsIn(range).toLocaleString("pt-BR")} folha
                            {sheetsIn(range) === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className={TD}>
                          {[row.reference, row.notes]
                            .filter(Boolean)
                            .join(" · ")}
                        </td>
                        <td className={`${TD} text-right`}>
                          {!voided && (
                            <span className="inline-flex gap-1.5">
                              <Link
                                href={`/admin/utilitarios/papel-seguranca/lancamentos/${row.id}`}
                                className="btn btn-admin-secondary btn-sm"
                              >
                                Editar
                              </Link>
                              <VoidMovementButton id={row.id} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <h2 className="border-b border-admin-border px-5 py-3.5 font-serif text-[17px] font-semibold text-admin-primary">
            Lotes do classificador
          </h2>
          {lotRows.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-admin-muted">
              Nenhum lote cadastrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-admin-border bg-admin-input-bg">
                  <tr>
                    <th className={TH}>Recebido</th>
                    <th className={TH}>Espécie</th>
                    <th className={TH}>Numeração</th>
                    <th className={TH}>Gráfica / nota</th>
                    <th className={TH}>Restam</th>
                  </tr>
                </thead>
                <tbody>
                  {shownLots.map((lot) => {
                    const row = stock
                      .flatMap((s) => s.lots)
                      .find((l) => l.lot.id === lot.id);
                    return (
                      <tr
                        key={lot.id}
                        className={`border-b border-admin-border last:border-0 ${lot.voided ? "opacity-55" : ""}`}
                      >
                        <td className={TD}>
                          {brDate(lot.receivedOn)}
                          {lot.opening && (
                            <span className="block text-[11.5px] text-admin-muted">
                              estoque anterior
                            </span>
                          )}
                        </td>
                        <td className={TD}>{kindName(lot)}</td>
                        <td className={`${TD} font-mono text-[12px]`}>
                          <Link
                            href={`/admin/utilitarios/papel-seguranca/lotes/${lot.id}`}
                            className={`text-admin-primary underline ${lot.voided ? "line-through" : ""}`}
                          >
                            {rangeLabel(lot, lot.first, lot.last)}
                          </Link>
                          <span className="block font-sans text-admin-muted">
                            {sheetsIn(lot).toLocaleString("pt-BR")} folhas
                          </span>
                        </td>
                        <td className={TD}>
                          {[lot.supplier, lot.invoice && `NF ${lot.invoice}`]
                            .filter(Boolean)
                            .join(" · ") || (
                            <span className="text-admin-muted">
                              Não informado
                            </span>
                          )}
                        </td>
                        <td className={TD}>
                          {lot.voided
                            ? "Excluído"
                            : (row?.remaining ?? 0).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-5 py-3.5">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Ofícios e relatórios
            </h2>
            <Link
              href="/admin/utilitarios/papel-seguranca/gerar"
              className="btn btn-admin-secondary btn-sm"
            >
              <AdminIcon name="file" className="h-4 w-4" /> Gerar
            </Link>
          </div>
          {reports.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-admin-muted">
              Nenhum ofício gerado ainda. Tudo o que for gerado fica guardado
              aqui, como foi gerado.
            </p>
          ) : (
            <ul>
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b border-admin-border px-5 py-3 last:border-0"
                >
                  <Link
                    href={`/admin/utilitarios/papel-seguranca/oficios/${r.id}`}
                    className="mr-auto text-[13.5px] font-semibold text-admin-primary underline"
                  >
                    {reportNumber(r) ? `Ofício nº ${reportNumber(r)} · ` : ""}
                    {REPORT_SHORT[r.kind as ReportKind]}
                  </Link>
                  <span className="text-[12.5px] text-admin-muted">
                    {periodLabel({ start: r.periodStart, end: r.periodEnd })}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
                      r.kind === "relatorio"
                        ? "bg-admin-input-bg text-admin-muted"
                        : r.sentOn
                          ? "bg-admin-success-bg text-admin-success-text"
                          : "bg-admin-warning-soft-bg text-admin-warning-text"
                    }`}
                  >
                    {r.kind === "relatorio"
                      ? "Arquivo da serventia"
                      : r.sentOn
                        ? `Enviado em ${brDate(r.sentOn)}`
                        : "Envio não registrado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
