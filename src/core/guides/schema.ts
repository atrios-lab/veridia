import { z } from "zod";
import { isValidCpf } from "../request/form.ts";
import { isValidCnpj } from "../tenant/pix.ts";

/**
 * A guia imobiliária as the office fills it in the panel: who transmits,
 * who acquires, which property, at what value. The shape is the same for
 * every kind (ITIV, ITCD, laudêmio municipal, certidão imobiliária); the
 * catalog (catalog.ts) says what each kind calls its parties and whether it
 * carries a tax at all.
 */

export const GUIDE_KINDS = [
  "itiv",
  "itcd-doacao",
  "itcd-causa-mortis",
  "laudemio-municipal",
  "certidao-imobiliaria",
] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];

/**
 * The kinds offered for a new guia. The certidão de débitos imobiliários
 * (IPTU) is no longer one (product decision of 09/11/2026: the debt shows
 * when the fisco issues the ITIV), but stays in `GUIDE_KINDS` so a guia
 * already issued as one still reads and prints.
 */
export const OFFERED_GUIDE_KINDS: readonly GuideKind[] = GUIDE_KINDS.filter(
  (kind) => kind !== "certidao-imobiliaria",
);

const text = (max: number, required?: string) =>
  required
    ? z.string().trim().min(1, required).max(max, `Use até ${max} caracteres.`)
    : z.string().trim().max(max, `Use até ${max} caracteres.`);

/** CPF or CNPJ, checked by its own digits; stored as typed. */
const taxId = z
  .string()
  .trim()
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, "");
      if (digits.length === 0) return true;
      return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
    },
    { message: "CPF ou CNPJ inválido." },
  );

export const CIVIL_STATUSES = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "separado",
] as const;

export const STABLE_UNION_OPTIONS = [
  "declara-nao-mantem",
  "declara-mantem",
  "nao",
  "sim",
  "nao-informado",
] as const;
export type StableUnion = (typeof STABLE_UNION_OPTIONS)[number];

export const MARRIAGE_REGIMES = [
  "comunhao-parcial",
  "comunhao-universal",
  "separacao-total",
  "separacao-obrigatoria",
  "participacao-final",
] as const;

/**
 * A party qualified the way the registry reads it: Lei 6.015/1973, art.
 * 176, § 1º, III, 2 (nome, domicílio, nacionalidade; estado civil,
 * profissão, CPF ou RG, ou a filiação na falta deles; a sede e o CNPJ da
 * pessoa jurídica), with what the CPC, art. 319, II adds for any
 * petition: the existence of união estável and the e-mail address. The
 * text the fisco reads is built from these fields (qualification.ts), so
 * every guia qualifies its parties the same way.
 */
export const GuidePartySchema = z.object({
  /** "transmitente" sells, donates or leaves; "adquirente" receives. */
  role: z.enum(["transmitente", "adquirente"]),
  personType: z.enum(["fisica", "juridica"]),
  name: text(160, "Informe o nome."),
  /** Agreement of the qualification ("brasileira, solteira, inscrita"). */
  gender: z.enum(["feminino", "masculino"]),
  nationality: text(60),
  civilStatus: z.enum(CIVIL_STATUSES).optional(),
  marriageRegime: z.enum(MARRIAGE_REGIMES).optional(),
  /** Where and when the marriage was registered, as the deed cites it. */
  marriageRecord: text(400),
  /** CPC, art. 319, II: whether the party lives in união estável. */
  // "declara-*": the declaration made under the penalties of the law, as the
  // registry asks of anyone not married (solteiro, viúvo, separado,
  // divorciado); "sim" and "nao" are the shorter wording kept for the
  // guias already issued with it.
  stableUnion: z.enum(STABLE_UNION_OPTIONS),
  profession: text(80),
  taxId,
  /** "RG nº 1.234.567, SSP/RN, expedido em 01/01/2020" */
  identity: text(200),
  /** Lei 6.015, art. 176: required when there is neither CPF nor RG. */
  filiation: text(300),
  email: text(160),
  /** Domicílio e residência (or the PJ's sede). */
  address: text(300),
  /** "neste ato representado por sua genitora, Fulana, CPF..." */
  representation: text(600),
});
export type GuideParty = z.infer<typeof GuidePartySchema>;

export const GuidePropertySchema = z.object({
  type: z.enum(["urbano", "rural"]),
  /** Location, area, limits and confrontations, as on the certidão. */
  description: text(4000, "Descreva o imóvel."),
  /** Inscrição imobiliária (urbano) or CCIR/CAR/NIRF (rural). */
  fiscalRegistration: text(120),
  /** Matrícula, livro, folhas, registro: how the registry identifies it. */
  registration: text(500),
});
export type GuideProperty = z.infer<typeof GuidePropertySchema>;

