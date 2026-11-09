"use client";

import { useState } from "react";
import { GUIDE_KIND_INFO } from "@/core/guides/catalog.ts";
import { CIVIL_STATUS_LABELS } from "@/core/guides/qualification.ts";
import type {
  PublicGuideParty,
  PublicGuideRequest,
} from "@/core/guides/request.ts";
import {
  CIVIL_STATUSES,
  GUIDE_KINDS,
  type GuideKind,
} from "@/core/guides/schema.ts";

const input =
  "w-full rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";
const label = "mb-1.5 block text-[13px] font-semibold";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-brand-alert">{message}</p>
  );
}

const blankParty = (role: PublicGuideParty["role"]): PublicGuideParty => ({
  role,
  name: "",
  gender: "feminino",
  taxId: "",
  civilStatus: undefined,
  profession: "",
  address: "",
});

/** "27.000,00" → 2700000; NaN when it is not a value. */
function parseMoney(text: string): number {
  const clean = text
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

/**
 * The guia de recolhimento, as the citizen asks for it: a short form (who
 * transmits, who acquires, the property, the value). It travels as one JSON
 * field, `guia`, and the guia is drawn by itself for the office to check
 * before anything reaches the citizen.
 */
export function GuideRequestFields({
  errorFor,
}: {
  /** The form's own lookup of a server error by field path ("guia.parties"). */
  errorFor: (name: string) => string | undefined;
}) {
  const [kind, setKind] = useState<GuideKind>("itiv");
  const [nature, setNature] = useState("");
  const [parties, setParties] = useState<PublicGuideParty[]>([
    blankParty("transmitente"),
    blankParty("adquirente"),
  ]);
  const [property, setProperty] = useState<PublicGuideRequest["property"]>({
    type: "urbano",
    description: "",
    fiscalRegistration: "",
    registration: "",
  });
  const [value, setValue] = useState("");
  const info = GUIDE_KIND_INFO[kind];
  const cents = parseMoney(value);

  const payload: PublicGuideRequest = {
    kind,
    nature,
    parties,
    property,
    declaredValueCents: Number.isNaN(cents) ? 0 : cents,
  };
  const setParty = (index: number, patch: Partial<PublicGuideParty>) =>
    setParties(parties.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const err = (path: string) => errorFor(`guia.${path}`);

  return (
    <fieldset className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-brand-tint/40 p-4">
      <legend className="px-1 text-[13px] font-bold text-brand-primary">
        Dados para a guia
      </legend>
      <input type="hidden" name="guia" value={JSON.stringify(payload)} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={label}>Qual guia?</span>
          <select
            className={input}
            value={kind}
            onChange={(event) => setKind(event.target.value as GuideKind)}
          >
            {GUIDE_KINDS.map((option) => (
              <option key={option} value={option}>
                {GUIDE_KIND_INFO[option].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>
            Negócio{" "}
            <span className="font-normal text-brand-muted">· opcional</span>
          </span>
          <input
            className={input}
            list="guia-natureza"
            value={nature}
            onChange={(event) => setNature(event.target.value)}
            placeholder={info.natures[0]}
          />
          <datalist id="guia-natureza">
            {info.natures.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
      </div>

      {(["transmitente", "adquirente"] as const).map((role) => (
        <div key={role} className="flex flex-col gap-3">
          <p className="text-[13px] font-bold text-brand-primary">
            {info.roles[role]}
          </p>
          {parties.map((party, index) =>
            party.role !== role ? null : (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: people have no id here; the index is their place in the form.
                key={index}
                className="grid gap-3 rounded-xl border border-brand-border bg-brand-card p-3 md:grid-cols-2"
              >
                <label className="block md:col-span-2">
                  <span className={label}>Nome completo</span>
                  <input
                    className={input}
                    value={party.name}
                    onChange={(e) => setParty(index, { name: e.target.value })}
                  />
                  <FieldError message={err(`parties.${index}.name`)} />
                </label>
                <label className="block">
                  <span className={label}>CPF ou CNPJ</span>
                  <input
                    className={input}
                    inputMode="numeric"
                    value={party.taxId}
                    onChange={(e) => setParty(index, { taxId: e.target.value })}
                  />
                  <FieldError message={err(`parties.${index}.taxId`)} />
                </label>
                <label className="block">
                  <span className={label}>Tratamento</span>
                  <select
                    className={input}
                    value={party.gender}
                    onChange={(e) =>
                      setParty(index, {
                        gender: e.target.value as PublicGuideParty["gender"],
                      })
                    }
                  >
                    <option value="feminino">Sra.</option>
                    <option value="masculino">Sr.</option>
                  </select>
                </label>
                <label className="block">
                  <span className={label}>Estado civil</span>
                  <select
                    className={input}
                    value={party.civilStatus ?? ""}
                    onChange={(e) =>
                      setParty(index, {
                        civilStatus: (e.target.value ||
                          undefined) as PublicGuideParty["civilStatus"],
                      })
                    }
                  >
                    <option value="">Escolher…</option>
                    {CIVIL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {CIVIL_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={label}>Profissão</span>
                  <input
                    className={input}
                    value={party.profession}
                    onChange={(e) =>
                      setParty(index, { profession: e.target.value })
                    }
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className={label}>Endereço completo</span>
                  <input
                    className={input}
                    value={party.address}
                    onChange={(e) =>
                      setParty(index, { address: e.target.value })
                    }
                    placeholder="Rua, número, bairro, cidade/UF, CEP"
                  />
                  <FieldError message={err(`parties.${index}.address`)} />
                </label>
                {parties.filter((p) => p.role === role).length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setParties(parties.filter((_, i) => i !== index))
                    }
                    className="justify-self-start text-[12.5px] font-semibold text-brand-alert hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>
            ),
          )}
          <button
            type="button"
            onClick={() => setParties([...parties, blankParty(role)])}
            className="self-start text-[13px] font-semibold text-brand-primary underline"
          >
            + Adicionar {info.roles[role].toLocaleLowerCase("pt-BR")}
          </button>
        </div>
      ))}
      <FieldError message={err("parties")} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={label}>Imóvel</span>
          <select
            className={input}
            value={property.type}
            onChange={(e) =>
              setProperty({
                ...property,
                type: e.target.value as "urbano" | "rural",
              })
            }
          >
            <option value="urbano">Urbano</option>
            <option value="rural">Rural</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>
            {property.type === "rural"
              ? "CCIR, CAR ou NIRF"
              : "Inscrição imobiliária (IPTU)"}{" "}
            <span className="font-normal text-brand-muted">· se souber</span>
          </span>
          <input
            className={input}
            value={property.fiscalRegistration}
            onChange={(e) =>
              setProperty({ ...property, fiscalRegistration: e.target.value })
            }
          />
        </label>
        <label className="block md:col-span-2">
          <span className={label}>Endereço e descrição do imóvel</span>
          <textarea
            rows={3}
            className={input}
            value={property.description}
            onChange={(e) =>
              setProperty({ ...property, description: e.target.value })
            }
            placeholder="Ex.: casa na Rua das Flores, 100, Centro, com 200 m²"
          />
          <FieldError message={err("property.description")} />
        </label>
        <label className="block">
          <span className={label}>
            Matrícula{" "}
            <span className="font-normal text-brand-muted">· se souber</span>
          </span>
          <input
            className={input}
            value={property.registration}
            onChange={(e) =>
              setProperty({ ...property, registration: e.target.value })
            }
            placeholder="Ex.: matrícula nº 9.999"
          />
        </label>
        {info.rate !== "none" && (
          <label className="block">
            <span className={label}>Valor declarado do negócio (R$)</span>
            <input
              className={input}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="27.000,00"
            />
            <FieldError
              message={
                value && Number.isNaN(cents)
                  ? "Use números, ex.: 27.000,00"
                  : err("declaredValueCents")
              }
            />
          </label>
        )}
      </div>
      <p className="text-[12px] leading-relaxed text-brand-muted">
        A serventia confere estes dados com os documentos anexados e prepara a
        guia. Você recebe a guia assinada e o boleto na consulta do protocolo. O
        imposto é pago ao fisco (Prefeitura ou Estado), não à serventia.
      </p>
    </fieldset>
  );
}
