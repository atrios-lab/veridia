"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { type AuditState, addNote, emailReport } from "./actions.ts";

const IDLE: AuditState = { status: "idle" };

export interface TrailRow {
  id: string;
  tenantName: string;
  when: string;
  who: string;
  actorId: string | null;
  what: string;
  code: string;
  target: string;
  notes: { id: string; body: string; meta: string }[];
}

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

/**
 * The trail with a tick per entry, and what to do with the ticked ones:
 * the PDF (opens to print or save), the e-mail, the notification.
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
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (mailState.status === "saved") toast.success(mailState.message);
  }, [mailState]);
  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const people = [
    ...new Set(
      entries
        .filter((e) => chosen.includes(e.id))
        .map((e) => e.actorId)
        .filter(Boolean),
    ),
  ];

  return (
    <div className="mt-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-[10px] bg-admin-input-bg px-3 py-2.5 text-[12.5px]">
        <span className="font-semibold text-admin-primary">
          {chosen.length} marcado(s)
        </span>
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
          <button
            type="submit"
            disabled={!chosen.length}
            className="btn btn-admin-secondary btn-sm"
          >
            Gerar PDF
          </button>
        </form>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-mail para enviar"
          aria-label="E-mail para enviar o relatório"
          className="w-52 rounded-[8px] border border-admin-input-border bg-admin-card px-2.5 py-1.5 text-[12.5px]"
        />
        <button
          type="button"
          disabled={!chosen.length || mailing}
          onClick={() => {
            const data = new FormData();
            for (const id of chosen) data.append("ids", id);
            data.set("email", email);
            data.set("serventia", serventia);
            startTransition(() => mail(data));
          }}
          className="btn btn-admin-secondary btn-sm"
        >
          {mailing ? "Enviando..." : "Enviar por e-mail"}
        </button>
        <a
          aria-disabled={chosen.length === 0 || people.length !== 1}
          href={
            chosen.length && people.length === 1
              ? `/admin/auditoria/notificacao/nova?pessoa=${people[0]}&${chosen.map((id) => `ids=${id}`).join("&")}`
              : undefined
          }
          className={`btn btn-admin-primary btn-sm ${chosen.length && people.length === 1 ? "" : "pointer-events-none opacity-50"}`}
        >
          Notificar a pessoa
        </a>
        {chosen.length > 0 && people.length !== 1 && (
          <span className="text-[11.5px] text-admin-muted">
            Para notificar, marque registros de uma só pessoa.
          </span>
        )}
        {mailState.status === "error" && (
          <span role="alert" className="text-admin-error-text">
            {mailState.message}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="mt-3 text-[13px] text-admin-muted">
          Nenhum registro com esses filtros.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-admin-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 py-2.5 text-[13px]">
              <input
                type="checkbox"
                checked={chosen.includes(entry.id)}
                onChange={() => toggle(entry.id)}
                aria-label={`Marcar: ${entry.what}, ${entry.when}`}
                className="checkbox-admin mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-admin-text">
                  <strong className="text-admin-primary">{entry.what}</strong>
                  <span className="text-admin-muted"> · {entry.who}</span>
                </p>
                <p className="text-[11.5px] text-admin-muted [overflow-wrap:anywhere]">
                  {entry.when}
                  {showOffice && ` · ${entry.tenantName}`}
                  {entry.target && ` · ${entry.target}`} · {entry.code}
                </p>
                {entry.notes.map((note) => (
                  <p
                    key={note.id}
                    className="mt-1 rounded-[8px] bg-admin-warning-soft-bg px-2.5 py-1.5 text-[12px] text-admin-text"
                  >
                    {note.body}
                    <span className="block text-[11px] text-admin-muted">
                      {note.meta}
                    </span>
                  </p>
                ))}
                <NoteForm auditId={entry.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
