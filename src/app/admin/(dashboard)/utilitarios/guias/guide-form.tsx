"use client";

import { useActionState, useState } from "react";
import { GUIDE_KIND_INFO } from "@/core/guides/catalog.ts";
import { addressee, guideAmount, localLaw } from "@/core/guides/document.ts";
import {
  CIVIL_STATUS_LABELS,
  MARRIAGE_REGIME_LABELS,
  missingQualification,
  qualify,
} from "@/core/guides/qualification.ts";
import {
  CIVIL_STATUSES,
  emptyParty,
  type Guide,
  type GuideKind,
  type GuideParty,
  type GuideSettings,
  MARRIAGE_REGIMES,
  OFFERED_GUIDE_KINDS,
  rateFor,
} from "@/core/guides/schema.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { type GuideFormState, saveGuide } from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";
const FIELD_ERROR =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL = "mb-1 block text-[11.5px] font-bold text-admin-primary";

/** "27.000,00" or "27000" → cents; NaN when it is not a value. */
function parseMoney(input: string): number {
  const clean = input
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className={LABEL}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={error ? FIELD_ERROR : FIELD}
      />
      {error && (
        <span className="mt-1 block text-[11.5px] font-semibold text-admin-error-text">
          {error}
        </span>
      )}
    </label>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  empty,
}: {
  label: string;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: { value: T; label: string }[];
  empty?: string;
}) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) =>
          onChange((event.target.value || undefined) as T | undefined)
        }
        className={FIELD}
      >
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PartyCard({
  party,
  index,
  roleLabel,
  errors,
  onChange,
  onRemove,
}: {
  party: GuideParty;
  index: number;
  roleLabel: string;
  errors: Record<string, string>;
  onChange: (party: GuideParty) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof GuideParty>(key: K, value: GuideParty[K]) =>
    onChange({ ...party, [key]: value });
  const error = (key: string) => errors[`parties.${index}.${key}`];
  const missing = party.name.trim() ? missingQualification(party) : [];
  const pf = party.personType === "fisica";

  return (
    <fieldset className="rounded-[12px] border border-admin-border bg-admin-card p-4">
      <legend className="px-1 text-[12px] font-bold uppercase tracking-[0.08em] text-admin-accent">
        {roleLabel}
      </legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Select
          label="Pessoa"
          value={party.personType}
          onChange={(value) => set("personType", value ?? "fisica")}
          options={[
            { value: "fisica", label: "Física" },
            { value: "juridica", label: "Jurídica" },
          ]}
        />
        <div className="md:col-span-3">
          <Field
            label={pf ? "Nome completo" : "Razão social"}
            value={party.name}
            onChange={(value) => set("name", value)}
            error={error("name")}
          />
        </div>
        {pf && (
          <>
            <Select
              label="Gênero (concordância)"
              value={party.gender}
              onChange={(value) => set("gender", value ?? "feminino")}
              options={[
                { value: "feminino", label: "Feminino" },
                { value: "masculino", label: "Masculino" },
              ]}
            />
            <Field
              label="Nacionalidade"
              value={party.nationality}
              onChange={(value) => set("nationality", value)}
            />
            <Select
              label="Estado civil"
              value={party.civilStatus}
              onChange={(value) => set("civilStatus", value)}
              options={CIVIL_STATUSES.map((value) => ({
                value,
                label: CIVIL_STATUS_LABELS[value],
              }))}
              empty="Escolher…"
            />
            <Select
              label="União estável (CPC, art. 319, II)"
              value={party.stableUnion}
              onChange={(value) => set("stableUnion", value ?? "nao-informado")}
              options={[
                { value: "nao", label: "Declara que não convive" },
                { value: "sim", label: "Convive em união estável" },
                { value: "nao-informado", label: "Não informar" },
              ]}
            />
            {party.civilStatus === "casado" && (
              <>
                <Select
                  label="Regime de bens"
                  value={party.marriageRegime}
                  onChange={(value) => set("marriageRegime", value)}
                  options={MARRIAGE_REGIMES.map((value) => ({
                    value,
                    label: MARRIAGE_REGIME_LABELS[value],
                  }))}
                  empty="Escolher…"
                />
                <div className="md:col-span-3">
                  <Field
                    label="Registro do casamento"
                    value={party.marriageRecord}
                    onChange={(value) => set("marriageRecord", value)}
                    placeholder="Ex.: conforme certidão do 1º Ofício de Exemplo/RN, livro B-1, fls. 10, nº 100"
                  />
                </div>
              </>
            )}
            <Field
              label="Profissão"
              value={party.profession}
              onChange={(value) => set("profession", value)}
            />
          </>
        )}
        <Field
          label={pf ? "CPF" : "CNPJ"}
          value={party.taxId}
          onChange={(value) => set("taxId", value)}
          error={error("taxId")}
        />
        {pf && (
          <div className="md:col-span-2">
            <Field
              label="Identidade (RG)"
              value={party.identity}
              onChange={(value) => set("identity", value)}
              placeholder="Ex.: nº 1.234.567, SSP/RN, expedida em 01/01/2020"
            />
          </div>
        )}
        {pf && (
          <div className="md:col-span-2">
            <Field
              label="Filiação (obrigatória sem CPF e sem RG)"
              value={party.filiation}
              onChange={(value) => set("filiation", value)}
              placeholder="Ex.: José Exemplo da Silva e Ana Exemplo da Silva"
            />
          </div>
        )}
        <div className="md:col-span-2">
          <Field
            label={pf ? "Domicílio e residência" : "Sede"}
            value={party.address}
            onChange={(value) => set("address", value)}
            placeholder="Rua, número, bairro, cidade/UF, CEP"
          />
        </div>
        <div className="md:col-span-2">
          <Field
            label="E-mail (CPC, art. 319, II)"
            value={party.email}
            onChange={(value) => set("email", value)}
          />
        </div>
        <div className="md:col-span-4">
          <Field
            label="Representação (opcional)"
            value={party.representation}
            onChange={(value) => set("representation", value)}
            placeholder="Ex.: neste ato representado por sua genitora, Fulana de Tal, CPF 000.000.000-00"
          />
        </div>
      </div>

      {party.name.trim() && (
        <p className="mt-3 rounded-lg bg-admin-input-bg px-3 py-2 text-[12px] leading-relaxed text-admin-text">
          {qualify(party)}
        </p>
      )}
      {missing.length > 0 && (
        <p className="mt-2 text-[12px] text-admin-warning-text">
          Falta para a qualificação (Lei 6.015, art. 176): {missing.join(", ")}.
        </p>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="mt-3 text-[12px] font-semibold text-admin-alert hover:underline"
      >
        Remover esta parte
      </button>
    </fieldset>
  );
}

/**
 * The guia as the clerk fills it: the kind, the parties qualified field by
 * field (with the text the paper will print shown under each), the
 * property, the value and the rate, and who signs. Submits the whole guia
 * as one JSON field; the server checks it against the same schema.
 */
export function GuideForm({
  initial,
  id,
  settings,
}: {
  initial: Guide;
  id?: string;
  settings: GuideSettings;
}) {
  const [state, formAction, pending] = useActionState<GuideFormState, FormData>(
    saveGuide,
    { status: "idle" },
  );
  const [guide, setGuide] = useState<Guide>(initial);
  const [value, setValue] = useState(
    initial.declaredValueCents
      ? formatMoneyBRL(initial.declaredValueCents)
      : "",
  );
  const [rate, setRate] = useState(
    initial.rateBasisPoints
      ? String(initial.rateBasisPoints / 100).replace(".", ",")
      : "",
  );
  const [taxOverride, setTaxOverride] = useState(
    initial.taxOverrideCents === null
      ? ""
      : formatMoneyBRL(initial.taxOverrideCents),
  );
  const errors = state.status === "error" ? state.fieldErrors : {};
  const info = GUIDE_KIND_INFO[guide.kind];

  const cents = parseMoney(value);
  const overrideCents = taxOverride.trim() ? parseMoney(taxOverride) : null;
  const basisPoints = Math.round(Number(rate.replace(",", ".")) * 100);
  // A fixed-rate kind always takes the typed rate; the ITCD only when the
  // clerk chose to set it by hand instead of the state's brackets.
  const typedRate =
    info.rate === "fixed" || (info.rate === "itcd-rn" && guide.manualRate);
  const draft: Guide = {
    ...guide,
    declaredValueCents: Number.isNaN(cents) ? 0 : cents,
    rateBasisPoints:
      typedRate && Number.isFinite(basisPoints) ? basisPoints : 0,
    taxOverrideCents:
      overrideCents === null || Number.isNaN(overrideCents)
        ? null
        : overrideCents,
  };
  const amount = guideAmount(draft);
  const plain = { ...draft, addresseeText: "", lawText: "" };

  const update = (patch: Partial<Guide>) => setGuide({ ...guide, ...patch });
  const setKind = (kind: GuideKind) => {
    const next = rateFor(kind, settings);
    setRate(next ? String(next / 100).replace(".", ",") : "");
    update({ kind });
  };
  const roles: GuideParty["role"][] = ["transmitente", "adquirente"];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="guide" value={JSON.stringify(draft)} />
      {id && <input type="hidden" name="id" value={id} />}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Select
          label="Guia"
          value={guide.kind}
          onChange={(kind) => setKind(kind ?? "itiv")}
          // A guia already issued as a certidão keeps its kind on the list;
          // a new one is never offered it.
          options={(OFFERED_GUIDE_KINDS.includes(guide.kind)
            ? OFFERED_GUIDE_KINDS
            : [...OFFERED_GUIDE_KINDS, guide.kind]
          ).map((kind) => ({
            value: kind,
            label: GUIDE_KIND_INFO[kind].label,
          }))}
        />
        <label className="block md:col-span-2">
          <span className={LABEL}>Natureza do ato</span>
          <input
            list="guide-natures"
            value={guide.nature}
            onChange={(event) => update({ nature: event.target.value })}
            placeholder={info.natures[0]}
            className={FIELD}
          />
          <datalist id="guide-natures">
            {info.natures.map((nature) => (
              <option key={nature} value={nature} />
            ))}
          </datalist>
        </label>
      </section>

      {roles.map((role) => (
        <section key={role} className="flex flex-col gap-3">
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            {info.roles[role]}
          </h2>
          {guide.parties.map((party, index) =>
            party.role === role ? (
              <PartyCard
                // biome-ignore lint/suspicious/noArrayIndexKey: parties have no id; the index is their identity in this form.
                key={index}
                party={party}
                index={index}
                roleLabel={info.roles[role]}
                errors={errors}
                onChange={(next) =>
                  update({
                    parties: guide.parties.map((p, i) =>
                      i === index ? next : p,
                    ),
                  })
                }
                onRemove={() =>
                  update({
                    parties: guide.parties.filter((_, i) => i !== index),
                  })
                }
              />
            ) : null,
          )}
          <button
            type="button"
            onClick={() =>
              update({ parties: [...guide.parties, emptyParty(role)] })
            }
            className="btn btn-admin-secondary btn-md self-start"
          >
            + {info.roles[role]}
          </button>
        </section>
      ))}
      {errors.parties && (
        <p className="text-[12px] font-semibold text-admin-error-text">
          {errors.parties}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
          Imóvel
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            label="Tipo"
            value={guide.property.type}
            onChange={(type) =>
              update({
                property: { ...guide.property, type: type ?? "urbano" },
              })
            }
            options={[
              { value: "urbano", label: "Urbano" },
              { value: "rural", label: "Rural" },
            ]}
          />
          <Field
            label={
              guide.property.type === "rural"
                ? "CCIR / CAR / NIRF"
                : "Inscrição imobiliária"
            }
            value={guide.property.fiscalRegistration}
            onChange={(fiscalRegistration) =>
              update({ property: { ...guide.property, fiscalRegistration } })
            }
          />
          <Field
            label="Registro (matrícula, livro, folhas)"
            value={guide.property.registration}
            onChange={(registration) =>
              update({ property: { ...guide.property, registration } })
            }
            placeholder="Ex.: matrícula nº 9.999, livro 2-A, fls. 010/012"
          />
        </div>
        <label className="block">
          <span className={LABEL}>Descrição (localização, área, limites)</span>
          <textarea
            rows={4}
            value={guide.property.description}
            onChange={(event) =>
              update({
                property: {
                  ...guide.property,
                  description: event.target.value,
                },
              })
            }
            aria-invalid={errors["property.description"] ? true : undefined}
            className={errors["property.description"] ? FIELD_ERROR : FIELD}
          />
          {errors["property.description"] && (
            <span className="mt-1 block text-[11.5px] font-semibold text-admin-error-text">
              {errors["property.description"]}
            </span>
          )}
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
          Valores e assinatura
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field
            label="Valor declarado (R$)"
            value={value}
            onChange={setValue}
            placeholder="27.000,00"
            error={
              value && Number.isNaN(cents)
                ? "Use números, ex.: 27.000,00"
                : errors.declaredValueCents
            }
          />
          {typedRate && (
            <Field
              label="Alíquota (%)"
              value={rate}
              onChange={setRate}
              placeholder="3"
              error={errors.rateBasisPoints}
            />
          )}
          {info.rate === "itcd-rn" && (
            <div className="text-[12px] leading-relaxed text-admin-muted md:pt-5">
              {!guide.manualRate &&
                "ITCD do RN por faixa: 3% até R$ 500 mil, 4% até R$ 1 milhão, 5% até R$ 3 milhões e 6% acima (Lei 5.887/1989, art. 7º)."}
              <label className="mt-1 flex items-center gap-2 text-admin-text">
                <input
                  type="checkbox"
                  className="checkbox-admin"
                  checked={guide.manualRate}
                  onChange={(event) =>
                    update({ manualRate: event.target.checked })
                  }
                />
                Usar alíquota manual, em vez da tabela
              </label>
            </div>
          )}
          <Select
            label="Quem assina"
            value={String(guide.signer)}
            onChange={(signer) => update({ signer: Number(signer ?? 0) })}
            options={settings.signers.map((signer, index) => ({
              value: String(index),
              label: [signer.name, signer.title].filter(Boolean).join(", "),
            }))}
          />
        </div>
        {amount.taxCents !== null && (
          <div className="max-w-[320px]">
            <Field
              label="Imposto: ajuste manual (opcional)"
              value={taxOverride}
              onChange={setTaxOverride}
              placeholder="Em branco, sai o calculado"
              error={
                overrideCents !== null && Number.isNaN(overrideCents)
                  ? "Use números, ex.: 810,00"
                  : errors.taxOverrideCents
              }
            />
          </div>
        )}
        {amount.taxCents !== null && (
          <div className="rounded-lg bg-admin-input-bg px-3.5 py-2.5 text-[13px] text-admin-text">
            <strong>
              Imposto{" "}
              {draft.taxOverrideCents === null ? "estimado" : "ajustado à mão"}:
              R$ {formatMoneyBRL(amount.taxCents)}
            </strong>{" "}
            ({amount.rateLabel})
            {amount.breakdown.map((line) => (
              <span key={line} className="block text-[12px] text-admin-muted">
                {line}
              </span>
            ))}
          </div>
        )}
        <label className="block">
          <span className={LABEL}>Destinatário desta guia (opcional)</span>
          <textarea
            rows={2}
            value={guide.addresseeText}
            onChange={(event) => update({ addresseeText: event.target.value })}
            placeholder={addressee(plain, settings)}
            className={FIELD}
          />
        </label>
        {info.rate !== "none" && (
          <label className="block">
            <span className={LABEL}>Lei citada nesta guia (opcional)</span>
            <input
              value={guide.lawText}
              onChange={(event) => update({ lawText: event.target.value })}
              placeholder={localLaw(plain, settings) || "Informe a lei"}
              className={FIELD}
            />
          </label>
        )}
        <p className="-mt-1 text-[11.5px] text-admin-muted">
          Em branco, saem o destinatário e a lei da configuração. O Word baixado
          também pode ser editado antes de assinar.
        </p>
        <label className="block">
          <span className={LABEL}>Observações para o fisco (opcional)</span>
          <textarea
            rows={2}
            value={guide.notes}
            onChange={(event) => update({ notes: event.target.value })}
            className={FIELD}
          />
        </label>
      </section>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      <div className="flex items-center gap-3.5">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-lg"
        >
          {pending ? "Salvando…" : id ? "Salvar correções" : "Emitir guia"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. O PDF e o Word já saem corrigidos.
          </output>
        )}
      </div>
    </form>
  );
}
