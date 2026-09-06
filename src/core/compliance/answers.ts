import { isValidCpf } from "../request/form.ts";
import { isValidCnpj } from "../tenant/pix.ts";
import {
  type Answers,
  type FieldContext,
  type FieldDef,
  isVisible,
  type ListItem,
  optionsOf,
  SECTIONS,
  type SectionDef,
  UNKNOWN,
  type Value,
} from "./sections.ts";

/**
 * What the panel already knows about the office, in the shape Seção 1, 2 and
 * 5 ask for. Built by the caller from the tenant (src/lib), so this module
 * stays free of the tenant's own schema and of where the values came from.
 */
export interface PrefillSource {
  officialName: string;
  tradeName: string;
  cns: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  attributions: readonly string[];
  ownerName: string;
  dpoName: string;
  dpoEmail: string;
}

export function prefillAnswers(source: PrefillSource): Answers {
  return {
    serventia: {
      officialName: source.officialName,
      tradeName: source.tradeName,
      cns: source.cns,
      address: source.address,
      city: source.city,
      phone: source.phone,
      email: source.email,
      attributions: [...source.attributions],
    },
    titular: { name: source.ownerName },
    encarregado: {
      who: "other",
      name: source.dpoName,
      email: source.dpoEmail,
    },
  };
}

export function isEmpty(value: Value | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return value.length === 0;
}

/**
 * The answers as the screen shows them: what the office typed, over what the
 * panel already knew, over what each field derives from earlier answers
 * (nationality from gender, the nobreak from the inventory). Sections are
 * walked in order so a default may read a default filled just before it.
 */
export function effectiveAnswers(stored: Answers, prefill: Answers): Answers {
  const answers: Answers = {};
  for (const section of SECTIONS) {
    answers[section.id] = {
      ...(prefill[section.id] ?? {}),
      ...(stored[section.id] ?? {}),
    };
  }
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (!field.defaultValue) continue;
      if (!isEmpty(answers[section.id][field.name])) continue;
      const value = field.defaultValue({ answers });
      if (value !== undefined) answers[section.id][field.name] = value;
    }
  }
  return answers;
}

/** The visible fields of a section for these answers. */
export function visibleFields(section: SectionDef, answers: Answers) {
  return section.fields.filter((f) => isVisible(f, { answers }));
}

/** Required, visible, and still empty. Looks inside list items too. */
export function missingFields(
  section: SectionDef,
  answers: Answers,
): FieldDef[] {
  const missing: FieldDef[] = [];
  for (const field of visibleFields(section, answers)) {
    const value = answers[section.id]?.[field.name];
    if (field.required && isEmpty(value)) {
      missing.push(field);
      continue;
    }
    if (field.type === "list" && Array.isArray(value)) {
      const items = value as ListItem[];
      const incomplete = items.some((item) =>
        (field.items ?? []).some(
          (sub) =>
            sub.required &&
            isVisible(sub, { answers, item }) &&
            isEmpty(item[sub.name]),
        ),
      );
      if (incomplete) missing.push(field);
    }
  }
  return missing;
}

export type SectionStatus = "not-started" | "in-progress" | "complete";

/**
 * A section the office never opened is "não iniciada" even when the panel
 * prefilled every field: the brief asks the office to confirm what it was
 * handed, and the confirmation is the visit. Once touched, it is complete
 * when nothing required is missing.
 */
export function sectionStatus(
  section: SectionDef,
  answers: Answers,
  touched: boolean,
): SectionStatus {
  if (!touched) return "not-started";
  return missingFields(section, answers).length === 0
    ? "complete"
    : "in-progress";
}

export interface Progress {
  total: number;
  complete: number;
  statuses: Record<string, SectionStatus>;
  /** Every section complete: the review screen may open. */
  ready: boolean;
}

/** `touchedAt`: ISO instant per section id, set whenever the office saves in it. */
export function progress(
  answers: Answers,
  touchedAt: Record<string, string>,
): Progress {
  const statuses: Record<string, SectionStatus> = {};
  for (const section of SECTIONS) {
    statuses[section.id] = sectionStatus(
      section,
      answers,
      Boolean(touchedAt[section.id]),
    );
  }
  const complete = Object.values(statuses).filter(
    (s) => s === "complete",
  ).length;
  return {
    total: SECTIONS.length,
    complete,
    statuses,
    ready: complete === SECTIONS.length,
  };
}

/**
 * Where "continuar de onde parei" goes: the section touched most recently
 * that is not yet complete, else the first one not complete, else the first.
 */
