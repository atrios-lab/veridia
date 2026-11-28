import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Plus,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  shortDate,
  termSignaturesOf,
  tomoLabel,
  tomosOf,
} from "@/core/ri/books.ts";
import { cnsDigits } from "@/core/ri/cnm.ts";
import { PENDENCY_LABELS, pendenciesOf } from "@/core/ri/pendencies.ts";
import { addressLine, propertyTitle } from "@/core/ri/property.ts";
import { weekdayName } from "@/core/ri/protocol-days.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { db } from "@/db/index.ts";
import { listExportsWith, loadAcervo } from "@/lib/ri.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import {
  markedPendenciesWith,
  ownerCountOf,
  pendencyKey,
} from "@/lib/ri-pendencies.ts";
import {
  lastImportedDayWith,
  pendingDaysWith,
} from "@/lib/ri-protocol-days.ts";
import {
  countersOf,
  listProtocolsWith,
  officeToday,
} from "@/lib/ri-protocols.ts";
import { buttonVariants } from "../_ui/button.tsx";
import { Panel, RiPage } from "./_components/page.tsx";
import { requireRi, riCan, stamp } from "./_lib.ts";
import { statusText } from "./protocolo/_shared.ts";

export const metadata = { title: "Mesa do Registro de Imóveis" };

const WEEK = 7 * 24 * 60 * 60 * 1000;

