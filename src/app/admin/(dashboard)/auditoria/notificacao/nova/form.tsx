"use client";

import { startTransition, useActionState } from "react";
import { DocumentNameField } from "@/app/_components/document-name-field.tsx";
import { type AuditState, createNotification } from "../../actions.ts";
import { EvidenceFiles } from "../evidence-files.tsx";

const IDLE: AuditState = { status: "idle" };
const LABEL = "mb-1.5 block text-xs font-bold text-admin-primary";
const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

export const EVIDENCE_NAMES = [
  "Captura de tela",
  "Registro do sistema",
  "Comprovante",
  "Documento",
] as const;

export function NewNotificationForm({
  ids,
  people,
  defaultPerson,
  defaultFacts,
  defaultLegalBasis,
}: {
  ids: string[];
  people: { id: string; label: string }[];
  defaultPerson: string;
  defaultFacts: string;
  defaultLegalBasis: string;
}) {
  const [state, action, pending] = useActionState(createNotification, IDLE);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-4 flex flex-col gap-3.5"
    >
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <div>
        <label htmlFor="n-pessoa" className={LABEL}>
          Pessoa notificada
        </label>
        <select
          id="n-pessoa"
          name="pessoa"
          required
          defaultValue={defaultPerson}
          className={FIELD}
        >
          <option value="" disabled>
            Escolha
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="n-assunto" className={LABEL}>
          Assunto
        </label>
        <input
          id="n-assunto"
          name="assunto"
          required
          maxLength={200}
          defaultValue="Esclarecimentos sobre atos registrados no painel"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="n-fatos" className={LABEL}>
          Dos fatos
        </label>
        <textarea
          id="n-fatos"
          name="fatos"
          required
          rows={5}
          maxLength={6000}
          defaultValue={defaultFacts}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="n-fund" className={LABEL}>
          Da fundamentação
        </label>
        <textarea
          id="n-fund"
          name="fundamentacao"
          required
          rows={7}
          maxLength={6000}
          defaultValue={defaultLegalBasis}
          className={FIELD}
        />
        <p className="mt-1 text-[11.5px] text-admin-muted">
          Texto-base com a Constituição (ampla defesa), a Lei 8.935/1994, a CLT
          e a LGPD. Ajuste ao caso e, se houver, cite o regimento interno da
          serventia.
        </p>
      </div>
      <DocumentNameField
        field="provas"
        tone="admin"
        suggestions={EVIDENCE_NAMES}
        hint="Nome das imagens ou arquivos de prova (opcional)."
      />
      <EvidenceFiles name="provas" label="Imagens e provas (opcional)" />
      {state.status === "error" && (
        <p role="alert" className="text-[12.5px] text-admin-error-text">
          {state.message}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Enviando..." : "Enviar notificação"}
        </button>
      </div>
    </form>
  );
}
