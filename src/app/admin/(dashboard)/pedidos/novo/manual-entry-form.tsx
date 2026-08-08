"use client";

import { useActionState, useState } from "react";
import { actsOfAttribution } from "@/core/acts/catalog.ts";
import type { Attribution, Tenant } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import {
  createManualServiceRequest,
  type ManualEntryState,
} from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
      {message}
    </p>
  );
}

export function ManualEntryForm({ tenant }: { tenant: Tenant }) {
  const [attribution, setAttribution] = useState<Attribution>(
    tenant.attributions[0],
  );
  const acts = actsOfAttribution(tenant, attribution);
  const [actId, setActId] = useState(acts[0]?.id ?? "");
  const act = acts.find((a) => a.id === actId) ?? acts[0];

  const [state, formAction, pending] = useActionState<
    ManualEntryState,
    FormData
  >(createManualServiceRequest, { status: "idle" });
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  if (state.status === "success") {
    return (
      <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
        <h3 className="font-serif text-[17px] font-semibold text-admin-primary">
          Pedido registrado
        </h3>
        <p className="mt-2 text-[13px] text-admin-muted">
          Protocolo e chave de acesso — mostrados só agora, guarde-os:
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-4 py-2.5 font-bold text-admin-primary">
            {state.protocolNumber}
          </div>
          <div className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-4 py-2.5 font-bold tracking-[0.15em] text-admin-primary">
            {state.accessKey}
          </div>
        </div>
        <a
          href="/admin/pedidos"
          className="mt-4 inline-block text-[12.5px] font-semibold text-admin-primary-soft underline"
        >
          Voltar à fila
        </a>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-[14px] border border-admin-border bg-admin-card p-6.5"
    >
      <span className="mb-3 block text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
        Atribuição
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tenant.attributions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAttribution(a);
              setActId(actsOfAttribution(tenant, a)[0]?.id ?? "");
            }}
            className={
              a === attribution
                ? "rounded-[9px] border-[1.5px] border-admin-primary-soft bg-admin-input-bg px-3 py-2 text-center text-[12.5px] font-bold text-admin-primary"
                : "rounded-[9px] border border-admin-border px-3 py-2 text-center text-[12.5px] font-semibold text-admin-muted"
            }
          >
            {a}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label className={LABEL_CLASS} htmlFor="actId">
          Ato
        </label>
        <div className="relative">
          <select
            id="actId"
            name="actId"
            value={actId}
            onChange={(event) => setActId(event.target.value)}
            className={`appearance-none pr-9 ${FIELD_CLASS}`}
          >
            {acts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <AdminIcon
            name="chevronDown"
            className="pointer-events-none absolute top-1/2 right-3.5 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
            strokeWidth={2}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="applicantName">
            Nome do solicitante
          </label>
          <input
            id="applicantName"
            name="applicantName"
            className={FIELD_CLASS}
          />
          <FieldError message={fieldErrors.applicantName} />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="cpf">
            CPF (opcional)
          </label>
          <input
            id="cpf"
            name="cpf"
            placeholder="000.000.000-00"
            className={FIELD_CLASS}
          />
          <FieldError message={fieldErrors.cpf} />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="contact">
            E-mail ou WhatsApp
          </label>
          <input
            id="contact"
            name="contact"
            placeholder="Para avisar sobre o andamento"
            className={FIELD_CLASS}
          />
          <FieldError message={fieldErrors.contact} />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="amount">
            Valor (se já souber)
          </label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="Pode informar depois"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {act?.requiresPurpose && (
        <div className="mt-3.5">
          <label className={LABEL_CLASS} htmlFor="purpose">
            Finalidade
          </label>
          <input id="purpose" name="purpose" className={FIELD_CLASS} />
          <FieldError message={fieldErrors.purpose} />
        </div>
      )}

      <div className="mt-3.5">
        <label className={LABEL_CLASS} htmlFor="description">
          Observações
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Detalhes do pedido, documentos já entregues em mãos…"
          className={FIELD_CLASS}
        />
        <FieldError message={fieldErrors.description} />
      </div>

      <label className="mt-4.5 flex items-center gap-2.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-3">
        <input
          type="checkbox"
          name="counter"
          defaultChecked
          className="h-[18px] w-[18px] accent-admin-primary-soft"
        />
        <span className="text-[12.5px] text-admin-text">
          Pedido recebido presencialmente no balcão — documentos já estão em
          mãos da serventia.
        </span>
      </label>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}

      <div className="mt-5.5 flex items-center gap-3.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[9px] bg-admin-primary-soft px-5.5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-70"
        >
          {pending ? "Registrando…" : "Registrar pedido"}
        </button>
        <span className="text-[12px] text-admin-faint">
          Gera o protocolo REQ e a chave de acesso, como no site público.
        </span>
      </div>
    </form>
  );
}