export function resumeSection(
  progress: Progress,
  touchedAt: Record<string, string>,
): SectionDef {
  const open = SECTIONS.filter((s) => progress.statuses[s.id] !== "complete");
  const recent = open
    .filter((s) => touchedAt[s.id])
    .sort((a, b) => touchedAt[b.id].localeCompare(touchedAt[a.id]))[0];
  return recent ?? open[0] ?? SECTIONS[0];
}

/** Sections edited after the intake was sent, for the Átrios profile. */
export function changedAfterSubmit(
  touchedAt: Record<string, string>,
  submittedAt: string | null,
): string[] {
  if (!submittedAt) return [];
  return SECTIONS.filter(
    (s) => touchedAt[s.id] && touchedAt[s.id] > submittedAt,
  ).map((s) => s.id);
}

export function unknownLabel(field: FieldDef): string {
  return typeof field.unknown === "string" ? field.unknown : "Não sei";
}

/** The value as the review screen and the Átrios profile read it. */
export function displayValue(
  field: FieldDef,
  value: Value | undefined,
  ctx: FieldContext,
): string {
  if (isEmpty(value)) return "";
  if (typeof value === "string") {
    if (value === UNKNOWN) return unknownLabel(field);
    if (field.type === "choice") {
      return (
        optionsOf(field, ctx).find((o) => o.value === value)?.label ?? value
      );
    }
    if (field.type === "money") return formatMoney(value);
    if (field.type === "date") return formatIsoDate(value);
    return value;
  }
  if (field.type === "multi") {
    const options = optionsOf(field, ctx);
    return (value as string[])
      .map((v) => options.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  const items = value as ListItem[];
  const label = field.itemLabel ?? "item";
  return `${items.length} ${items.length === 1 ? label : `${label}s`}`;
}

export function formatMoney(value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number);
}

function formatIsoDate(value: string): string {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

/**
 * Turns what the browser sent into a stored value, or refuses it. The screen
 * is not the boundary: this is, and it is the one place the shape of every
 * answer is decided.
 */
export function parseAnswer(
  field: FieldDef,
  raw: unknown,
  ctx: FieldContext,
): { value: Value } | { error: string } {
  switch (field.type) {
    case "choice": {
      const value = String(raw ?? "");
      if (value === "") return { value: "" };
      const allowed = optionsOf(field, ctx).some((o) => o.value === value);
      return allowed ? { value } : { error: "Escolha uma das opções." };
    }
    case "multi": {
      if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string")) {
        return { error: "Escolha uma ou mais opções." };
      }
      const options = optionsOf(field, ctx);
      const values = (raw as string[]).filter((v) =>
        options.some((o) => o.value === v),
      );
      return { value: values };
    }
    case "list": {
      if (!Array.isArray(raw)) return { error: "Lista inválida." };
      const items: ListItem[] = [];
      for (const entry of raw) {
        if (typeof entry !== "object" || entry === null) {
          return { error: "Lista inválida." };
        }
        const item: ListItem = {};
        for (const sub of field.items ?? []) {
          const subRaw = (entry as Record<string, unknown>)[sub.name];
          if (subRaw === undefined) continue;
          const parsed = parseAnswer(sub, subRaw, {
            ...ctx,
            item: entry as ListItem,
          });
          if ("error" in parsed) return parsed;
          if (
            Array.isArray(parsed.value) &&
            parsed.value.some((v) => typeof v !== "string")
          ) {
            return { error: "Lista inválida." };
          }
          item[sub.name] = parsed.value as string | string[];
        }
        items.push(item);
      }
      return { value: items };
    }
    default: {
      if (typeof raw !== "string") return { error: "Valor inválido." };
      const value = raw.trim();
      if (value === "" || (field.unknown && value === UNKNOWN))
        return { value };
      return validateText(field, value);
    }
  }
}

function validateText(
  field: FieldDef,
  value: string,
): { value: Value } | { error: string } {
  if (value.length > 2000) return { error: "Texto longo demais." };
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { error: "Informe um e-mail válido." };
  }
  if (
    (field.type === "number" || field.type === "money") &&
    !Number.isFinite(Number(value))
  ) {
    return { error: "Informe um número." };
  }
  if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: "Informe uma data." };
  }
  if (field.name === "cpf" && !isValidCpf(value)) {
    return { error: "CPF inválido. Confira os dígitos." };
  }
  if (field.name === "cnpj" && !isValidCnpj(value)) {
    return { error: "CNPJ inválido. Confira os dígitos." };
  }
  if (field.name === "document" && !isValidCpf(value) && !isValidCnpj(value)) {
    return { error: "CPF ou CNPJ inválido. Confira os dígitos." };
  }
  if (field.name === "cns" && !/^\d{2}\.?\d{3}-?\d$/.test(value)) {
    return { error: "O CNS tem seis dígitos (ex.: 09.473-0)." };
  }
  return { value };
}
