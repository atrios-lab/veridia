"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { PIX_KEY_TYPES, type PixKeyType } from "@/core/tenant/pix.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import {
  type PixKeyState,
  type PixKeyValues,
  removePixKey,
  savePixKey,
} from "./actions.ts";

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
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        {value}
      </p>
    </div>
  );
}

function ReadOnlyView({ tenant }: { tenant: Tenant }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <h2 className="text-lg font-semibold text-foreground">
          Chave Pix da serventia
        </h2>
        <span className="rounded-full bg-warning px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
          Somente leitura
        </span>
      </div>
      <div className="mt-4.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <ReadOnlyField
          label="Tipo"
          value={tenant.pix ? TYPE_LABELS[tenant.pix.type] : "Sem chave"}
        />
        <ReadOnlyField label="Chave" value={tenant.pix?.key ?? "Sem chave"} />
      </div>
      <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">
        Só quem responde pela serventia pode alterar a chave: por isso o botão
        não aparece aqui. Mesmo sem ele, o servidor recusaria a gravação de
        qualquer jeito.
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

  useEffect(() => {
    if (saveState.status === "saved")
      toast.success("Salvo. Já vale na consulta de protocolo.");
  }, [saveState]);

  if (!canEdit) return <ReadOnlyView tenant={tenant} />;

  const fieldErrors = saveState.status === "error" ? saveState.fieldErrors : {};
  const sent: PixKeyValues | undefined =
    saveState.status === "error" ? saveState.values : undefined;
  const removed = removeState.status === "removed";
  const hasKey = Boolean(tenant.pix) && !removed;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">
        Chave Pix da serventia
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O dinheiro do cidadão vai direto para esta chave: confira os dados com
        atenção antes de salvar. O sistema valida só o formato, não se a conta é
        da serventia: essa checagem é sua. Ele também não avisa quando o Pix
        cai; confirmar o recebimento continua sendo responsabilidade da
        serventia, pelo extrato bancário.
      </p>

      {!hasKey && (
        <p className="mt-3.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-medium text-warning-text">
          Sem chave, a consulta de protocolo não mostra QR Code: o cidadão vê
          apenas o valor e a instrução de pagar no balcão.
        </p>
      )}
      <form
        id="pix-key-form"
        action={saveAction}
        // React resets the form's own DOM fields once the action settles.
        // A <select>'s reset falls back to its first <option> (no option
        // here carries the HTML "selected" attribute), which snapped the
        // type back to CPF after every submit regardless of what was
        // chosen. The text fields survive it by coincidence (their
        // defaultValue is re-derived from what was just submitted); the
        // select has no equivalent, so the reset itself has to be skipped.
        onReset={(event) => event.preventDefault()}
      >
        <div className="mt-4.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <Label htmlFor="type" className="mb-1.5">
              Tipo da chave
            </Label>
            <NativeSelect
              id="type"
              name="type"
              defaultValue={sent?.type ?? tenant.pix?.type ?? ""}
              aria-invalid={fieldErrors.type ? true : undefined}
              className="w-full"
            >
              <option value="" disabled>
                Escolher…
              </option>
              {PIX_KEY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
            {fieldErrors.type && (
              <p className="mt-1.5 text-sm text-destructive">
                {fieldErrors.type}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="key" className="mb-1.5">
              Chave
            </Label>
            <Input
              id="key"
              name="key"
              type="text"
              defaultValue={sent?.key ?? tenant.pix?.key ?? ""}
              aria-invalid={fieldErrors.key ? true : undefined}
              aria-describedby={fieldErrors.key ? "key-erro" : undefined}
            />
            {fieldErrors.key && (
              <p id="key-erro" className="mt-1.5 text-sm text-destructive">
                {fieldErrors.key}
              </p>
            )}
          </div>
        </div>

        {saveState.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
          >
            {saveState.message}
          </p>
        )}
      </form>

      <div className="mt-4.5 flex flex-wrap items-center gap-3.5">
        <Button type="submit" form="pix-key-form" disabled={savePending}>
          {savePending ? "Salvando…" : "Salvar chave"}
        </Button>
        {hasKey && (
          <ConfirmAction
            action={removeAction}
            pending={removePending}
            error={removeState.status === "error" ? removeState.message : null}
            trigger="Remover chave"
            question="Remover a chave Pix da serventia?"
            consequence="Sem chave, a consulta de protocolo deixa de mostrar QR Code, e o cidadão perde a forma de pagar pelo site. Dá para cadastrar outra depois."
            confirmLabel="Confirmar remoção"
            pendingLabel="Removendo…"
            triggerClassName={buttonVariants({ variant: "destructive" })}
          />
        )}
      </div>
    </div>
  );
}