export const GuideSchema = z.object({
  kind: z.enum(GUIDE_KINDS),
  parties: z
    .array(GuidePartySchema)
    .min(1, "Informe ao menos uma parte.")
    .max(20, "Use até 20 partes."),
  property: GuidePropertySchema,
  /** "compra e venda", "permuta", "doação com reserva de usufruto"... */
  nature: text(120),
  /** In cents, as the deed declares it. Zero for a certidão. */
  declaredValueCents: z
    .number()
    .int()
    .min(0, "Valor inválido.")
    .max(100_000_000_000, "Valor alto demais."),
  /**
   * The rate this guia applies, in hundredths of a percent (300 = 3%):
   * the office's default for the kind, which the clerk may change for a
   * case the default does not fit (a progressive bracket, a reduced rate).
   */
  rateBasisPoints: z.number().int().min(0).max(10_000),
  /**
   * The clerk chose the rate by hand where the kind has its own rule (the
   * RN's ITCD brackets): the guia then charges `rateBasisPoints` flat.
   */
  manualRate: z.boolean().default(false),
  /** The tax as the clerk set it, overriding the computed one; null = computed. */
  taxOverrideCents: z
    .number()
    .int()
    .min(0, "Valor inválido.")
    .max(100_000_000_000, "Valor alto demais.")
    .nullable()
    .default(null),
  /** This guia's addressee, when it differs from the settings'; "" = settings. */
  addresseeText: text(400).default(""),
  /** This guia's local law, when it differs from the settings'; "" = settings. */
  lawText: text(400).default(""),
  /** Anything else the fisco should read: the death date, the process. */
  notes: text(2000),
  /** Who signs, by index into the office's signers. */
  signer: z.number().int().min(0).max(20),
});
export type Guide = z.infer<typeof GuideSchema>;

/**
 * The office's own settings for the guias, edited on the Utilitários screen
 * and kept in `tenant_content`: the municipality's tax office and law, the
 * state's, and who signs. The rates are the office's defaults, never a
 * claim that they are right: a law changes, and the office corrects it here.
 */
export const GuideSettingsSchema = z.object({
  municipal: z.object({
    /** "Prefeitura Municipal de Ielmo Marinho/RN" */
    authority: text(160),
    /** The prefeitura's CNPJ, printed after its name. */
    cnpj: text(20),
    /** "Secretaria Municipal de Tributação / Finanças" */
    addressee: text(200),
    /** "Lei Complementar nº 44, de 30 de dezembro de 2021, art. 91" */
    itivLaw: text(300),
    itivRateBasisPoints: z.number().int().min(0).max(10_000),
    /** The municipal laudêmio's law and rate, when the town has foreiros. */
    laudemioLaw: text(300),
    laudemioRateBasisPoints: z.number().int().min(0).max(10_000),
  }),
  state: z.object({
    /** "Coordenadoria de Arrecadação, Controle e Estatística (CACE)" */
    addressee: text(200),
    /** The coordinator's name, as the office writes it; optional. */
    addresseeName: text(160),
    itcdLaw: text(400),
    itcdRateBasisPoints: z.number().int().min(0).max(10_000),
  }),
  signers: z
    .array(
      z.object({
        name: text(160, "Informe o nome de quem assina."),
        title: text(160),
        /** "Portaria/Matrícula: 001/2010/256574 (TJRN)" */
        note: text(160),
      }),
    )
    .max(20),
});
export type GuideSettings = z.infer<typeof GuideSettingsSchema>;

/** "001/2026": the number as the office's papers print it. */
export function formatGuideNumber(year: number, sequence: number): string {
  return `${String(sequence).padStart(3, "0")}/${year}`;
}

/**
 * How long the platform keeps a guia: a year after it was issued. Then it
 * leaves the main list for "prazo de guarda vencido", with the reminder to
 * download it into the office's own archive. Nothing is erased by itself.
 */
export const RETENTION_MONTHS = 12;
/** How early the reminder starts, before the year is up. */
export const RETENTION_WARNING_DAYS = 30;

/** The day the guia's year in the platform ends. */
export function retentionEnds(issuedAt: Date): Date {
  const end = new Date(issuedAt);
  // UTC, never the process's own zone: a year later, to the instant.
  end.setUTCMonth(end.getUTCMonth() + RETENTION_MONTHS);
  return end;
}

export type RetentionState = "kept" | "ending" | "past";

export function retentionState(issuedAt: Date, now: Date): RetentionState {
  const end = retentionEnds(issuedAt).getTime();
  if (now.getTime() >= end) return "past";
  const warn = end - RETENTION_WARNING_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= warn ? "ending" : "kept";
}

/** 300 → "3%", 250 → "2,5%", 175 → "1,75%". */
export function formatRate(basisPoints: number): string {
  const percent = basisPoints / 100;
  return `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** The tax a rate yields on a value, rounded to the cent. */
export function taxOn(valueCents: number, basisPoints: number): number {
  return Math.round((valueCents * basisPoints) / 10_000);
}

/** A blank party of the given side, as the form adds one. */
export function emptyParty(role: GuideParty["role"]): GuideParty {
  return {
    role,
    personType: "fisica",
    name: "",
    gender: "feminino",
    nationality: "brasileira",
    civilStatus: undefined,
    marriageRegime: undefined,
    marriageRecord: "",
    stableUnion: "nao-informado",
    profession: "",
    taxId: "",
    identity: "",
    filiation: "",
    email: "",
    address: "",
    representation: "",
  };
}

/** The office's default rate for a kind; zero where the rate is not fixed. */
export function rateFor(kind: GuideKind, settings: GuideSettings): number {
  if (kind === "itiv") return settings.municipal.itivRateBasisPoints;
  if (kind === "laudemio-municipal") {
    return settings.municipal.laudemioRateBasisPoints;
  }
  return 0;
}

/** A new ITIV guia: one party on each side, the office's rate. */
export function emptyGuide(settings: GuideSettings): Guide {
  return {
    kind: "itiv",
    parties: [emptyParty("transmitente"), emptyParty("adquirente")],
    property: {
      type: "urbano",
      description: "",
      fiscalRegistration: "",
      registration: "",
    },
    nature: "compra e venda",
    declaredValueCents: 0,
    rateBasisPoints: rateFor("itiv", settings),
    manualRate: false,
    taxOverrideCents: null,
    addresseeText: "",
    lawText: "",
    notes: "",
    signer: 0,
  };
}
