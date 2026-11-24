"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { RoutingPriority } from "@/core/routing/routing.ts";
import { Button } from "../../_ui/button.tsx";
import { receiveAction } from "../pedidos/[protocolo]/routing-actions.ts";

export interface RoutedRow {
  routingId: string;
  bucket: "mine" | "queue" | "sent";
  protocolNumber: string;
  applicantName: string | null;
  purpose: string;
  sectorLabel: string | null;
  from: string;
  atLabel: string;
  received: boolean;
  priority: RoutingPriority;
  dueLabel: string | null;
  overdue: boolean;
  note: string;
}

const PRIORITY: Record<RoutingPriority, { label: string; className: string }> =
  {
    normal: { label: "", className: "" },
    attention: {
      label: "⚠ Atenção",
      className: "border border-warning/40 bg-warning-soft text-warning-text",
    },
    urgent: {
      label: "Urgente",
      className:
        "border border-destructive/40 bg-destructive-soft text-destructive",
    },
  };

function Row({ row }: { row: RoutedRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const href = `/admin/pedidos/${encodeURIComponent(row.protocolNumber)}`;
  const receive = () =>
    start(async () => {
      const result = await receiveAction(row.routingId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      if (result.status === "success") toast.success(result.message);
      router.push(href);
    });
  const priority = PRIORITY[row.priority];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="font-semibold text-foreground tabular-nums underline-offset-4 hover:underline"
        >
          {row.protocolNumber}
        </Link>{" "}
        <span className="text-foreground">· {row.purpose}</span>
        {row.sectorLabel && (
          <span className="text-muted-foreground"> · {row.sectorLabel}</span>
        )}
        <span className="block text-sm text-muted-foreground">
          {row.applicantName ? `${row.applicantName} · ` : ""}
          {row.from} · {row.atLabel}
          {!row.received && row.bucket !== "queue" && (
            <strong className="font-semibold text-destructive">
              {" "}
              · ainda não recebido
            </strong>
          )}
        </span>
        {row.note && (
          <span className="block text-sm text-foreground">"{row.note}"</span>
        )}
      </div>
      {(priority.label || row.dueLabel) && (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.overdue
              ? PRIORITY.urgent.className
              : priority.className || "border bg-muted text-muted-foreground"
          }`}
        >
          {priority.label}
          {priority.label && row.dueLabel ? " · " : ""}
          {row.dueLabel && `${row.overdue ? "venceu " : "até "}${row.dueLabel}`}
        </span>
      )}
      {row.bucket !== "sent" && !row.received ? (
        <Button size="sm" disabled={pending} onClick={receive}>
          {pending ? "Recebendo…" : "Recebi, abrir pedido"}
        </Button>
      ) : (
        <Link
          href={href}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Abrir pedido
        </Link>
      )}
    </li>
  );
}

function Section({
  title,
  help,
  rows,
  empty,
}: {
  title: string;
  help: string;
  rows: RoutedRow[];
  empty: string;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">
        {title}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </h2>
      <p className="text-sm text-muted-foreground">{help}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y">
          {rows.map((row) => (
            <Row key={row.routingId} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RoutedList({ rows }: { rows: RoutedRow[] }) {
  return (
    <>
      <Section
        title="Comigo"
        help="Mandados a você (receba para ficar com eles) e os que estão com você."
        rows={rows.filter((r) => r.bucket === "mine")}
        empty="Nenhum pedido direcionado a você agora."
      />
      <Section
        title="Fila do meu setor"
        help="Mandados ao setor sem escolher a pessoa: o primeiro que receber fica com o pedido."
        rows={rows.filter((r) => r.bucket === "queue")}
        empty="A fila do seu setor está vazia."
      />
      <Section
        title="Mandei e ainda não receberam"
        help="Enquanto não recebem, você pode alterar ou desfazer no pedido. Sem receber em 2 horas, você é avisado."
        rows={rows.filter((r) => r.bucket === "sent")}
        empty="Tudo o que você mandou já foi recebido."
      />
    </>
  );
}
