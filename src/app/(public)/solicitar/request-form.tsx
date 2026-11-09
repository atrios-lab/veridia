"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  type UseFormRegister,
  type UseFormRegisterReturn,
  type UseFormWatch,
  useForm,
} from "react-hook-form";
import type { Act, ActVariants } from "@/core/acts/catalog.ts";
import {
  ATTRIBUTION_SHORT_NAMES,
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_TYPES,
  FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  FEE_EXEMPTION_DECLARATION,
  PURPOSE_HINT,
  PURPOSE_LABEL,
  PURPOSE_PLACEHOLDER,
  REQUESTER_QUALIFICATION_NOTICE,
} from "@/core/acts/catalog.ts";
import { MAX_ATTACHMENTS } from "@/core/request/attachment.ts";
import { DEADLINE_CAVEAT } from "@/core/request/deadline.ts";
import {
  formatCpf,
  formatPhone,
  publicServiceRequestSchema,
  REQUESTER_QUALIFICATION_FIELDS,
} from "@/core/request/form.ts";
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
import { SIGNED_FORM_REQUIRED_NOTICE } from "@/core/request/requerimento.ts";
import type { Attribution } from "@/core/tenant/schema.ts";
import { DemoFormNotice } from "../_components/demo-notice.tsx";
import { Icon } from "../_components/icon.tsx";
import { ProtocolReveal } from "../_components/protocol-reveal.tsx";
import { SignedFormUpload } from "../_components/signed-form-upload.tsx";
import {
  ATTACHMENT_ACCEPT,
  useAttachmentUpload,
  validateAttachments,
} from "../_lib/attachments.tsx";
import { withMask } from "../_lib/mask.ts";
import { ProcessingBadge } from "./_components/badges.tsx";
import { DuplicateRequestDialog } from "./_components/duplicate-dialog.tsx";
import {
  type SubmitState,
  type SubmitSuccess,
  submitServiceRequest,
} from "./actions.ts";

const PARAMETER_LABELS = {
  transactionValue: "Valor da transação ou do documento",
  registryYears: "Há quantos anos o registro foi feito",
} as const;

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

