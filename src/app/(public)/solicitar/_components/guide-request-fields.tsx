"use client";

import { useRef, useState, useTransition } from "react";
import { GUIDE_KIND_INFO } from "@/core/guides/catalog.ts";
import {
  CIVIL_STATUS_LABELS,
  MARRIAGE_REGIME_LABELS,
} from "@/core/guides/qualification.ts";
import type { GuideReading } from "@/core/guides/reading.ts";
import {
  GUIDE_MAX_FILES,
  type PublicGuideParty,
  type PublicGuideRequest,
} from "@/core/guides/request.ts";
import {
  CIVIL_STATUSES,
  type GuideKind,
  MARRIAGE_REGIMES,
  OFFERED_GUIDE_KINDS,
} from "@/core/guides/schema.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import {
  ATTACHMENT_ACCEPT,
  validateAttachments,
} from "../../_lib/attachments.tsx";
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
  marriageRegime: undefined,
  spouseName: "",
  spouseTaxId: "",
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

/** The documents, by whose they are (decision of 19/11/2026). */
type DocGroup = "transmitente" | "adquirente" | "imovel" | "procuracao";
const DOC_GROUPS: DocGroup[] = [
  "transmitente",
  "adquirente",
  "imovel",
  "procuracao",
];

/**
 * Up to this size a PDF is read here to fill the fields; a bigger one is
 * only attached. Reading sends the file to the server in the request body,
 * which the hosting caps: that cap is what said "muito grande" before.
 */
const READ_LIMIT_BYTES = 4 * 1024 * 1024;

type Requester = "" | "adquirente" | "transmitente" | "terceiro";

/**
 * The guia de transmissão de bens, as the citizen asks for it (decisions of
 * 14 and 19/11/2026), in the order of the paper: who is asking, the
 * documents of each side and of the property, then the people (with the
 * spouse and the regime when married), the property and the value. It
 * travels as one JSON field, `guia`; the documents go apart, in
 * `guiaAnexos`, each named by its group, straight to the store.
 */
