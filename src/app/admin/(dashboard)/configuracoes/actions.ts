"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { agendaIdOf, agendaRules } from "@/core/scheduling/agenda.ts";
import { whyNotOffered } from "@/core/scheduling/slots.ts";
import {
  OfficeAttributionsSchema,
  OfficeContactSchema,
  OfficeDeadlineSchema,
  OfficeHolidaysSchema,
  OfficeIdentificationSchema,
} from "@/core/tenant/overrides.ts";
import { ATTRIBUTIONS } from "@/core/tenant/schema.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { bookedFrom, getAgendaConfig } from "@/lib/appointments.ts";
import { recordAudit } from "@/lib/audit.ts";
import { getSession } from "@/lib/session.ts";
import {
  getTenant,
  OFFICE_ATTRIBUTIONS_KEY,
  OFFICE_CONTACT_KEY,
  OFFICE_DEADLINE_KEY,
  OFFICE_HOLIDAYS_KEY,
  OFFICE_IDENTIFICATION_KEY,
  today,
} from "@/lib/tenant.ts";

/** The fields as they were typed, unvalidated. */
export type OfficeContactValues = Record<
  | "openingHours"
  | "startHour"
  | "endHour"
  | "breakStart"
  | "breakEnd"
  | "phone"
  | "whatsapp"
  | "email",
  string
>;

/**
 * Where a schema issue is shown, by the last key of its path. The rules that
 * span fields (closing after opening, the break inside the hours, the break
 * ending after it starts) report on an object, so they land on the field the
 * office has to move.
 */
const FIELD_OF_PATH: Record<string, keyof OfficeContactValues> = {
  counterHours: "endHour",
  lunchBreak: "breakEnd",
  start: "breakStart",
  end: "breakEnd",
};

export type OfficeContactState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      // Echoed back because React resets an uncontrolled form once the action
      // resolves. Without this the registrar loses three correct fields to
      // fix the fourth, which is how a form teaches people to distrust it.
      values: OfficeContactValues;
    };

const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

function fail(
  message: string,
  values: OfficeContactValues,
  fieldErrors: Record<string, string> = {},
): OfficeContactState {
  return { status: "error", message, fieldErrors, values };
}

export async function saveOfficeContact(
  _previous: OfficeContactState,
  formData: FormData,
): Promise<OfficeContactState> {
  // Only these eight names are ever read. Name, CNS and attributions are not
  // in the shape, so a forged submission carrying them changes nothing: there
  // is no defensive branch to forget, the schema is the boundary.
  const values: OfficeContactValues = {
    openingHours: String(formData.get("openingHours") ?? "").trim(),
    startHour: String(formData.get("startHour") ?? "").trim(),
    endHour: String(formData.get("endHour") ?? "").trim(),
    breakStart: String(formData.get("breakStart") ?? "").trim(),
    breakEnd: String(formData.get("breakEnd") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
  };

  const session = await getSession();
  // Hiding the screen is not the check; this is. A person who reaches the
  // action by any other route is refused here, on the server.
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
    return fail("Você não tem permissão para alterar estes dados.", values);
  }
  const tenant = await getTenant();

  // The break is optional, but whole: both ends or neither. Half of one is
  // not a break the site can compute with, and guessing the other end would
  // be the panel inventing the office's lunch hour.
  const breakFilled = [values.breakStart, values.breakEnd].filter(Boolean);
  if (breakFilled.length === 1) {
    const missing = values.breakStart ? "breakEnd" : "breakStart";
    return fail("Confira os campos destacados.", values, {
      [missing]: "Informe o início e o fim do intervalo.",
    });
  }

  const parsed = OfficeContactSchema.safeParse({
    openingHours: values.openingHours,
    // Number(""), which is 0, would read as "abre à meia-noite" and pass the
    // range check; NaN fails it and the field says so.
    counterHours: {
      startHour:
        values.startHour === "" ? Number.NaN : Number(values.startHour),
      endHour: values.endHour === "" ? Number.NaN : Number(values.endHour),
      // Always written, object or null: a row without the key reads as one
      // saved before breaks existed and inherits the config's (see
      // applyTenantOverrides), so clearing both fields has to say null.
      lunchBreak:
        breakFilled.length === 2
          ? { start: values.breakStart, end: values.breakEnd }
          : null,
    },
    contacts: {
      phone: values.phone,
      whatsapp: values.whatsapp,
      email: values.email,
    },
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // "contacts.phone" -> "phone": the form names its inputs flat.
      const path = String(issue.path.at(-1) ?? "");
      const field = FIELD_OF_PATH[path] ?? path;
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", values, fieldErrors);
  }

  try {
    // Written to `published`, never to `draft`. A telephone number is
    // operational, not editorial: the office correcting it needs the
    // correction live now, not after someone remembers to publish.
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_CONTACT_KEY,
        published: parsed.data,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: parsed.data,
          publishedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        },
      });
  } catch {
    return fail(GENERIC_ERROR, values);
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_CONTACT_KEY,
  });

  // Opening hours and contacts are printed in the public layout, on the home
  // page and on the contact page. A narrower target would be a guess; this is
  // the one that is right until something measures otherwise.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

