"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { PIX_KEY_TYPES, type PixKeyType } from "@/core/tenant/pix.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import {
  type PixKeyState,
  type PixKeyValues,
  removePixKey,
  savePixKey,
} from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

const TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className={LABEL_CLASS}>{label}</span>
      <p className="rounded-[9px] border border-admin-border bg-admin-readonly-bg px-3.5 py-2.5 text-[13.5px] text-admin-muted">
        {value}
      </p>
    </div>
  );
}

function ReadOnlyView({ tenant }: { tenant: Tenant }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          Chave Pix da serventia
        </h2>
        <span className="rounded-full bg-admin-warning-bg px-2.5 py-0.5 text-[11px] font-bold text-admin-warning-text">
          Somente leitura
        </span>
      </div>
      <div className="mt-4.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <ReadOnlyField
          label="Tipo"
          value={tenant.pix ? TYPE_LABELS[tenant.pix.type] : "Sem chave"}
        />
        <ReadOnlyField label="Chave" value={tenant.pix?.key ?? "Sem chave"} />
        <ReadOnlyField
          label="Cidade"
          value={tenant.pix?.city ?? "Sem cidade"}
        />
      </div>
      <p className="mt-3.5 text-xs leading-relaxed text-admin-muted">
        Quem responde pela serventia pode alterar a chave. A ausência do botão
        aqui é cortesia, a gravação é recusada no servidor de qualquer jeito.
      </p>
    </div>
  );
}

export function PixKeyForm({
  tenant,
  canEdit,
}: {
  tenant: Tenant;
  canEdit: boolean;
}) {
  const [saveState, saveAction, savePending] = useActionState<
    PixKeyState,
    FormData
  >(savePixKey, { status: "idle" });
  const [removeState, removeAction, removePending] = useActionState<
    PixKeyState,
    FormData
  >(removePixKey, { status: "idle" });

  useEffect(() => {
    if (removeState.status === "removed") toast.success("Chave Pix removida.");
  }, [removeState]);

  if (!canEdit) return <ReadOnlyView tenant={tenant} />;

  const fieldErrors = saveState.status === "error" ? saveState.fieldErrors : {};
  const sent: PixKeyValues | undefined =
    saveState.status === "error" ? saveState.values : undefined;
  const removed = removeState.status === "removed";
  const hasKey = Boolean(tenant.pix) && !removed;
  const hasCity = Boolean(tenant.pix?.city) && !removed;

  return (
    <div>
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Chave Pix da serventia
      </h2>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        É para esta chave que vai o dinheiro do cidadão. O sistema confere o
        formato, mas não tem como saber se a conta é da serventia: confira com
        atenção. O sistema também não fica sabendo quando o Pix cai: a
        conferência do recebimento continua sendo da serventia, pelo extrato.
      </p>

      {!hasKey && (
        <p className="mt-3.5 rounded-lg bg-admin-warning-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-admin-warning-text">
          Sem chave, a consulta de protocolo não mostra QR Code: o cidadão vê
          apenas o valor e a instrução de pagar no balcão.
        </p>
      )}
      {hasKey && !hasCity && (
        <p className="mt-3.5 rounded-lg bg-admin-warning-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-admin-warning-text">
          Falta a cidade para o QR Code aparecer: até preencher, a consulta de
          protocolo mostra só o valor e a instrução de pagar no balcão.
        </p>
      )}

      <form action={saveAction}>
        <div className="mt-4.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="type">
              Tipo da chave
            </label>
            <div className="relative">
              <select
                id="type"
                name="type"
                defaultValue={sent?.type ?? tenant.pix?.type ?? ""}
                aria-invalid={fieldErrors.type ? true : undefined}
                className={`appearance-none pr-9 ${fieldErrors.type ? ERROR_FIELD_CLASS : FIELD_CLASS}`}
              >
                <option value="" disabled>
                  Escolher…
                </option>
                {PIX_KEY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <AdminIcon
                name="chevronDown"
                className="pointer-events-none absolute top-1/2 right-3.5 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
                strokeWidth={2}
              />
            </div>
            {fieldErrors.type && (
              <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
                {fieldErrors.type}
              </p>
            )}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="key">
              Chave
            </label>
            <input
              id="key"
              name="key"
              type="text"
              defaultValue={sent?.key ?? tenant.pix?.key ?? ""}
              aria-invalid={fieldErrors.key ? true : undefined}
              aria-describedby={fieldErrors.key ? "key-erro" : undefined}
              className={fieldErrors.key ? ERROR_FIELD_CLASS : FIELD_CLASS}
            />
            {fieldErrors.key && (
              <p
                id="key-erro"
                className="mt-1.5 text-xs font-semibold text-admin-error-text"
              >
                {fieldErrors.key}
              </p>
            )}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="city">
              Cidade
            </label>
            <input
              id="city"
              name="city"
              type="text"
              defaultValue={sent?.city ?? tenant.pix?.city ?? ""}
              aria-invalid={fieldErrors.city ? true : undefined}
              aria-describedby={fieldErrors.city ? "city-erro" : undefined}
              className={fieldErrors.city ? ERROR_FIELD_CLASS : FIELD_CLASS}
            />
            {fieldErrors.city && (
              <p
                id="city-erro"
                className="mt-1.5 text-xs font-semibold text-admin-error-text"
              >
                {fieldErrors.city}
              </p>
            )}
          </div>
        </div>

        {saveState.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
          >
            {saveState.message}
          </p>
        )}

        <div className="mt-4.5 flex items-center gap-3.5">
          <button
            type="submit"
            disabled={savePending}
            className="btn btn-admin-primary btn-lg"
          >
            {savePending ? "Salvando…" : "Salvar chave"}
          </button>
          {saveState.status === "saved" && (
            <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
              <AdminIcon
                name="check"
                className="h-3.5 w-3.5"
                strokeWidth={2.4}
              />
              Salvo. Já está valendo no site.
            </output>
          )}
        </div>
      </form>

      {hasKey && (
        <div className="mt-3">
          <ConfirmAction
            action={removeAction}
            pending={removePending}
            error={removeState.status === "error" ? removeState.message : null}
            trigger="Remover chave"
            question="Remover a chave Pix da serventia?"
            consequence="Sem chave, a consulta de protocolo deixa de mostrar QR Code, e o cidadão perde a forma de pagar pelo site. Dá para cadastrar outra depois."
            confirmLabel="Confirmar remoção"
            pendingLabel="Removendo…"
          />
        </div>
      )}
    </div>
  );
}
