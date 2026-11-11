"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/core/auth/roles.ts";
import { isValidCpf } from "@/core/request/form.ts";
import {
  agendaIdOf,
  channelLabelsOn,
  usesChannels,
} from "@/core/scheduling/agenda.ts";
import { servicesOfAgenda } from "@/core/scheduling/services.ts";
import { LONG_TEXT_MAX, LONG_TEXT_TOO_LONG } from "@/core/text-limits.ts";
import {
  addAppointmentNote,
  addOfficeAppointmentAttachments,
  correctAppointment,
  findAppointmentById,
  getAgendaConfig,
} from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

export type DetailState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const NO_PERMISSION =
  "Você não tem permissão para alterar a agenda. Peça acesso a um administrador.";
const GENERIC = "Não foi possível salvar agora. Tente novamente.";

async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    return null;
  return session;
}

function revalidate(id: string) {
  revalidatePath(`/admin/agenda/agendamento/${id}`);
  revalidatePath("/admin/agenda");
}

/** An internal note: what the citizen said on the phone, what to check. */
export async function addNoteAction(
  _previous: DetailState,
  formData: FormData,
): Promise<DetailState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { status: "error", message: "Escreva a anotação." };
  if (body.length > LONG_TEXT_MAX) {
    return { status: "error", message: LONG_TEXT_TOO_LONG };
  }
  const tenant = await getTenant();
  try {
    const added = await addAppointmentNote(
      tenant.slug,
      id,
      { id: session.user.id, name: session.user.name || session.user.email },
      body,
    );
    if (!added)
      return { status: "error", message: "Agendamento não encontrado." };
  } catch (error) {
    console.error("agenda.note", error);
    return { status: "error", message: GENERIC };
  }
  revalidate(id);
  return { status: "success", message: "Anotação salva." };
}

/** Files the office keeps with the appointment; the citizen does not see them. */
export async function attachOfficeFilesAction(
  _previous: DetailState,
  formData: FormData,
): Promise<DetailState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  if (!(await findAppointmentById(tenant.slug, id))) {
    return { status: "error", message: "Agendamento não encontrado." };
  }
  try {
    const files = formData
      .getAll("arquivo")
      .filter((file): file is File => file instanceof File);
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      kind: "anexo-agenda",
      name: String(formData.get("arquivoName") ?? ""),
    });
    if (stored.length === 0) {
      return { status: "error", message: "Escolha um arquivo para anexar." };
    }
    await addOfficeAppointmentAttachments(
      tenant.slug,
      id,
      stored,
      session.user.id,
    );
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("agenda.office-attach", error);
    return { status: "error", message: GENERIC };
  }
  revalidate(id);
  return { status: "success", message: "Arquivo anexado." };
}

const correctionSchema = z.object({
  citizenName: z.string().trim().min(2, "Informe o nome.").max(160),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "E-mail inválido.",
    }),
  phone: z.string().trim().min(8, "Informe o telefone.").max(40),
  cpf: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidCpf(value), {
      message: "CPF inválido.",
    }),
  serviceId: z.string().min(1, "Escolha o serviço."),
  mode: z.string().min(1, "Escolha o modo."),
  serviceDetails: z.string().trim().max(LONG_TEXT_MAX, LONG_TEXT_TOO_LONG),
});

/** The citizen's data corrected by the office, audited. */
export async function correctAppointmentAction(
  _previous: DetailState,
  formData: FormData,
): Promise<DetailState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  const appointment = await findAppointmentById(tenant.slug, id);
  if (!appointment)
    return { status: "error", message: "Agendamento não encontrado." };

  const parsed = correctionSchema.safeParse({
    citizenName: formData.get("citizenName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    cpf: formData.get("cpf") ?? "",
    serviceId: formData.get("serviceId") ?? "",
    mode: formData.get("mode") ?? "",
    serviceDetails: formData.get("serviceDetails") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors,
    };
  }

  const config = await getAgendaConfig(tenant.slug);
  const agenda = agendaIdOf(appointment.agenda);
  const services = servicesOfAgenda(config, agenda);
  // The booked service stays valid even if it left the agenda's list since.
  const service =
    services.find((item) => item.id === parsed.data.serviceId) ??
    (parsed.data.serviceId === appointment.serviceId
      ? { id: appointment.serviceId, label: appointment.serviceLabel }
      : undefined);
  if (!service) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: { serviceId: "Escolha um serviço desta agenda." },
    };
  }
  const modes = usesChannels(agenda)
    ? channelLabelsOn(config.agendas[agenda], appointment.date)
    : config.modes;
  if (
    !modes.includes(parsed.data.mode) &&
    parsed.data.mode !== appointment.mode
  ) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: { mode: "Escolha um modo desta agenda." },
    };
  }

  try {
    await correctAppointment(
      tenant.slug,
      id,
      {
        citizenName: parsed.data.citizenName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        cpf: parsed.data.cpf.replace(/\D/g, "") || null,
        serviceId: service.id,
        serviceLabel: service.label,
        mode: parsed.data.mode,
        serviceDetails: parsed.data.serviceDetails || null,
      },
      session.user.id,
    );
  } catch (error) {
    console.error("agenda.correct", error);
    return { status: "error", message: GENERIC };
  }
  revalidate(id);
  return { status: "success", message: "Dados corrigidos." };
}
