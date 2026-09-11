import { z } from "zod";
import type { Act, CertificateType } from "../acts/catalog.ts";
import { EXEMPTION_SIGNED_BY, type ExemptionBeneficiary } from "./kinds.ts";

// The three `CertificateType` values, repeated here rather than imported as a
// value from `catalog.ts`: `tenant/pix.ts` imports this file for `isValidCpf`,
// and `catalog.ts` imports `tenant/schema.ts`, which imports `pix.ts` — a
// value import back from here to `catalog.ts` closes that cycle and the
// module that runs last sees the other half-initialised. `CertificateType`
// itself is a type-only import above, erased before any of this runs, and
// `request.test.ts` guards the two lists staying the same by parsing every
// value `CERTIFICATE_TYPES` (catalog.ts) declares through this schema.
const CERTIFICATE_TYPE_VALUES = ["sem-busca", "com-busca", "inteiro-teor"] as const;

/** Digits only, the way a CPF is stored and compared. */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Check digits, not just eleven digits. A typo caught here is a request the
 * office does not have to chase the citizen about later.
 */
export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  // Repeated digits pass the arithmetic but are never issued.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  for (const [length, position] of [
    [9, 10],
    [10, 11],
  ]) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (position - i);
    }
    const remainder = (sum * 10) % 11;
    const expected = remainder === 10 ? 0 : remainder;
    if (expected !== Number(digits[length])) return false;
  }
  return true;
}

/**
 * Shown to an operator who has no reason to see the whole number: only the
 * digits that identify which citizen this is, never the ones a person could
 * reuse elsewhere.
 */