export default async function RiDeskPage() {
  const { session, tenant } = await requireRi();
  const [acervo, exports, protocols] = await Promise.all([
    loadAcervo(tenant.slug),
    listExportsWith(db, tenant.slug),
    listProtocolsWith(db, tenant.slug),
  ]);
  const counters = countersOf(protocols, officeToday());
  const cns = cnsDigits(tenant.cns) ?? tenant.cns;
  const ownerCount = (id: string) => ownerCountOf(acervo.acts.get(id) ?? []);
  const marked = await markedPendenciesWith(db, tenant.slug);
  // The ones the office marked done leave the counters (decision of 26/11/2026).
  const pendencies = pendenciesOf(
    cns,
    acervo.properties.map((p) => ({ ...p, ownerCount: ownerCount(p.id) })),
  ).filter((p) => !marked.has(pendencyKey(p.kind, p.ids)));
  const byKind = new Map<string, number>();
  for (const p of pendencies) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
  const active = acervo.properties.filter((p) => p.status === 0);
  const outOfPgv = acervo.properties.filter(
    (p) => p.recordKind !== 4 && p.book === 2 && !p.cnmInPgv,
  ).length;
  const live = exports.filter((e) => !e.withdrawnAt);
  const lastReal = live.find((e) => e.kind === "indicador-real");
  const realDue = !lastReal || Date.now() - lastReal.createdAt.getTime() > WEEK;
  const people = [...acervo.people.values()].filter((p) => !p.deletedAt);
  const recent = [...acervo.properties]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);
  const canEdit = riCan(session, "ri.edit");
  const canImport = riCan(session, "ri.import");
  const canExport = riCan(session, "ri.export");

  // How many títulos the Livro 1 has, imported ones included.
  const today = officeToday();
  const prenotations = protocols.filter((p) => p.kind === "prenotacao");
  const lastNumber = prenotations.reduce((n, p) => Math.max(n, p.number), 0);
  const open = protocols.filter(
    (p) =>
      !p.voidedAt && ["prenotado", "exigencia", "duvida"].includes(p.status),
  );
  const dueToday = open.filter(
    (p) => p.status === "prenotado" && p.qualifyBy === today,
  );
  const exigencias = open.filter((p) => p.status === "exigencia").length;
  const pending = (await pendingDaysWith(db, tenant.slug, today))
    .filter((d) => d < today)
    .sort();
  const imported = await lastImportedDayWith(db, tenant.slug).catch(() => null);
  const books = (await listBooksWith(db, tenant.slug)).filter(
    (b) => !b.deletedAt,
  );
  const tomos = tomosOf(books);
  const unsigned = books.flatMap((b) => {
    const signed = termSignaturesOf(b.termSignatures);
    const kind = !signed.abertura
      ? "abertura"
      : b.closedOn && !signed.encerramento
        ? "encerramento"
        : null;
    return kind ? [{ book: b, kind }] : [];
  });
  const book1 = books.find((b) => b.book === 1 && !b.closedOn);
  const numbers = (list: typeof open) =>
    list
      .slice(0, 4)
      .map(
        (p) =>
          `nº ${p.number.toLocaleString("pt-BR")} (${p.titleKind.toLowerCase()})`,
      )
      .join(", ");

  // "Agora": what needs a hand today, the most urgent first (decision of
  // 28/11/2026: the Mesa as a list of what to do, not a wall of numbers).
  type Tone = "red" | "amber" | "blue";
  const now: {
    tone: Tone;
    title: string;
    detail: string;
    href: string;
    action: string;
  }[] = [];
  if (counters.qualifyLate) {
    now.push({
      tone: "red",
      title: `${counters.qualifyLate} ${counters.qualifyLate === 1 ? "qualificação vencida" : "qualificações vencidas"}`,
      detail:
        "o prazo de 10 dias úteis já passou (Lei nº 6.015/1973, art. 188)",
      href: "/admin/ri/protocolo?ver=prazo",
      action: "Qualificar",
    });
  }
  if (dueToday.length) {
    now.push({
      tone: "red",
      title: `${dueToday.length} ${dueToday.length === 1 ? "qualificação vence hoje" : "qualificações vencem hoje"}`,
      detail: numbers(dueToday),
      href: "/admin/ri/protocolo?ver=prazo",
      action: "Qualificar",
    });
  }
  if (counters.prenotationEnding) {
    now.push({
      tone: "red",
      title: `${counters.prenotationEnding} ${counters.prenotationEnding === 1 ? "prenotação no fim" : "prenotações no fim"}`,
      detail: "em exigência, com a prenotação de 20 dias terminando (art. 205)",
      href: "/admin/ri/protocolo?ver=exigencia",
      action: "Ver exigências",
    });
  }
  if (pending.length) {
    const first = pending[0] ?? "";
    const physical = imported !== null && first <= imported;
    now.push(
      physical
        ? {
            tone: "blue",
            title: `Dias do livro físico (desde ${shortDate(first)}) não marcados`,
            detail: "um clique marca todos como encerrados à época",
            href: "/admin/ri/protocolo/dias",
            action: "Marcar",
          }
        : {
            tone: "amber",
            title:
              pending.length === 1
                ? `Protocolo de ${shortDate(first)} ainda não encerrado`
                : `${pending.length} dias do Protocolo ainda não encerrados`,
            detail:
              "encerramento diário, cada termo com a data do seu dia (art. 184)",
            href: "/admin/ri/protocolo/dias",
            action:
              pending.length === 1
                ? `Encerrar ${shortDate(first)}`
                : "Encerrar os dias",
          },
    );
  }
  for (const u of unsigned.slice(0, 3)) {
    const t = tomos.get(u.book.id);
    now.push({
      tone: "amber",
      title: `Termo de ${u.kind} sem assinatura`,
      detail: `Livro ${u.book.volume}${t ? ` · ${tomoLabel(t)}` : ""}`,
      href: `/admin/ri/livros/${u.book.id}#termos`,
      action: "Assinar o termo",
    });
  }
  if (realDue && canExport) {
    now.push({
      tone: "blue",
      title: "Indicador Real à ONR",
      detail: lastReal
        ? `último arquivo em ${stamp(lastReal.createdAt)}; o envio é semanal`
        : "nenhum arquivo gerado ainda; o envio é semanal",
      href: "/admin/ri/onr",
      action: "Gerar",
    });
  }
  const TONE_ICON: Record<Tone, string> = {
    red: "bg-destructive-soft text-destructive",
    amber: "bg-warning-soft text-warning-text",
    blue: "bg-primary-soft text-primary",
  };
  const recentProtocols = [...protocols]
    .filter((p) => !p.voidedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);

  return (
    <RiPage
      wide
      back={null}
      title={`Bom trabalho, ${session.user.name.split(" ")[0]}`}
      description={`${weekdayName(today).replace(/^./, (c) => c.toUpperCase())}, ${shortDate(today)} · o que pede atenção agora, na ordem.`}
      actions={
        <>
          {canEdit && (
            <>
              <Link
                href="/admin/ri/protocolo/novo"
                className={buttonVariants({ size: "sm" })}
              >
                <Plus className="size-4" /> Novo protocolo
              </Link>
              <Link
                href="/admin/ri/matriculas/nova"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                <Plus className="size-4" /> Nova matrícula
              </Link>
            </>
          )}
          <Link
            href="/admin/ri/certidoes"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Emitir certidão
          </Link>
        </>
      }
    >
      <section
        aria-label="Agora"
        className="overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        <p className="px-5 pt-3 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Agora
        </p>
        {now.length === 0 ? (
          <p className="flex items-center gap-3 border-t px-5 py-4 text-sm">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-success-soft text-success-text">
              <CheckCircle2 className="size-4" />
            </span>
            <span>
              <strong>Tudo em dia.</strong>{" "}
              <span className="text-muted-foreground">
                Nenhum prazo vencendo, dia aberto ou termo a assinar.
              </span>
            </span>
          </p>
        ) : (
          <ul>
            {now.map((item) => (
              <li
                key={item.title}
                className="flex flex-wrap items-center gap-3 border-t px-5 py-3"
              >
                <span
                  aria-hidden
                  className={`inline-flex size-8 flex-none items-center justify-center rounded-lg ${TONE_ICON[item.tone]}`}
                >
                  {item.tone === "red" ? (
                    <AlertTriangle className="size-4" />
                  ) : item.tone === "amber" ? (
                    <Clock className="size-4" />
                  ) : (
                    <Info className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
                <Link
                  href={item.href}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Protocolo"
          actions={
            <Link
              href="/admin/ri/protocolo"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Abrir
            </Link>
          }
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat value={counters.open} label="em andamento" />
            <Stat
              value={counters.qualifyToday + counters.qualifyLate}
              label="vencem hoje ou venceram"
              tone={
                counters.qualifyToday + counters.qualifyLate
                  ? "text-destructive"
                  : ""
              }
            />
            <Stat
              value={exigencias}
              label="em exigência"
              tone={exigencias ? "text-warning-text" : ""}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Próximo nº {(lastNumber + 1).toLocaleString("pt-BR")}
            {book1 && tomos.get(book1.id)
              ? ` · Livro ${book1.volume} · ${tomoLabel(tomos.get(book1.id))}`
              : ""}
          </p>
        </Panel>
        <Panel
          title="Acervo"
          actions={
            <Link
              href="/admin/ri/matriculas"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Abrir
            </Link>
          }
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat value={active.length} label="matrículas ativas" />
            <Stat
              value={acervo.properties.filter((p) => p.book === 3).length}
              label="Livro 3"
            />
            <Stat value={people.length} label="pessoas" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {canImport && (
              <Link
                href="/admin/ri/importar-exportar"
                className="text-primary underline-offset-4 hover:underline"
              >
                <Upload className="mr-1 inline size-3" />
                Importar e exportar
              </Link>
            )}
            <Link
              href="/admin/ri/indicadores/real"
              className="text-primary underline-offset-4 hover:underline"
            >
              <MapPin className="mr-1 inline size-3" />
              Indicador Real
            </Link>
            <Link
              href="/admin/ri/pessoas"
              className="text-primary underline-offset-4 hover:underline"
            >
              <Users className="mr-1 inline size-3" />
              Pessoas
            </Link>
          </div>
        </Panel>
        <Panel
          title="Migração e ONR"
          actions={
            <Link
              href="/admin/ri/migracao"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Abrir
            </Link>
          }
        >
          <ul className="flex flex-col gap-1.5 text-sm">
            {[...byKind].map(([kind, count]) => (
              <li key={kind}>
                <Link
                  href={`/admin/ri/migracao#${kind}`}
                  className="flex items-center justify-between gap-3 hover:text-primary"
                >
                  <span>
                    {PENDENCY_LABELS[kind as keyof typeof PENDENCY_LABELS]}
                  </span>
                  <span className="rounded-full bg-warning-soft px-2 text-xs font-semibold text-warning-text tabular-nums">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/admin/ri/cnm"
                className="flex items-center justify-between gap-3 hover:text-primary"
              >
                <span>CNM fora do PGV</span>
                <span
                  className={`rounded-full px-2 text-xs font-semibold tabular-nums ${outOfPgv ? "bg-warning-soft text-warning-text" : "bg-success-soft text-success-text"}`}
                >
                  {outOfPgv}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/ri/onr"
                className="flex items-center justify-between gap-3 hover:text-primary"
              >
                <span>Indicador Real à ONR</span>
                <span
                  className={`rounded-full px-2 text-xs font-semibold ${realDue ? "bg-primary-soft text-primary" : "bg-success-soft text-success-text"}`}
                >
                  {realDue ? "enviar" : "em dia"}
                </span>
              </Link>
            </li>
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Últimos títulos do Protocolo">
          {recentProtocols.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum título ainda. Lance o primeiro em Novo protocolo.
            </p>
          ) : (
            <ul className="divide-y">
              {recentProtocols.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/ri/protocolo/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm hover:text-primary"
                  >
                    <span className="font-semibold text-primary tabular-nums">
                      {p.kind === "exame" ? "E-" : ""}
                      {p.number.toLocaleString("pt-BR")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.titleKind}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {statusText(p)} · {stamp(p.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Matrículas alteradas por último">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma matrícula no sistema ainda. Comece importando a planilha
              do índice ou cadastrando uma matrícula.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/ri/matriculas/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm hover:text-primary"
                  >
                    <span className="font-medium">{propertyTitle(p)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {p.book === 3
                        ? p.auxKind || "registro auxiliar"
                        : addressLine(p) || "sem endereço"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {statusLabel(p.status)} · {stamp(p.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </RiPage>
  );
}

function Stat({
  value,
  label,
  tone = "",
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <div>
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