/** Which of the kinds the act groups, same shape as the agenda's selects. */
function ActVariantField({
  variants,
  registration,
  error,
}: {
  variants: ActVariants;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  if (variants.listed) {
    return (
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-semibold">
          {variants.question}
        </legend>
        <div className="flex flex-col gap-2">
          {variants.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm has-[:checked]:border-brand-accent"
            >
              <input
                type="radio"
                value={option.id}
                className="h-4 w-4 accent-brand-accent"
                {...registration}
              />
              {option.name}
            </label>
          ))}
        </div>
        <FieldError message={error} />
      </fieldset>
    );
  }
  return (
    <div>
      <label
        htmlFor="actVariant"
        className="mb-1.5 block text-[13px] font-semibold"
      >
        {variants.question}
      </label>
      <select
        id="actVariant"
        className={inputClass}
        defaultValue=""
        {...registration}
      >
        <option value="" disabled>
          Escolha uma opção
        </option>
        {variants.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

/**
 * Quem pede o inteiro teor do RCPN. Só aparece com um registro escolhido, e nunca
 * no óbito. A finalidade fica de fora porque o campo já existe logo abaixo.
 */
function RequesterQualificationFields({
  register,
  role,
  errorFor,
}: {
  // The form's values depend on the act, like the block further down.
  // biome-ignore lint/suspicious/noExplicitAny: see the comment above.
  register: UseFormRegister<any>;
  role?: string;
  errorFor: (name: string) => string | undefined;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-brand-border bg-brand-card p-4">
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">
          Quem está pedindo?
        </legend>
        <div className="flex flex-col gap-1.5">
          {REQUESTER_ROLES.map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                value={value}
                className="h-4 w-4 accent-brand-accent"
                {...register("requesterRole")}
              />
              <span className="text-[13px] text-brand-text-soft">
                {REQUESTER_ROLE_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errorFor("requesterRole")} />
      </fieldset>

      {role === "attorney" && (
        <div>
          <label
            htmlFor="representedName"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            Nome de quem você representa
          </label>
          <input
            id="representedName"
            className={inputClass}
            {...register("representedName")}
          />
          <FieldError message={errorFor("representedName")} />
          {/* Cor cheia, não nota de rodapé: sem o mandato o pedido costuma
              voltar em exigência, e a nota miúda passava despercebida. */}
          <div
            role="note"
            className="mt-2.5 flex items-start gap-2.5 rounded-xl bg-brand-primary px-3.5 py-3 text-white"
          >
            <Icon
              name="alert"
              className="mt-0.5 h-4.5 w-4.5 shrink-0"
              strokeWidth={2}
            />
            <p className="text-[13px] leading-snug">
              <strong className="font-bold">
                Anexe o mandato (procuração).
              </strong>{" "}
              Junte o arquivo em "Anexar arquivos", mais abaixo. Sem ele, a
              serventia pode recusar o pedido ou pedir o documento depois.
            </p>
          </div>
        </div>
      )}

      {role && role !== "self" && (
        <div>
          <label
            htmlFor="kinship"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            Grau de parentesco com a pessoa registrada
            <span className="font-normal text-brand-muted"> · se houver</span>
          </label>
          <input id="kinship" className={inputClass} {...register("kinship")} />
          <FieldError message={errorFor("kinship")} />
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">
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
                value={value}
                className="h-4 w-4 accent-brand-accent"
                {...register("registrantDeceased")}
              />
              <span className="text-[13px] text-brand-text-soft">{label}</span>
            </label>
          ))}
        </div>
        <FieldError message={errorFor("registrantDeceased")} />
      </fieldset>

      <div className="flex items-start gap-2.5 rounded-xl bg-brand-accent-soft px-3.5 py-3">
        <Icon
          name="info"
          className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent-ink"
          strokeWidth={2}
        />
        <p className="text-[11.5px] leading-relaxed text-brand-accent-ink">
          {REQUESTER_QUALIFICATION_NOTICE}
        </p>
      </div>
    </div>
  );
}

/**
 * O motivo do pedido, no inteiro teor e nos poucos atos que a lei deixa
 * perguntar. Quem decide se aparece é `asksPurpose`: a certidão resumida nunca
 * renderiza o campo (Lei 6.015 art. 17).
 */
function PurposeField({
  registration,
  error,
}: {
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor="purpose"
        className="mb-1.5 block text-[13px] font-semibold"
      >
        {PURPOSE_LABEL}
      </label>
      <textarea
        id="purpose"
        rows={2}
        maxLength={500}
        className={inputClass}
        placeholder={PURPOSE_PLACEHOLDER}
        aria-describedby="purpose-hint"
        {...registration}
      />
      <p id="purpose-hint" className="mt-1.5 text-[11px] text-brand-faint">
        {PURPOSE_HINT}
      </p>
      <FieldError message={error} />
    </div>
  );
}

/** Digital pelo site ou papel no balcão, nos atos que deixam escolher. */
function DeliveryFormatField({
  registration,
  error,
}: {
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold">
        Como quer receber a certidão?
      </legend>
      <div className="flex flex-col gap-1.5">
        {DELIVERY_FORMATS.map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              value={value}
              className="h-4 w-4 accent-brand-accent"
              {...registration}
            />
            <span className="text-[13px] text-brand-text-soft">
              {DELIVERY_FORMAT_LABELS[value]}
            </span>
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

function DocumentsChecklist({ documents }: { documents: string[] }) {
  return (
    <ul className="mt-2.5 flex flex-col gap-2">
      {documents.map((document) => (
        <li
          key={document}
          className="flex items-center gap-2 text-[12.5px] text-brand-text-soft"
        >
          <span className="h-4 w-4 shrink-0 rounded border-[1.5px] border-brand-border" />
          {document}
        </li>
      ))}
    </ul>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-brand-alert">{message}</p>
  );
}

const SIGNED_BY_LABELS: Record<ExemptionSignedBy, string> = {
  self: "A própria pessoa beneficiária",
  "legal-representative": "Representante legal",
  "on-behalf": "Assinatura a rogo (não sabe ou não pode assinar)",
};

const smallInputClass =
  "w-full rounded-lg border border-brand-border bg-brand-card px-3 py-2.5 text-[13px] text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

/**
 * One beneficiary's declaration (Provimento CGJ/TJRN n. 7/2026, art. 4º):
 * only the name is required online, the rest of the Anexo I bloco 2 is
 * optional and prints blank for the person to fill by hand. `index` is the
 * position among however many the act's `beneficiaryCount` asks for: 0 for
 * every act but the habilitação de casamento, which also renders a 1.
 */
function BeneficiaryFields({
  index,
  register,
  watch,
  errorFor,
  heading,
}: {
  index: number;
  /** The form's schema shape varies per act (exemption fields only exist on
   * the gratuidade entry), so this component takes whatever `useForm`
   * produced for it rather than re-declaring that union here. */
  // biome-ignore lint/suspicious/noExplicitAny: see the comment above.
  register: UseFormRegister<any>;
  // biome-ignore lint/suspicious/noExplicitAny: see register above.
  watch: UseFormWatch<any>;
  errorFor: (path: string) => string | undefined;
  heading?: string;
}) {
  const prefix = `beneficiaries.${index}`;
  const signedBy =
    (watch(`${prefix}.signedBy`) as ExemptionSignedBy | undefined) ?? "self";
  return (
    <div className="flex flex-col gap-2.5">
      {heading && (
        <p className="text-[13px] font-bold text-brand-primary">{heading}</p>
      )}
      <div>
        <label
          htmlFor={`${prefix}.name`}
          className="mb-1 block text-[12px] font-semibold text-brand-text-soft"
        >
          Nome completo da pessoa beneficiária
        </label>
        <input
          id={`${prefix}.name`}
          className={smallInputClass}
          {...register(`${prefix}.name`)}
        />
        <FieldError message={errorFor(`${prefix}.name`)} />
      </div>

      <details className="group rounded-lg border border-brand-border px-3 py-2.5">
        <summary className="cursor-pointer text-[12px] font-semibold text-brand-muted">
          Mais dados da pessoa beneficiária (opcional)
        </summary>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <input
            placeholder="CPF ou RG"
            className={smallInputClass}
            {...register(`${prefix}.cpfOrId`)}
          />
          <input
            placeholder="Data de nascimento"
            className={smallInputClass}
            {...register(`${prefix}.birthDate`)}
          />
          <input
            placeholder="Profissão"
            className={smallInputClass}
            {...register(`${prefix}.occupation`)}
          />
          <input
            placeholder="Telefone ou e-mail"
            className={smallInputClass}
            {...register(`${prefix}.contact`)}
          />
          <input
            placeholder="Endereço"
            className={`${smallInputClass} sm:col-span-2`}
            {...register(`${prefix}.address`)}
          />
          <input
            placeholder="Município/UF"
            className={smallInputClass}
            {...register(`${prefix}.cityState`)}
          />
          <input
            placeholder="CEP"
            className={smallInputClass}
            {...register(`${prefix}.zip`)}
          />
        </div>
      </details>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-0.5 text-[12px] font-semibold text-brand-text-soft">
          Quem formaliza esta declaração?
        </legend>
        {EXEMPTION_SIGNED_BY.map((value) => (
          <label key={value} className="flex items-start gap-2">
            <input
              type="radio"
              value={value}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-primary"
              {...register(`${prefix}.signedBy`)}
            />
            <span className="text-[12.5px] text-brand-text">
              {SIGNED_BY_LABELS[value]}
            </span>
          </label>
        ))}
      </fieldset>

      {signedBy !== "self" && (
        <div className="rounded-lg bg-brand-accent-soft px-3 py-2.5">
          <p className="mb-2 text-[12px] font-semibold text-brand-accent-ink">
            Dados de quem assina em lugar da pessoa beneficiária
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              placeholder="Nome completo"
              className={smallInputClass}
              {...register(`${prefix}.signer.name`)}
            />
            <input
              placeholder="CPF ou RG"
              className={smallInputClass}
              {...register(`${prefix}.signer.cpfOrId`)}
            />
            <input
              placeholder="Telefone ou e-mail"
              className={smallInputClass}
              {...register(`${prefix}.signer.contact`)}
            />
            {signedBy === "legal-representative" && (
              <input
                placeholder="Qualidade (ex.: pai, tutor, curador)"
                className={smallInputClass}
                {...register(`${prefix}.signer.capacity`)}
              />
            )}
          </div>
          <FieldError message={errorFor(`${prefix}.signer.name`)} />
          {signedBy === "on-behalf" && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-brand-accent-ink">
              As duas testemunhas da assinatura a rogo assinam no balcão da
              serventia, junto com a pessoa que assina por aqui: não são pedidas
              neste formulário.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function RequestForm({
  act,
  attribution,
  lookupHref,
  prenotation,
}: {
  act: Act;
  attribution: Attribution;
  /** Where "Acompanhar pedido" sends the citizen after success: /acompanhar. */
  lookupHref: string;
  /** For a prenotação act: what it costs by the table in force, said before
   * the citizen sends; null when the table has no such item yet. */
  prenotation?: { headline: string; detail: string } | null;
}) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    submitServiceRequest,
    { status: "idle" },
  );
  // The native file input is visually hidden (the dashed box is the control),
  // so the feedback it used to give has to come from somewhere.
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The files go to the store before the form is sent, so the action never
  // carries them in its body (see ../_lib/attachments.tsx).
  const {
    send,
    uploading,
    error: attachmentError,
    setError: setAttachmentError,
  } = useAttachmentUpload(formAction);
  const sending = pending || uploading;

  // Opens on every fresh "duplicate" result, closable without touching the
  // rest of the form: the citizen may just change the act and resend.
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  useEffect(() => {
    if (state.status === "duplicate") setDuplicateOpen(true);
  }, [state]);

  // The form posts the input's own FileList, so it has to be rebuilt
  // whenever `attachments` changes, not just the state that renders the list.
  function syncAttachments(next: File[]) {
    setAttachments(next);
    const transfer = new DataTransfer();
    for (const file of next) transfer.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = transfer.files;
  }

  function removeAttachment(index: number) {
    setAttachmentError(undefined);
    syncAttachments(attachments.filter((_, i) => i !== index));
  }

  // A file picker's selection replaces itself each time it opens, so a
  // second pick would otherwise wipe out the first: add to what's already
  // there instead, capped at the limit the server also enforces.
  // Each file is judged on its own so one oversized photograph does not
  // throw away the four that were fine, and the refusal is said here rather
  // than after a minute of uploading on a phone connection.
  function addAttachments(selected: FileList | null) {
    if (!selected) return;
    const accepted: File[] = [];
    let problem: string | undefined;
    for (const file of selected) {
      const message = validateAttachments([file]);
      if (message) problem ??= message;
      else accepted.push(file);
    }
    const merged = [...attachments, ...accepted];
    setAttachmentError(problem ?? validateAttachments(merged));
    syncAttachments(merged.slice(0, MAX_ATTACHMENTS));
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: clientErrors },
  } = useForm({
    resolver: zodResolver(publicServiceRequestSchema(act)),
    mode: "onTouched",
  });
  const exemptionTargets = act.exemptionTargets;
  const exemptionActId = watch("exemptionActId") as string | undefined;
  const exemptionTarget = exemptionTargets?.find(
    (target) => target.id === exemptionActId,
  );
  // The gratuidade's act is only chosen below the description, so its kinds
  // are asked inside that block; every other act asks right above it.
  const variants = (exemptionTargets ? exemptionTarget : act)?.variants;
  const selectedVariant = variants?.options.find(
    (option) => option.id === (watch("actVariant") as string | undefined),
  );
  const descriptionRequired =
    act.requiresDescription || selectedVariant?.requiresDescription;
  const asksQualification = asksRequesterQualification(
    act,
    selectedVariant?.id,
  );
  const purposeAsked = asksPurpose(act, {
    variantId: selectedVariant?.id,
    exemptionActId,
    certificateType: watch("certificateType") as string | undefined,
  });

  // Esconder um campo não apaga o valor: quem preenche o bloco e troca para
  // óbito, ou do inteiro teor para a matrícula, ficaria preso num erro de um
  // campo que não vê mais, porque a validação daqui ainda lê o valor antigo.
  useEffect(() => {
    if (purposeAsked) return;
    setValue("purpose", "");
  }, [purposeAsked, setValue]);
  useEffect(() => {
    if (!act.requesterQualification || asksQualification) return;
    for (const field of REQUESTER_QUALIFICATION_FIELDS) {
      setValue(field, undefined);
    }
  }, [act.requesterQualification, asksQualification, setValue]);

  if (state.status === "success") {
    return <SuccessScreen result={state} lookupHref={lookupHref} />;
  }

  // The client catches what the schema can; the server can still refuse
  // (attachments, rate limit) and its per-field errors land here too. `name`
  // is a dotted path (`beneficiaries.0.signer.name`) for the gratuidade's
  // nested fields, and a plain key for everything else: `react-hook-form`
  // nests `clientErrors` the same way it nests `register`, and the server
  // builds `fieldErrors` with the same dotted keys (see `actions.ts`).
  const serverErrors = state.status === "error" ? state.fieldErrors : {};
  const errorFor = (name: string): string | undefined => {
    // Walking a dynamic path into react-hook-form's own error tree, whose
    // shape depends on the act.
    // biome-ignore lint/suspicious/noExplicitAny: see the comment above.
    let node: any = clientErrors;
    for (const segment of name.split(".")) node = node?.[segment];
    return (node?.message as string | undefined) ?? serverErrors[name];
  };

  // Validation gates the send; the untouched FormData (honeypot and
  // attachments included) still goes to the same server action.
  const onSubmit = handleSubmit((_data, event) => {
    void send(event?.target as HTMLFormElement, "anexos");
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-5 md:grid md:grid-cols-[1fr_340px] md:gap-9"
    >
      <input type="hidden" name="actId" value={act.id} />

      {duplicateOpen && state.status === "duplicate" && (
        <DuplicateRequestDialog
          protocolNumber={state.protocolNumber}
          onClose={() => setDuplicateOpen(false)}
        />
      )}

      {/* Off screen and out of the tab order: nobody using the site can reach
          it, so anything in it came from a script. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">Não preencha este campo</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-3.5">
        <ActContext act={act} attribution={attribution} className="md:hidden" />

        {/* Desktop pairs name and contact and narrows the CPF, as the
            redesign draws; on a phone everything stacks. */}
        <div className="grid gap-3.5 md:grid-cols-2">
          <div>
            <label
              htmlFor="applicantName"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              Nome completo
            </label>
            <input
              id="applicantName"
              autoComplete="name"
              className={inputClass}
              {...register("applicantName")}
            />
            <FieldError message={errorFor("applicantName")} />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              E-mail{" "}
              <span className="font-normal text-brand-muted">
                · para retorno
              </span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass}
              placeholder="voce@exemplo.com"
              {...register("email")}
            />
            <FieldError message={errorFor("email")} />
            {/* The way out for whoever has no address, said before the
                refusal rather than after it. */}
            <p className="mt-1.5 text-[11px] text-brand-faint">
              Sem e-mail? A serventia recebe o pedido no balcão.
            </p>
          </div>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2">
          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              Telefone{" "}
              <span className="font-normal text-brand-muted">· opcional</span>
            </label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="(84) 90000-0000"
              {...withMask(register("phone"), formatPhone)}
            />
            <FieldError message={errorFor("phone")} />
          </div>

          <div>
            <label
              htmlFor="cpf"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              CPF
              {act.consultation && (
                <span className="font-normal text-brand-muted">
                  {" "}
                  · opcional
                </span>
              )}
            </label>
            <input
              id="cpf"
              inputMode="numeric"
              className={inputClass}
              placeholder="000.000.000-00"
              {...withMask(register("cpf"), formatCpf)}
            />
            <FieldError message={errorFor("cpf")} />
            {/* Said before the refusal, same as the e-mail just above. The
                busca takes no CPF at all, so it has nothing to say there. */}
            {!act.consultation && (
              <p className="mt-1.5 text-[11px] text-brand-faint">
                Sem CPF? A serventia recebe o pedido no balcão.
              </p>
            )}
          </div>
        </div>

        {act.variants && (
          <ActVariantField
            variants={act.variants}
            registration={register("actVariant")}
            error={errorFor("actVariant")}
          />
        )}

        {act.deliveryChoice && (
          <DeliveryFormatField
            registration={register("deliveryFormat")}
            error={errorFor("deliveryFormat")}
          />
        )}

        <div>
          <label
            htmlFor="description"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            Descreva o que você precisa
            {!descriptionRequired && (
              <span className="font-normal text-brand-muted"> · opcional</span>
            )}
          </label>
          <textarea
            id="description"
            rows={4}
            className={inputClass}
            placeholder={
              act.descriptionPlaceholder ??
              "Ex.: queremos casar em outubro deste ano."
            }
            {...register("description")}
          />
          <p className="mt-1 text-[11.5px] text-brand-faint">
            O que você escrever entra no requerimento, com as suas palavras, na
            parte "Dos fatos".
          </p>
          <FieldError message={errorFor("description")} />
        </div>

        {asksQualification && (
          <RequesterQualificationFields
            register={register}
            role={watch("requesterRole") as string | undefined}
            errorFor={errorFor}
          />
        )}

        {/* A certidão resumida nunca pergunta (Lei 6.015 art. 17). Na
            gratuidade, o campo vem dentro do bloco, depois do tipo de
            certidão que o decide. */}
        {purposeAsked && !exemptionTargets && (
          <PurposeField
            registration={register("purpose")}
            error={errorFor("purpose")}
          />
        )}

        {act.parameter && (
          <div>
            <label
              htmlFor="parameterValue"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              {PARAMETER_LABELS[act.parameter]}
            </label>
            <input
              id="parameterValue"
              className={inputClass}
              {...register("parameterValue")}
            />
            <p className="mt-1.5 text-[11px] text-brand-faint">
              Serve para a serventia localizar a faixa correta na tabela de
              custas. O site não calcula valores.
            </p>
            <FieldError message={errorFor("parameterValue")} />
          </div>
        )}

        {/* On a phone the checklist sits with the upload; on desktop it moves
            to the sidebar, next to the act, the way the redesign draws it. */}
        <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
          <div className={act.documents ? "md:hidden" : undefined}>
            <div className="text-[13px] font-bold text-brand-primary">
              Documentos para este ato
            </div>
            {act.documents ? (
              <DocumentsChecklist documents={act.documents} />
            ) : (
              <p className="mt-2 text-[12.5px] text-brand-muted">
                Este ato não tem lista fixa. Anexe o que ajudar a serventia a
                entender o pedido.
              </p>
            )}
          </div>

          <label
            htmlFor="anexos"
            className={`block cursor-pointer rounded-xl border-[1.5px] border-dashed border-brand-border px-3 py-3.5 text-center hover:border-brand-accent has-[:focus-visible]:border-brand-accent ${act.documents ? "mt-3 md:mt-0" : "mt-3"}`}
          >
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-primary">
              <Icon name="plus" className="h-4 w-4 text-brand-accent" />
              <span className="md:hidden">Tirar foto ou anexar arquivo</span>
              <span className="hidden md:inline">
                Anexar arquivos{" "}
                <span className="font-normal text-brand-muted">
                  · até {MAX_ATTACHMENTS}, foto ou PDF
                </span>
              </span>
            </span>
            {/* Hidden, not gone: the dashed box is the visible control, and
                the input keeps working for keyboard, screen reader and the
                form post. */}
            <input
              ref={fileInputRef}
              id="anexos"
              name="anexos"
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              onChange={(event) => addAttachments(event.target.files)}
            />
          </label>
          {attachments.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-2">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${file.lastModified}`}
                  className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-card px-3 py-2"
                >
                  <Icon
                    name="file"
                    className="h-4 w-4 shrink-0 text-brand-accent"
                  />
                  <span className="flex-1 truncate text-[12.5px] text-brand-text">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-brand-faint">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="shrink-0 text-brand-faint hover:text-brand-alert"
                    aria-label={`Remover ${file.name}`}
                  >
                    <Icon name="x" className="h-4 w-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {attachmentError && (
            <output className="mt-2 block text-xs font-semibold text-brand-alert">
              {attachmentError}
            </output>
          )}
          <p className="mt-2 text-[11px] text-brand-faint">
            Até {MAX_ATTACHMENTS} arquivos (foto ou PDF). Pode enviar depois,
            pela consulta do protocolo.
          </p>
        </div>

        {act.chargesPrenotation && <PrenotationCard notice={prenotation} />}

        {act.guidance && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft px-3.5 py-3">
            <Icon
              name="info"
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent-ink"
              strokeWidth={2}
            />
            <p className="text-[12px] leading-relaxed text-brand-accent-ink">
              {act.guidance} O pedido enviado aqui adianta a análise.
            </p>
          </div>
        )}

        {/* Só no ato da gratuidade. Esconder não é o controle: o schema
            recusa o ato-alvo sem previsão legal, venha de onde vier. */}
        {exemptionTargets && (
          <div className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-brand-card p-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-semibold text-brand-primary">
                Para qual ato você pede a gratuidade?
              </legend>
              {exemptionTargets.map((option) => (
                <label key={option.id} className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    value={option.id}
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
                    {...register("exemptionActId", {
                      // Without `shouldUnregister` the value outlives its
                      // select, and the next act would refuse a stale kind.
                      onChange: () => setValue("actVariant", ""),
                    })}
                  />
                  <span className="text-[13px] text-brand-primary">
                    {option.name}
                    <span className="block text-[12px] text-brand-text-soft">
                      {option.feeExemption?.legalBasis}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <FieldError message={errorFor("exemptionActId")} />

            {exemptionTarget?.id === "rcpn-certidao" && (
              <p className="rounded-lg bg-brand-accent-soft px-3 py-2.5 text-[11.5px] leading-relaxed text-brand-accent-ink">
                O registro de nascimento e o assento de óbito, com a primeira
                certidão de cada um, já são gratuitos para qualquer pessoa, sem
                esta declaração (Lei 6.015 art. 30, caput).
              </p>
            )}

            {exemptionTarget?.variants && (
              <div className="border-t border-brand-border pt-3">
                <ActVariantField
                  key={exemptionTarget.id}
                  variants={exemptionTarget.variants}
                  registration={register("actVariant")}
                  error={errorFor("actVariant")}
                />
              </div>
            )}

            {exemptionTarget?.feeExemption?.askCertificateType && (
              <fieldset className="flex flex-col gap-2 border-t border-brand-border pt-3">
                <legend className="text-[12px] font-semibold text-brand-text-soft">
                  Que tipo de certidão você precisa?
                </legend>
                <div className="flex flex-wrap gap-3">
                  {CERTIFICATE_TYPES.map((value) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        value={value}
                        className="h-4 w-4 shrink-0 accent-brand-primary"
                        {...register("certificateType")}
                      />
                      <span className="text-[12.5px] text-brand-text">
                        {CERTIFICATE_TYPE_LABELS[value]}
                      </span>
                    </label>
                  ))}
                </div>
                <FieldError message={errorFor("certificateType")} />
              </fieldset>
            )}

            {purposeAsked && (
              <div className="border-t border-brand-border pt-3">
                <PurposeField
                  registration={register("purpose")}
                  error={errorFor("purpose")}
                />
              </div>
            )}

            {exemptionTarget && (
              <div className="border-t border-brand-border pt-3">
                <BeneficiaryFields
                  index={0}
                  register={register}
                  watch={watch}
                  errorFor={errorFor}
                  heading={
                    exemptionTarget.feeExemption?.beneficiaryCount === 2
                      ? "Primeiro nubente"
                      : undefined
                  }
                />
              </div>
            )}

            {exemptionTarget?.feeExemption?.beneficiaryCount === 2 && (
              <details className="rounded-lg border border-brand-border px-3 py-2.5">
                <summary className="cursor-pointer text-[13px] font-bold text-brand-primary">
                  Segundo nubente
                </summary>
                <div className="mt-3">
                  <BeneficiaryFields
                    index={1}
                    register={register}
                    watch={watch}
                    errorFor={errorFor}
                  />
                </div>
              </details>
            )}

            <div className="flex flex-col gap-2.5 border-t border-brand-border pt-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
                  {...register("exemptionDeclaration")}
                />
                <span className="text-[12px] leading-relaxed text-brand-text-soft">
                  {FEE_EXEMPTION_DECLARATION} Declaro, ainda, que estou ciente
                  de que:
                </span>
              </label>
              <ul className="ml-7 flex list-disc flex-col gap-1 text-[11.5px] leading-relaxed text-brand-text-soft">
                {FEE_EXEMPTION_ACKNOWLEDGEMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <FieldError message={errorFor("exemptionDeclaration")} />
            </div>

            <p className="text-[11.5px] text-brand-faint">
              Prefere preencher no papel?{" "}
              <Link
                href="/solicitar/declaracao-hipossuficiencia"
                target="_blank"
                className="font-semibold text-brand-accent-ink underline"
              >
                Baixe o formulário em branco (PDF)
              </Link>
              .
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
              {...register("lgpdConsent")}
            />
            <span className="text-[12px] leading-relaxed text-brand-text-soft">
              Autorizo o tratamento dos meus dados para a análise e a prática do
              ato (Lei 13.709/2018, LGPD).
            </span>
          </label>
          <FieldError message={errorFor("lgpdConsent")} />
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
              {...register("truthDeclaration")}
            />
            <span className="text-[12px] leading-relaxed text-brand-text-soft">
              Declaro, sob as penas da lei, que as informações são verdadeiras.
            </span>
          </label>
          <FieldError message={errorFor("truthDeclaration")} />
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
          >
            {state.message}
          </p>
        )}

        <DemoFormNotice />

        <div className="md:flex md:items-center md:gap-4">
          <button
            type="submit"
            disabled={sending}
            className="btn btn-primary btn-lg w-full md:w-auto md:shrink-0 md:px-7 md:py-3.5"
          >
            {sending ? "Enviando..." : "Enviar requerimento"}
          </button>
          <p className="mt-2 text-[11px] text-brand-faint md:mt-0 md:max-w-[40ch]">
            {act.chargesPrenotation
              ? "A prenotação é paga pela consulta do protocolo; os emolumentos do ato, na serventia, depois da análise."
              : "Pagamentos e emissão do ato acontecem na serventia."}{" "}
            Sem CAPTCHA: a proteção anti-robô é invisível.
          </p>
        </div>
      </div>

      <aside className="mt-6 flex flex-col gap-3.5 md:mt-0">
        <ActContext
          act={act}
          attribution={attribution}
          className="hidden md:block"
        />
        {act.documents && (
          <div className="hidden rounded-2xl border border-brand-border bg-brand-card p-4 md:block">
            <div className="text-[13px] font-bold text-brand-primary">
              Documentos para este ato
            </div>
            <DocumentsChecklist documents={act.documents} />
            <p className="mt-2.5 text-[11.5px] text-brand-faint">
              Pode anexar agora ou depois, pela consulta do protocolo.
            </p>
          </div>
        )}
        <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft px-3.5 py-3">
          <Icon
            name="info"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent-ink"
            strokeWidth={2}
          />
          <p className="text-[12px] leading-relaxed text-brand-accent-ink">
            Ao enviar, você recebe um <strong>protocolo</strong> e uma{" "}
            <strong>chave de acesso</strong>, mostrada uma única vez. É com eles
            que você acompanha o pedido.
          </p>
        </div>
      </aside>
    </form>
  );
}

function ActContext({
  act,
  attribution,
  className,
}: {
  act: Act;
  attribution: Attribution;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-l-4 border-brand-border border-l-brand-accent bg-brand-card p-3.5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex-1">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-accent-ink">
            {ATTRIBUTION_SHORT_NAMES[attribution]}
          </div>
          <div className="font-serif text-[15px] font-semibold text-brand-primary">
            {act.name}
          </div>
        </div>
        <Link
          href={`/solicitar?atribuicao=${attribution}`}
          className="btn btn-ghost btn-sm"
        >
          trocar
        </Link>
      </div>
      <div className="mt-2">
        <ProcessingBadge act={act} />
      </div>
    </div>
  );
}

/** The pair every download form has to carry, in a hidden field each. */
function ProtocolFields({ result }: { result: SubmitSuccess }) {
  return (
    <>
      <input
        type="hidden"
        name="protocolNumber"
        value={result.protocolNumber}
      />
      <input type="hidden" name="accessKey" value={result.accessKey} />
    </>
  );
}

/**
 * The prenotação's price, before sending and after: the value with the
 * table's code and name, and the sentence that keeps anyone from reading it
 * as the price of the registration.
 */
function PrenotationCard({
  notice,
  paid,
}: {
  notice?: { headline: string; detail: string } | null;
  paid?: boolean;
}) {
  return (
    <div className="rounded-2xl border-[1.5px] border-brand-accent-line bg-brand-card px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <Icon
          name="info"
          className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
          strokeWidth={2}
        />
        <div>
          <p className="text-[13.5px] font-bold text-brand-primary">
            {notice?.headline ??
              "Prenotação: o valor é informado pela serventia no protocolo"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-brand-muted">
            {notice?.detail ??
              "A prenotação é a entrada do título no protocolo para a análise. O valor sai da tabela de emolumentos vigente e aparece na consulta do protocolo."}
          </p>
          <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-brand-accent-ink">
            {paid
              ? "Pague pela consulta do protocolo e envie o requerimento assinado: a análise começa com os dois."
              : "Ao enviar, o valor da prenotação já fica no protocolo para pagamento, junto com o requerimento assinado."}
          </p>
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({
  result,
  lookupHref,
}: {
  result: SubmitSuccess;
  lookupHref: string;
}) {
  // The blink asks for one gesture, the download, and stops once it happens:
  // blinking forever would get in the way of reading the step (WCAG 2.2.2).
  // The red stays until the signed requerimento is actually in.
  const [requerimentoDownloaded, setRequerimentoDownloaded] = useState(false);
  const [requerimentoSent, setRequerimentoSent] = useState(false);

  return (
    <div className="mt-5 md:mx-auto md:max-w-3xl">
      <div className="rounded-t-2xl bg-brand-primary px-5 py-6 text-center">
        <span className="inline-flex h-13 w-13 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="check"
            className="h-6.5 w-6.5 text-brand-on-dark-accent"
            strokeWidth={2.4}
          />
        </span>
        <h1 className="mt-3 font-serif text-[23px] font-semibold text-white">
          Pedido registrado
        </h1>
        <p className="mt-1 text-[13px] text-brand-on-dark-body">
          {result.actName} · {result.attributionName}
        </p>
      </div>

      {/* The key is the loudest thing on the screen because this is the only
          moment it exists here. It also went to the citizen's own e-mail, so
          losing this tab is not losing the pedido: see
          `recoverAccessKeyAction` on the consult page for what happens if
          that message never arrives either. */}
      <ProtocolReveal
        protocolNumber={result.protocolNumber}
        accessKey={result.accessKey}
        className="rounded-b-2xl"
      >
        <strong className="text-brand-alert">A chave aparece só agora.</strong>{" "}
        Enviamos o protocolo e a chave também para{" "}
        <strong className="text-brand-primary">{result.email}</strong>. Se não
        chegar em alguns minutos, veja o spam ou baixe o comprovante abaixo.
      </ProtocolReveal>

      <ol className="mt-4 flex flex-col gap-2.5">
        <Step number={1} title="Guarde o protocolo e a chave">
          <p className="text-[12px] leading-relaxed text-brand-muted">
            Eles servem para consultar o andamento do pedido. A previsão de
            análise é até{" "}
            <strong className="text-brand-primary">
              {result.deadlineLabel}
            </strong>
            . {DEADLINE_CAVEAT}
          </p>
          {/* POST, not a link: the key would otherwise sit in the address
              bar, in the browser history and in every access log on the way. */}
          <form
            action="/solicitar/requerimento"
            method="post"
            target="_blank"
            rel="noopener"
            className="mt-2.5"
          >
            <ProtocolFields result={result} />
            <input type="hidden" name="documento" value="comprovante" />
            <button type="submit" className="btn btn-primary btn-md">
              <Icon name="download" className="h-3.5 w-3.5" strokeWidth={2} />
              Baixar comprovante (PDF)
            </button>
          </form>
        </Step>

        {result.prenotation && (
          <PrenotationCard notice={result.prenotation} paid />
        )}

        {/* A busca é só consulta: não há requerimento a assinar, e a resposta
            aparece na consulta do protocolo. */}
        {result.consultation && (
          <Step number={2} title="Aguarde a resposta da serventia">
            <p className="text-[12px] leading-relaxed text-brand-muted">
              A busca não pede requerimento assinado. A serventia procura o
              registro e responde na consulta do protocolo, e avisamos por
              e-mail. Se a serventia cobrar a busca, o valor aparece ali também.
              Se o registro constar e você quiser a certidão, faça um novo
              pedido no ato certo.
            </p>
          </Step>
        )}

        {!result.consultation && (
          <Step
            number={2}
            title="Baixe o requerimento e assine"
            emphasis={
              requerimentoSent
                ? undefined
                : requerimentoDownloaded
                  ? "alert"
                  : "blink"
            }
            band={
              requerimentoSent ? undefined : "Obrigatório para o pedido andar"
            }
          >
            {!requerimentoSent && (
              <p className="mb-1 text-[12px] font-semibold leading-relaxed text-brand-alert">
                {SIGNED_FORM_REQUIRED_NOTICE}
              </p>
            )}
            <p className="text-[12px] leading-relaxed text-brand-muted">
              Digitalmente pelo Gov.br (assinador.iti.br), ou imprima e assine
              de próprio punho.
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-brand-faint">
              {result.signatureCaveat}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <form
                action="/solicitar/requerimento"
                method="post"
                target="_blank"
                rel="noopener"
                onSubmit={() => setRequerimentoDownloaded(true)}
              >
                <ProtocolFields result={result} />
                <button type="submit" className="btn btn-primary btn-md">
                  <Icon
                    name="download"
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                  />
                  Baixar requerimento (PDF)
                </button>
              </form>
              {result.hasExemption && (
                <form
                  action="/solicitar/requerimento"
                  method="post"
                  target="_blank"
                  rel="noopener"
                >
                  <ProtocolFields result={result} />
                  <input type="hidden" name="documento" value="declaracao" />
                  <button type="submit" className="btn btn-secondary btn-md">
                    <Icon
                      name="download"
                      className="h-3.5 w-3.5"
                      strokeWidth={2}
                    />
                    Baixar declaração de hipossuficiência (PDF)
                  </button>
                </form>
              )}
            </div>
          </Step>
        )}

        {!result.consultation && (
          <Step
            number={3}
            title={
              result.hasExemption
                ? "Envie o requerimento e a declaração assinados"
                : "Envie o requerimento assinado"
            }
            emphasis={requerimentoSent ? undefined : "alert"}
          >
            <p className="text-[12px] leading-relaxed text-brand-muted">
              Pode ser agora, depois pela consulta do protocolo, ou em papel no
              balcão.
              {result.hasExemption &&
                " Se assinou os dois num arquivo só, envie como requerimento."}
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              <SignedFormUpload
                protocolNumber={result.protocolNumber}
                accessKey={result.accessKey}
                documento="requerimento"
                onSent={() => setRequerimentoSent(true)}
              />
              {result.hasExemption && (
                <SignedFormUpload
                  protocolNumber={result.protocolNumber}
                  accessKey={result.accessKey}
                  documento="declaracao"
                />
              )}
            </div>
          </Step>
        )}
      </ol>

      <div className="mt-4 flex gap-2.5">
        <Link
          href={`${lookupHref}?numero=${encodeURIComponent(result.protocolNumber)}`}
          className="btn btn-primary btn-lg flex-1"
        >
          Acompanhar pedido
        </Link>
        <Link href="/solicitar" className="btn btn-secondary btn-lg flex-1">
          Novo pedido
        </Link>
      </div>
    </div>
  );
}

const STEP_EMPHASIS = {
  alert: "border-2 border-brand-alert",
  blink:
    "border-2 border-brand-alert animate-signature-blink motion-reduce:animate-none",
};

function Step({
  number,
  title,
  emphasis,
  band,
  children,
}: {
  number: number;
  title: string;
  emphasis?: keyof typeof STEP_EMPHASIS;
  /** Solid strip over the step, saying in words what the red border says. */
  band?: string;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`overflow-hidden rounded-2xl bg-brand-card ${emphasis ? STEP_EMPHASIS[emphasis] : "border border-brand-border"}`}
    >
      {band && (
        <div className="bg-brand-alert px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          {band}
        </div>
      )}
      <div className="flex gap-3 p-3.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand-primary">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-brand-primary">
            {title}
          </div>
          {children}
        </div>
      </div>
    </li>
  );
}
