import {
  IDENTIFICATION_ONLY_HINT,
  IDENTIFICATION_ONLY_LABEL,
  PROCESSING_MODE_HINTS,
  PROCESSING_MODE_LABELS,
  type ProcessingMode,
} from "@/core/acts/catalog.ts";
import { Icon } from "../../_components/icon.tsx";

/** Just enough of an act to say how it travels. */
interface ActTravel {
  processingMode: ProcessingMode;
  identificationOnly?: true;
}

function Badge({ label, atCounter }: { label: string; atCounter?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        atCounter
          ? "bg-brand-accent-soft text-brand-accent-ink"
          : "bg-brand-tint text-brand-primary-soft"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/**
 * What the citizen needs to know before filling anything in: whether this ends
 * on the phone or at the counter, and whether the office wants papers beyond
 * their own identification. Two facts, so up to two badges: they used to share
 * one field, which forced an act that answered both to say only one.
 *
 * The counter case is the one that changes someone's afternoon, so it is the
 * one that reads differently.
 */
export function ProcessingBadge({ act }: { act: ActTravel }) {
  return (
    <>
      <Badge
        label={PROCESSING_MODE_LABELS[act.processingMode]}
        atCounter={act.processingMode === "presential"}
      />
      {act.identificationOnly && <Badge label={IDENTIFICATION_ONLY_LABEL} />}
    </>
  );
}

export function ProcessingHint({ act }: { act: ActTravel }) {
  return (
    <span className="text-[11.5px] text-brand-muted">
      {act.identificationOnly
        ? IDENTIFICATION_ONLY_HINT
        : PROCESSING_MODE_HINTS[act.processingMode]}
    </span>
  );
}

/** The selos explained once, under the list that uses them. */
export function ProcessingLegend() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-brand-accent-soft px-3.5 py-3">
      <Icon
        name="info"
        className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent-ink"
        strokeWidth={2}
      />
      <p className="text-[11.5px] leading-relaxed text-brand-accent-ink">
        Qualquer ato desta lista também pode ser pedido no balcão da serventia.
        O selo diz onde ele <strong>termina</strong>:{" "}
        <strong>Termina on-line</strong>, você assina o requerimento pelo Gov.br
        e resolve sem sair de casa; <strong>Termina no balcão</strong>, o pedido
        adianta a análise, mas você precisa comparecer para concluir.{" "}
        <strong>Só identificação</strong>: a serventia não pede documento nenhum
        além da sua identificação.
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