export type OfficeDeadlineState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string; value: string };

/**
 * The office's default term for a service request. The same discipline as
 * `saveOfficeContact`: the schema is the boundary, the check is on the
 * server, and the write goes straight to `published` because a term is
 * operational, not editorial.
 */
export async function saveOfficeDeadline(
  _previous: OfficeDeadlineState,
  formData: FormData,
): Promise<OfficeDeadlineState> {
  const value = String(formData.get("requestDeadlineDays") ?? "").trim();

  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar estes dados.",
      value,
    };
  }
  const tenant = await getTenant();

  const parsed = OfficeDeadlineSchema.safeParse({
    // An empty field reaches the schema as NaN and is refused there, rather
    // than silently becoming zero.
    requestDeadlineDays: Number(value),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Informe um prazo entre 1 e 365 dias.",
      value,
    };
  }

  try {
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_DEADLINE_KEY,
        published: parsed.data,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: parsed.data,
          publishedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        },
      });
  } catch {
    return { status: "error", message: GENERIC_ERROR, value };
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_DEADLINE_KEY,
  });

  // The term shows on the request confirmation and on the protocol consult,
  // and it is read by the queue's badge in the panel.
  revalidatePath("/", "layout");
  revalidatePath("/admin/pedidos");
  return { status: "saved" };
}

/** One row of the holidays form, as typed. */
export type HolidayDraft = { name: string; date: string; yearly: boolean };

export type OfficeHolidaysState =
  | { status: "idle" }
  // `stranded`: appointments still booked on a day the office, with the
  // calendar just saved, no longer receives on.
  | { status: "saved"; stranded: number }
  | {
      status: "error";
      message: string;
      // "3.name" -> message: the row and the field the office has to fix.
      fieldErrors: Record<string, string>;
    };

/**
 * The office's calendar, saved whole: its own days off and the law days it
 * does not keep. Switching a law day off removes nothing from anywhere: it
 * is one id on this list, and switching it back on takes it off the list.
 * Saved whole: the list the form submits replaces
 * the stored one. Same discipline as the other settings: permission checked
 * here, the schema is the boundary, written straight to `published` because
 * a day off is operational (it closes the chat and stops the terms), and
 * every save leaves an audit line.
 *
 * Both lists (the office's own days and the law days it switched off)
 * travel as one JSON field: rows are added and removed on the client, and a
 * variable number of rows in flat form names is a parser to get wrong.
 * Anything that is not the expected shape fails the schema, including a law
 * day id the calendar does not know.
 */
export async function saveOfficeHolidays(
  _previous: OfficeHolidaysState,
  formData: FormData,
): Promise<OfficeHolidaysState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar estes dados.",
      fieldErrors: {},
    };
  }
  const tenant = await getTenant();

  let submitted: unknown;
  try {
    submitted = JSON.parse(String(formData.get("holidays") ?? "[]"));
  } catch {
    submitted = null;
  }
  const parsed = OfficeHolidaysSchema.safeParse(submitted);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    let general: string | undefined;
    for (const issue of parsed.error.issues) {
      const [, row, field] = issue.path;
      if (typeof row === "number" && typeof field === "string") {
        fieldErrors[`${row}.${field}`] ??= issue.message;
      } else {
        general ??= issue.message;
      }
    }
    return {
      status: "error",
      message: general ?? "Confira os feriados destacados.",
      fieldErrors,
    };
  }

  try {
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_HOLIDAYS_KEY,
        published: parsed.data,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: parsed.data,
          publishedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        },
      });
  } catch {
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_HOLIDAYS_KEY,
  });

  // A day off reaches the whole site (the hours card, the chat, the agenda,
  // every term) and the panel's queues.
  revalidatePath("/", "layout");
  return {
    status: "saved",
    stranded: await strandedBy(tenant.slug, parsed.data),
  };
}

