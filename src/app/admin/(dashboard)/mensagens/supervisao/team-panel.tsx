"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  type Lunch,
  lunchLabel,
  type Presence,
  STATUS_LABELS,
  STATUSES,
  type Status,
} from "@/core/messages/rules.ts";
import { Badge } from "../../../_ui/badge.tsx";
import { Button } from "../../../_ui/button.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { decideLunch, setChatEnabled, setMemberStatus } from "../actions.ts";

export interface TeamMember {
  userId: string;
  name: string;
  role: string;
  lunch: Lunch | null;
  lunchPending: Lunch | null;
  requestedAt: string | null;
  chatDisabled: boolean;
  presence: Presence;
  status: Status;
  statusSince: string | null;
  lingering: boolean;
}

/**
 * The Tabelião/Registrador's field for the team in the internal messenger
 * (decision of 11/11/2026): approve or refuse each lunch window asked for,
 * and turn a person's messenger off or on. Every decision goes to the audit.
 */
export function TeamPanel({ team }: { team: TeamMember[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (
    key: string,
    action: () => Promise<{ ok: boolean; message?: string }>,
    done: string,
  ) => {
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.ok) toast.error(result.message ?? "Não foi possível agora.");
    else {
      toast.success(done);
      router.refresh();
    }
  };
  if (!team.length) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Ninguém na equipe ainda.
      </p>
    );
  }
  return (
    <ul className="mt-3 flex flex-col divide-y">
      {team.map((member) => (
        <li
          key={member.userId}
          className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {member.name}{" "}
              <span className="font-normal text-muted-foreground">
                ({member.role})
              </span>
            </p>
            <p className="text-xs text-foreground">
              Agora: <strong>{STATUS_LABELS[member.presence]}</strong>
              {member.statusSince && member.presence !== "offline"
                ? ` (status desde ${member.statusSince})`
                : ""}
            </p>
            {member.lingering && (
              <p className="mt-1 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-text">
                ⚠ Há mais de 40 minutos como &quot;
                {STATUS_LABELS[member.status]}
                &quot;. Com 60 minutos volta a Disponível sozinho.
              </p>
            )}
            <label
              htmlFor={`status-${member.userId}`}
              className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              Mudar status:
              <NativeSelect
                id={`status-${member.userId}`}
                size="sm"
                value={member.status}
                disabled={busy !== null}
                onChange={(event) =>
                  void run(
                    `s-${member.userId}`,
                    () => setMemberStatus(member.userId, event.target.value),
                    "Status alterado.",
                  )
                }
                className="text-foreground"
              >
                {STATUSES.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <p className="text-xs text-foreground">
              Almoço: {member.lunch ? lunchLabel(member.lunch) : "não definido"}
            </p>
            {member.lunchPending && (
              <div className="mt-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-xs text-warning-text">
                <p className="font-semibold">
                  Pediu {lunchLabel(member.lunchPending)}
                  {member.requestedAt ? ` em ${member.requestedAt}` : ""}.
                </p>
                <div className="mt-1 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `a-${member.userId}`,
                        () => decideLunch(member.userId, true),
                        "Horário de almoço aprovado.",
                      )
                    }
                  >
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `r-${member.userId}`,
                        () => decideLunch(member.userId, false),
                        "Pedido recusado.",
                      )
                    }
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              className={
                member.chatDisabled
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-success text-success-foreground"
              }
            >
              {member.chatDisabled ? "Chat desativado" : "Chat ativo"}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant={member.chatDisabled ? "default" : "destructive"}
              disabled={busy !== null}
              onClick={() =>
                void run(
                  `c-${member.userId}`,
                  () => setChatEnabled(member.userId, member.chatDisabled),
                  member.chatDisabled ? "Chat reativado." : "Chat desativado.",
                )
              }
            >
              {member.chatDisabled ? "Ativar chat" : "Desativar chat"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
