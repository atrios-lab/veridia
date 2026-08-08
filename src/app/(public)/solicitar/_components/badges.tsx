import {
  PROCESSING_MODE_HINTS,
  PROCESSING_MODE_LABELS,
  type ProcessingMode,
} from "@/core/acts/catalog.ts";
import { Icon } from "../../_components/icon.tsx";

/**
 * What the citizen needs to know before filling anything in: whether this ends
 * on the phone or at the counter. The counter case is the one that changes
 * someone's afternoon, so it is the one that reads differently.
 */
export function ProcessingBadge({ mode }: { mode: ProcessingMode }) {
  const atCounter = mode === "presential";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        atCounter
          ? "bg-brand-accent-soft text-brand-accent"
          : "bg-brand-tint text-brand-primary-soft"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {PROCESSING_MODE_LABELS[mode]}
    </span>
  );
}

export function ProcessingHint({ mode }: { mode: ProcessingMode }) {
  return (
    <span className="text-[11.5px] text-brand-muted">
      {PROCESSING_MODE_HINTS[mode]}
    </span>
  );
}

/** The three modes explained once, under the list that uses them. */
export function ProcessingLegend() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-brand-accent-soft px-3.5 py-3">
      <Icon
        name="info"
        className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
        strokeWidth={2}
      />
      <p className="text-[11.5px] leading-relaxed text-brand-accent">
        <strong>Só identificação</strong>: peça na hora, sem requerimento.{" "}
        <strong>100% on-line</strong>: você assina o PDF pelo Gov.br.{" "}
        <strong>On-line + presencial</strong>: o pedido adianta a análise, mas o
        ato termina no balcão.
      </p>
    </div>
  );
}

/** Progress across the three steps, as the redesign draws it. */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Atribuição", "Ato", "Pedido"] as const;
  return (
    <ol className="flex items-center gap-2">
      {[1, 2, 3].map((step) => {
        const done = step < current;
        const active = step === current;
        return (
          <li
            key={step}
            className={`flex items-center gap-2 ${step < 3 ? "flex-1" : ""}`}
          >
            <span
              className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${
                done
                  ? "bg-brand-accent text-white"
                  : active
                    ? "bg-brand-primary text-white"
                    : "bg-brand-border text-brand-faint"
              }`}
            >
              {done ? (
                <Icon name="check" className="h-3 w-3" strokeWidth={3} />
              ) : (
                step
              )}
            </span>
            {active && (
              <span className="text-[13px] font-bold text-brand-primary">
                {labels[step - 1]}
              </span>
            )}
            {step < 3 && (
              <span
                className={`h-0.5 flex-1 ${done ? "bg-brand-accent" : "bg-brand-border"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
