"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatCpf, formatPhone } from "@/core/request/form.ts";
import { type ActionState, updateRequestDataAction } from "../actions.ts";

export interface ApplicantData {
  applicantName: string;
  contact: string;
  /** Asked for apart from the contact on the public form; may be empty. */
  phone: string;
  cpf: string;
  purpose: string;
  description: string;
  /** "YYYY-MM-DDTHH:mm" on the office's wall clock, not the browser's. */
  createdAt: string;
}

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

const EMPTY = "Não informado";

/** Label over value, in plain text: the read view has no boxes to fill. */
function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="text-[11px] text-admin-faint">{label}</div>
      <div
        className={`mt-0.5 text-[13.5px] leading-[1.4] whitespace-pre-line ${
          value === EMPTY ? "text-admin-muted" : "text-admin-text"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-bold text-admin-primary"
    >
      {children}
    </label>
  );
}

/**
 * The requester's data, correctable. The act and the protocol are not here on
 * purpose: changing the act changes the attribution and the legal basis of
 * something already protocolled, which is a new request, not an edit.
 *
 * Closed by default, like the citizen's own Histórico: the operator opens it
 * when the summary line is not enough.
 */
export function ApplicantSection({
  requestId,
  data,
  actLabel,
  cpfMasked,
  filedLabel,
  allowsPurpose,
}: {
  requestId: string;
  data: ApplicantData;
  actLabel: string;
  /** What the read view shows, masked; editing reveals the digits to fix. */
  cpfMasked: string;
  /** The attendance, on the office's wall clock, for the read view. */
  filedLabel: string;
  /**
   * Whether this act may be asked what the document is for. Lei 6.015 art. 17
   * says a certificate may not, and the counter is the same office asking as
   * the public form: the server drops it either way.
   */
  allowsPurpose: boolean;
}) {
  const [mode, setMode] = useState<"closed" | "open" | "editing">("closed");
  // Controlled only because it is masked as it is typed, like the public form:
  // the operator reads a CPF off a document, in the shape the document has.
  const [cpf, setCpf] = useState(() => formatCpf(data.cpf));
  const [phone, setPhone] = useState(() => formatPhone(data.phone));
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateRequestDataAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success("Dados corrigidos. O cidadão já vê a correção na consulta.");
    setMode("open");
  }, [state]);

  const closed = mode === "closed";

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card px-6 py-[22px]">
      {/* The whole row toggles, so the hit area is the row and not a chevron.
          The title is the real button (keyboard, aria-expanded); its click
          bubbles up to the row, which is the one place the toggle lives. The
          edit button stops the click on its way up. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the title button inside carries the keyboard. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only enlargement of the button's hit area. */}
      <div
        onClick={() => {
          if (mode !== "editing") setMode(closed ? "open" : "closed");
        }}
        className="flex min-h-9 cursor-pointer items-center gap-3"
      >
        <button
          type="button"
          aria-expanded={!closed}
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-[3px] text-left"
        >
          <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
            Dados do solicitante
          </h4>
          {closed && (
            <span className="w-full truncate text-[12.5px] text-admin-muted">
              {data.applicantName || EMPTY} · {data.contact || EMPTY} · CPF{" "}
              {cpfMasked}
            </span>
          )}
        </button>
        {mode === "open" && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMode("editing");
            }}
            className="btn btn-admin-secondary btn-sm"
          >
            Editar dados
          </button>
        )}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-none text-admin-text transition-transform duration-300 ${closed ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
      </div>

      {mode === "open" && (
        <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3.5 border-t border-admin-border pt-3.5">
          <Field label="Nome" value={data.applicantName || EMPTY} />
          <Field label="CPF" value={cpfMasked} />
          <Field label="Contato" value={data.contact || EMPTY} />
          <Field label="Telefone" value={data.phone || EMPTY} />
          {/* Same order as the edit form: toggling must not move fields
              around under the operator's eye. */}
          <Field label="Data e hora do atendimento" value={filedLabel} />
          <Field label="Ato" value={actLabel} />
          {data.purpose && (
            <Field label="Finalidade" value={data.purpose} wide />
          )}
          {data.description && (
            <Field label="Descrição" value={data.description} wide />
          )}
        </div>
      )}

      {mode === "editing" && (
        <form
          action={action}
          className="mt-3.5 flex flex-col gap-3.5 border-t border-admin-border pt-4"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <div>
              <Label htmlFor="applicantName">Nome</Label>
              <input
                id="applicantName"
                name="applicantName"
                defaultValue={data.applicantName}
                className={FIELD}
              />
            </div>
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <input
                id="cpf"
                name="cpf"
                inputMode="numeric"
                value={cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
                placeholder="000.000.000-00"
                className={FIELD}
              />
            </div>
            <div>
              <Label htmlFor="contact">Contato</Label>
              <input
                id="contact"
                name="contact"
                defaultValue={data.contact}
                className={FIELD}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <input
                id="phone"
                name="phone"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
                placeholder="(00) 00000-0000"
                className={FIELD}
              />
            </div>
            <div>
              <Label htmlFor="createdAt">Data e hora do atendimento</Label>
              <input
                id="createdAt"
                name="createdAt"
                type="datetime-local"
                defaultValue={data.createdAt}
                className={FIELD}
              />
              <p className="mt-1 text-[11px] text-admin-faint">
                O balcão lança depois; o protocolo vale pelo atendimento.
              </p>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-bold text-admin-primary">
              Ato
            </span>
            <p className="rounded-[9px] border border-admin-input-border bg-admin-readonly-bg px-3.5 py-2.5 text-[13.5px] text-admin-muted">
              {actLabel}
            </p>
            <p className="mt-1 text-[11px] text-admin-faint">
              O ato não se corrige: trocá-lo muda a atribuição e a base legal do
              que já foi protocolado. Nesse caso, cancele e abra outro pedido.
            </p>
          </div>
          {allowsPurpose && (
            <div>
              <Label htmlFor="purpose">Finalidade</Label>
              <input
                id="purpose"
                name="purpose"
                defaultValue={data.purpose}
                className={FIELD}
              />
            </div>
          )}
          <div>
            <Label htmlFor="description">Descrição</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={data.description}
              className={FIELD}
            />
          </div>
          {state.status === "error" && (
            <p
              role="alert"
              className="text-[12.5px] font-semibold text-admin-error-text"
            >
              {state.message}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-admin-primary btn-md"
            >
              {pending ? "Salvando…" : "Salvar dados"}
            </button>
            <button
              type="button"
              onClick={() => setMode("open")}
              disabled={pending}
              className="btn btn-admin-secondary btn-md"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
