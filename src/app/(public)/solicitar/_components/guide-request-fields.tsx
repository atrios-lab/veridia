"use client";

import { useRef, useState, useTransition } from "react";
import { GUIDE_KIND_INFO } from "@/core/guides/catalog.ts";
import { CIVIL_STATUS_LABELS } from "@/core/guides/qualification.ts";
import type { GuideReading } from "@/core/guides/reading.ts";
import type {
  PublicGuideParty,
  PublicGuideRequest,
} from "@/core/guides/request.ts";
import {
  CIVIL_STATUSES,
  type GuideKind,
  OFFERED_GUIDE_KINDS,
} from "@/core/guides/schema.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { readGuideDocumentsAction } from "../actions.ts";

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
  stableUnion: "nao-informado",
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
 * The guia de transmissão de bens, as the citizen asks for it: a short form (who
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

  // The documents read to fill the guia (decision of 14/11/2026): they go
  // with the request in "anexos", the field the attachments already use.
  const [readFiles, setReadFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [reading, startReading] = useTransition();
  const filesInput = useRef<HTMLInputElement>(null);

  const keepFiles = (next: File[]) => {
    setReadFiles(next);
    const transfer = new DataTransfer();
    for (const file of next) transfer.items.add(file);
    if (filesInput.current) filesInput.current.files = transfer.files;
  };

  /** Fills what is blank with what the documents say; never overwrites. */
  const apply = (found: GuideReading) => {
    setProperty((current) => ({
      type: found.property.type ?? current.type,
      description: current.description || found.property.description || "",
      fiscalRegistration:
        current.fiscalRegistration || found.property.fiscalRegistration || "",
      registration: current.registration || found.property.registration || "",
    }));
    if (!value && found.declaredValueCents) {
      setValue(
        (found.declaredValueCents / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        }),
      );
    }
    setParties((current) => {
      const next = [...current];
      for (const person of found.parties) {
        const digits = person.taxId.replace(/\D/g, "");
        if (next.some((p) => p.taxId.replace(/\D/g, "") === digits)) continue;
        const role = person.role ?? "transmitente";
        const filled: PublicGuideParty = {
          ...blankParty(role),
          name: person.name,
          taxId: person.taxId,
          gender: person.gender ?? "feminino",
          civilStatus: person.civilStatus,
          profession: person.profession ?? "",
          address: person.address ?? "",
        };
        const blank = next.findIndex(
          (p) => p.role === role && !p.name.trim() && !p.taxId.trim(),
        );
        if (blank >= 0) next[blank] = filled;
        else next.push(filled);
      }
      return next;
    });
  };

  const readDocuments = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const chosen = [...picked];
    keepFiles([...readFiles, ...chosen].slice(0, 5));
    const data = new FormData();
    for (const file of chosen) data.append("documentos", file);
    startReading(async () => {
      const result = await readGuideDocumentsAction(data);
      if (result.status === "read") {
        apply(result.reading);
        setNotes((current) => [...current, ...result.notes]);
      } else if (result.status === "error") {
        setNotes((current) => [...current, result.message]);
      }
    });
  };
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

      <div className="rounded-xl border-[1.5px] border-dashed border-brand-border bg-brand-card p-4">
        <p className="text-[13px] font-bold text-brand-primary">
          Anexe os documentos e o sistema preenche
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-brand-muted">
          Certidão da matrícula do imóvel, escritura ou contrato e os documentos
          das partes. O sistema lê e preenche os campos abaixo; você só confere.
          Para o sistema conseguir ler, envie em{" "}
          <strong className="font-semibold text-brand-text">
            PDF pesquisável
          </strong>{" "}
          (em que dá para selecionar o texto) ou digitalizado em ótima
          qualidade. Foto ou digitalização sem texto vai anexada, mas os campos
          você preenche. Estes documentos seguem com o pedido, junto dos demais
          anexos.
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand-border px-3.5 py-2.5 text-[13px] font-semibold text-brand-primary hover:border-brand-accent has-[:focus-visible]:border-brand-accent">
          {reading ? "Lendo os documentos..." : "Anexar e ler documentos"}
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="sr-only"
            disabled={reading}
            onChange={(event) => {
              readDocuments(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {/* The files themselves, in the request's own attachments field. */}
        <input
          ref={filesInput}
          type="file"
          name="anexos"
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
        {readFiles.map((file) => (
          <input
            key={`${file.name}-${file.lastModified}`}
            type="hidden"
            name="anexosName"
            value="Documento para a guia"
          />
        ))}
        {readFiles.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {readFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}`}
                className="flex items-center gap-2 text-[12.5px] text-brand-text"
              >
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-semibold text-brand-muted hover:text-brand-alert"
                  onClick={() =>
                    keepFiles(readFiles.filter((_, i) => i !== index))
                  }
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        {notes.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {notes.map((note) => (
              <li key={note} className="text-[12px] text-brand-muted">
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={label}>Qual guia?</span>
          <select
            className={input}
            value={kind}
            onChange={(event) => setKind(event.target.value as GuideKind)}
          >
            {OFFERED_GUIDE_KINDS.map((option) => (
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
                {party.civilStatus && party.civilStatus !== "casado" && (
                  <label className="block md:col-span-2">
                    <span className={label}>União estável</span>
                    <select
                      className={input}
                      value={party.stableUnion}
                      onChange={(e) =>
                        setParty(index, {
                          stableUnion: e.target
                            .value as PublicGuideParty["stableUnion"],
                        })
                      }
                    >
                      <option value="nao-informado">Escolher…</option>
                      <option value="declara-nao-mantem">
                        Declara, sob as penas da lei, que não mantém união
                        estável
                      </option>
                      <option value="declara-mantem">
                        Declara, sob as penas da lei, que mantém união estável
                      </option>
                    </select>
                  </label>
                )}
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
          <span className={label}>Bem transmitido</span>
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
          <span className={label}>
            Descrição do bem (imóvel: endereço e área; móvel ou digital: o que
            é)
          </span>
          <textarea
            rows={3}
            maxLength={LONG_TEXT_MAX}
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
