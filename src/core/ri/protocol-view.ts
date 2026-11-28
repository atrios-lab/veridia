/**
 * How a título shows in the list of the Protocolo (decision of
 * 28/11/2026, the screen redrawn for the staff member to see at a glance):
 * one colour by meaning, always the same, and the share of the prazo used.
 *
 * - red: the qualificação is late or ends today, or the prenotação ends;
 * - amber: em exigência, dúvida, or the qualificação ends tomorrow;
 * - blue: being examined, in time;
 * - green: registrado;
 * - gray: closed without a registro (cessada, desistência, exame concluído).
 */

export type ProtocolTone = "red" | "amber" | "blue" | "green" | "gray";

export interface ProtocolViewRow {
  kind: string;
  status: string;
  presentedOn: string;
  qualifyBy: string | null;
  prenotationEnds: string | null;
}

export interface ProtocolView {
  tone: ProtocolTone;
  /** Short, for the chip: "Vence hoje", "Em exigência". */
  label: string;
  /** The date the prazo that matters now ends, when one runs. */
  due: string | null;
  /** 0 to 100: how much of that prazo has gone. Null when none runs. */
  used: number | null;
}

const days = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );

const share = (from: string, due: string, today: string) => {
  const total = Math.max(1, days(from, due));
  const gone = days(from, today);
  return Math.max(0, Math.min(100, Math.round((gone / total) * 100)));
};

export function protocolView(
  row: ProtocolViewRow,
  today: string,
  tomorrow: string,
): ProtocolView {
  if (row.kind === "exame") {
    return row.status === "prenotado"
      ? { tone: "blue", label: "Em exame e cálculo", due: null, used: null }
      : { tone: "gray", label: "Exame concluído", due: null, used: null };
  }
  switch (row.status) {
    case "prenotado": {
      const due = row.qualifyBy;
      const used = due ? share(row.presentedOn, due, today) : null;
      if (due && due < today) {
        return { tone: "red", label: "Qualificação vencida", due, used: 100 };
      }
      if (due === today) {
        return { tone: "red", label: "Vence hoje", due, used };
      }
      if (due === tomorrow) {
        return { tone: "amber", label: "Vence amanhã", due, used };
      }
      return { tone: "blue", label: "A qualificar", due, used };
    }
    case "exigencia": {
      const due = row.prenotationEnds;
      const used = due ? share(row.presentedOn, due, today) : null;
      if (due && due <= today) {
        return { tone: "red", label: "Prenotação no fim", due, used: 100 };
      }
      return { tone: "amber", label: "Em exigência", due, used };
    }
    case "duvida":
      return {
        tone: "amber",
        label: "Dúvida suscitada",
        due: row.prenotationEnds,
        used: null,
      };
    case "registrado":
      return { tone: "green", label: "Registrado", due: null, used: null };
    case "cessado":
      return {
        tone: "gray",
        label: "Prenotação cessada",
        due: null,
        used: null,
      };
    case "desistencia":
      return { tone: "gray", label: "Desistência", due: null, used: null };
    default:
      return { tone: "gray", label: row.status, due: null, used: null };
  }
}
