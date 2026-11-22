"use client";

import { startTransition, useActionState, useState } from "react";
import {
  type ActVariants,
  actsOfAttribution,
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_TYPES,
  FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  FEE_EXEMPTION_DECLARATION,
  PURPOSE_HINT,
  PURPOSE_LABEL,
  PURPOSE_PLACEHOLDER,
  REQUESTER_QUALIFICATION_NOTICE,
} from "@/core/acts/catalog.ts";
import { isEmailContact } from "@/core/request/form.ts";
import {
  asksPurpose,
  asksRequesterQualification,
  DELIVERY_FORMAT_LABELS,
  DELIVERY_FORMATS,
  EXEMPTION_SIGNED_BY,
  type ExemptionSignedBy,
  REQUESTER_ROLE_LABELS,
  REQUESTER_ROLES,
} from "@/core/request/kinds.ts";
import type { Attribution, Tenant } from "@/core/tenant/schema.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Checkbox } from "../../../_ui/checkbox.tsx";
import { cn } from "../../../_ui/cn.ts";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import { AlternateDocumentFields } from "../_components/alternate-document-fields.tsx";
import {
  createManualServiceRequest,
  type ManualEntryState,
} from "./actions.ts";

/** A group's own heading (Atribuição), in the same voice as a field label. */
const GROUP_LABEL =
  "mb-2 block text-sm leading-none font-medium text-foreground";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-destructive">{message}</p>
  );
}

const SIGNED_BY_LABELS: Record<ExemptionSignedBy, string> = {
  self: "A própria pessoa beneficiária",
  "legal-representative": "Representante legal",
  "on-behalf": "Assinatura a rogo (não sabe ou não pode assinar)",
};

/**
 * One beneficiary's declaration, the balcão's own layout (plain named
 * inputs, not `react-hook-form`): only the name is required, `actRules` in
 * `form.ts` is what enforces that server-side, this only asks for it. The
 * testemunhas the site never asks for do live here (Provimento CGJ/TJRN
 * n. 7/2026, art. 7º III): the balcão is where a assinatura a rogo actually
 * happens, in front of the operator.
 */
