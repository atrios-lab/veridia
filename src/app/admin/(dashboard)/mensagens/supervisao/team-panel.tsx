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
      <p className="mt-2 text-[13px] text-admin-muted">
        Ninguém na equipe ainda.
      </p>
    );
  }
  return (
    <ul className="mt-3 flex flex-col divide-y divide-admin-border">
      {team.map((member) => (
        <li
          key={member.userId}
          className="flex flex-wrap items-start justify-between gap-3 py-3 text-[13px]"
        >
          <div className="min-w-0">
            <p className="font-semibold text-admin-primary">
              {member.name}{" "}
              <span className="font-normal text-admin-muted">
                ({member.role})
              </span>
            </p>
            <p className="text-[12px] text-admin-text">
              Agora: <strong>{STATUS_LABELS[member.presence]}</strong>
              {member.statusSince && member.presence !== "offline"
                ? ` (status desde ${member.statusSince})`
                : ""}
            </p>
            {member.lingering && (
              <p className="mt-1 rounded-[8px] bg-admin-warning-bg px-2.5 py-1 text-[12px] font-semibold text-admin-warning-text">
                ⚠ Há mais de 40 minutos como &quot;
                {STATUS_LABELS[member.status]}
                &quot;. Com 60 minutos volta a Disponível sozinho.
              </p>
            )}
            <label className="mt-1 flex items-center gap-1.5 text-[12px] text-admin-muted">
              Mudar status:
              <select
                value={member.status}
                disabled={busy !== null}
                onChange={(event) =>
                  void run(
                    `s-${member.userId}`,
                    () => setMemberStatus(member.userId, event.target.value),
                    "Status alterado.",
                  )
                }
                className="rounded-[6px] border border-admin-input-border bg-admin-card px-1.5 py-0.5 text-[12px] text-admin-text"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[12px] text-admin-text">
              Almoço: {member.lunch ? lunchLabel(member.lunch) : "não definido"}
            </p>
            {member.lunchPending && (
              <div className="mt-1.5 rounded-[8px] bg-admin-warning-bg px-2.5 py-1.5 text-[12px] text-admin-warning-text">
                <p className="font-semibold">
                  Pediu {lunchLabel(member.lunchPending)}
                  {member.requestedAt ? ` em ${member.requestedAt}` : ""}.
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `a-${member.userId}`,
                        () => decideLunch(member.userId, true),
                        "Horário de almoço aprovado.",
                      )
                    }
                    className="btn btn-admin-primary btn-sm"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `r-${member.userId}`,
                        () => decideLunch(member.userId, false),
                        "Pedido recusado.",
                      )
                    }
                    className="btn btn-admin-secondary btn-sm"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${member.chatDisabled ? "bg-admin-error-bg text-admin-error-text" : "bg-admin-success-bg text-admin-success-text"}`}
            >
              {member.chatDisabled ? "Chat desativado" : "Chat ativo"}
            </span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  `c-${member.userId}`,
                  () => setChatEnabled(member.userId, member.chatDisabled),
                  member.chatDisabled ? "Chat reativado." : "Chat desativado.",
                )
              }
              className={`btn btn-sm ${member.chatDisabled ? "btn-admin-primary" : "btn-admin-danger"}`}
            >
              {member.chatDisabled ? "Ativar chat" : "Desativar chat"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