export function maskCpf(value: string): string {
  const d = normalizeCpf(value);
  if (d.length !== 11) return value;
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

/** Mask as the citizen types: 123.456.789-09. Presentation only. */
export function formatCpf(value: string): string {
  const d = normalizeCpf(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

/**
 * Phone mask for the mixed contact field: only applied when the value is
 * numeric, so an e-mail passes through untouched.
 */
export function formatPhone(value: string): string {
  if (!/^[\d\s()-]+$/.test(value)) return value;
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  // 10 digits = landline (0000-0000), 11 = mobile (00000-0000).
  const split = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * One field for e-mail or WhatsApp, as the redesign asks: a citizen who only
 * uses WhatsApp should not have to invent an address to be answered.
 */
export function isValidContact(value: string): boolean {
  const trimmed = value.trim();
  if (EMAIL.test(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  // Brazilian numbers with area code, mobile or landline.
  return digits.length === 10 || digits.length === 11;
}

/**
 * Whether the mixed contact field holds an e-mail rather than a phone
 * number, conservative on purpose: anything that does not clearly match
 * gets treated as "not an e-mail", so a notification never fires at a
 * malformed address instead of quietly not firing at all.
 */
export function isEmailContact(value: string): boolean {
  return EMAIL.test(value.trim());
}

/**
 * A Brazilian number with area code, mobile or landline. Its own check
 * because the agenda asks for the telephone in its own field, next to a
 * required e-mail, rather than in the either/or field the other channels use.
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

const requiredText = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z.string().min(1, "Preencha este campo.").max(max, "Texto longo demais."),
    );

const optionalText = (max: number) =>
  z
    .string()
    // The client only registers the fields the act renders, so a field the
    // act does not ask for arrives as undefined, not "".
    .default("")
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().max(max, "Texto longo demais."))
    .transform((s) => (s === "" ? undefined : s));

/**
 * What every filing of a service request asks, whichever counter it comes
 * through. What differs between them is the identification, and only that:
 * the site asks for an e-mail it can write to, the balcão has the citizen
 * standing there and takes whichever contact they have.
 */
const commonFields = {
  applicantName: requiredText(160),
  cpf: z
    .string()
    .transform((s) => normalizeCpf(s))
    .refine((s) => s === "" || isValidCpf(s), {
      message: "CPF inválido.",
    })
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
  description: optionalText(4000),
  purpose: optionalText(500),
  // Never a price: it is what the operator needs to find the band in the
  // court's fee table.
  parameterValue: optionalText(120),
  lgpdConsent: z.coerce.boolean(),
  truthDeclaration: z.coerce.boolean(),
};

/** Empty string or absent both mean "not filled", the way `optionalText`
 * treats them for the fields the act always registers. A person block reads
 * these the same way, whether it came from the online form or the balcão. */
const optionalPersonText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((s) => s?.trim() || undefined)
    .pipe(z.string().max(max, "Texto longo demais.").optional());

const exemptionPersonSchema = z.object({
  name: optionalPersonText(160),
  cpfOrId: optionalPersonText(30),
  contact: optionalPersonText(160),
});

const exemptionSignerSchema = exemptionPersonSchema.extend({
  capacity: optionalPersonText(160),
  proofDocument: optionalPersonText(160),
});

/**
 * One beneficiary's declaration as the form sends it: every field optional at
 * this layer (`actRules` below is what makes the name and the signer
 * mandatory), because the raw shape has to parse before business rules can
 * even look at it. `signedBy` defaults to `"self"`: a block the citizen never
 * touched is the citizen declaring for themselves, not a missing answer.
 */
const exemptionBeneficiarySchema = z.object({
  name: optionalPersonText(160),
  cpfOrId: optionalPersonText(30),
  birthDate: optionalPersonText(20),
  occupation: optionalPersonText(160),
  address: optionalPersonText(200),
  cityState: optionalPersonText(120),
  zip: optionalPersonText(20),
  contact: optionalPersonText(160),
  signedBy: z.preprocess(
    (v) => (typeof v === "string" && v !== "" ? v : "self"),
    z.enum(EXEMPTION_SIGNED_BY),
  ),
  signer: exemptionSignerSchema.optional(),
  witnesses: z.array(exemptionPersonSchema).optional(),
});
type ExemptionBeneficiaryFormInput = z.infer<typeof exemptionBeneficiarySchema>;

const certificateTypeSchema = z.preprocess(
  (v) => (typeof v === "string" && v !== "" ? v : undefined),
  z.enum(CERTIFICATE_TYPE_VALUES).optional(),
);

const exemptionFields = {
  // `.default("self")` no beneficiário já cobre o campo ausente; aqui é só a
  // leitura do ato-alvo e da declaração, iguais nos dois canais.
  //
  // `.nullish()` porque um grupo de radios sem nenhum marcado chega como null
  // pelo react-hook-form, e o objeto base falharia nele com "expected string"
  // no lugar da mensagem que diz o que fazer.
  exemptionActId: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || undefined),
  exemptionDeclaration: z.coerce.boolean().default(false),
  certificateType: certificateTypeSchema,
  beneficiaries: z.array(exemptionBeneficiarySchema).optional(),
};

/**
 * The rules the act imposes on the fields above. Written against the fields
 * they read rather than against a whole schema, so both filings share one
 * copy: a rule that exists twice is a rule that will be changed once.
 *
 * Two acts ask different questions, and the difference is law, not
 * preference: only the acts that may ask for a purpose carry the field, and
 * "outros" cannot be read without a description.
 *
 * `channel` is the one difference between the site and the balcão in the
 * gratuidade block (Provimento CGJ/TJRN n. 7/2026, art. 7º): testemunhas da
 * assinatura a rogo só existem onde alguém está de fato assinando na frente
 * do operador, então o site as recusa e o balcão as exige.
 */
function actRules(act: Act, options: { channel: "online" | "counter" } = { channel: "online" }) {
  return (
    data: {
      lgpdConsent: boolean;
      truthDeclaration: boolean;
      description?: string;
      purpose?: string;
      exemptionActId?: string;
      exemptionDeclaration?: boolean;
      certificateType?: CertificateType;
      beneficiaries?: ExemptionBeneficiaryFormInput[];
    },
    ctx: z.RefinementCtx,
  ) => {
    if (!data.lgpdConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["lgpdConsent"],
        message: "É necessário autorizar o tratamento dos dados para enviar.",
      });
    }
    if (!data.truthDeclaration) {
      ctx.addIssue({
        code: "custom",
        path: ["truthDeclaration"],
        message: "É necessário declarar que as informações são verdadeiras.",
      });
    }
    if (act.requiresDescription && !data.description) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Descreva o que você precisa para a serventia poder avaliar.",
      });
    }
    if (act.requiresPurpose && !data.purpose) {
      ctx.addIssue({
        code: "custom",
        path: ["purpose"],
        message: "Este ato exige que você informe a finalidade.",
      });
    }
    if (act.exemptionTargets) {
      // Which act the exemption is for is the first question the form asks,
      // and the only place it is answered: a filing that skips the client is
      // refused here, the same discipline the honeypot and the consents
      // follow.
      const requested = act.exemptionTargets.find(
        (target) => target.id === data.exemptionActId,
      );
      if (!requested) {
        ctx.addIssue({
          code: "custom",
          path: ["exemptionActId"],
          message: "Escolha o ato para o qual você pede a gratuidade.",
        });
      }
      if (!data.exemptionDeclaration) {
        ctx.addIssue({
          code: "custom",
          path: ["exemptionDeclaration"],
          message:
            "Para pedir a gratuidade é necessário fazer a declaração acima.",
        });
      }
      const asksCertificateType = requested?.feeExemption?.askCertificateType;
      if (asksCertificateType && !data.certificateType) {
        ctx.addIssue({
          code: "custom",
          path: ["certificateType"],
          message: "Escolha o tipo da certidão.",
        });
      } else if (!asksCertificateType && data.certificateType) {
        ctx.addIssue({
          code: "custom",
          path: ["certificateType"],
          message: "Este ato não pede o tipo de certidão.",
        });
      }
      const beneficiaryCount = requested?.feeExemption?.beneficiaryCount ?? 1;
      const beneficiaries = data.beneficiaries ?? [];
      for (let i = 0; i < beneficiaryCount; i++) {
        const beneficiary = beneficiaries[i];
        if (!beneficiary?.name) {
          ctx.addIssue({
            code: "custom",
            path: ["beneficiaries", i, "name"],
            message: "Informe o nome da pessoa beneficiária.",
          });
        }
        if (
          beneficiary &&
          beneficiary.signedBy !== "self" &&
          !beneficiary.signer?.name
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["beneficiaries", i, "signer", "name"],
            message: "Informe o nome de quem assina em lugar do beneficiário.",
          });
        }
        const witnesses = (beneficiary?.witnesses ?? []).filter((w) => w.name);
        if (beneficiary?.signedBy === "on-behalf") {
          if (options.channel === "online" && witnesses.length > 0) {
            ctx.addIssue({
              code: "custom",
              path: ["beneficiaries", i, "witnesses"],
              message:
                "As testemunhas assinam no balcão, não pelo site: deixe em branco.",
            });
          }
          if (options.channel === "counter" && witnesses.length < 2) {
            ctx.addIssue({
              code: "custom",
              path: ["beneficiaries", i, "witnesses"],
              message: "Informe as duas testemunhas da assinatura a rogo.",
            });
          }
        } else if (witnesses.length > 0) {
          ctx.addIssue({
            code: "custom",
            path: ["beneficiaries", i, "witnesses"],
            message: "Testemunhas só se aplicam à assinatura a rogo.",
          });
        }
      }
    } else if (data.exemptionActId) {
      ctx.addIssue({
        code: "custom",
        path: ["exemptionActId"],
        message: "A gratuidade é pedida pelo ato próprio da lista.",
      });
    }
  };
}

