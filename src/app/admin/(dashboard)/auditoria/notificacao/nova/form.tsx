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
  each,
}: {
  ids: string[];
  people: { id: string; label: string }[];
  defaultPerson: string;
  defaultFacts: string;
  defaultLegalBasis: string;
  /** Several people's acts: their names, one notification each. */
  each: string[] | null;
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
      {each ? (
        <div className="rounded-[10px] bg-admin-input-bg px-3.5 py-2.5 text-[12.5px] text-admin-text">
          <input type="hidden" name="modo" value="cada" />
          <p className="font-bold text-admin-primary">
            Uma notificação para cada pessoa ({each.length})
          </p>
          <p className="mt-0.5">{each.join(", ")}</p>
          <p className="mt-1 text-admin-muted">
            Cada uma recebe só os atos dela, com o mesmo texto abaixo.
          </p>
        </div>
      ) : (
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
      )}
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
      <fieldset className="rounded-[10px] border border-admin-border px-3.5 py-2.5">
        <legend className="px-1 text-xs font-bold text-admin-primary">
          Como enviar
        </legend>
        <label className="flex items-start gap-2 text-[13px] text-admin-text">
          <input
            type="checkbox"
            checked
            disabled
            className="checkbox-admin mt-0.5"
          />
          <span>
            Pelo painel: a pessoa vê a notificação na aba Auditoria e um aviso
            em todas as telas até responder.
          </span>
        </label>
        <label className="mt-1.5 flex items-start gap-2 text-[13px] text-admin-text">
          <input
            type="checkbox"
            name="porEmail"
            defaultChecked
            className="checkbox-admin mt-0.5"
          />
          <span>Também por e-mail, com o PDF anexado.</span>
        </label>
        <p className="mt-1.5 text-[11.5px] text-admin-muted">
          Para imprimir, abra a notificação depois de enviada e use &quot;Abrir
          PDF (imprimir)&quot;.
        </p>
      </fieldset>
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
