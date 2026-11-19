"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CLOSING_LABELS,
  type ClosingMode,
  type ClosingStage,
  describeDocument,
  PICKUP_DOCUMENT_LABELS,
  PICKUP_DOCUMENT_TYPES,
  PICKUP_NAME_MAX,
  PICKUP_NOTE_MAX,
  PICKUP_RELATION_LABELS,
  PICKUP_RELATIONS,
  type PickupDocumentType,
  type PickupRecord,
  typedCpf,
} from "@/core/request/pickup.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { useEmailWarning } from "../../../../_components/use-email-warning.ts";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  type ActionState,
  closeDeliveryAction,
  registerPickupAction,
} from "../actions.ts";

const IDLE: ActionState = { status: "idle" };

/** "19/11, 14:05" in the office's time. */
const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: OFFICE_TIME_ZONE,
  }).format(new Date(iso));

/**
 * How a request ends once its final document is attached (decision of
 * 19/11/2026): the question "digital or counter", then, for the counter,
 * who came to pick it up. Closes the flow the delivery card used to leave
 * open.
 */
export function DeliveryClosing({
  requestId,
  stage,
  preferred,
  applicantName,
  pickup,
}: {
  requestId: string;
  stage: ClosingStage;
  /** What the applicant chose at filing, when the act asked: a hint, not a rule. */
  preferred: ClosingMode | null;
  applicantName: string;
  pickup: PickupRecord | null;
}) {
  if (stage === "none") return null;
  if (stage === "held") {
    return (
      <div className="rounded-xl border border-warning bg-warning-soft p-5 text-sm text-warning-text">
        O documento está retido, esperando a assinatura. Assine-o em "Entrega ao
        cidadão" para poder concluir o pedido.
      </div>
    );
  }
  if (stage === "picked-up" && pickup) {
    return <PickedUp pickup={pickup} />;
  }
  if (stage === "pickup") {
    return <PickupForm requestId={requestId} applicantName={applicantName} />;
  }
  return <Ask requestId={requestId} preferred={preferred} />;
}

function Ask({
  requestId,
  preferred,
}: {
  requestId: string;
  preferred: ClosingMode | null;
}) {
  const [state, action, pending] = useActionState(closeDeliveryAction, IDLE);
  useEmailWarning(state);
  const modeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
    if (state.status === "success") toast.success("Andamento atualizado.");
  }, [state]);
  const choose = (mode: ClosingMode) => {
    if (modeRef.current) modeRef.current.value = mode;
    formRef.current?.requestSubmit();
  };
  return (
    <section
      aria-labelledby="closing-title"
      className="rounded-xl border-2 border-primary bg-card p-6 motion-safe:animate-attention-pulse-light"
    >
      <h4
        id="closing-title"
        className="text-base font-semibold text-foreground"
      >
        Documento anexado. Como este pedido termina?
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha para fechar o fluxo. O cidadão é avisado por e-mail em qualquer
        das duas.
        {preferred
          ? ` O solicitante pediu: ${preferred === "digital" ? "entrega digital" : "retirada no balcão"}.`
          : ""}
      </p>
      <form ref={formRef} action={action} className="mt-4">
        <input type="hidden" name="requestId" value={requestId} />
        <input ref={modeRef} type="hidden" name="mode" defaultValue="" />
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={pending}
            variant={preferred === "counter" ? "outline" : "default"}
            onClick={() => choose("digital")}
          >
            {CLOSING_LABELS.digital}
          </Button>
          <Button
            type="button"
            disabled={pending}
            variant={preferred === "counter" ? "default" : "outline"}
            onClick={() => choose("counter")}
          >
            {CLOSING_LABELS.counter}
          </Button>
        </div>
      </form>
    </section>
  );
}

function PickupForm({
  requestId,
  applicantName,
}: {
  requestId: string;
  applicantName: string;
}) {
  const [state, action, pending] = useActionState(registerPickupAction, IDLE);
  useEmailWarning(state);
  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
    if (state.status === "success") toast.success("Retirada registrada.");
  }, [state]);
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [relation, setRelation] = useState<string>("applicant");
  const [docType, setDocType] = useState<PickupDocumentType>("cpf");
  const [name, setName] = useState(applicantName);
  const [docNumber, setDocNumber] = useState("");
  return (
    <section
      aria-labelledby="pickup-title"
      className="rounded-xl border-2 border-primary bg-card p-6"
    >
      <h4 id="pickup-title" className="text-base font-semibold text-foreground">
        Aguardando retirada no balcão
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Quando a pessoa chegar, confira o documento dela e registre quem
        retirou. Salvar conclui o pedido.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="requestId" value={requestId} />
        <div className="grid gap-3 md:grid-cols-2">
          <label
            htmlFor={id("relation")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Quem retirou
            <NativeSelect
              id={id("relation")}
              name="relation"
              value={relation}
              onChange={(e) => {
                setRelation(e.target.value);
                if (e.target.value === "applicant" && !name) {
                  setName(applicantName);
                }
              }}
              className="font-normal"
            >
              {PICKUP_RELATIONS.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {PICKUP_RELATION_LABELS[r]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label
            htmlFor={id("name")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Nome completo
            <Input
              id={id("name")}
              name="personName"
              required
              maxLength={PICKUP_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className="font-normal"
            />
          </label>
          <label
            htmlFor={id("doctype")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Documento apresentado
            <NativeSelect
              id={id("doctype")}
              name="documentType"
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value as PickupDocumentType);
                setDocNumber("");
              }}
              className="font-normal"
            >
              {PICKUP_DOCUMENT_TYPES.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {PICKUP_DOCUMENT_LABELS[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label
            htmlFor={id("doc")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Número do documento
            <Input
              id={id("doc")}
              name="documentNumber"
              required
              maxLength={30}
              inputMode={docType === "cpf" ? "numeric" : "text"}
              value={docType === "cpf" ? typedCpf(docNumber) : docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              autoComplete="off"
              className="font-normal"
            />
          </label>
        </div>
        <label
          htmlFor={id("note")}
          className="flex flex-col gap-1 text-sm font-medium"
        >
          Observação (opcional)
          <Textarea
            id={id("note")}
            name="note"
            rows={2}
            maxLength={PICKUP_NOTE_MAX}
            placeholder="Ex.: apresentou procuração; conferido o original"
            className="font-normal"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          O dia e a hora são os de agora. O número do documento fica guardado
          como prova da entrega e não aparece para o cidadão.
        </p>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Registrando…" : "Registrar a retirada e concluir"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function PickedUp({ pickup }: { pickup: PickupRecord }) {
  return (
    <section
      aria-labelledby="picked-title"
      className="rounded-xl border bg-card p-6"
    >
      <h4 id="picked-title" className="text-base font-semibold text-foreground">
        Retirada registrada
      </h4>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Quem retirou
          </dt>
          <dd className="text-foreground">
            {pickup.personName} ({PICKUP_RELATION_LABELS[pickup.relation]})
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Documento
          </dt>
          <dd className="text-foreground">
            {describeDocument(pickup.documentType, pickup.documentNumber)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Quando</dt>
          <dd className="text-foreground">{when(pickup.pickedUpAt)}</dd>
        </div>
        {pickup.note && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Observação
            </dt>
            <dd className="text-foreground [overflow-wrap:anywhere]">
              {pickup.note}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
