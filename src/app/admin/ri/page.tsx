import {
  BookOpen,
  ClipboardList,
  ListChecks,
  MapPin,
  Plus,
  ScanBarcode,
  Send,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { situationOf } from "@/core/ri/acts.ts";
import { cnsDigits } from "@/core/ri/cnm.ts";
import { PENDENCY_LABELS, pendenciesOf } from "@/core/ri/pendencies.ts";
import { addressLine, propertyTitle } from "@/core/ri/property.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { db } from "@/db/index.ts";
import { EXPORT_LABELS, listExportsWith, loadAcervo } from "@/lib/ri.ts";
import {
  countersOf,
  listProtocolsWith,
  officeToday,
} from "@/lib/ri-protocols.ts";
import { buttonVariants } from "../_ui/button.tsx";
import { Panel, RiPage } from "./_components/page.tsx";
import { requireRi, riCan, stamp } from "./_lib.ts";

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
  const late = counters.qualifyLate + counters.prenotationEnding;
  const cns = cnsDigits(tenant.cns) ?? tenant.cns;
  const ownerCount = (id: string) =>
    situationOf(acervo.acts.get(id) ?? []).owners.length;
  const pendencies = pendenciesOf(
    cns,
    acervo.properties.map((p) => ({ ...p, ownerCount: ownerCount(p.id) })),
  );
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

  const tiles = [
    {
      label: "Protocolo em andamento",
      value: counters.open,
      detail: late
        ? `${counters.qualifyLate} qualificação vencida, ${counters.prenotationEnding} prenotação no fim`
        : counters.qualifyToday
          ? `${counters.qualifyToday} vence(m) hoje`
          : "nenhum prazo vencido",
      href: "/admin/ri/protocolo",
      icon: ClipboardList,
      tone: late ? "warning" : counters.qualifyToday ? "info" : "success",
    },
    {
      label: "Matrículas ativas",
      value: active.length,
      detail: `${acervo.properties.length} no acervo do sistema`,
      href: "/admin/ri/matriculas",
      icon: BookOpen,
      tone: "info",
    },
    {
      label: "Pendências da migração",
      value: pendencies.length,
      detail: "duplicidades, números, CNM e dados do Livro 4",
      href: "/admin/ri/migracao",
      icon: ListChecks,
      tone: pendencies.length ? "warning" : "success",
    },
    {
      label: "CNM fora do PGV",
      value: outOfPgv,
      detail: "vão no próximo lote do PGV-CNM",
      href: "/admin/ri/cnm",
      icon: ScanBarcode,
      tone: outOfPgv ? "warning" : "success",
    },
    {
      label: "Indicador Real",
      value: realDue ? "Enviar" : "Em dia",
      detail: lastReal
        ? `último arquivo em ${stamp(lastReal.createdAt)}`
        : "nenhum arquivo gerado ainda",
      href: "/admin/ri/onr",
      icon: Send,
      tone: realDue ? "warning" : "success",
    },
  ] as const;

  const TONES = {
    info: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning-text",
    success: "bg-success-soft text-success-text",
  } as const;

  return (
    <RiPage
      wide
      back={null}
      title={`Bom trabalho, ${session.user.name.split(" ")[0]}`}
      description="O que o Registro de Imóveis pede hoje: os títulos do Protocolo e seus prazos, as pendências da migração para fichas, o lote de CNM e o envio semanal do Indicador Real à ONR."
      actions={
        canEdit && (
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
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className="group flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {tile.label}
                </span>
                <span
                  className={`inline-flex size-8 items-center justify-center rounded-lg ${TONES[tile.tone]}`}
                >
                  <Icon className="size-4" />
                </span>
              </span>
              <span className="text-2xl font-semibold text-foreground tabular-nums">
                {typeof tile.value === "number"
                  ? tile.value.toLocaleString("pt-BR")
                  : tile.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {tile.detail}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel
            title="Pendências por tipo"
            description="Cada uma com o passo a passo e a regra de onde vem, em Pendências da migração."
          >
            {pendencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma pendência no acervo cadastrado.
              </p>
            ) : (
              <ul className="divide-y">
                {[...byKind].map(([kind, count]) => (
                  <li key={kind}>
                    <Link
                      href={`/admin/ri/migracao#${kind}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary"
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
        <div className="flex flex-col gap-5">
          <Panel title="Atalhos">
            <div className="flex flex-col gap-2">
              {canImport && (
                <Link
                  href="/admin/ri/importar-exportar"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Upload className="size-4" /> Importar e exportar o acervo
                </Link>
              )}
              {canExport && (
                <Link
                  href="/admin/ri/onr"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Send className="size-4" /> Gerar arquivos para a ONR
                </Link>
              )}
              <Link
                href="/admin/ri/indicadores/real"
                className={buttonVariants({ variant: "outline" })}
              >
                <MapPin className="size-4" /> Indicador Real (Livro 4)
              </Link>
              <Link
                href="/admin/ri/pessoas"
                className={buttonVariants({ variant: "outline" })}
              >
                <Users className="size-4" /> Pessoas ({people.length})
              </Link>
            </div>
          </Panel>
          <Panel title="Últimos arquivos para a ONR">
            {live.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum arquivo gerado.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {live.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex flex-col">
                    <span className="font-medium">
                      {EXPORT_LABELS[e.kind as keyof typeof EXPORT_LABELS]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stamp(e.createdAt)} · {e.recordCount} linha(s) ·{" "}
                      {e.importedAt
                        ? "importado na ONR"
                        : "ainda não importado"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </RiPage>
  );
}