export function GuideRequestFields({
  errorFor,
}: {
  /** The form's own lookup of a server error by field path ("guia.parties"). */
  errorFor: (name: string) => string | undefined;
}) {
  const [kind, setKind] = useState<GuideKind>("itiv");
  const [nature, setNature] = useState("");
  const [requester, setRequester] = useState<Requester>("");
  const [mandate, setMandate] = useState("");
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

  const [docs, setDocs] = useState<Record<DocGroup, File[]>>({
    transmitente: [],
    adquirente: [],
    imovel: [],
    procuracao: [],
  });
  const [notes, setNotes] = useState<string[]>([]);
  const [docError, setDocError] = useState<string>();
  const [reading, startReading] = useTransition();
  const filesInput = useRef<HTMLInputElement>(null);

  const groupLabel: Record<DocGroup, string> = {
    transmitente: `Documentos: ${info.roles.transmitente}`,
    adquirente: `Documentos: ${info.roles.adquirente}`,
    imovel: kind.startsWith("itcd")
      ? "Documentos do bem"
      : "Documentos do imóvel",
    procuracao: "Procuração ou documento do mandato",
  };
  const groupHint: Record<DocGroup, string> = {
    transmitente:
      "Documento com foto (RG ou CNH), CPF, certidão de casamento se for casado(a) e comprovante de endereço.",
    adquirente:
      "Documento com foto (RG ou CNH), CPF, certidão de casamento se for casado(a) e comprovante de endereço.",
    imovel: kind.startsWith("itcd")
      ? "O que identifica o bem: matrícula do imóvel, documento do veículo, extrato, contrato. No inventário, a certidão de óbito."
      : "Certidão da matrícula atualizada, escritura ou contrato e o carnê do IPTU (urbano) ou o CCIR (rural).",
    procuracao:
      "A procuração pública ou particular com firma reconhecida, ou o documento que dá a representação.",
  };
  const groups = DOC_GROUPS.filter(
    (group) => group !== "procuracao" || requester === "terceiro",
  );

  /** Every file in one hidden input, in group order, each with its name. */
  const ordered = groups.flatMap((group) =>
    docs[group].map((file) => ({ file, group })),
  );
  const keepFiles = (next: Record<DocGroup, File[]>, who = requester) => {
    setDocs(next);
    const transfer = new DataTransfer();
    for (const group of DOC_GROUPS) {
      if (group === "procuracao" && who !== "terceiro") continue;
      for (const file of next[group]) transfer.items.add(file);
    }
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
    if (found.declaredValueCents) {
      const cents = found.declaredValueCents;
      setValue((current) =>
        current
          ? current
          : (cents / 100).toLocaleString("pt-BR", {
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

  const addDocuments = (group: DocGroup, picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const accepted: File[] = [];
    let problem: string | undefined;
    for (const file of picked) {
      const message = validateAttachments([file], GUIDE_MAX_FILES);
      if (message) problem ??= `${file.name}: ${message}`;
      else accepted.push(file);
    }
    if (ordered.length + accepted.length > GUIDE_MAX_FILES) {
      problem = `Envie até ${GUIDE_MAX_FILES} arquivos ao todo. Junte as páginas do mesmo documento num PDF só.`;
      accepted.splice(Math.max(0, GUIDE_MAX_FILES - ordered.length));
    }
    setDocError(problem);
    if (accepted.length === 0) return;
    keepFiles({ ...docs, [group]: [...docs[group], ...accepted] });
    // One file per read, small enough for the request: a big one is only
    // attached, and the fields are filled by hand.
    startReading(async () => {
      for (const file of accepted) {
        const isPdf =
          file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (!isPdf) continue;
        if (file.size > READ_LIMIT_BYTES) {
          setNotes((current) => [
            ...current,
            `${file.name}: anexado. É grande para ser lido aqui; confira e preencha os campos abaixo.`,
          ]);
          continue;
        }
        const data = new FormData();
        data.append("documentos", file);
        const result = await readGuideDocumentsAction(data).catch(() => null);
        if (result?.status === "read") {
          apply(result.reading);
          setNotes((current) => [...current, ...result.notes]);
        } else if (result?.status === "error") {
          setNotes((current) => [...current, result.message]);
        }
      }
    });
  };

  const removeDocument = (group: DocGroup, index: number) =>
    keepFiles({
      ...docs,
      [group]: docs[group].filter((_, i) => i !== index),
    });

  const cents = parseMoney(value);
  const payload = {
    kind,
    nature,
    requester: {
      role: requester,
      mandate,
      mandateAttached: requester === "terceiro" && docs.procuracao.length > 0,
    },
    parties,
    property,
    declaredValueCents: Number.isNaN(cents) ? 0 : cents,
  };
  const setParty = (index: number, patch: Partial<PublicGuideParty>) =>
    setParties(parties.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const err = (path: string) => errorFor(`guia.${path}`);

  const requesterOptions: { id: Exclude<Requester, "">; text: string }[] = [
    {
      id: "adquirente",
      text: `Sou o(a) ${info.roles.adquirente.toLocaleLowerCase("pt-BR")}`,
    },
    {
      id: "transmitente",
      text: `Sou o(a) ${info.roles.transmitente.toLocaleLowerCase("pt-BR")}`,
    },
    {
      id: "terceiro",
      text: "Sou outra pessoa, por procuração ou representação",
    },
  ];

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

      {/* 1. Who is asking: the paper names the requerente apart. */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-brand-border bg-brand-card p-4">
        <p className="text-[13px] font-bold text-brand-primary">
          1. Quem está pedindo a guia?
        </p>
        <p className="-mt-1 text-[12.5px] text-brand-muted">
          Você, que preenche este pedido, é o requerente.
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {requesterOptions.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] ${
                requester === option.id
                  ? "border-brand-accent bg-brand-tint font-semibold text-brand-primary"
                  : "border-brand-border text-brand-text hover:border-brand-accent"
              }`}
            >
              <input
                type="radio"
                name="guia-requerente"
                className="mt-0.5"
                checked={requester === option.id}
                onChange={() => {
                  setRequester(option.id);
                  keepFiles(
                    option.id === "terceiro"
                      ? docs
                      : { ...docs, procuracao: [] },
                    option.id,
                  );
                }}
              />
              {option.text}
            </label>
          ))}
        </div>
        <FieldError message={err("requester.role")} />
        {requester === "terceiro" && (
          <label className="block">
            <span className={label}>Dados da procuração ou do mandato</span>
            <textarea
              rows={2}
              maxLength={LONG_TEXT_MAX}
              className={input}
              value={mandate}
              onChange={(event) => setMandate(event.target.value)}
              placeholder="Ex.: procuração pública lavrada no Cartório X, livro 10, folha 20, em 05/03/2026. Ou anexe a procuração abaixo."
            />
            <FieldError message={err("requester.mandate")} />
          </label>
        )}
      </div>

      {/* 2. The documents, apart by whose they are. */}
      <div className="flex flex-col gap-3 rounded-xl border-[1.5px] border-dashed border-brand-border bg-brand-card p-4">
        <div>
          <p className="text-[13px] font-bold text-brand-primary">
            2. Anexe os documentos de cada parte
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-brand-muted">
            Separados por quem vende, quem compra e o imóvel, a serventia sabe
            de quem é cada um. Em{" "}
            <strong className="font-semibold text-brand-text">
              PDF pesquisável
            </strong>{" "}
            (que dá para selecionar o texto), o sistema lê e preenche os campos
            abaixo; foto ou digitalização vai anexada e você preenche. Até{" "}
            {GUIDE_MAX_FILES} arquivos ao todo, foto ou PDF.
          </p>
        </div>
        {/* Every file, in one field, straight to the store on sending. */}
        <input
          ref={filesInput}
          type="file"
          name="guiaAnexos"
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
        {ordered.map(({ file, group }) => (
          <input
            key={`${group}-${file.name}-${file.lastModified}`}
            type="hidden"
            name="guiaAnexosName"
            value={groupLabel[group].replace("Documentos: ", "Documento: ")}
          />
        ))}
        {groups.map((group) => (
          <div
            key={group}
            className="rounded-xl border border-brand-border p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-brand-text">
                  {groupLabel[group]}
                </p>
                <p className="text-[12px] leading-snug text-brand-muted">
                  {groupHint[group]}
                </p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-brand-border px-3 py-2 text-[12.5px] font-semibold text-brand-primary hover:border-brand-accent has-[:focus-visible]:border-brand-accent">
                + Anexar
                <input
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  className="sr-only"
                  aria-label={`Anexar ${groupLabel[group]}`}
                  onChange={(event) => {
                    addDocuments(group, event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {docs[group].length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {docs[group].map((file, index) => (
                  <li
                    key={`${file.name}-${file.lastModified}`}
                    className="flex items-center gap-2 text-[12.5px] text-brand-text"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      📄 {file.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-brand-faint">
                      {(file.size / 1024 / 1024).toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      MB
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[12px] font-semibold text-brand-muted hover:text-brand-alert"
                      onClick={() => removeDocument(group, index)}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {reading && (
          <p className="text-[12.5px] font-semibold text-brand-primary">
            Lendo os documentos...
          </p>
        )}
        {docError && (
          <p className="text-xs font-semibold text-brand-alert">{docError}</p>
        )}
        {notes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {notes.map((note) => (
              <li key={note} className="text-[12px] text-brand-muted">
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[13px] font-bold text-brand-primary">
        3. Confira os dados das partes
      </p>
      {(["transmitente", "adquirente"] as const).map((role) => (
        <div key={role} className="flex flex-col gap-3">
          <p className="text-[13px] font-bold text-brand-primary">
            {requester === role
              ? `Requerente/${info.roles[role]}`
              : info.roles[role]}
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
                {/* Married: the spouse and the regime, as the deed and the
                    registry ask (decision of 19/11/2026). */}
                {party.civilStatus === "casado" && (
                  <div className="grid gap-3 rounded-xl bg-brand-tint/60 p-3 md:col-span-2 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className={label}>Nome completo do cônjuge</span>
                      <input
                        className={input}
                        value={party.spouseName ?? ""}
                        onChange={(e) =>
                          setParty(index, { spouseName: e.target.value })
                        }
                      />
                      <FieldError
                        message={err(`parties.${index}.spouseName`)}
                      />
                    </label>
                    <label className="block">
                      <span className={label}>
                        CPF do cônjuge{" "}
                        <span className="font-normal text-brand-muted">
                          · se souber
                        </span>
                      </span>
                      <input
                        className={input}
                        inputMode="numeric"
                        value={party.spouseTaxId ?? ""}
                        onChange={(e) =>
                          setParty(index, { spouseTaxId: e.target.value })
                        }
                      />
                      <FieldError
                        message={err(`parties.${index}.spouseTaxId`)}
                      />
                    </label>
                    <label className="block">
                      <span className={label}>Regime de bens</span>
                      <select
                        className={input}
                        value={party.marriageRegime ?? ""}
                        onChange={(e) =>
                          setParty(index, {
                            marriageRegime: (e.target.value ||
                              undefined) as PublicGuideParty["marriageRegime"],
                          })
                        }
                      >
                        <option value="">Escolher…</option>
                        {MARRIAGE_REGIMES.map((regime) => (
                          <option key={regime} value={regime}>
                            {MARRIAGE_REGIME_LABELS[regime]
                              .charAt(0)
                              .toLocaleUpperCase("pt-BR") +
                              MARRIAGE_REGIME_LABELS[regime].slice(1)}
                          </option>
                        ))}
                      </select>
                      <FieldError
                        message={err(`parties.${index}.marriageRegime`)}
                      />
                    </label>
                  </div>
                )}
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

      <p className="text-[13px] font-bold text-brand-primary">
        4. O bem e o valor
      </p>
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