function ManualBeneficiaryFields({
  index,
  fieldErrors,
  heading,
}: {
  index: number;
  fieldErrors: Record<string, string>;
  heading?: string;
}) {
  const [signedBy, setSignedBy] = useState<ExemptionSignedBy>("self");
  const prefix = `beneficiaries.${index}`;

  return (
    <div className="flex flex-col gap-3">
      {heading && (
        <p className="text-sm font-semibold text-foreground">{heading}</p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-2" htmlFor={`${prefix}.name`}>
            Nome completo
          </Label>
          <Input id={`${prefix}.name`} name={`${prefix}.name`} />
          <FieldError message={fieldErrors[`${prefix}.name`]} />
        </div>
        <div>
          <Label className="mb-2" htmlFor={`${prefix}.cpfOrId`}>
            CPF ou RG (opcional)
          </Label>
          <Input id={`${prefix}.cpfOrId`} name={`${prefix}.cpfOrId`} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-foreground">
          Quem formaliza esta declaração?
        </legend>
        {EXEMPTION_SIGNED_BY.map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${prefix}.signedBy`}
              value={value}
              checked={signedBy === value}
              onChange={() => setSignedBy(value)}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-foreground">
              {SIGNED_BY_LABELS[value]}
            </span>
          </label>
        ))}
      </fieldset>

      {signedBy !== "self" && (
        <div className="rounded-lg border bg-background p-3">
          <p className="mb-2 text-sm font-medium text-foreground">
            Dados de quem assina em lugar da pessoa beneficiária
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input placeholder="Nome completo" name={`${prefix}.signer.name`} />
            <Input placeholder="CPF ou RG" name={`${prefix}.signer.cpfOrId`} />
            {signedBy === "legal-representative" && (
              <Input
                placeholder="Qualidade (ex.: pai, tutor, curador)"
                name={`${prefix}.signer.capacity`}
              />
            )}
          </div>
          <FieldError message={fieldErrors[`${prefix}.signer.name`]} />

          {signedBy === "on-behalf" && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-2">
              {[0, 1].map((witness) => (
                <div key={witness}>
                  <Label
                    className="mb-2"
                    htmlFor={`${prefix}.witnesses.${witness}.name`}
                  >
                    Testemunha {witness + 1}
                  </Label>
                  <Input
                    id={`${prefix}.witnesses.${witness}.name`}
                    name={`${prefix}.witnesses.${witness}.name`}
                    placeholder="Nome completo"
                  />
                  <Input
                    name={`${prefix}.witnesses.${witness}.cpfOrId`}
                    placeholder="CPF ou RG"
                    className="mt-2"
                  />
                </div>
              ))}
              <FieldError message={fieldErrors[`${prefix}.witnesses`]} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STEPS = ["Dados do pedido", "Impressão"] as const;

/**
 * The counter's two moments: filling the request, then handing the paper over.
 * Its own component rather than the public site's `Stepper`: that one is fixed
 * at three steps and paints itself with the office's palette, and the panel
 * reads its own neutral tokens on purpose, so the two can change
 * independently.
 */
function Stepper({ current }: { current: 1 | 2 }) {
  return (
    <ol className="mb-6 flex items-center gap-3">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li
            key={label}
            className={`flex items-center gap-2 ${
              step < STEPS.length ? "flex-1" : ""
            }`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                done || active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? (
                <AdminIcon name="check" className="size-3.5" strokeWidth={3} />
              ) : (
                step
              )}
            </span>
            <span
              className={`text-sm font-medium ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {step < STEPS.length && (
              <span
                className={`h-0.5 flex-1 ${done ? "bg-primary" : "bg-border"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Quem pede o inteiro teor do RCPN: as mesmas perguntas do site. */
/** Digital pelo site ou papel no balcão, nos atos que deixam escolher. */
/** O motivo do pedido, nas mesmas palavras do site. Quem decide é `asksPurpose`. */
function ManualPurposeField({ error }: { error?: string }) {
  return (
    <div>
      <Label className="mb-2" htmlFor="purpose">
        {PURPOSE_LABEL}
      </Label>
      <Textarea
        id="purpose"
        name="purpose"
        rows={2}
        maxLength={LONG_TEXT_MAX}
        placeholder={PURPOSE_PLACEHOLDER}
        aria-describedby="purpose-hint"
      />
      <p id="purpose-hint" className="mt-1 text-xs text-muted-foreground">
        {PURPOSE_HINT}
      </p>
      <FieldError message={error} />
    </div>
  );
}

function ManualDeliveryFormatField({ error }: { error?: string }) {
  return (
    <fieldset className="mt-4 flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium text-foreground">
        Como quer receber a certidão?
      </legend>
      {DELIVERY_FORMATS.map((value) => (
        <label key={value} className="flex items-center gap-2">
          <input
            type="radio"
            name="deliveryFormat"
            value={value}
            className="size-4 accent-primary"
          />
          <span className="text-sm text-foreground">
            {DELIVERY_FORMAT_LABELS[value]}
          </span>
        </label>
      ))}
      <FieldError message={error} />
    </fieldset>
  );
}

function ManualRequesterQualificationFields({
  fieldErrors,
}: {
  fieldErrors: Record<string, string>;
}) {
  const [role, setRole] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg bg-muted/50 p-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-foreground">
          Quem está pedindo?
        </legend>
        {REQUESTER_ROLES.map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="requesterRole"
              value={value}
              checked={role === value}
              onChange={() => setRole(value)}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-foreground">
              {REQUESTER_ROLE_LABELS[value]}
            </span>
          </label>
        ))}
        <FieldError message={fieldErrors.requesterRole} />
      </fieldset>

      {role === "attorney" && (
        <div>
          <Label className="mb-2" htmlFor="representedName">
            Nome do representado
          </Label>
          <Input id="representedName" name="representedName" />
          <FieldError message={fieldErrors.representedName} />
          {/* Cor cheia, como as faixas da fila: a nota miúda passava. */}
          <div
            role="note"
            className="mt-2 flex items-start gap-2 rounded-lg bg-warning px-3 py-2.5 text-warning-foreground"
          >
            <AdminIcon
              name="alert"
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={2}
            />
            <p className="text-sm leading-snug">
              <strong className="font-semibold">
                Confira o mandato (procuração).
              </strong>{" "}
              Anexe-o ao pedido depois de registrar.
            </p>
          </div>
        </div>
      )}

      {role && role !== "self" && (
        <div>
          <Label className="mb-2" htmlFor="kinship">
            Grau de parentesco com a pessoa registrada (se houver)
          </Label>
          <Input id="kinship" name="kinship" />
          <FieldError message={fieldErrors.kinship} />
        </div>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-foreground">
          A pessoa registrada é falecida?
        </legend>
        <div className="flex gap-4">
          {(
            [
              ["yes", "Sim"],
              ["no", "Não"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="registrantDeceased"
                value={value}
                className="size-4 accent-primary"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
        <FieldError message={fieldErrors.registrantDeceased} />
      </fieldset>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {REQUESTER_QUALIFICATION_NOTICE}
      </p>
    </div>
  );
}

/** Which of the kinds the act groups, in the same shape as the act's select. */
function ManualVariantField({
  variants,
  value,
  error,
  onChange,
}: {
  variants: ActVariants;
  /** Controlado quando a opção muda o resto do formulário. */
  value?: string;
  error?: string;
  onChange?: (variantId: string) => void;
}) {
  return (
    <div>
      <Label className="mb-2" htmlFor="actVariant">
        {variants.question}
      </Label>
      <NativeSelect
        id="actVariant"
        name="actVariant"
        {...(value === undefined ? { defaultValue: "" } : { value })}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full"
      >
        <NativeSelectOption value="" disabled>
          Escolha uma opção
        </NativeSelectOption>
        {variants.options.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldError message={error} />
    </div>
  );
}

export function ManualEntryForm({
  tenant,
  fromConversation,
}: {
  tenant: Tenant;
  fromConversation?: { id: string; name: string; contact: string };
}) {
  const [attribution, setAttribution] = useState<Attribution>(
    tenant.attributions[0],
  );
  const acts = actsOfAttribution(tenant, attribution);
  const [actId, setActId] = useState(acts[0]?.id ?? "");
  const act = acts.find((a) => a.id === actId) ?? acts[0];
  // Guardado com o ato: uma opção de outro ato não diz nada sobre este, e o
  // select abaixo volta para o vazio quando o ato muda.
  const [chosenVariant, setChosenVariant] = useState<{
    actId: string;
    id: string;
  }>();
  const variantId =
    chosenVariant?.actId === act?.id ? chosenVariant?.id : undefined;
  const exemptionTargets = act?.exemptionTargets;
  const [exemptionActId, setExemptionActId] = useState("");
  const exemptionTarget = exemptionTargets?.find(
    (target) => target.id === exemptionActId,
  );
  // Guardado com o ato e o ato da gratuidade, pelo mesmo motivo da opção: o
  // tipo de certidão de outro pedido não diz nada sobre este.
  const [chosenCertificateType, setChosenCertificateType] = useState<{
    key: string;
    value: string;
  }>();
  const certificateKey = `${act?.id}/${exemptionActId}`;
  const certificateType =
    chosenCertificateType?.key === certificateKey
      ? chosenCertificateType.value
      : undefined;
  const purposeAsked = act
    ? asksPurpose(act, { variantId, exemptionActId, certificateType })
    : false;

  const [state, formAction, pending] = useActionState<
    ManualEntryState,
    FormData
  >(createManualServiceRequest, { status: "idle" });
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const [noCpf, setNoCpf] = useState(false);

  if (state.status === "success") {
    return (
      <>
        <Stepper current={2} />
        <SuccessScreen state={state} />
      </>
    );
  }

  return (
    <>
      <Stepper current={1} />
      <form
        action={formAction}
        // Sem isto o React limpa o formulário depois de cada envio, e um erro
        // num campo apagava tudo o que o operador já tinha digitado.
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="rounded-xl border bg-card p-6"
      >
        {fromConversation && (
          <>
            <input
              type="hidden"
              name="fromConversationId"
              value={fromConversation.id}
            />
            <p className="mb-4 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              A partir da conversa com <b>{fromConversation.name}</b>. Ao
              registrar, o atendimento é encerrado e vinculado a este pedido.
            </p>
          </>
        )}
        <span className={GROUP_LABEL}>Atribuição</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tenant.attributions.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={a === attribution}
              onClick={() => {
                setAttribution(a);
                setActId(actsOfAttribution(tenant, a)[0]?.id ?? "");
              }}
              className={cn(
                buttonVariants({
                  variant: a === attribution ? "default" : "outline",
                }),
                "w-full",
                a !== attribution && "text-muted-foreground",
              )}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <Label className="mb-2" htmlFor="actId">
            Ato
          </Label>
          <NativeSelect
            id="actId"
            name="actId"
            value={actId}
            onChange={(event) => setActId(event.target.value)}
            className="w-full"
          >
            {acts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-2" htmlFor="applicantName">
              Nome do solicitante
            </Label>
            <Input
              id="applicantName"
              name="applicantName"
              defaultValue={fromConversation?.name}
            />
            <FieldError message={fieldErrors.applicantName} />
          </div>
          <div>
            <Label className="mb-2" htmlFor="cpf">
              CPF
              {act?.consultation && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · opcional na busca
                </span>
              )}
            </Label>
            {/* Remounted on the toggle: a number left behind in the disabled
                field would read as if it were being filed. */}
            <Input
              key={noCpf ? "no-cpf" : "cpf"}
              id="cpf"
              name="cpf"
              placeholder="000.000.000-00"
              disabled={noCpf}
              className="disabled:bg-muted"
            />
            <FieldError message={fieldErrors.cpf} />
            <AlternateDocumentFields
              checked={noCpf}
              onCheckedChange={setNoCpf}
              typeError={fieldErrors.alternateDocumentType}
              numberError={fieldErrors.alternateDocumentNumber}
            />
          </div>
          <div>
            <Label className="mb-2" htmlFor="contact">
              E-mail ou WhatsApp
            </Label>
            <Input
              id="contact"
              name="contact"
              defaultValue={fromConversation?.contact}
              placeholder="Para avisar sobre o andamento"
            />
            <FieldError message={fieldErrors.contact} />
            <p className="mt-1 text-xs leading-snug text-admin-muted">
              Com e-mail, o cliente recebe o protocolo, a chave de acesso e o
              passo a passo para acompanhar o pedido.
            </p>
          </div>
          <div>
            <Label className="mb-2" htmlFor="amount">
              Valor (se já souber)
            </Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="Pode informar depois"
            />
          </div>
        </div>

        {act?.variants && (
          <div className="mt-4">
            {/* Keyed so that changing the act discards the kind chosen. */}
            <ManualVariantField
              key={act.id}
              variants={act.variants}
              value={variantId ?? ""}
              error={fieldErrors.actVariant}
              onChange={(id) => setChosenVariant({ actId: act.id, id })}
            />
          </div>
        )}

        {/* Chaves com sufixo: este campo e o bloco de quem pede são irmãos, e a
            mesma chave nos dois fazia o React confundir um com o outro. */}
        {act?.deliveryChoice && (
          <ManualDeliveryFormatField
            key={`${act.id}-delivery`}
            error={fieldErrors.deliveryFormat}
          />
        )}

        {/* Na gratuidade, o campo vem dentro do bloco, depois do tipo de
            certidão que o decide. */}
        {purposeAsked && !exemptionTargets && (
          <div className="mt-4">
            <ManualPurposeField error={fieldErrors.purpose} />
          </div>
        )}

        {act && asksRequesterQualification(act, variantId) && (
          <ManualRequesterQualificationFields
            key={`${act.id}-qualification`}
            fieldErrors={fieldErrors}
          />
        )}

        <div className="mt-4">
          <Label className="mb-2" htmlFor="description">
            Discrimine sua solicitação
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            maxLength={LONG_TEXT_MAX}
            placeholder="Detalhes do pedido, documentos já entregues em mãos…"
          />
          <FieldError message={fieldErrors.description} />
        </div>

        {exemptionTargets && (
          <div className="mt-4 flex flex-col gap-4 rounded-lg bg-muted/50 p-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-foreground">
                Para qual ato é a gratuidade?
              </legend>
              {exemptionTargets.map((option) => (
                <label key={option.id} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="exemptionActId"
                    value={option.id}
                    checked={exemptionActId === option.id}
                    onChange={() => {
                      setExemptionActId(option.id);
                      setChosenVariant(undefined);
                    }}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm text-foreground">
                    {option.name}
                    <span className="block text-xs text-muted-foreground">
                      {option.feeExemption?.legalBasis}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <FieldError message={fieldErrors.exemptionActId} />

            {exemptionTarget?.variants && (
              <div className="border-t pt-3">
                {/* Controlado: no inteiro teor, o óbito não pede o motivo. */}
                <ManualVariantField
                  key={exemptionTarget.id}
                  variants={exemptionTarget.variants}
                  value={variantId ?? ""}
                  error={fieldErrors.actVariant}
                  onChange={(id) =>
                    act && setChosenVariant({ actId: act.id, id })
                  }
                />
              </div>
            )}

            {exemptionTarget?.feeExemption?.askCertificateType && (
              <fieldset className="flex flex-col gap-2 border-t pt-3">
                <legend className="mb-1 text-sm font-medium text-foreground">
                  Que tipo de certidão?
                </legend>
                <div className="flex flex-wrap gap-3">
                  {CERTIFICATE_TYPES.map((value) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="certificateType"
                        value={value}
                        checked={certificateType === value}
                        onChange={() =>
                          setChosenCertificateType({
                            key: certificateKey,
                            value,
                          })
                        }
                        className="size-4 accent-primary"
                      />
                      <span className="text-sm text-foreground">
                        {CERTIFICATE_TYPE_LABELS[value]}
                      </span>
                    </label>
                  ))}
                </div>
                <FieldError message={fieldErrors.certificateType} />
              </fieldset>
            )}

            {purposeAsked && (
              <div className="border-t pt-3">
                <ManualPurposeField error={fieldErrors.purpose} />
              </div>
            )}

            {exemptionTarget && (
              <div className="border-t pt-3">
                <ManualBeneficiaryFields
                  index={0}
                  fieldErrors={fieldErrors}
                  heading={
                    exemptionTarget.feeExemption?.beneficiaryCount === 2
                      ? "Primeiro nubente"
                      : undefined
                  }
                />
              </div>
            )}
            {exemptionTarget?.feeExemption?.beneficiaryCount === 2 && (
              <div className="border-t pt-3">
                <ManualBeneficiaryFields
                  index={1}
                  fieldErrors={fieldErrors}
                  heading="Segundo nubente"
                />
              </div>
            )}

            <div className="border-t pt-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="exemptionDeclaration"
                  className="checkbox-admin mt-0.5 shrink-0"
                />
                <span className="text-sm leading-relaxed text-foreground">
                  {FEE_EXEMPTION_DECLARATION} Declaro, ainda, ciência de que:
                </span>
              </label>
              <ul className="mt-1.5 ml-7 flex list-disc flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                {FEE_EXEMPTION_ACKNOWLEDGEMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <FieldError message={fieldErrors.exemptionDeclaration} />
            </div>

            <a
              href="/solicitar/declaracao-hipossuficiencia"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-primary underline underline-offset-4"
            >
              Formulário em branco do Anexo I (PDF), para entregar
            </a>
          </div>
        )}

        <label className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
          <input
            type="checkbox"
            name="counter"
            defaultChecked
            className="checkbox-admin"
          />
          <span className="text-sm text-foreground">
            Pedido recebido presencialmente no balcão: documentos já estão em
            mãos da serventia.
          </span>
        </label>

        {state.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
          >
            {state.message}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Registrando…" : "Registrar pedido"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Gera o protocolo REQ e a chave de acesso, como no site público.
          </span>
        </div>
      </form>
    </>
  );
}

type SuccessState = Extract<ManualEntryState, { status: "success" }>;

/** One of the documents the counter prints, as data. */
interface Printable {
  key: "requerimento" | "comprovante" | "declaracao" | "protocolo";
  title: string;
  /** How the action button names it when it is the only one ticked. */
  short: string;
  tag: string;
  /** Tags read as opposites on purpose: one stays, one leaves. */
  tagTone: "stays" | "leaves";
  icon: "file" | "lock";
  description: string;
  /** Appended to `printHref` as a query string, for a document other than
   * the requerimento itself: the same GET route answers both, picked by
   * `documento` (see `pedidos/[protocolo]/imprimir/route.ts`). */
  query?: string;
}

const BASE_PRINTABLES: Printable[] = [
  {
    key: "requerimento",
    title: "Requerimento",
    short: "o requerimento",
    tag: "Fica na serventia",
    tagTone: "stays",
    icon: "file",
    description:
      "O requerente assina e a folha vai para o arquivo. Não contém a chave, " +
      "por isso pode ser reimpresso depois, pelo detalhe do pedido.",
  },
  {
    key: "comprovante",
    title: "Comprovante de acesso",
    short: "o comprovante",
    tag: "Vai com o cidadão",
    tagTone: "leaves",
    icon: "lock",
    description:
      "Confidencial, só para o requerente: a única folha com a chave. Só " +
      "sai enquanto esta tela estiver aberta: depois, apenas emitindo uma " +
      "chave nova, o que invalida esta.",
  },
  {
    key: "protocolo",
    title: "Comprovante de apresentação",
    short: "o comprovante de apresentação",
    tag: "Pode ser compartilhado",
    tagTone: "leaves",
    icon: "file",
    description:
      "Prova ao banco ou ao órgão que o pedido foi protocolado: quem, o " +
      "quê, quando e os documentos. Sem a chave, não movimenta o pedido; " +
      "pode ser reimpresso depois, pelo detalhe do pedido.",
  },
];

/** `BASE_PRINTABLES`, plus a third document only when the pedido has
 * gratuidade: not every andamento gera este arquivo, então oferecê-lo
 * incondicionalmente prometeria uma impressão vazia. It sits between the two,
 * next to the requerimento it is signed with, in the same order the combined
 * PDF comes out (`COUNTER_DOCUMENTS` in the imprimir route). */
function printablesFor(hasExemption: boolean): Printable[] {
  if (!hasExemption) return BASE_PRINTABLES;
  const [requerimento, comprovante, protocolo] = BASE_PRINTABLES;
  return [
    requerimento,
    {
      key: "declaracao",
      title: "Declaração de hipossuficiência",
      short: "a declaração",
      tag: "Fica na serventia",
      tagTone: "stays",
      icon: "file",
      description:
        "O Anexo I do Provimento CGJ/TJRN n. 7/2026, preenchido com o que " +
        "foi coletado aqui. Vai junto com o requerimento para o requerente " +
        "assinar.",
    },
    comprovante,
    protocolo,
  ];
}

/** The action button's words for what is ticked: "Imprimir os dois",
 * "Baixar o comprovante", "Imprimir os 2 marcados". */
function emitLabel(
  verb: "Imprimir" | "Baixar",
  chosen: Printable[],
  total: number,
): string {
  if (chosen.length === 0) return verb;
  if (chosen.length === 1) return `${verb} ${chosen[0].short}`;
  if (chosen.length === total) {
    return `${verb} ${total === 2 ? "os dois" : total === 3 ? "os três" : `os ${total}`}`;
  }
  return `${verb} os ${chosen.length} marcados`;
}

/** Protocol or key, as a labelled block with its own copy button. */
function CredentialBlock({
  label,
  value,
  note,
  guarded,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  note: string;
  /** The key: framed as a credential, not as a second protocol. */
  guarded?: boolean;
  /** Absent while idle; carries whether the clipboard actually took it. */
  copied?: { ok: boolean };
  onCopy: () => void;
}) {
  return (
    <div
      className={
        guarded
          ? "flex-1 rounded-lg border border-warning/30 bg-warning-soft p-4"
          : "flex-1 rounded-lg border bg-muted/50 p-4"
      }
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {guarded && <AdminIcon name="lock" className="size-3" />}
        {label}
      </span>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-lg font-semibold tracking-wider text-foreground">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onCopy}
          aria-label={`Copiar ${label.toLowerCase()}`}
          className="shrink-0"
        >
          <AdminIcon
            name={copied?.ok ? "check" : "copy"}
            className="size-3.5"
            strokeWidth={2}
          />
        </Button>
      </div>
      {/* The note gives way to the copy result, so success and failure land
          in the same spot the eye is already on, instead of a toast the
          operator may never look at. */}
      {copied ? (
        <output
          className={`mt-1.5 block text-xs leading-snug font-medium ${
            copied.ok ? "text-success-text" : "text-destructive"
          }`}
        >
          {copied.ok
            ? "Copiado."
            : "O navegador recusou o acesso à área de transferência. Selecione e copie à mão."}
        </output>
      ) : (
        <p
          className={`mt-1.5 text-xs leading-snug ${
            guarded ? "text-warning-text" : "text-muted-foreground"
          }`}
        >
          {note}
        </p>
      )}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 block text-sm text-foreground">{value}</span>
    </div>
  );
}

function SuccessScreen({ state }: { state: SuccessState }) {
  const [copied, setCopied] = useState<{
    which: "protocolo" | "chave";
    ok: boolean;
  } | null>(null);
  const printHref = `/admin/pedidos/${encodeURIComponent(state.protocolNumber)}/imprimir`;
  const docs = printablesFor(state.hasExemption);
  // Everything ticked to start with: the usual counter visit emits it all,
  // and unticking is the exception (decision of 19/11/2026).
  const [selected, setSelected] = useState<Printable["key"][]>(() =>
    docs.map((doc) => doc.key),
  );
  const [emitted, setEmitted] = useState<
    Partial<Record<Printable["key"], EmitMode>>
  >({});
  const chosen = docs.filter((doc) => selected.includes(doc.key));
  const emittedCount = docs.filter((doc) => emitted[doc.key]).length;

  const receiptPrinted = Boolean(emitted.comprovante);
  const summary = [
    { label: "Contato", value: state.contact },
    ...(state.cpfLabel ? [{ label: "CPF", value: state.cpfLabel }] : []),
    ...(state.alternateDocument
      ? [
          {
            label: state.alternateDocument.label,
            value: state.alternateDocument.number,
          },
        ]
      : []),
    { label: "Atribuição", value: state.attributionLabel },
    ...(state.amountLabel
      ? [{ label: "Valor", value: state.amountLabel }]
      : []),
    {
      label: "Previsão",
      value: `até ${state.deadlineLabel} · por ordem de chegada`,
    },
  ];

  /**
   * Awaited and caught, never fired and forgotten: `writeText` rejects on a
   * denied permission or outside a secure context, and a check mark over a
   * clipboard that stayed empty is the worst kind of lie here. The operator
   * would walk away believing they had the key.
   */
  async function copy(which: "protocolo" | "chave") {
    const text = which === "protocolo" ? state.protocolNumber : state.accessKey;
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ which, ok: true });
    } catch {
      setCopied({ which, ok: false });
    }
    setTimeout(() => setCopied(null), 2500);
  }

  function toggle(key: Printable["key"], on: boolean) {
    setSelected((current) =>
      on
        ? docs
            .map((doc) => doc.key)
            .filter((k) => k === key || current.includes(k))
        : current.filter((k) => k !== key),
    );
  }

  /**
   * Marks the ticked documents as asked for, in the way they were asked.
   * Nothing on this side can know whether paper came out of a printer, so
   * the label says "enviado para impressão" and never "impresso": the honest
   * claim is the one the screen can back. Runs on the submit button's click,
   * before the browser sends the form; the form itself does the work.
   */
  function markEmitted(mode: EmitMode) {
    setEmitted((current) => {
      const next = { ...current };
      for (const doc of chosen) next[doc.key] = mode;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Inline and not a toast, only here: the operator is standing with the
          person, and this is the one moment a wrong address can be fixed by
          asking. A toast that fades while they read the protocol out loud
          would take the chance with it. */}
      {state.emailWarning ? (
        <p
          role="alert"
          className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm font-medium text-warning-text"
        >
          {state.emailWarning}
        </p>
      ) : state.contact && isEmailContact(state.contact) ? (
        <p className="flex items-start gap-2.5 rounded-xl bg-admin-success-bg px-4 py-3 text-sm text-admin-success-text">
          <AdminIcon
            name="mail"
            className="mt-0.5 h-4 w-4 flex-none"
            strokeWidth={2}
          />
          <span>
            Protocolo, chave de acesso e passo a passo enviados para{" "}
            <strong>{state.contact.trim()}</strong>, com o link que abre o
            acompanhamento já com o protocolo preenchido.
          </span>
        </p>
      ) : (
        <p className="rounded-xl bg-admin-warning-bg px-4 py-3 text-sm font-semibold text-admin-warning-text">
          Sem e-mail informado, nada foi enviado ao cliente. Entregue o
          comprovante impresso, que traz o protocolo e a chave de acesso.
        </p>
      )}
      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-full bg-success-soft">
            <AdminIcon
              name="check"
              className="size-4.5 text-success-text"
              strokeWidth={2.5}
            />
          </span>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-foreground">
              Pedido registrado
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {state.actName} ·{" "}
              <b className="font-semibold text-foreground">
                {state.applicantName}
              </b>{" "}
              · {state.filedAtLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <CredentialBlock
            label="Protocolo"
            value={state.protocolNumber}
            note="Público. Identifica o pedido e pode ser consultado e repetido sempre."
            copied={copied?.which === "protocolo" ? copied : undefined}
            onCopy={() => copy("protocolo")}
          />
          <CredentialBlock
            label="Chave de acesso"
            value={state.accessKey}
            note="Existe só nesta tela. O sistema guarda apenas uma versão cifrada: ao sair ou recarregar, ela não volta."
            guarded
            copied={copied?.which === "chave" ? copied : undefined}
            onCopy={() => copy("chave")}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          {summary.map((field) => (
            <SummaryField key={field.label} {...field} />
          ))}
        </div>
      </section>

      {/* One form, one submit, one PDF with every ticked document (decision
          of 19/11/2026). Two tabs from one click was the old way, and the
          browser blocked the second: only the receipt came out. A submit
          button is the strongest gesture there is, and the key travels in
          the body, never in a URL. */}
      <form
        method="post"
        action={printHref}
        target="_blank"
        rel="noopener"
        className="overflow-hidden rounded-xl border bg-card"
      >
        <input type="hidden" name="chave" value={state.accessKey} />
        {chosen.map((doc) => (
          <input key={doc.key} type="hidden" name="documento" value={doc.key} />
        ))}
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-semibold text-foreground">
              Emitir agora
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Marque o que quer emitir: sai um PDF só, na ordem abaixo. Cada
              emissão fica registrada na auditoria, com quem emitiu e quando.
            </p>
          </div>
          <Badge className="bg-muted text-muted-foreground tabular-nums">
            {emittedCount} de {docs.length}
          </Badge>
          <div className="flex flex-wrap gap-2 max-sm:w-full">
            <Button
              type="submit"
              name="modo"
              value="imprimir"
              disabled={chosen.length === 0}
              onClick={() => markEmitted("imprimir")}
              className="max-sm:flex-1"
            >
              <AdminIcon name="printer" className="size-4" strokeWidth={2} />
              {emitLabel("Imprimir", chosen, docs.length)}
            </Button>
            <Button
              type="submit"
              name="modo"
              value="baixar"
              variant="outline"
              disabled={chosen.length === 0}
              onClick={() => markEmitted("baixar")}
              className="max-sm:flex-1"
            >
              <AdminIcon name="download" className="size-4" strokeWidth={2} />
              {emitLabel("Baixar", chosen, docs.length)}
            </Button>
          </div>
        </div>

        {docs.map((doc) => (
          <PrintableRow
            key={doc.key}
            doc={doc}
            checked={selected.includes(doc.key)}
            emitted={emitted[doc.key]}
            onToggle={(on) => toggle(doc.key, on)}
          />
        ))}

        {/*
          The screen's one irreversible fact, kept where the exit is: leaving
          before the receipt is out costs the citizen their access, and no
          amount of copy elsewhere is read at the moment the operator reaches
          for "voltar à fila".
        */}
        <div
          className={`flex flex-wrap items-center gap-3 border-t px-5 py-3 ${
            receiptPrinted
              ? "bg-muted/50"
              : "border-warning bg-warning text-warning-foreground"
          }`}
        >
          <AdminIcon
            name={receiptPrinted ? "checkCircle" : "alert"}
            className={`size-4 flex-none ${
              receiptPrinted ? "text-success-text" : ""
            }`}
          />
          <span
            className={`min-w-0 flex-1 text-sm font-medium ${
              receiptPrinted ? "text-muted-foreground" : ""
            }`}
          >
            {receiptPrinted
              ? "O comprovante saiu. A chave pode ser esquecida com segurança."
              : "O comprovante ainda não saiu. Finalizar agora apaga a chave, e o cidadão fica sem acesso."}
          </span>
        </div>
      </form>

      {/* The way out of the wizard, and the only one: the pedido is already
          filed, so this closes the counter's turn rather than saving
          anything. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-muted-foreground">
          O pedido já está na fila. Isto encerra o atendimento no balcão.
        </span>
        <a href="/admin/pedidos" className={buttonVariants()}>
          Finalizar pedido
        </a>
      </div>
    </div>
  );
}

type EmitMode = "imprimir" | "baixar";

/**
 * One document's row: a tick to include it in the emission, and once it went
 * out, how (sent to the printer or saved). The whole row is the label, so a
 * click anywhere on it ticks or unticks.
 */
function PrintableRow({
  doc,
  checked,
  emitted,
  onToggle,
}: {
  doc: Printable;
  checked: boolean;
  emitted?: EmitMode;
  onToggle: (on: boolean) => void;
}) {
  const leaves = doc.tagTone === "leaves";
  const id = `emitir-${doc.key}`;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 border-t px-5 py-4 transition-colors hover:bg-muted/40",
        !checked && "opacity-70",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onToggle(value === true)}
        className="mt-2"
      />
      <span
        className={`mt-0.5 flex size-8 flex-none items-center justify-center rounded-md ${
          leaves ? "bg-warning-soft" : "bg-muted"
        }`}
      >
        <AdminIcon
          name={doc.icon}
          className={`size-4 ${leaves ? "text-warning-text" : "text-primary"}`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {doc.title}
          </span>
          <Badge
            className={
              leaves
                ? "border-warning/30 bg-warning-soft text-warning-text"
                : "border-success/30 bg-success-soft text-success-text"
            }
          >
            {doc.tag}
          </Badge>
          {emitted && (
            <span className="flex items-center gap-1 text-xs font-medium text-success-text">
              <AdminIcon name="check" className="size-3" strokeWidth={3} />
              {emitted === "baixar" ? "Baixado" : "Enviado para impressão"}
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs leading-snug text-muted-foreground">
          {doc.description}
        </span>
      </span>
    </label>
  );
}
