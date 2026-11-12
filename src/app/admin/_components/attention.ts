/**
 * The panel's "click here" treatment, for an entry point the office has to
 * notice: the Treinamento item today, the LGPD course next.
 *
 * A solid fill with white text, not a badge's pale tint (a tint disappears
 * in a scroll), plus a pulsing halo around it. The halo is the only thing
 * that moves, so the text keeps its contrast at every frame, and it sits
 * behind `motion-safe:`: with "reduce motion" on, the fill stays and the
 * pulse is gone.
 *
 * A class string rather than a component, so it lands on whatever element
 * already is the link (a sidebar item, a button) without wrapping it. The
 * sidebar applies it to any nav item marked `attention` (see nav.ts).
 */
export const ATTENTION_CLASS =
  "bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground motion-safe:animate-attention-pulse";
