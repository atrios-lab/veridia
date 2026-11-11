"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { AUDIT_LEVEL_LABELS, type AuditLevel } from "@/core/audit/severity.ts";
import {
  type AuditState,
  addNote,
  emailReport,
  markReviewed,
} from "./actions.ts";

const IDLE: AuditState = { status: "idle" };

export interface TrailRow {
  id: string;
  tenantName: string;
  day: string;
  time: string;
  who: string;
  role: string;
  actorId: string | null;
  what: string;
  code: string;
  level: AuditLevel;
  reason: string | null;
  reviewed: string | null;
  target: string;
  notes: { id: string; body: string; meta: string }[];
}

/** The band's colour: a stripe on the left and the badge. */
const BAND: Record<AuditLevel, { stripe: string; badge: string }> = {
  urgente: {
    stripe: "border-l-admin-error-text",
    badge: "bg-admin-error-bg text-admin-error-text",
  },
  atencao: {
    stripe: "border-l-admin-warning-text",
    badge: "bg-admin-warning-bg text-admin-warning-text",
  },
  analise: {
    stripe: "border-l-admin-primary-soft",
    badge: "bg-admin-readonly-bg text-admin-primary",
  },
  rotina: { stripe: "border-l-admin-border", badge: "" },
};

function NoteForm({ auditId }: { auditId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addNote, IDLE);
  useEffect(() => {
    if (state.status === "saved") {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11.5px] font-semibold text-admin-muted underline hover:text-admin-primary"
      >
        Anotar
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-start gap-2">
      <textarea
        id={`nota-${auditId}`}
        rows={2}
        maxLength={2000}
        aria-label="Anotação"
        className="min-w-0 flex-1 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[12.5px] text-admin-text"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const data = new FormData();
          data.set("auditId", auditId);
          data.set(
            "body",
            (
              document.getElementById(
                `nota-${auditId}`,
              ) as HTMLTextAreaElement | null
            )?.value ?? "",
          );
          startTransition(() => action(data));
        }}
        className="btn btn-admin-primary btn-sm"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {state.status === "error" && (
        <p
          role="alert"
          className="basis-full text-[12px] text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

/** One urgent act seen: its alert ends. */
function ReviewButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(markReviewed, IDLE);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const data = new FormData();
        data.append("ids", id);
        startTransition(() => action(data));
      }}
      className="btn btn-admin-danger btn-sm"
    >
      {pending ? "Marcando..." : "Marcar como verificado"}
    </button>
  );
}

/**
 * The trail, a day at a time, each act striped with its band. Ticking acts
 * brings up the bar of what to do with them: PDF, e-mail, notify the
 * person, mark the urgent ones as seen.
 */
