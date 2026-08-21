"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { agendaConfigSchema } from "@/core/scheduling/agenda.ts";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import { isSlotFree } from "@/core/scheduling/slots.ts";
import {
  bookAppointment,
  cancelAppointment,
  cancelDay,
  getAgendaConfig,
  markAttended,
  markNoShow,
  SlotTakenError,
  saveAgendaConfig,
  takenTimesByDay,
} from "@/lib/appointments.ts";
import {
  sendAgendaDayClosedEmails,
  sendAppointmentBookedEmail,
  sendAppointmentCancelledEmail,
} from "@/lib/email/appointment.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, officeNow } from "@/lib/tenant.ts";

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

/** The citizen did not come. No e-mail goes out; the record and the audit
 * trail are the point. */
export async function markAppointmentNoShow(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    await markNoShow(tenant.slug, id, session.user.id);
  } catch (error) {
    console.error("agenda.no-show", error);
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
 * "Reservar para um cidadão": the office booking a free slot at the counter.
 * Same rules as the site (offered day, free slot, the database as referee),
 * because a desk that skips the rules double-books the same hour. E-mail is
 * optional here: the citizen is on the phone or in front of the operator.
 */
export async function reserveDeskAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const date = String(formData.get("date") ?? "");
  const slotTime = String(formData.get("slotTime") ?? "");
  const citizenName = String(formData.get("citizenName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const serviceId = String(formData.get("serviceId") ?? "");
  const mode = String(formData.get("mode") ?? "");

  if (!citizenName || !phone) {
    return {
      status: "error",
      message: "Informe ao menos o nome e o telefone do cidadão.",
    };
  }

  const tenant = await getTenant();
  try {
    const config = await getAgendaConfig(tenant.slug);
    const service = config.services.find((item) => item.id === serviceId);
    if (!service || !config.modes.includes(mode)) {
      return {
        status: "error",
        message: "Escolha um serviço e um modo das listas configuradas.",
      };
    }

    const taken = await takenTimesByDay(tenant.slug, date, date);
    if (
      !isSlotFree(
        config,
        date,
        slotTime,
        taken.get(date) ?? new Set<string>(),
        officeNow(),
      )
    ) {
      return {
        status: "error",
        message: "Este horário já não está livre. Atualize a página.",
      };
    }

    const cancelToken = generateCancelToken();
    const appointment = await bookAppointment(
      tenant.slug,
      {
        date,
        slotTime,
        citizenName,
        email,
        phone,
        serviceId,
        serviceLabel: service.label,
        mode,
        cancelTokenHash: hashCancelToken(cancelToken),
        origin: "desk",
      },
      session.user.id,
    );
    if (email) {
      await sendAppointmentBookedEmail(tenant, appointment, cancelToken);
    }
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return {
        status: "error",
        message: "Este horário acabou de ser preenchido. Atualize a página.",
      };
    }
    console.error("agenda.desk-book", error);
    return {
      status: "error",
      message: "Não foi possível reservar agora. Tente novamente.",
    };
  }
  revalidateAdmin();
  return {
    status: "success",
    message: email
      ? "Horário reservado e confirmação enviada por e-mail."
      : "Horário reservado no balcão.",
  };
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
    // The form sends the whole config as one JSON field: the grid chips,
    // services and modes are structured client state, and one field parsed by
    // one schema keeps "a grid half-saved" impossible.
    let submitted: {
      grid?: unknown;
      services?: Array<{ label?: unknown; notaryOnly?: unknown }>;
      modes?: unknown;
    };
    try {
      submitted = JSON.parse(String(formData.get("config") ?? ""));
    } catch {
      return {
        status: "error",
        message: "Não foi possível ler o formulário. Recarregue a página.",
      };
    }
    const parsed = agendaConfigSchema.safeParse({
      grid: submitted.grid ?? {},
      services: withUniqueIds(
        (submitted.services ?? []).map((service) => ({
          label: String(service.label ?? "").trim(),
          notaryOnly: service.notaryOnly === true,
        })),
      ),
      modes: Array.isArray(submitted.modes)
        ? submitted.modes.map((item) => String(item).trim()).filter(Boolean)
        : [],
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

/**
 * Ids derived from the labels, so the citizen's choice survives a reorder of
 * the list. A rename still produces a new id, which is exactly why the
 * appointment keeps its own copy of the label.
 *
 * Two labels that reduce to the same slug ("Certidão" and "Certidao") get a
 * suffix: an id shared by two services would hand the second one's citizens
 * the first one's name.
 */
function withUniqueIds(
  services: Array<{ label: string; notaryOnly: boolean }>,
): Array<{ id: string; label: string; notaryOnly: boolean }> {
  const used = new Set<string>();
  return services
    .filter((service) => service.label)
    .map(({ label, notaryOnly }) => {
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
      return { id, label, notaryOnly };
    });
}
