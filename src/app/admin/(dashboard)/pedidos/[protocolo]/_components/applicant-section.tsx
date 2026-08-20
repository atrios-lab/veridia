"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatCpf } from "@/core/request/form.ts";
import { type ActionState, updateRequestDataAction } from "../actions.ts";

export interface ApplicantData {
  applicantName: string;
  contact: string;
  cpf: string;
  purpose: string;
  description: string;
  /** "YYYY-MM-DDTHH:mm" on the office's wall clock, not the browser's. */
  createdAt: string;
}

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
        {label}
      </span>
      <p className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text">
        {value}
      </p>
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
  const [editing, setEditing] = useState(false);
  // Controlled only because it is masked as it is typed, like the public form:
  // the operator reads a CPF off a document, in the shape the document has.
  const [cpf, setCpf] = useState(() => formatCpf(data.cpf));
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateRequestDataAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success("Dados corrigidos. O cidadão já vê a correção na consulta.");
    setEditing(false);
  }, [state]);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <div className="flex items-center gap-2.5">
        <h4 className="flex-1 font-serif text-[17px] font-semibold text-admin-primary">
          Dados do solicitante
        </h4>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-admin-secondary btn-sm"
          >
            Editar dados
          </button>
        )}
      </div>

      {editing ? (
        <form action={action} className="mt-4 flex flex-col gap-3.5">
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
              onClick={() => setEditing(false)}
              disabled={pending}
              className="btn btn-admin-secondary btn-md"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label="Nome" value={data.applicantName || "Não informado"} />
            <Field label="CPF" value={cpfMasked} />
            <Field label="Contato" value={data.contact || "Não informado"} />
            {/* Same order as the edit form: toggling must not move fields
                around under the operator's eye. */}
            <Field label="Data e hora do atendimento" value={filedLabel} />
            <Field label="Ato" value={actLabel} />
          </div>
          {data.purpose && (
            <div className="mt-3.5">
              <Field label="Finalidade" value={data.purpose} />
            </div>
          )}
          {data.description && (
            <div className="mt-3.5">
              <Field label="Descrição" value={data.description} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
