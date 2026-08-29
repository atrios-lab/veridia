import { z } from "zod";
import { addDays, type IsoDate } from "../scheduling/calendar.ts";
import {
  isValidContact,
  isValidCpf,
  isValidPhone,
  normalizeCpf,
} from "./form.ts";
import {
  type DataRight,
  DataRightSchema,
  type ManifestationType,
  ManifestationTypeSchema,
} from "./kinds.ts";

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
    .default("")
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().max(max, "Texto longo demais."))
    .transform((s) => (s === "" ? undefined : s));

/* ------------------------------------------------------------------ agendar */

/**
 * A day, a time, who is coming and what for.
 *
 * The e-mail is required and is not one of two options: it is the only channel
 * the appointment has: confirmation, cancellation and the link that lets the
 * citizen call it off all travel through it. The telephone is the office's way
 * of reaching a person the same day. The CPF is optional on purpose: most
 * counter visits do not need it before the citizen shows up with the document.
 *
 * The service and the mode are checked against what the office actually
 * offers, not against a list this module knows: both are the serventia's to
 * edit.
 */
export function appointmentSchema(options: {
  serviceIds: readonly string[];
  modes: readonly string[];
}) {
  return z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha um dia de atendimento."),
    slotTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escolha um horário livre."),
    citizenName: requiredText(160),
    email: z.email("Informe um e-mail válido para receber a confirmação."),
    phone: requiredText(40).refine(isValidPhone, {
      message: "Informe um telefone com DDD.",
    }),
    cpf: z
      .string()
      .default("")
      .transform((s) => normalizeCpf(s))
      .refine((s) => s === "" || isValidCpf(s), { message: "CPF inválido." })
      .transform((s) => (s === "" ? undefined : s)),
    serviceId: z
      .string()
      .refine((id) => options.serviceIds.includes(id), "Escolha um serviço."),
    mode: z
      .string()
      .refine(
        (mode) => options.modes.includes(mode),
        "Escolha o modo de atendimento.",
      ),
  });
}

export type AppointmentInput = z.infer<ReturnType<typeof appointmentSchema>>;

/* --------------------------------------------------------------------- lgpd */

/**
 * The rights of a data subject, said the way the person would say them. The
 * legal name is the subtitle, not the label: a citizen who has to recognise
 * "portabilidade" to pick the right option is being asked to know the statute
 * before exercising it.
 */
export const DATA_RIGHT_OPTIONS: {
  id: DataRight;
  label: string;
  legalName: string;
  hint: string;
  /** How the choice is named back on the confirmation and in the consult. */
  summary: string;
}[] = [
  {
    id: "access",
    label: "Ver quais dados vocês têm sobre mim",
    legalName: "Acesso aos dados",
    hint: "resposta em até 15 dias",
    summary: "Acesso aos meus dados",
  },
  {
    id: "rectification",
    label: "Corrigir um dado meu que está errado",
    legalName: "Correção",
    hint: "não altera registro público, só o cadastro",
    summary: "Correção de dados",
  },
  {
    id: "deletion",
    label: "Excluir dados que não são obrigatórios",
    legalName: "Exclusão",
    hint: "atos registrais têm guarda obrigatória por lei",
    summary: "Exclusão de dados",
  },
  {
    id: "other",
    label: "Outro direito ou uma dúvida",
    legalName: "Outros direitos",
    hint: "portabilidade, revogação de consentimento, informação sobre compartilhamento",
    summary: "Outro direito",
  },
];

export function dataRightOption(right: DataRight) {
  const option = DATA_RIGHT_OPTIONS.find((o) => o.id === right);
  if (!option) throw new Error(`Direito desconhecido: ${right}`);
  return option;
}

/**
 * Lei 13.709/2018, art. 19: fifteen days from the request. Fixed, unlike the
 * service request's term: this one is the law's, and the office cannot
 * stretch it from the panel.
 *
 * Counted in plain calendar days, deliberately not through the service
 * request's business-day counting: the business-day rule is Lei 14.382/2022's
 * and reaches the extrajudicial registries, not the data protection law.
 * Counting these fifteen in business days would quietly hand the office three
 * extra weeks it does not have.
 */
export const DATA_RIGHTS_DEADLINE_DAYS = 15;

export function dataRightsDeadline(requestedOn: IsoDate): IsoDate {
  return addDays(requestedOn, DATA_RIGHTS_DEADLINE_DAYS);
}

/**
 * Which day of the legal term today is, counting the day of the request as
 * day 1. Past the term it keeps counting: a deadline that stops at fifteen
 * would hide exactly the case that matters.
 */
export function dataRightsDayOfDeadline(
  requestedOn: IsoDate,
  today: IsoDate,
): number {
  const elapsed = Math.round(
    (Date.parse(`${today}T00:00:00Z`) -
      Date.parse(`${requestedOn}T00:00:00Z`)) /
      86_400_000,
  );
  return Math.max(1, elapsed + 1);
}

export const dataRightsSchema = z
  .object({
    right: DataRightSchema,
    applicantName: requiredText(160),
    email: z.email("Informe um e-mail válido."),
    cpf: z
      .string()
      .default("")
      .transform((s) => normalizeCpf(s))
      .refine((s) => s === "" || isValidCpf(s), { message: "CPF inválido." })
      .transform((s) => (s === "" ? undefined : s)),
    description: requiredText(4000),
    holderDeclaration: z.coerce.boolean(),
  })
  .refine((data) => data.holderDeclaration, {
    path: ["holderDeclaration"],
    message: "É necessário declarar que você é o titular ou representante.",
  });

export type DataRightsInput = z.infer<typeof dataRightsSchema>;

/* ---------------------------------------------------------------- ouvidoria */

export const MANIFESTATION_OPTIONS: {
  id: ManifestationType;
  label: string;
}[] = [
  { id: "praise", label: "Elogio" },
  { id: "complaint", label: "Reclamação" },
  { id: "suggestion", label: "Sugestão" },
  { id: "report", label: "Denúncia" },
];

export function manifestationLabel(type: ManifestationType): string {
  const option = MANIFESTATION_OPTIONS.find((o) => o.id === type);
  if (!option) throw new Error(`Tipo de manifestação desconhecido: ${type}`);
  return option.label;
}

/**
 * Name and contact are optional on purpose, and the office is told so before
 * the first field. A contact that is filled in still has to be reachable: an
 * unreachable contact is worse than none, because the citizen waits.
 */
export const ombudsmanSchema = z.object({
  manifestationType: ManifestationTypeSchema,
  message: requiredText(4000),
  applicantName: optionalText(160),
  contact: optionalText(160).refine(
    (v) => v === undefined || isValidContact(v),
    {
      message:
        "Informe um e-mail válido ou um telefone com DDD, ou deixe vazio.",
    },
  ),
  confidential: z.coerce.boolean().default(false),
});

export type OmbudsmanInput = z.infer<typeof ombudsmanSchema>;

/**
 * Anonymous is the absence of identification, not a checkbox. Nothing to
 * protect and nobody to answer, which is why an anonymous record gets no
 * access key, and why confidentiality only means something when there is a
 * name to keep out of the file.
 */
export function isAnonymous(input: {
  applicantName?: string;
  contact?: string;
}): boolean {
  return !input.applicantName && !input.contact;
}
