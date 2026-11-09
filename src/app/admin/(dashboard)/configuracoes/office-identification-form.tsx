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
import {
  type OfficeIdentificationState,
  saveOfficeIdentification,
} from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

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
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Identificação nos documentos
      </h2>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        Sai no cabeçalho de todo documento que o site gera (requerimento,
        comprovantes, declarações), com o brasão da República, como manda o
        Código de Normas (Provimento CGJ/TJRN 156/2016, art. 2º). Logomarca não
        entra nos documentos.
      </p>

      <div className="mt-4.5 grid grid-cols-1 gap-3.5 md:grid-cols-[1fr_1fr_120px]">
        <div className="md:col-span-3">
          <label className={LABEL_CLASS} htmlFor="officialName">
            Denominação oficial da serventia
          </label>
          <input
            id="officialName"
            name="officialName"
            value={officialName}
            onChange={(event) => setOfficialName(event.target.value)}
            placeholder={tenant.name}
            maxLength={120}
            aria-invalid={fieldErrors.officialName ? true : undefined}
            className={
              fieldErrors.officialName ? ERROR_FIELD_CLASS : FIELD_CLASS
            }
          />
          <p className="mt-1.5 text-[11.5px] text-admin-muted">
            Como está nas certidões. Ex.: Cartório do Ofício Único de Ielmo
            Marinho/RN. Em branco, sai “{tenant.name}”.
          </p>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="jurisdictionKind">
            Comarca ou termo
          </label>
          <div className="relative">
            <select
              id="jurisdictionKind"
              name="jurisdictionKind"
              value={kind}
              onChange={(event) => setKind(event.target.value as Kind | "")}
              aria-invalid={fieldErrors.jurisdictionKind ? true : undefined}
              className={`appearance-none pr-9 ${fieldErrors.jurisdictionKind ? ERROR_FIELD_CLASS : FIELD_CLASS}`}
            >
              <option value="" disabled>
                Escolher…
              </option>
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <AdminIcon
              name="chevronDown"
              className="pointer-events-none absolute top-1/2 right-3.5 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
              strokeWidth={2}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] text-admin-muted">
            Se o município é sede, “Comarca”. Se pertence à comarca de outra
            cidade, “Termo” ou “Comarca/Termo”, como a serventia escreve.
          </p>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="jurisdictionSeat">
            Cidade sede da comarca
          </label>
          <input
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
            className={`disabled:opacity-60 ${fieldErrors.jurisdictionSeat ? ERROR_FIELD_CLASS : FIELD_CLASS}`}
          />
          {fieldErrors.jurisdictionSeat ? (
            <p
              id="jurisdictionSeat-erro"
              className="mt-1.5 text-xs font-semibold text-admin-error-text"
            >
              {fieldErrors.jurisdictionSeat}
            </p>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-admin-muted">
              Só o nome da cidade; a UF vai ao lado.
            </p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="jurisdictionUf">
            UF
          </label>
          <div className="relative">
            <select
              id="jurisdictionUf"
              name="jurisdictionUf"
              value={uf}
              onChange={(event) => setUf(event.target.value)}
              disabled={kind === "none"}
              aria-invalid={fieldErrors.jurisdictionUf ? true : undefined}
              className={`appearance-none pr-9 disabled:opacity-60 ${fieldErrors.jurisdictionUf ? ERROR_FIELD_CLASS : FIELD_CLASS}`}
            >
              {BRAZILIAN_UFS.map((code) => (
                <option key={code} value={code}>
                  {code}
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
      </div>

      <h3 className="mt-5.5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
        Abaixo da identificação, em letra menor (opcional)
      </h3>
      <div className="mt-2.5 flex flex-col gap-3">
        <label className="flex items-start gap-2.5 text-[13px] text-admin-text">
          <input
            type="checkbox"
            name="showHolder"
            className="checkbox-admin mt-0.5"
            checked={showHolder}
            onChange={(event) => setShowHolder(event.target.checked)}
          />
          Mostrar o nome do(a) titular
        </label>
        <div
          className={`grid grid-cols-1 gap-3.5 pl-6.5 md:grid-cols-2 ${showHolder ? "" : "hidden"}`}
        >
          <div>
            <label className={LABEL_CLASS} htmlFor="holderName">
              Nome do(a) titular
            </label>
            <input
              id="holderName"
              name="holderName"
              value={holderName}
              onChange={(event) => setHolderName(event.target.value)}
              placeholder="Nome completo"
              maxLength={120}
              aria-invalid={fieldErrors.holderName ? true : undefined}
              className={
                fieldErrors.holderName ? ERROR_FIELD_CLASS : FIELD_CLASS
              }
            />
            <p className="mt-1.5 text-[11.5px] text-admin-muted">
              Mudou o tabelião? Troque aqui; os próximos documentos já saem com
              o nome novo.
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="holderTitle">
              Cargo, como sai depois do nome
            </label>
            <input
              id="holderTitle"
              name="holderTitle"
              value={holderTitle}
              onChange={(event) => setHolderTitle(event.target.value)}
              placeholder="Ex.: Tabeliã e Registradora"
              maxLength={80}
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-[13px] text-admin-text">
          <input
            type="checkbox"
            name="showAttributions"
            className="checkbox-admin mt-0.5"
            checked={showAttributions}
            onChange={(event) => setShowAttributions(event.target.checked)}
          />
          Mostrar as atribuições da serventia
        </label>
      </div>

      <h3 className="mt-5.5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
        Prévia do cabeçalho
      </h3>
      <figure
        className="mt-2.5 rounded-lg border border-admin-border bg-admin-card px-5 py-4 text-center font-serif text-admin-text"
        aria-label="Prévia do cabeçalho dos documentos"
      >
        <p className="text-[10.5px] text-admin-muted">(brasão da República)</p>
        {preview.header.map((line) => (
          <p key={line} className="text-[13px] leading-snug font-bold">
            {line}
          </p>
        ))}
        {preview.holder && (
          <p className="mt-1 text-[11.5px] text-admin-muted">
            {preview.holder}
          </p>
        )}
        {preview.attributions && (
          <p className="text-[11px] text-admin-muted">{preview.attributions}</p>
        )}
      </figure>
      <div className="mt-5.5">
        <label className={LABEL_CLASS} htmlFor="footerLines">
          Rodapé dos documentos (opcional)
        </label>
        <textarea
          id="footerLines"
          name="footerLines"
          value={footer}
          onChange={(event) => setFooter(event.target.value)}
          rows={3}
          placeholder={defaultFooter(tenant).join("\n")}
          aria-invalid={fieldErrors.footerLines ? true : undefined}
          aria-describedby="footerLines-ajuda"
          className={fieldErrors.footerLines ? ERROR_FIELD_CLASS : FIELD_CLASS}
        />
        <p
          id="footerLines-ajuda"
          className={`mt-1.5 text-[11.5px] ${fieldErrors.footerLines ? "font-semibold text-admin-error-text" : "text-admin-muted"}`}
        >
          {fieldErrors.footerLines ??
            "Até 3 linhas, uma por linha. Em branco, sai o endereço e os contatos do formulário de contato acima."}
        </p>
      </div>

      {preview.missingJurisdiction && (
        <p className="mt-2 text-[12px] text-admin-warning-text">
          Falta a comarca ou o termo: sem ela, a linha não sai no cabeçalho. O
          Código de Normas pede a indicação da comarca.
        </p>
      )}
      <p className="mt-2 text-[11.5px] text-admin-muted">
        No rodapé: {preview.footer.join(" · ")}.
      </p>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}

      <div className="mt-4.5 flex items-center gap-3.5">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-lg"
        >
          {pending ? "Salvando…" : "Salvar identificação"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Já sai nos próximos documentos.
          </output>
        )}
      </div>
    </form>
  );
}
