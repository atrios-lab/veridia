import type { IsoDate } from "./calendar.ts";

export interface CalendarEvent {
  /** Stable identifier of the event, so a second download updates the first. */
  uid: string;
  date: IsoDate;
  startHour: number;
  endHour: number;
  title: string;
  description: string;
  location: string;
  /** When the file was written, as an instant. */
  stamp: Date;
}

/** Commas, semicolons and newlines are field separators in this format. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function localStamp(date: IsoDate, hour: number): string {
  return `${date.replace(/-/g, "")}T${String(hour).padStart(2, "0")}0000`;
}

function utcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/**
 * The appointment as a calendar file. It is a text format of one field per
 * line, so it is written here rather than pulled in as a dependency.
 *
 * The times are local and carry the office's zone: an appointment at 9h is 9h
 * on the counter's clock, whatever the phone is set to.
 */
export function buildCalendarEvent(
  event: CalendarEvent,
  timeZone: string,
): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Veridia//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${utcStamp(event.stamp)}`,
    `DTSTART;TZID=${timeZone}:${localStamp(event.date, event.startHour)}`,
    `DTEND;TZID=${timeZone}:${localStamp(event.date, event.endHour)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
