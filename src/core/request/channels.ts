import { z } from "zod";
import { addDays, type IsoDate } from "../scheduling/calendar.ts";
import type { SchedulingWindow } from "../scheduling/slots.ts";
import { isValidContact, isValidCpf, normalizeCpf } from "./form.ts";
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
 * A band, a day and how to be reached. No act, no purpose, no document list:
 * the citizen who needs the counter should not have to know the name of the
 * act to ask for an hour of it.
 */
export function appointmentSchema(window: SchedulingWindow) {
  return z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha um dia de atendimento."),
    slotHour: z.coerce
      .number()
      .int()
      .refine(
        (hour) => hour >= window.startHour && hour < window.endHour,
        "Escolha uma faixa de horário do atendimento.",
      ),
    applicantName: requiredText(160),
    contact: requiredText(160).refine(isValidContact, {
      message: "Informe um e-mail válido ou um telefone com DDD.",
    }),
    subject: optionalText(500),
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

/** Lei 13.709/2018, art. 19: fifteen days from the request. */
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