/**
 * How many appointments still booked fall on a day the office no longer
 * receives on, with the calendar just saved: a new holiday on a day people
 * had already booked. The agenda lists them; this only says to look. A read
 * that fails counts none rather than turning a saved calendar into an error.
 */
async function strandedBy(
  tenantSlug: string,
  holidays: Parameters<typeof whyNotOffered>[0]["holidays"],
): Promise<number> {
  try {
    const [office, upcoming] = await Promise.all([
      getAgendaConfig(tenantSlug),
      bookedFrom(tenantSlug, today()),
    ]);
    return upcoming.filter((appointment) =>
      whyNotOffered(
        { ...agendaRules(office, agendaIdOf(appointment.agenda)), holidays },
        appointment.date,
      ),
    ).length;
  } catch {
    return 0;
  }
}

export type OfficeIdentificationState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
    };

/** An empty text field is "not set", so the office's default stands. */
function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}

/**
 * How the office identifies itself on its papers (Provimento CGJ/TJRN
 * 156/2016, art. 2º): the denomination, the comarca or termo, and whether the
 * holder's name and the attributions go under it. Same discipline as the
 * other settings: the schema is the boundary, the write goes straight to
 * `published`, and it is saved whole.
 */
export async function saveOfficeIdentification(
  _previous: OfficeIdentificationState,
  formData: FormData,
): Promise<OfficeIdentificationState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar estes dados.",
      fieldErrors: {},
    };
  }
  const tenant = await getTenant();

  const kind = String(formData.get("jurisdictionKind") ?? "");
  const parsed = OfficeIdentificationSchema.safeParse({
    officialName: optionalText(formData.get("officialName")),
    jurisdiction: kind
      ? {
          kind,
          seat: optionalText(formData.get("jurisdictionSeat")),
          uf: optionalText(formData.get("jurisdictionUf")),
        }
      : undefined,
    holderName: optionalText(formData.get("holderName")),
    holderTitle: optionalText(formData.get("holderTitle")),
    // One line per line typed; blank lines dropped. None at all means the
    // automatic foot (address and contacts) stands.
    footerLines: (() => {
      const lines = String(formData.get("footerLines") ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.length ? lines : undefined;
    })(),
    showHolder: formData.get("showHolder") === "on",
    showAttributions: formData.get("showAttributions") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field =
        issue.path[0] === "jurisdiction"
          ? issue.path[1] === "seat"
            ? "jurisdictionSeat"
            : issue.path[1] === "uf"
              ? "jurisdictionUf"
              : "jurisdictionKind"
          : String(issue.path[0] ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors,
    };
  }

  try {
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_IDENTIFICATION_KEY,
        published: parsed.data,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: parsed.data,
          publishedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        },
      });
  } catch {
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_IDENTIFICATION_KEY,
  });

  // Every document the site prints from now on reads it.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

export type OfficeAttributionsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

/**
 * The attributions the office marks it offers, who answers for each
 * (delegado, interino, interventor), and the Registro de Distribuição
 * (decision of 14/11/2026: the office marks them, as it does at the CNJ).
 * The Tabelião/Registrador's alone: it changes what the site offers.
 */
export async function saveOfficeAttributions(
  _previous: OfficeAttributionsState,
  formData: FormData,
): Promise<OfficeAttributionsState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Só o Tabelião/Registrador marca as atribuições da serventia.",
    };
  }
  const tenant = await getTenant();
  const offered = ATTRIBUTIONS.filter(
    (a) => formData.get(`oferece.${a}`) === "on",
  );
  const distribution = formData.get("oferece.DISTRIBUICAO") === "on";
  const regimes: Record<string, string> = {};
  for (const key of [...offered, ...(distribution ? ["DISTRIBUICAO"] : [])]) {
    regimes[key] = String(formData.get(`regime.${key}`) ?? "delegado");
  }
  const parsed = OfficeAttributionsSchema.safeParse({
    attributions: offered,
    attributionRegimes: regimes,
    offersDistribution: distribution,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        offered.length === 0
          ? "Marque pelo menos uma atribuição."
          : "Confira o regime de cada atribuição.",
    };
  }
  try {
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_ATTRIBUTIONS_KEY,
        published: parsed.data,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: parsed.data,
          publishedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        },
      });
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }
  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-settings.attributions",
    targetType: "tenant-content",
    targetId: OFFICE_ATTRIBUTIONS_KEY,
  });
  // The site's sections, the request catalog and the panel all read it.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