export function TrailList({
  entries,
  serventia,
  showOffice,
}: {
  entries: TrailRow[];
  serventia: string;
  showOffice: boolean;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [mailState, mail, mailing] = useActionState(emailReport, IDLE);
  const [reviewState, review, reviewing] = useActionState(markReviewed, IDLE);
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (mailState.status === "saved") toast.success(mailState.message);
  }, [mailState]);
  useEffect(() => {
    if (reviewState.status === "saved") {
      toast.success(reviewState.message);
      setChosen([]);
    }
  }, [reviewState]);
  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const picked = entries.filter((e) => chosen.includes(e.id));
  const people = [...new Set(picked.map((e) => e.actorId).filter(Boolean))];
  const pendingUrgent = picked.filter(
    (e) => e.level === "urgente" && !e.reviewed,
  );
  const days = entries.reduce<{ day: string; rows: TrailRow[] }[]>(
    (groups, entry) => {
      const last = groups.at(-1);
      if (last?.day === entry.day) last.rows.push(entry);
      else groups.push({ day: entry.day, rows: [entry] });
      return groups;
    },
    [],
  );

  return (
    <div className="mt-4">
      {entries.length === 0 ? (
        <p className="text-[13px] text-admin-muted">
          Nenhum registro com esses filtros.
        </p>
      ) : (
        days.map((group) => (
          <section key={group.day} className="mt-3 first:mt-0">
            <h3 className="sticky top-0 z-[1] bg-admin-card py-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-admin-muted">
              {group.day}
            </h3>
            <ul className="flex flex-col gap-2">
              {group.rows.map((entry) => {
                const band = BAND[entry.level];
                const ticked = chosen.includes(entry.id);
                return (
                  <li
                    key={entry.id}
                    className={`flex gap-3 rounded-[10px] border border-l-4 border-admin-border px-3 py-2.5 text-[13px] ${band.stripe} ${ticked ? "bg-admin-input-bg" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={ticked}
                      onChange={() => toggle(entry.id)}
                      aria-label={`Marcar: ${entry.what}, ${entry.day} ${entry.time}`}
                      className="checkbox-admin mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {entry.level !== "rotina" && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] ${band.badge}`}
                          >
                            {AUDIT_LEVEL_LABELS[entry.level]}
                          </span>
                        )}
                        <strong className="text-admin-primary">
                          {entry.what}
                        </strong>
                        <span className="text-[12px] text-admin-muted">
                          {entry.time}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-admin-text [overflow-wrap:anywhere]">
                        {entry.who}
                        {entry.role && (
                          <span className="text-admin-muted">
                            {" "}
                            ({entry.role})
                          </span>
                        )}
                        {entry.target && (
                          <span className="text-admin-muted">
                            {" "}
                            · {entry.target}
                          </span>
                        )}
                        {showOffice && (
                          <span className="text-admin-muted">
                            {" "}
                            · {entry.tenantName}
                          </span>
                        )}
                      </p>
                      {entry.reason && (
                        <p className="mt-1.5 rounded-[8px] bg-admin-warning-soft-bg px-2.5 py-1.5 text-[12px] text-admin-text [overflow-wrap:anywhere]">
                          <span className="font-semibold">Justificativa:</span>{" "}
                          {entry.reason}
                        </p>
                      )}
                      {entry.notes.map((note) => (
                        <p
                          key={note.id}
                          className="mt-1.5 rounded-[8px] bg-admin-input-bg px-2.5 py-1.5 text-[12px] text-admin-text [overflow-wrap:anywhere]"
                        >
                          {note.body}
                          <span className="block text-[11px] text-admin-muted">
                            {note.meta}
                          </span>
                        </p>
                      ))}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        {entry.level === "urgente" &&
                          (entry.reviewed ? (
                            <span className="text-[11.5px] font-semibold text-admin-success-text">
                              ✓ {entry.reviewed}
                            </span>
                          ) : (
                            <ReviewButton id={entry.id} />
                          ))}
                        <NoteForm auditId={entry.id} />
                        <span className="text-[10.5px] text-admin-faint">
                          {entry.code}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {/* What to do with the ticked acts: only there when something is. */}
      {chosen.length > 0 && (
        <div className="sticky bottom-3 z-10 mt-4 rounded-[14px] border border-admin-border bg-admin-card px-3.5 py-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="font-semibold text-admin-primary">
              {chosen.length} marcado(s)
            </span>
            <button
              type="button"
              onClick={() => setChosen([])}
              className="text-[12px] text-admin-muted underline"
            >
              limpar
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingUrgent.length > 0 && (
              <button
                type="button"
                disabled={reviewing}
                onClick={() => {
                  const data = new FormData();
                  for (const e of pendingUrgent) data.append("ids", e.id);
                  startTransition(() => review(data));
                }}
                className="btn btn-admin-danger btn-sm"
              >
                Marcar {pendingUrgent.length} urgente(s) como verificado(s)
              </button>
            )}
            <form
              method="post"
              action="/admin/auditoria/relatorio"
              target="_blank"
              rel="noopener"
            >
              {chosen.map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}
              <input type="hidden" name="serventia" value={serventia} />
              <button type="submit" className="btn btn-admin-secondary btn-sm">
                Gerar PDF
              </button>
            </form>
            {people.length === 1 ? (
              <a
                href={`/admin/auditoria/notificacao/nova?pessoa=${people[0]}&${chosen.map((id) => `ids=${id}`).join("&")}`}
                className="btn btn-admin-primary btn-sm"
              >
                Notificar a pessoa
              </a>
            ) : (
              <span className="self-center text-[11.5px] text-admin-muted">
                Para notificar, marque atos de uma só pessoa.
              </span>
            )}
          </div>
          <div className="mt-2 flex min-w-0 gap-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-mail para enviar o relatório"
              aria-label="E-mail para enviar o relatório"
              className="min-w-0 flex-1 rounded-[8px] border border-admin-input-border bg-admin-input-bg px-2.5 py-1.5 text-[12.5px]"
            />
            <button
              type="button"
              disabled={mailing}
              onClick={() => {
                const data = new FormData();
                for (const id of chosen) data.append("ids", id);
                data.set("email", email);
                data.set("serventia", serventia);
                startTransition(() => mail(data));
              }}
              className="btn btn-admin-secondary btn-sm shrink-0"
            >
              {mailing ? "Enviando..." : "Enviar"}
            </button>
          </div>
          {mailState.status === "error" && (
            <p
              role="alert"
              className="mt-1.5 text-[12px] text-admin-error-text"
            >
              {mailState.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
