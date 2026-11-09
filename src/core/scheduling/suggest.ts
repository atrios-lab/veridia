import { addMinutes, type SlotTime } from "./agenda.ts";

/**
 * "Montar a grade automaticamente": from how many people attend, the hours
 * the counter is open, a lunch the attendants take in turns and how long
 * each service takes, a grid where every attendant always has a citizen,
 * the quick services (firma, autenticação) come between the long ones so a
 * quick vacancy is never far, and as many citizens start at one time as
 * there are attendants starting at it.
 *
 * A suggestion: the office looks at it, changes what it wants on the grid
 * and saves. Nothing here reads or writes the agenda itself.
 */

export interface SuggestService {
  id: string;
  /** How long it usually takes, in minutes. */
  minutes: number;
}

export interface SuggestInput {
  /** "08:00" */
  open: SlotTime;
  /** "14:00": the last citizen ends by then. */
  close: SlotTime;
  /** How many people attend at once. */
  staff: number;
  /**
   * The attendants' lunch, taken in turns inside the window: with 12:00 to
   * 14:00 and an hour each, half go at 12:00 and half at 13:00, and the
   * counter never closes. Absent: nobody stops.
   */
  lunch?: { from: SlotTime; to: SlotTime; minutes: number };
  /** The quick services, placed between the long ones. */
  quick: SuggestService[];
  /** The other services, taken in turns by each attendant. */
  long: SuggestService[];
}

export interface SuggestedBlock {
  start: SlotTime;
  end: SlotTime;
  kind: "quick" | "long" | "lunch";
  /** The services the block takes: every quick one, or one long one. */
  serviceIds: string[];
}

export interface Suggestion {
  /** One per attendant, in order: the day as that person lives it. */
  lanes: SuggestedBlock[][];
  /** The times to offer, sorted. */
  times: SlotTime[];
  /** Per time, how many citizens start at it. */
  capacity: Record<SlotTime, number>;
  /** Per time, the services offered at it. */
  services: Record<SlotTime, string[]>;
}

function minutesOf(time: SlotTime): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function timeOf(minutes: number): SlotTime {
  return addMinutes("00:00", minutes);
}

/** The day of one attendant, block by block. */
function lane(input: SuggestInput, index: number): SuggestedBlock[] {
  const open = minutesOf(input.open);
  const close = minutesOf(input.close);
  const quickMinutes = Math.max(
    0,
    ...input.quick.map((service) => service.minutes),
  );
  const quickIds = input.quick.map((service) => service.id);
  const long = input.long.filter((service) => service.minutes > 0);

  // Lunch in turns: attendant 1 at the first hour of the window, attendant
  // 2 at the next, and round again.
  let lunchStart: number | undefined;
  let lunchEnd: number | undefined;
  if (input.lunch && input.lunch.minutes > 0) {
    const from = minutesOf(input.lunch.from);
    const turns = Math.floor(
      (minutesOf(input.lunch.to) - from) / input.lunch.minutes,
    );
    if (turns >= 1) {
      lunchStart = from + (index % turns) * input.lunch.minutes;
      lunchEnd = lunchStart + input.lunch.minutes;
    }
  }

  const blocks: SuggestedBlock[] = [];
  let cursor = open;
  // Half the attendants open with a quick service, half with a long one,
  // so a quick vacancy is there at opening and every half hour or so.
  let quickNext = quickIds.length > 0 && (index % 2 === 0 || long.length === 0);
  let longIndex = long.length > 0 ? index % long.length : 0;

  const place = (kind: "quick" | "long", minutes: number, ids: string[]) => {
    blocks.push({
      start: timeOf(cursor),
      end: timeOf(cursor + minutes),
      kind,
      serviceIds: ids,
    });
    cursor += minutes;
  };

  while (cursor < close) {
    if (lunchStart !== undefined && lunchEnd !== undefined) {
      if (cursor >= lunchStart && cursor < lunchEnd) {
        blocks.push({
          start: timeOf(lunchStart),
          end: timeOf(lunchEnd),
          kind: "lunch",
          serviceIds: [],
        });
        cursor = lunchEnd;
        continue;
      }
    }
    const limit =
      lunchStart !== undefined && cursor < lunchStart
        ? Math.min(lunchStart, close)
        : close;
    const room = limit - cursor;

    const quickFits = quickIds.length > 0 && quickMinutes <= room;
    // The long service whose turn it is, or the next one that fits.
    let longPick: SuggestService | undefined;
    for (let step = 0; step < long.length; step++) {
      const candidate = long[(longIndex + step) % long.length];
      if (candidate.minutes <= room) {
        longPick = candidate;
        longIndex = (longIndex + step) % long.length;
        break;
      }
    }

    if (quickNext && quickFits) {
      place("quick", quickMinutes, quickIds);
      quickNext = long.length === 0;
    } else if (longPick) {
      place("long", longPick.minutes, [longPick.id]);
      longIndex = (longIndex + 1) % long.length;
      quickNext = quickIds.length > 0;
    } else if (quickFits) {
      place("quick", quickMinutes, quickIds);
    } else if (limit < close) {
      // Nothing fits before lunch: the minutes left go to the lunch turn.
      cursor = limit;
    } else {
      break;
    }
  }
  return blocks;
}

export function suggestGrid(input: SuggestInput): Suggestion {
  const staff = Math.max(0, Math.min(99, Math.floor(input.staff)));
  const lanes = Array.from({ length: staff }, (_, index) => lane(input, index));
  const capacity: Record<SlotTime, number> = {};
  const services: Record<SlotTime, string[]> = {};
  for (const blocks of lanes) {
    for (const block of blocks) {
      if (block.kind === "lunch") continue;
      capacity[block.start] = (capacity[block.start] ?? 0) + 1;
      services[block.start] = [
        ...new Set([...(services[block.start] ?? []), ...block.serviceIds]),
      ];
    }
  }
  return {
    lanes,
    times: Object.keys(capacity).sort(),
    capacity,
    services,
  };
}

/**
 * How long a service usually takes, as a starting point the office edits:
 * read from its name, because the catalogue does not time its services.
 */
export function usualMinutes(label: string): number {
  const name = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/firma|autentica/.test(name)) return 30;
  if (/2a via|segunda via|certidao|retirada|orientacao/.test(name)) return 30;
  if (/retifica|averba|inventario|divorcio|usucapiao/.test(name)) return 90;
  if (/procura/.test(name)) return 45;
  return 60;
}

/** Whether a service is a quick one, to intercalate by default. */
export function isQuickService(label: string): boolean {
  return /firma|autentica/.test(
    label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
  );
}