/** How many beneficiary blocks and witness slots the form ever renders: the
 * ceiling `readExemptionForm` reads up to, so it never scans an unbounded
 * `FormData` for keys nobody sent. */
const MAX_EXEMPTION_BENEFICIARIES = 2;
const MAX_EXEMPTION_WITNESSES = 2;

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Reads the gratuidade block out of a raw `FormData`, both channels: the
 * flat, dot-indexed field names `beneficiaries.<i>.<field>` (and
 * `beneficiaries.<i>.signer.<field>` / `.witnesses.<j>.<field>`) that
 * `react-hook-form` writes for a fixed-size list without `useFieldArray`. A
 * beneficiary block that the screen never rendered (habilitação's second
 * nubente on any other act) leaves no `.name` key at all, so the loop stops
 * there instead of reading blanks nobody typed.
 */
export function readExemptionForm(formData: FormData) {
  const beneficiaries = [];
  for (let i = 0; i < MAX_EXEMPTION_BENEFICIARIES; i++) {
    const prefix = `beneficiaries.${i}`;
    if (!formData.has(`${prefix}.name`)) break;
    const witnesses = [];
    for (let w = 0; w < MAX_EXEMPTION_WITNESSES; w++) {
      const witnessPrefix = `${prefix}.witnesses.${w}`;
      if (!formData.has(`${witnessPrefix}.name`)) continue;
      witnesses.push({
        name: stringField(formData, `${witnessPrefix}.name`),
        cpfOrId: stringField(formData, `${witnessPrefix}.cpfOrId`),
        contact: stringField(formData, `${witnessPrefix}.contact`),
      });
    }
    beneficiaries.push({
      name: stringField(formData, `${prefix}.name`),
      cpfOrId: stringField(formData, `${prefix}.cpfOrId`),
      birthDate: stringField(formData, `${prefix}.birthDate`),
      occupation: stringField(formData, `${prefix}.occupation`),
      address: stringField(formData, `${prefix}.address`),
      cityState: stringField(formData, `${prefix}.cityState`),
      zip: stringField(formData, `${prefix}.zip`),
      contact: stringField(formData, `${prefix}.contact`),
      signedBy: stringField(formData, `${prefix}.signedBy`),
      signer: {
        name: stringField(formData, `${prefix}.signer.name`),
        cpfOrId: stringField(formData, `${prefix}.signer.cpfOrId`),
        contact: stringField(formData, `${prefix}.signer.contact`),
        capacity: stringField(formData, `${prefix}.signer.capacity`),
        proofDocument: stringField(formData, `${prefix}.signer.proofDocument`),
      },
      witnesses,
    });
  }
  return {
    exemptionActId: formData.get("exemptionActId") ?? "",
    exemptionDeclaration: formData.get("exemptionDeclaration") ?? "",
    certificateType: formData.get("certificateType") ?? "",
    beneficiaries,
  };
}

