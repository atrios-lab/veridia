"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { type ActVariants, PURPOSE_LABEL } from "@/core/acts/catalog.ts";
import { formatCpf, formatPhone } from "@/core/request/form.ts";
import type { AlternateDocumentType } from "@/core/request/kinds.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label as UiLabel } from "../../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import { AlternateDocumentFields } from "../../_components/alternate-document-fields.tsx";
import { type ActionState, updateRequestDataAction } from "../actions.ts";

export interface ApplicantData {
  applicantName: string;
  contact: string;
  /** Asked for apart from the contact on the public form; may be empty. */
  phone: string;
  /** The kind of act stored, or "" when there is none the catalogue knows. */
  actVariant: string;
  cpf: string;
  /** Present on a request of a citizen with no CPF. */
  alternateDocumentType?: AlternateDocumentType;
  alternateDocumentNumber?: string;
  purpose: string;
  description: string;
  /** "YYYY-MM-DDTHH:mm" on the office's wall clock, not the browser's. */
  createdAt: string;
}

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
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm leading-snug whitespace-pre-line [overflow-wrap:anywhere] ${
          value === EMPTY ? "text-muted-foreground" : "text-foreground"
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
    <UiLabel htmlFor={htmlFor} className="mb-2">
      {children}
    </UiLabel>
  );
}

/**
 * The requester's data, correctable. The act and the protocol are not here on
 * purpose: changing the act changes the attribution and the legal basis of
 * something already protocolled, which is a new request, not an edit.
 *
 * Open by default: the operator works from these data, so they start in view.
 * Closing it down to the summary line is there for whoever wants the room.
 */
export function ApplicantSection({
  requestId,
  data,
  actLabel,
  cpfMasked,
  alternateDocumentMasked,
  filedLabel,
  allowsPurpose,
  qualificationRows,
  actVariants,
}: {
  requestId: string;
  data: ApplicantData;
  actLabel: string;
  /** What the read view shows, masked; editing reveals the digits to fix. */
  cpfMasked: string;
  /** Same discipline, for the document of a citizen with no CPF. */
  alternateDocumentMasked?: string;
  /** The attendance, on the office's wall clock, for the read view. */
  filedLabel: string;
  /**
   * Whether this act may be asked what the document is for. Lei 6.015 art. 17
   * says a certificate may not, and the counter is the same office asking as
   * the public form: the server drops it either way.
   */
  allowsPurpose: boolean;
  /** As respostas de quem pede o inteiro teor do RCPN. Só leitura. */
  qualificationRows: { label: string; value: string }[];
  /** The kinds the act groups, when it groups any. */
  actVariants?: ActVariants;
}) {
  const [mode, setMode] = useState<"closed" | "open" | "editing">("open");
  // Controlled only because it is masked as it is typed, like the public form:
  // the operator reads a CPF off a document, in the shape the document has.
  const [cpf, setCpf] = useState(() => formatCpf(data.cpf));
  const [noCpf, setNoCpf] = useState(() => Boolean(data.alternateDocumentType));
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
    <div className="rounded-xl border bg-card p-6">
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
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-md text-left"
        >
          <h4 className="text-base font-semibold text-foreground">
            Dados do solicitante
          </h4>
          {closed && (
            <span className="w-full truncate text-sm text-muted-foreground">
              {data.applicantName || EMPTY} · {data.contact || EMPTY} · CPF{" "}
              {cpfMasked}
              {alternateDocumentMasked && ` · ${alternateDocumentMasked}`}
            </span>
          )}
        </button>
        {mode === "open" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setMode("editing");
            }}
          >
            Editar dados
          </Button>
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
          className={`flex-none text-muted-foreground transition-transform duration-300 ${closed ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
      </div>

      {mode === "open" && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4">
          <Field label="Nome" value={data.applicantName || EMPTY} />
          <Field
            label="CPF"
            value={
              alternateDocumentMasked
                ? `${cpfMasked} · ${alternateDocumentMasked}`
                : cpfMasked
            }
          />
          <Field label="Contato" value={data.contact || EMPTY} />
          <Field label="Telefone" value={data.phone || EMPTY} />
          {/* Same order as the edit form: toggling must not move fields
              around under the operator's eye. */}
          <Field label="Data e hora do atendimento" value={filedLabel} />
          <Field label="Ato" value={actLabel} />
          {data.purpose && (
            <Field label={PURPOSE_LABEL} value={data.purpose} wide />
          )}
          {qualificationRows.map((row) => (
            <Field key={row.label} label={row.label} value={row.value} />
          ))}
          {data.description && (
            <Field label="Descrição" value={data.description} wide />
          )}
        </div>
      )}

      {mode === "editing" && (
        <form
          action={action}
          className="mt-4 flex flex-col gap-4 border-t pt-4"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="applicantName">Nome</Label>
              <Input
                id="applicantName"
                name="applicantName"
                defaultValue={data.applicantName}
              />
            </div>
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                name="cpf"
                inputMode="numeric"
                value={noCpf ? "" : cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
                placeholder="000.000.000-00"
                disabled={noCpf}
                className="disabled:bg-muted"
              />
              <AlternateDocumentFields
                checked={noCpf}
                onCheckedChange={setNoCpf}
                defaultType={data.alternateDocumentType}
                defaultNumber={data.alternateDocumentNumber}
              />
            </div>
            <div>
              <Label htmlFor="contact">Contato</Label>
              <Input id="contact" name="contact" defaultValue={data.contact} />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                name="phone"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="createdAt">Data e hora do atendimento</Label>
              <Input
                id="createdAt"
                name="createdAt"
                type="datetime-local"
                defaultValue={data.createdAt}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                O balcão lança depois; o protocolo vale pelo atendimento.
              </p>
            </div>
          </div>
          <div>
            <span className="mb-2 block text-sm leading-none font-medium text-foreground">
              Ato
            </span>
            <p className="rounded-md border border-input bg-muted px-2.5 py-2 text-sm text-muted-foreground">
              {actLabel}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              O ato não se corrige: trocá-lo muda a atribuição e a base legal do
              que já foi protocolado. Nesse caso, cancele e abra outro pedido.
            </p>
          </div>
          {actVariants && (
            <div>
              <Label htmlFor="actVariant">{actVariants.question}</Label>
              <NativeSelect
                id="actVariant"
                name="actVariant"
                defaultValue={data.actVariant}
                className="w-full"
              >
                {/* Only while nothing is stored: an old request stays
                    correctable without anyone having to guess its kind. */}
                {!data.actVariant && (
                  <NativeSelectOption value="">{EMPTY}</NativeSelectOption>
                )}
                {actVariants.options.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>
                    {option.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          {allowsPurpose && (
            <div>
              <Label htmlFor="purpose">{PURPOSE_LABEL}</Label>
              <Input id="purpose" name="purpose" defaultValue={data.purpose} />
            </div>
          )}
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={LONG_TEXT_MAX}
              defaultValue={data.description}
            />
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar dados"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("open")}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
