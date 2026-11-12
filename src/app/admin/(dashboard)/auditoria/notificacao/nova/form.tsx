"use client";

import { startTransition, useActionState } from "react";
import { DocumentNameField } from "@/app/_components/document-name-field.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import { type AuditState, createNotification } from "../../actions.ts";
import { EvidenceFiles } from "../evidence-files.tsx";

const IDLE: AuditState = { status: "idle" };
const LABEL = "mb-1.5 block text-sm font-medium text-foreground";

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
      className="mt-4 flex flex-col gap-4"
    >
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      {each ? (
        <div className="rounded-lg bg-muted/50 px-3.5 py-2.5 text-xs text-foreground">
          <input type="hidden" name="modo" value="cada" />
          <p className="font-medium text-foreground">
            Uma notificação para cada pessoa ({each.length})
          </p>
          <p className="mt-0.5">{each.join(", ")}</p>
          <p className="mt-1 text-muted-foreground">
            Cada uma recebe só os atos dela, com o mesmo texto abaixo.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="n-pessoa" className={LABEL}>
            Pessoa notificada
          </label>
          <NativeSelect
            id="n-pessoa"
            name="pessoa"
            required
            defaultValue={defaultPerson}
            className="w-full"
          >
            <NativeSelectOption value="" disabled>
              Escolha
            </NativeSelectOption>
            {people.map((person) => (
              <NativeSelectOption key={person.id} value={person.id}>
                {person.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      <div>
        <label htmlFor="n-assunto" className={LABEL}>
          Assunto
        </label>
        <Input
          id="n-assunto"
          name="assunto"
          required
          maxLength={200}
          defaultValue="Esclarecimentos sobre atos registrados no painel"
        />
      </div>
      <div>
        <label htmlFor="n-fatos" className={LABEL}>
          Dos fatos
        </label>
        <Textarea
          id="n-fatos"
          name="fatos"
          required
          rows={5}
          maxLength={6000}
          defaultValue={defaultFacts}
        />
      </div>
      <div>
        <label htmlFor="n-fund" className={LABEL}>
          Da fundamentação
        </label>
        <Textarea
          id="n-fund"
          name="fundamentacao"
          required
          rows={7}
          maxLength={6000}
          defaultValue={defaultLegalBasis}
        />
        <p className="mt-1 text-xs text-muted-foreground">
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
      <fieldset className="rounded-lg border border-border px-3.5 py-2.5">
        <legend className="px-1 text-sm font-medium text-foreground">
          Como enviar
        </legend>
        <label className="flex items-start gap-2 text-sm text-foreground">
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
        <label className="mt-1.5 flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="porEmail"
            defaultChecked
            className="checkbox-admin mt-0.5"
          />
          <span>Também por e-mail, com o PDF anexado.</span>
        </label>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Para imprimir, abra a notificação depois de enviada e use &quot;Abrir
          PDF (imprimir)&quot;.
        </p>
      </fieldset>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Enviando..." : "Enviar notificação"}
        </Button>
      </div>
    </form>
  );
}
