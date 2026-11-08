"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  OfficeContactSchema,
  OfficeDeadlineSchema,
  OfficeHolidaysSchema,
} from "@/core/tenant/overrides.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAudit } from "@/lib/audit.ts";
import { getSession } from "@/lib/session.ts";
import {
  getTenant,
  OFFICE_CONTACT_KEY,
  OFFICE_DEADLINE_KEY,
  OFFICE_HOLIDAYS_KEY,
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
  if (!session || !can(session.user.role ?? "", "content.edit")) {
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
  if (!session || !can(session.user.role ?? "", "content.edit")) {
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
  | { status: "saved" }
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
  if (!session || !can(session.user.role ?? "", "content.edit")) {
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
  return { status: "saved" };
}
