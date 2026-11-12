"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FILING_LABELS, type IssSettings } from "@/core/iss/declaration.ts";
import { TaxIdInput } from "../../../../_components/tax-id-input.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { type IssFormState, saveIssSettings } from "../actions.ts";

// TaxIdInput draws its own <input>: the same look as _ui/input.tsx.
const FIELD =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const LABEL =
  "flex flex-col items-stretch gap-1.5 text-sm leading-normal font-medium text-foreground";

export function IssSettingsForm({ settings }: { settings: IssSettings }) {
  const [state, action, pending] = useActionState<IssFormState, FormData>(
    saveIssSettings,
    { status: "idle" },
  );
  const [filing, setFiling] = useState(settings.filing);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-3.5 rounded-xl border bg-card px-5 py-4 md:grid-cols-2"
    >
      <h2 className="text-lg font-semibold text-foreground md:col-span-2">
        Imposto e lei municipal
      </h2>
      <Label className={LABEL}>
        Alíquota do ISS (%)
        <Input
          name="aliquota"
          inputMode="decimal"
          defaultValue={(settings.rateBasisPoints / 100)
            .toFixed(2)
            .replace(".", ",")}
          className="font-normal"
        />
        <span className="text-xs font-normal text-muted-foreground">
          De 2% a 5%, conforme a lei do município (LC 116/2003).
        </span>
      </Label>
      <Label className={LABEL}>
        Vencimento (dia do mês seguinte)
        <Input
          name="vencimentoDia"
          inputMode="numeric"
          defaultValue={settings.dueDay ?? ""}
          placeholder="Ex.: 10"
          className="font-normal"
        />
      </Label>
      <Label className={`${LABEL} md:col-span-2`}>
        Lei municipal do ISS (aparece na fundamentação)
        <Input
          name="lei_municipal"
          defaultValue={settings.municipalLaw}
          placeholder="Ex.: Código Tributário Municipal, Lei Complementar nº ..., art. ..."
          className="font-normal"
        />
      </Label>
      <label className={`${LABEL} md:col-span-2`}>
        Anexar a lei municipal ou o plano diretor (PDF)
        <input
          type="file"
          name="lei"
          accept="application/pdf,.pdf"
          className="block w-full text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground"
        />
        <span className="text-xs font-normal text-muted-foreground">
          {settings.lawAttachment ? (
            <>
              Anexada:{" "}
              <a
                href="/admin/utilitarios/iss/lei"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline"
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

      <h2 className="mt-2 text-lg font-semibold text-foreground md:col-span-2">
        Como a declaração chega à prefeitura
      </h2>
      <fieldset className="flex flex-col gap-2 md:col-span-2">
        <legend className="sr-only">Canal de envio</legend>
        {(Object.keys(FILING_LABELS) as IssSettings["filing"][]).map((key) => (
          <label
            key={key}
            className="flex items-start gap-2.5 rounded-lg border bg-muted/50 px-3.5 py-2.5 text-sm text-foreground"
          >
            <input
              type="radio"
              name="envio"
              value={key}
              checked={filing === key}
              onChange={() => setFiling(key)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-semibold">{FILING_LABELS[key]}</span>
              <span className="block text-xs text-muted-foreground">
                {key === "portal"
                  ? "A declaração mostra os dados prontos para copiar no site (CNPJ, receita, valor, descrição, data) e o PDF para anexar."
                  : "Sai também um protocolo de entrega, que a SEMUT carimba e assina e fica com o cartório."}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {filing !== "portal" && (
        // Kept as they were, for the day the prefeitura opens its site.
        <>
          <input type="hidden" name="portal" value={settings.portalUrl} />
          <input type="hidden" name="receita" value={settings.portalRevenue} />
        </>
      )}
      {filing === "portal" && (
        <>
          <Label className={LABEL}>
            Endereço do site da prefeitura
            <Input
              name="portal"
              type="url"
              defaultValue={settings.portalUrl}
              placeholder="https://"
              className="font-normal"
            />
          </Label>
          <Label className={LABEL}>
            Receita escolhida no site
            <Input
              name="receita"
              defaultValue={settings.portalRevenue}
              placeholder="Como aparece na lista do site"
              className="font-normal"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Se a serventia tem inscrição municipal, confirme com a SEMUT qual
              receita usar: em alguns sites, o DAM avulso é só para quem não é
              cadastrado e não quita o ISS de quem é.
            </span>
          </Label>
        </>
      )}

      <h2 className="mt-2 text-lg font-semibold text-foreground md:col-span-2">
        Destinatário: prefeitura
      </h2>
      <Label className={LABEL}>
        Prefeitura
        <Input
          name="prefeitura"
          defaultValue={settings.authority}
          className="font-normal"
        />
      </Label>
      <Label className={LABEL}>
        Secretaria
        <Input
          name="secretaria"
          defaultValue={settings.department}
          className="font-normal"
        />
      </Label>
      <label htmlFor="iss-cnpj-prefeitura" className={LABEL}>
        CNPJ da prefeitura
        <TaxIdInput
          id="iss-cnpj-prefeitura"
          name="cnpj_prefeitura"
          defaultValue={settings.authorityCnpj}
          className={`${FIELD} font-normal`}
        />
      </label>
      <Label className={LABEL}>
        Endereço da prefeitura (ou da secretaria)
        <Input
          name="endereco_prefeitura"
          defaultValue={settings.authorityAddress}
          placeholder="Rua, número, bairro, cidade/UF, CEP"
          className="font-normal"
        />
      </Label>
      <Label className={LABEL}>
        Prefeito(a) (opcional)
        <Input
          name="prefeito"
          defaultValue={settings.mayorName}
          className="font-normal"
        />
      </Label>
      <Label className={LABEL}>
        Secretário(a) de Tributação (opcional)
        <Input
          name="secretario"
          defaultValue={settings.secretaryName}
          className="font-normal"
        />
      </Label>
      <label className={`${LABEL} md:col-span-2`}>
        Portaria de nomeação do prefeito ou do secretário (PDF, opcional)
        <input
          type="file"
          name="portaria"
          accept="application/pdf,.pdf"
          className="block w-full text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground"
        />
        <span className="text-xs font-normal text-muted-foreground">
          {settings.appointmentAttachment ? (
            <>
              Anexada:{" "}
              <a
                href="/admin/utilitarios/iss/lei?doc=portaria"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline"
              >
                {settings.appointmentAttachment.name}
              </a>
              . Envie outra só para trocar.
            </>
          ) : (
            "Fica guardada para consulta da equipe."
          )}
        </span>
      </label>

      <h2 className="mt-2 text-lg font-semibold text-foreground md:col-span-2">
        Dados da serventia
      </h2>
      <label htmlFor="iss-cnpj-serventia" className={LABEL}>
        CNPJ da serventia (ou CPF do titular)
        <TaxIdInput
          id="iss-cnpj-serventia"
          name="cnpj"
          defaultValue={settings.cnpj}
          className={`${FIELD} font-normal`}
        />
      </label>
      <Label className={LABEL}>
        Inscrição municipal
        <Input
          name="inscricao"
          defaultValue={settings.municipalRegistration}
          className="font-normal"
        />
      </Label>
      <Label className={LABEL}>
        CNAE
        <Input
          name="cnae"
          defaultValue={settings.cnae}
          className="font-normal"
        />
      </Label>
      <Label className={`${LABEL} md:col-span-2`}>
        Endereço da serventia
        <Input
          name="endereco_serventia"
          defaultValue={settings.officeAddress}
          placeholder="Rua, número, bairro, cidade/UF, CEP"
          className="font-normal"
        />
      </Label>
      <Label className={LABEL}>
        Telefone da serventia
        <Input
          name="telefone_serventia"
          defaultValue={settings.officePhone}
          className="font-normal"
        />
      </Label>
      <Label className={LABEL}>
        E-mail da serventia
        <Input
          name="email_serventia"
          type="email"
          defaultValue={settings.officeEmail}
          className="font-normal"
        />
      </Label>

      {state.status === "error" && (
        <p
          role="alert"
          className="text-xs font-semibold text-destructive md:col-span-2"
        >
          {state.message}
        </p>
      )}
      <div className="md:col-span-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando..." : "Salvar configuração"}
        </Button>
      </div>
    </form>
  );
}
