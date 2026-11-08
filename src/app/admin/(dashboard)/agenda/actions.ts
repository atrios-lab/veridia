"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  AGENDA_IDS,
  AGENDA_NAMES,
  type AgendaConfig,
  agendaBookSchema,
  agendaRules,
  agendaServiceSchema,
  channelLabelsOn,
  dayChannelsSchema,
  hasGrid,
  isAgendaId,
  OWN_SERVICE_ID,
  ownServiceId,
  type ServiceChecklist,
  serviceChecklistSchema,
  usesChannels,
} from "@/core/scheduling/agenda.ts";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  defaultChecklist,
  getCounterService,
  resolveService,
  servicesOfAgenda,
} from "@/core/scheduling/services.ts";
import { isSlotFree } from "@/core/scheduling/slots.ts";
import { db } from "@/db/index.ts";
import {
  type AgendaAlertSnapshot,
  agendaAlertSnapshotWith,
} from "@/lib/appointment-reminders.ts";
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
import { AttachmentError, collectAttachments } from "@/lib/uploads.ts";

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
  const agendaValue = formData.get("agenda");
  const agenda = isAgendaId(agendaValue) ? agendaValue : "geral";

  if (!citizenName || !phone) {
    return {
      status: "error",
      message: "Informe ao menos o nome e o telefone do cidadão.",
    };
  }

  const tenant = await getTenant();
  try {
    const office = await getAgendaConfig(tenant.slug);
    const config = {
      ...agendaRules(office, agenda),
      holidays: officeHolidays(tenant),
    };
    const service = servicesOfAgenda(office, agenda).find(
      (item) => item.id === serviceId,
    );
    const modes = usesChannels(agenda)
      ? channelLabelsOn(office.agendas[agenda], date)
      : office.modes;
    if (!service || !modes.includes(mode)) {
      return {
        status: "error",
        message: "Escolha um serviço e um modo das listas configuradas.",
      };
    }

    const taken = await takenTimesByDay(tenant.slug, date, date, agenda);
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
        agenda,
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
 * Saves both agendas, the office's own services and the modes. The whole
 * config is written at once, parsed by the core's schemas on the way in: a
 * grid half-saved is a counter half-open.
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
    // ticked services and modes are structured client state, and one field
    // parsed by one schema keeps "a grid half-saved" impossible.
    let submitted: {
      agendas?: Record<string, unknown>;
      services?: Array<{ id?: unknown; label?: unknown; bring?: unknown }>;
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

    const services = ownServices(submitted.services ?? []);
    if ("error" in services) {
      return { status: "error", message: services.error };
    }
    const known = (id: string) =>
      Boolean(getCounterService(id)) ||
      services.list.some((service) => service.id === id);

    const agendas = {} as AgendaConfig["agendas"];
    for (const id of AGENDA_IDS) {
      const parsed = agendaBookSchema.safeParse(submitted.agendas?.[id] ?? {});
      if (!parsed.success) {
        return {
          status: "error",
          message:
            parsed.error.issues[0]?.message ??
            "Confira os horários: use o formato HH:mm.",
        };
      }
      agendas[id] = {
        grid: parsed.data.grid,
        channels: parsed.data.channels,
        // A single date's channels are set from the day itself, like the
        // closed dates: this form does not own them.
        dayChannels: current.agendas[id].dayChannels,
        // Only ids that exist: a ticked own service deleted in the same
        // save goes with it.
        serviceIds: [...new Set(parsed.data.serviceIds)].filter(known),
      };
    }

    const modes = Array.isArray(submitted.modes)
      ? submitted.modes.map((item) => String(item).trim()).filter(Boolean)
      : [];
    if (modes.length === 0) {
      return {
        status: "error",
        message: "Cadastre ao menos um modo de atendimento.",
      };
    }

    const config: AgendaConfig = {
      agendas,
      services: services.list,
      modes,
      // Closed dates are owned by the day-closing action, and lists by the
      // list editor: this form owns neither.
      closedDates: current.closedDates,
      checklists: current.checklists,
    };
    // An agenda with hours and nothing to book would show the citizen days
    // and an empty list of services.
    for (const id of AGENDA_IDS) {
      if (
        hasGrid(config.agendas[id]) &&
        servicesOfAgenda(config, id).length === 0
      ) {
        return {
          status: "error",
          message: `${AGENDA_NAMES[id].name}: marque ao menos um serviço, ou tire os horários para ela não aparecer no site.`,
        };
      }
    }

    await saveAgendaConfig(tenant.slug, config, session.user.id);
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
 * The office's own services as the form sent them. An id the form already
 * had is kept, so the agendas that tick it still find it; a new one gets an
 * id from its label. Empty labels drop out.
 */
function ownServices(
  submitted: Array<{ id?: unknown; label?: unknown; bring?: unknown }>,
): { list: AgendaConfig["services"] } | { error: string } {
  const used = new Set<string>();
  const list: AgendaConfig["services"] = [];
  for (const item of submitted) {
    const label = String(item.label ?? "").trim();
    if (!label) continue;
    const given = typeof item.id === "string" ? item.id : "";
    const id =
      OWN_SERVICE_ID.test(given) && !used.has(given)
        ? given
        : ownServiceId(label, used);
    used.add(id);
    const parsed = agendaServiceSchema.safeParse({
      id,
      label,
      bring: Array.isArray(item.bring)
        ? item.bring.map((line) => String(line).trim()).filter(Boolean)
        : [],
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Confira os serviços.",
      };
    }
    list.push(parsed.data);
  }
  return { list };
}

/**
 * How the notary attends on one date, when it differs from the weekday:
 * "nesta quinta só presencial". `reset` drops the date's own choice and the
 * weekday's applies again. Appointments already booked keep the channel they
 * were booked with; only new bookings see the change.
 */
export async function saveDayChannels(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const date = String(formData.get("date") ?? "");
  const reset = formData.get("restore") === "1";
  const parsed = dayChannelsSchema.safeParse({
    date,
    channels: formData.getAll("channels").map(String),
  });
  if (!reset && !parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Escolha ao menos um canal de atendimento.",
    };
  }

  const tenant = await getTenant();
  try {
    const config = await getAgendaConfig(tenant.slug);
    const book = config.agendas.tabeliao;
    // Dates gone by drop out on the way: they decide nothing any more.
    const today = officeNow().date;
    const others = book.dayChannels.filter(
      (day) => day.date !== date && day.date >= today,
    );
    await saveAgendaConfig(
      tenant.slug,
      {
        ...config,
        agendas: {
          ...config.agendas,
          tabeliao: {
            ...book,
            dayChannels:
              reset || !parsed.success ? others : [...others, parsed.data],
          },
        },
      },
      session.user.id,
    );
  } catch (error) {
    console.error("agenda.day-channels", error);
    return {
      status: "error",
      message: "Não foi possível salvar agora. Tente novamente.",
    };
  }
  revalidateAdmin();
  return {
    status: "success",
    message: reset
      ? "Este dia volta a seguir o padrão da semana."
      : "Canais deste dia salvos e já valendo no site.",
  };
}

/**
 * The office's own list for one service: items edited, added or removed
 * (the base ones included), and its own sheet as a PDF or image. "Voltar à
 * lista padrão" drops the edited items; "Tirar o arquivo" stops offering the
 * sheet. A replaced or removed file stays in the store, unreferenced: nothing
 * the office uploaded is deleted from here.
 */
export async function saveServiceChecklist(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const serviceId = String(formData.get("serviceId") ?? "");
  const restore = formData.get("restoreItems") === "1";
  const dropFile = formData.get("dropFile") === "1";

  let items: string[] | undefined;
  if (!restore) {
    try {
      const parsed = JSON.parse(String(formData.get("items") ?? "[]"));
      items = Array.isArray(parsed)
        ? parsed.map((item) => String(item).trim()).filter(Boolean)
        : [];
    } catch {
      return {
        status: "error",
        message: "Não foi possível ler a lista. Recarregue a página.",
      };
    }
  }

  const tenant = await getTenant();
  try {
    const config = await getAgendaConfig(tenant.slug);
    if (!resolveService(config, serviceId)) {
      return { status: "error", message: "Este serviço não existe mais." };
    }

    const [stored] = await collectAttachments(formData, "arquivo", {
      tenantSlug: tenant.slug,
      kind: "lista-de-documentos",
      limit: 1,
    });
    const current = config.checklists[serviceId] ?? {};
    // A list identical to the default is no change: saving it keeps the
    // service following the catalogue, so a later fix there reaches it.
    const sameAsDefault =
      items !== undefined &&
      JSON.stringify(items) ===
        JSON.stringify(defaultChecklist(config, serviceId));
    const next: ServiceChecklist = {
      items: restore || sameAsDefault ? undefined : items,
      file: stored
        ? {
            path: stored.path,
            storedName: stored.storedName,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
          }
        : dropFile
          ? undefined
          : current.file,
    };
    const parsed = serviceChecklistSchema.safeParse(next);
    if (!parsed.success) {
      return {
        status: "error",
        message:
          parsed.error.issues[0]?.message ?? "Confira os itens da lista.",
      };
    }
    if (parsed.data.items?.length === 0 && !parsed.data.file) {
      return {
        status: "error",
        message:
          "A lista ficou vazia. Deixe ao menos um item ou anexe a lista do cartório.",
      };
    }

    const checklists = { ...config.checklists };
    if (parsed.data.items === undefined && !parsed.data.file) {
      delete checklists[serviceId];
    } else {
      checklists[serviceId] = parsed.data;
    }
    await saveAgendaConfig(
      tenant.slug,
      { ...config, checklists },
      session.user.id,
    );
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("agenda.checklist", error);
    return {
      status: "error",
      message: "Não foi possível salvar agora. Tente novamente.",
    };
  }
  revalidateAdmin();
  return {
    status: "success",
    message: restore
      ? "A lista voltou ao padrão e já vale no site."
      : "Lista salva e já valendo no site e no comprovante.",
  };
}

/**
 * What the panel's agenda reminders show, polled from every screen: today's
 * appointments and the bookings just made on the site. Null without the
 * permission, which the component reads as "nothing to show".
 */
export async function agendaAlertSnapshotAction(): Promise<AgendaAlertSnapshot | null> {
  const session = await authorize();
  if (!session) return null;
  try {
    const tenant = await getTenant();
    return await agendaAlertSnapshotWith(db, tenant.slug, officeNow());
  } catch (error) {
    console.error("agenda.alert-snapshot", error);
    return null;
  }
}
