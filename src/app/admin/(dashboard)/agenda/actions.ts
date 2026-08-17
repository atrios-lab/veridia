"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { agendaConfigSchema } from "@/core/scheduling/agenda.ts";
import {
  cancelAppointment,
  cancelDay,
  getAgendaConfig,
  markAttended,
  saveAgendaConfig,
} from "@/lib/appointments.ts";
import {
  sendAgendaDayClosedEmails,
  sendAppointmentCancelledEmail,
} from "@/lib/email/appointment.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message?: string };

const NO_PERMISSION =
  "Você não tem permissão para alterar a agenda. Peça acesso a um administrador.";

/** Every action here re-checks on the server, same discipline as
 * `/admin/pedidos`: hiding the button and the page 404-ing are a courtesy. */
async function authorize() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) {
    return null;
  }
  return session;
}

function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

/** Marks the citizen as served, from the day's list. */
export async function attendAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    await markAttended(tenant.slug, id, session.user.id);
  } catch (error) {
    console.error("agenda.attend", error);
    return {
      status: "error",
      message:
        "Não foi possível registrar agora. Tente novamente em instantes.",
    };
  }
  revalidateAdmin();
  return { status: "success" };
}

/**
 * The office calling one appointment off. The reason is required and goes to
 * the citizen as written: a cancellation with no why is what makes someone
 * show up anyway.
 */
export async function cancelOneAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return {
      status: "error",
      message: "Escreva o motivo: ele vai no e-mail que o cidadão recebe.",
    };
  }

  const tenant = await getTenant();
  try {
    const cancelled = await cancelAppointment(tenant.slug, id, {
      reason,
      actorId: session.user.id,
    });
    if (!cancelled) {
      return {
        status: "error",
        message: "Este agendamento já não estava ativo. Atualize a página.",
      };
    }
    // Awaited, but it swallows its own failure: the citizen's warning must be
    // attempted before the screen says it is done, and a mail provider having
    // a bad minute must not undo a cancellation the office decided.
    await sendAppointmentCancelledEmail(tenant, cancelled, reason, "one");
  } catch (error) {
    console.error("agenda.cancel", error);
    return {
      status: "error",
      message: "Não foi possível cancelar agora. Tente novamente em instantes.",
    };
  }
  revalidateAdmin();
  return {
    status: "success",
    message: "Agendamento cancelado e cidadão avisado.",
  };
}

/**
 * Closing a whole day. Everything live on it is cancelled with the same
 * reason and the date is added to `closedDates`, so the public page stops
 * offering it, because cancelling without closing would let the next citizen book
 * the morning the office just called off.
 */
export async function closeAgendaDay(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const date = String(formData.get("date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!date) return { status: "error", message: "Escolha a data a fechar." };
  if (!reason) {
    return {
      status: "error",
      message:
        "Escreva o motivo: ele vai no e-mail de todos os cidadãos do dia.",
    };
  }

  const tenant = await getTenant();
  try {
    const config = await getAgendaConfig(tenant.slug);
    if (!config.closedDates.some((closed) => closed.date === date)) {
      await saveAgendaConfig(
        tenant.slug,
        {
          ...config,
          closedDates: [...config.closedDates, { date, reason }],
        },
        session.user.id,
      );
    }

    const cancelled = await cancelDay(
      tenant.slug,
      date,
      reason,
      session.user.id,
    );
    await sendAgendaDayClosedEmails(tenant, cancelled, reason);

    revalidateAdmin();
    return {
      status: "success",
      message:
        cancelled.length === 0
          ? "Dia fechado. Não havia agendamentos para cancelar."
          : `Dia fechado. ${cancelled.length} ${cancelled.length === 1 ? "cidadão avisado" : "cidadãos avisados"} por e-mail.`,
    };
  } catch (error) {
    console.error("agenda.close-day", error);
    return {
      status: "error",
      message: "Não foi possível fechar o dia agora. Tente novamente.",
    };
  }
}

/** Reopens a date the office had closed. The appointments it cancelled stay
 * cancelled: the citizens were told, and silently reinstating them would put
 * people at a counter that is not expecting them. */
export async function reopenAgendaDay(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const date = String(formData.get("date") ?? "");
  const tenant = await getTenant();
  try {
    const config = await getAgendaConfig(tenant.slug);
    await saveAgendaConfig(
      tenant.slug,
      {
        ...config,
        closedDates: config.closedDates.filter(
          (closed) => closed.date !== date,
        ),
      },
      session.user.id,
    );
  } catch (error) {
    console.error("agenda.reopen-day", error);
    return {
      status: "error",
      message: "Não foi possível reabrir o dia agora. Tente novamente.",
    };
  }
  revalidateAdmin();
  return { status: "success", message: "Dia reaberto." };
}

/**
 * Saves the weekly grid and the two lists. The whole config is written at
 * once, parsed by the core's schema on the way in: a grid half-saved is a
 * counter half-open.
 */
export async function saveAgenda(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const tenant = await getTenant();
  try {
    const current = await getAgendaConfig(tenant.slug);
    const parsed = agendaConfigSchema.safeParse({
      grid: Object.fromEntries(
        ["1", "2", "3", "4", "5"].map((day) => [
          day,
          splitList(String(formData.get(`grid.${day}`) ?? "")),
        ]),
      ),
      services: withUniqueIds(
        splitList(String(formData.get("services") ?? "")),
      ),
      modes: splitList(String(formData.get("modes") ?? "")),
      // Closed dates are owned by the day-closing action, not by this form.
      closedDates: current.closedDates,
    });

    if (!parsed.success) {
      return {
        status: "error",
        message:
          parsed.error.issues[0]?.message ??
          "Confira os horários: use o formato HH:mm, separados por vírgula.",
      };
    }
    if (parsed.data.services.length === 0) {
      return {
        status: "error",
        message: "Cadastre ao menos um serviço para o cidadão escolher.",
      };
    }
    if (parsed.data.modes.length === 0) {
      return {
        status: "error",
        message: "Cadastre ao menos um modo de atendimento.",
      };
    }

    await saveAgendaConfig(tenant.slug, parsed.data, session.user.id);
  } catch (error) {
    console.error("agenda.save", error);
    return {
      status: "error",
      message: "Não foi possível salvar agora. Tente novamente em instantes.",
    };
  }
  revalidateAdmin();
  return { status: "success", message: "Agenda salva e já valendo no site." };
}

/** One text field per list, split on commas and new lines: the office types
 * "08:30, 09:00" the way it would write it down, not one input per time. */
function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Ids derived from the labels, so the citizen's choice survives a reorder of
 * the list. A rename still produces a new id, which is exactly why the
 * appointment keeps its own copy of the label.
 *
 * Two labels that reduce to the same slug ("Certidão" and "Certidao") get a
 * suffix: an id shared by two services would hand the second one's citizens
 * the first one's name.
 */
function withUniqueIds(labels: string[]): Array<{ id: string; label: string }> {
  const used = new Set<string>();
  return labels.map((label) => {
    const base =
      label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "servico";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { id, label };
  });
}
