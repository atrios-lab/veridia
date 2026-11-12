"use client";

import { useActionState, useState } from "react";
import {
  defaultFooter,
  officeIdentification,
} from "@/core/tenant/identification.ts";
import {
  BRAZILIAN_UFS,
  type Jurisdiction,
  type Tenant,
} from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Switch } from "../../_ui/switch.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import {
  type OfficeIdentificationState,
  saveOfficeIdentification,
} from "./actions.ts";

type Kind = Jurisdiction["kind"];

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "comarca", label: "Comarca de…" },
  { value: "termo", label: "Termo de…" },
  { value: "comarca-termo", label: "Comarca/Termo de…" },
  { value: "none", label: "Não mostrar" },
];

/**
 * How the serventia identifies itself on every document the site prints
 * (Provimento CGJ/TJRN 156/2016, art. 2º): the denomination, the comarca or
 * termo, and, optional and in smaller type, the holder and the attributions.
 * Controlled, with the letterhead previewed as it is typed: what the office
 * sees here is what the requerimento prints.
 */
export function OfficeIdentificationForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, pending] = useActionState<
    OfficeIdentificationState,
    FormData
  >(saveOfficeIdentification, { status: "idle" });

  const [officialName, setOfficialName] = useState(tenant.officialName ?? "");
  const [kind, setKind] = useState<Kind | "">(tenant.jurisdiction?.kind ?? "");
  const [seat, setSeat] = useState(tenant.jurisdiction?.seat ?? "");
  const [uf, setUf] = useState<string>(
    tenant.jurisdiction?.uf ?? tenant.location.state,
  );
  // The name the papers print; the court's record of the holder until the
  // office types another (it changes hands, and the papers must follow).
  const [holderName, setHolderName] = useState(
    tenant.holderName ??
      (tenant.owner.status === "a confirmar" ? "" : tenant.owner.name),
  );
  const [holderTitle, setHolderTitle] = useState(tenant.holderTitle ?? "");
  const [footer, setFooter] = useState((tenant.footerLines ?? []).join("\n"));
  const [showHolder, setShowHolder] = useState(tenant.showHolder);
  const [showAttributions, setShowAttributions] = useState(
    tenant.showAttributions,
  );

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const footerLines = footer
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const draft = {
    ...tenant,
    officialName: officialName.trim() || undefined,
    jurisdiction: kind
      ? {
          kind,
          seat: seat.trim() || undefined,
          uf: uf as Jurisdiction["uf"],
        }
      : undefined,
    holderName: holderName.trim() || undefined,
    holderTitle: holderTitle.trim() || undefined,
    footerLines: footerLines.length ? footerLines : undefined,
    showHolder,
    showAttributions,
  };
  const preview = officeIdentification(draft);

  return (
    <form action={formAction}>
      <h2 className="text-lg font-semibold text-foreground">
        Identificação nos documentos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sai no cabeçalho de todo documento que o site gera (requerimento,
        comprovantes, declarações), com o brasão da República, como manda o
        Código de Normas (Provimento CGJ/TJRN 156/2016, art. 2º). Logomarca não
        entra nos documentos.
      </p>

      <div className="mt-4.5 grid grid-cols-1 gap-3.5 md:grid-cols-[1fr_1fr_120px]">
        <div className="md:col-span-3">
          <Label htmlFor="officialName" className="mb-1.5">
            Denominação oficial da serventia
          </Label>
          <Input
            id="officialName"
            name="officialName"
            value={officialName}
            onChange={(event) => setOfficialName(event.target.value)}
            placeholder={tenant.name}
            maxLength={120}
            aria-invalid={fieldErrors.officialName ? true : undefined}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Como está nas certidões. Ex.: Cartório do Ofício Único de Ielmo
            Marinho/RN. Em branco, sai “{tenant.name}”.
          </p>
        </div>

        <div>
          <Label htmlFor="jurisdictionKind" className="mb-1.5">
            Comarca ou termo
          </Label>
          <NativeSelect
            id="jurisdictionKind"
            name="jurisdictionKind"
            value={kind}
            onChange={(event) => setKind(event.target.value as Kind | "")}
            aria-invalid={fieldErrors.jurisdictionKind ? true : undefined}
            className="w-full"
          >
            <option value="" disabled>
              Escolher…
            </option>
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Se o município é sede, “Comarca”. Se pertence à comarca de outra
            cidade, “Termo” ou “Comarca/Termo”, como a serventia escreve.
          </p>
        </div>

        <div>
          <Label htmlFor="jurisdictionSeat" className="mb-1.5">
            Cidade sede da comarca
          </Label>
          <Input
            id="jurisdictionSeat"
            name="jurisdictionSeat"
            value={seat}
            onChange={(event) => setSeat(event.target.value)}
            disabled={kind === "none"}
            placeholder="Ex.: Macaíba"
            maxLength={60}
            aria-invalid={fieldErrors.jurisdictionSeat ? true : undefined}
            aria-describedby={
              fieldErrors.jurisdictionSeat ? "jurisdictionSeat-erro" : undefined
            }
          />
          {fieldErrors.jurisdictionSeat ? (
            <p
              id="jurisdictionSeat-erro"
              className="mt-1.5 text-sm text-destructive"
            >
              {fieldErrors.jurisdictionSeat}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Só o nome da cidade; a UF vai ao lado.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="jurisdictionUf" className="mb-1.5">
            UF
          </Label>
          <NativeSelect
            id="jurisdictionUf"
            name="jurisdictionUf"
            value={uf}
            onChange={(event) => setUf(event.target.value)}
            disabled={kind === "none"}
            aria-invalid={fieldErrors.jurisdictionUf ? true : undefined}
            className="w-full"
          >
            {BRAZILIAN_UFS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <h3 className="mt-5.5 text-xs font-medium text-muted-foreground">
        Abaixo da identificação, em letra menor (opcional)
      </h3>
      <div className="mt-2.5 flex flex-col gap-3">
        <Label className="gap-2.5 font-normal text-foreground">
          <Switch
            name="showHolder"
            checked={showHolder}
            onCheckedChange={(checked) => setShowHolder(checked)}
          />
          Mostrar o nome do(a) titular
        </Label>
        <div
          className={`grid grid-cols-1 gap-3.5 pl-10.5 md:grid-cols-2 ${showHolder ? "" : "hidden"}`}
        >
          <div>
            <Label htmlFor="holderName" className="mb-1.5">
              Nome do(a) titular
            </Label>
            <Input
              id="holderName"
              name="holderName"
              value={holderName}
              onChange={(event) => setHolderName(event.target.value)}
              placeholder="Nome completo"
              maxLength={120}
              aria-invalid={fieldErrors.holderName ? true : undefined}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Mudou o tabelião? Troque aqui; os próximos documentos já saem com
              o nome novo.
            </p>
          </div>
          <div>
            <Label htmlFor="holderTitle" className="mb-1.5">
              Cargo, como sai depois do nome
            </Label>
            <Input
              id="holderTitle"
              name="holderTitle"
              value={holderTitle}
              onChange={(event) => setHolderTitle(event.target.value)}
              placeholder="Ex.: Tabeliã e Registradora"
              maxLength={80}
            />
          </div>
        </div>
        <Label className="gap-2.5 font-normal text-foreground">
          <Switch
            name="showAttributions"
            checked={showAttributions}
            onCheckedChange={(checked) => setShowAttributions(checked)}
          />
          Mostrar as atribuições da serventia
        </Label>
      </div>

      <h3 className="mt-5.5 text-xs font-medium text-muted-foreground">
        Prévia do cabeçalho
      </h3>
      <figure
        className="mt-2.5 rounded-lg border bg-card px-5 py-4 text-center text-foreground"
        aria-label="Prévia do cabeçalho dos documentos"
      >
        <p className="text-xs text-muted-foreground">(brasão da República)</p>
        {preview.header.map((line) => (
          <p key={line} className="text-sm leading-snug font-semibold">
            {line}
          </p>
        ))}
        {preview.holder && (
          <p className="mt-1 text-xs text-muted-foreground">{preview.holder}</p>
        )}
        {preview.attributions && (
          <p className="text-xs text-muted-foreground">
            {preview.attributions}
          </p>
        )}
      </figure>
      <div className="mt-5.5">
        <Label htmlFor="footerLines" className="mb-1.5">
          Rodapé dos documentos (opcional)
        </Label>
        <Textarea
          id="footerLines"
          name="footerLines"
          value={footer}
          onChange={(event) => setFooter(event.target.value)}
          rows={3}
          placeholder={defaultFooter(tenant).join("\n")}
          aria-invalid={fieldErrors.footerLines ? true : undefined}
          aria-describedby="footerLines-ajuda"
        />
        <p
          id="footerLines-ajuda"
          className={`mt-1.5 text-xs ${fieldErrors.footerLines ? "text-destructive" : "text-muted-foreground"}`}
        >
          {fieldErrors.footerLines ??
            "Até 3 linhas, uma por linha. Em branco, sai o endereço e os contatos do formulário de contato acima."}
        </p>
      </div>

      {preview.missingJurisdiction && (
        <p className="mt-2 text-xs text-warning-text">
          Falta a comarca ou o termo: sem ela, a linha não sai no cabeçalho. O
          Código de Normas pede a indicação da comarca.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        No rodapé: {preview.footer.join(" · ")}.
      </p>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.message}
        </p>
      )}

      <div className="mt-4.5 flex items-center gap-3.5">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Salvando…" : "Salvar identificação"}
        </Button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Já sai nos próximos documentos.
          </output>
        )}
      </div>
    </form>
  );
}
