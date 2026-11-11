"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { IssSettings } from "@/core/iss/declaration.ts";
import { type IssFormState, saveIssSettings } from "../actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "flex flex-col gap-1.5 text-xs font-bold text-admin-primary";

export function IssSettingsForm({ settings }: { settings: IssSettings }) {
  const [state, action, pending] = useActionState<IssFormState, FormData>(
    saveIssSettings,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-3.5 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4 md:grid-cols-2"
    >
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary md:col-span-2">
        Imposto e lei municipal
      </h2>
      <label className={LABEL}>
        Alíquota do ISS (%)
        <input
          name="aliquota"
          inputMode="decimal"
          defaultValue={(settings.rateBasisPoints / 100)
            .toFixed(2)
            .replace(".", ",")}
          className={FIELD}
        />
        <span className="font-normal text-admin-muted">
          De 2% a 5%, conforme a lei do município (LC 116/2003).
        </span>
      </label>
      <label className={LABEL}>
        Vencimento (dia do mês seguinte)
        <input
          name="vencimentoDia"
          inputMode="numeric"
          defaultValue={settings.dueDay ?? ""}
          placeholder="Ex.: 10"
          className={FIELD}
        />
      </label>
      <label className={`${LABEL} md:col-span-2`}>
        Lei municipal do ISS (aparece na fundamentação)
        <input
          name="lei_municipal"
          defaultValue={settings.municipalLaw}
          placeholder="Ex.: Código Tributário Municipal, Lei Complementar nº ..., art. ..."
          className={FIELD}
        />
      </label>
      <label className={`${LABEL} md:col-span-2`}>
        Anexar a lei municipal ou o plano diretor (PDF)
        <input
          type="file"
          name="lei"
          accept="application/pdf,.pdf"
          className="block w-full text-[13px] font-normal file:mr-3 file:rounded-full file:border-0 file:bg-admin-primary file:px-4 file:py-2 file:text-[12.5px] file:font-semibold file:text-white"
        />
        <span className="font-normal text-admin-muted">
          {settings.lawAttachment ? (
            <>
              Anexada:{" "}
              <a
                href="/admin/utilitarios/iss/lei"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-admin-primary underline"
              >
                {settings.lawAttachment.name}
              </a>
              . Envie outra só para trocar.
            </>
          ) : (
            "Fica guardada para consulta da equipe."
          )}
        </span>
      </label>

      <h2 className="mt-2 font-serif text-[17px] font-semibold text-admin-primary md:col-span-2">
        Destinatário
      </h2>
      <label className={LABEL}>
        Prefeitura
        <input
          name="prefeitura"
          defaultValue={settings.authority}
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        Secretaria
        <input
          name="secretaria"
          defaultValue={settings.department}
          className={FIELD}
        />
      </label>

      <h2 className="mt-2 font-serif text-[17px] font-semibold text-admin-primary md:col-span-2">
        Dados da serventia no fisco
      </h2>
      <label className={LABEL}>
        CNPJ da serventia
        <input
          name="cnpj"
          defaultValue={settings.cnpj}
          placeholder="00.000.000/0000-00"
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        Inscrição municipal
        <input
          name="inscricao"
          defaultValue={settings.municipalRegistration}
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        CNAE
        <input name="cnae" defaultValue={settings.cnae} className={FIELD} />
      </label>

      {state.status === "error" && (
        <p
          role="alert"
          className="text-[12.5px] font-semibold text-admin-error-text md:col-span-2"
        >
          {state.message}
        </p>
      )}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando..." : "Salvar configuração"}
        </button>
      </div>
    </form>
  );
}