/**
 * `details.exemption`, built from what `publicServiceRequestSchema` or
 * `serviceRequestSchema` already validated (`actRules` ran first: by the time
 * this is called, every required name and signer is present). `undefined`
 * when the citizen did not ask for the act's own exemption entry — a filing
 * of any other act simply has no `exemptionActId`.
 */
export function buildExemptionDetails(
  parsed: {
    exemptionActId?: string;
    certificateType?: CertificateType;
    beneficiaries?: ExemptionBeneficiaryFormInput[];
  },
  declaredAt: string,
):
  | {
      declaredAt: string;
      actId: string;
      certificateType?: CertificateType;
      beneficiaries: ExemptionBeneficiary[];
    }
  | undefined {
  if (!parsed.exemptionActId) return undefined;
  const beneficiaries: ExemptionBeneficiary[] = (parsed.beneficiaries ?? [])
    .filter((b): b is ExemptionBeneficiaryFormInput & { name: string } =>
      Boolean(b.name),
    )
    .map((b) => {
      const witnesses =
        b.witnesses?.length === 2 && b.witnesses[0]?.name && b.witnesses[1]?.name
          ? ([
              {
                name: b.witnesses[0].name,
                cpfOrId: b.witnesses[0].cpfOrId,
                contact: b.witnesses[0].contact,
              },
              {
                name: b.witnesses[1].name,
                cpfOrId: b.witnesses[1].cpfOrId,
                contact: b.witnesses[1].contact,
              },
            ] as const)
          : undefined;
      return {
        name: b.name,
        cpfOrId: b.cpfOrId,
        birthDate: b.birthDate,
        occupation: b.occupation,
        address: b.address,
        cityState: b.cityState,
        zip: b.zip,
        contact: b.contact,
        signedBy: b.signedBy,
        signer:
          b.signedBy !== "self" && b.signer?.name
            ? {
                name: b.signer.name,
                cpfOrId: b.signer.cpfOrId,
                contact: b.signer.contact,
                capacity: b.signer.capacity,
                proofDocument: b.signer.proofDocument,
              }
            : undefined,
        witnesses: witnesses ? [...witnesses] : undefined,
      };
    });
  return {
    declaredAt,
    actId: parsed.exemptionActId,
    certificateType: parsed.certificateType,
    beneficiaries,
  };
}

/**
 * The filing the citizen makes on the site. Two identification fields, not
 * the either/or the other channels use: a request filed with only a telephone
 * number never received the protocol e-mail nor any andamento notice, because
 * there was no address to send them to. The office answers by telephone, so
 * the number is asked for as well, and it stays optional: nobody is turned
 * away for not having one.
 */
export function publicServiceRequestSchema(act: Act) {
  return z
    .object({
      ...commonFields,
      email: requiredText(160).refine((value) => EMAIL.test(value), {
        message: "Informe um e-mail válido.",
      }),
      phone: optionalText(40).refine(
        (value) => value === undefined || isValidPhone(value),
        { message: "Informe um telefone com DDD." },
      ),
      ...exemptionFields,
    })
    .superRefine(actRules(act, { channel: "online" }));
}

export type PublicServiceRequestInput = z.infer<
  ReturnType<typeof publicServiceRequestSchema>
>;

/**
 * The filing the operator makes at the counter. The contact stays the either/
 * or field on purpose: the balcão is where someone with no e-mail is served,
 * and it is the operator typing, with the citizen in front of them. The
 * gratuidade block is the same as the site's, plus the testemunhas that only
 * the balcão ever collects (Provimento CGJ/TJRN n. 7/2026, art. 7º III).
 */
export function serviceRequestSchema(act: Act) {
  return z
    .object({
      ...commonFields,
      contact: requiredText(160).refine(isValidContact, {
        message: "Informe um e-mail válido ou um telefone com DDD.",
      }),
      ...exemptionFields,
    })
    .superRefine(actRules(act, { channel: "counter" }));
}

export type ServiceRequestInput = z.infer<
  ReturnType<typeof serviceRequestSchema>
>;

/**
 * Invisible field no person ever sees, so anything in it came from a script.
 * The office asked for no CAPTCHA: the citizen should not solve a puzzle to
 * ask for a birth certificate.
 */
export function looksLikeBot(honeypot: FormDataEntryValue | null): boolean {
  return typeof honeypot === "string" && honeypot.trim() !== "";
}
