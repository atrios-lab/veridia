"use client";

import {
  type Note,
  SOUNDS,
  type SoundId,
  volumeGain,
} from "@/core/chat/alerts.ts";

/**
 * Plays the attendant's alert tones with Web Audio: the notes come from
 * core/chat/alerts.ts and are synthesised here, so there is no audio file
 * to load and nothing to allow in the CSP.
 *
 * One AudioContext for the whole panel. Browsers start it suspended until
 * the person has clicked or typed on the page (autoplay policy), which is
 * why `isAudioLocked` exists: the watcher shows "Clique para ativar o som"
 * instead of ringing into silence.
 */
let context: AudioContext | undefined;

function audioContext(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return undefined;
    context = new Ctor();
  }
  return context;
}

/** Whether the browser is still holding sound back for a first click. */
export function isAudioLocked(): boolean {
  const ctx = audioContext();
  return !ctx || ctx.state !== "running";
}

/** Asks the browser to let sound play; works when called from a click. */
export async function unlockAudio(): Promise<boolean> {
  const ctx = audioContext();
  if (!ctx) return false;
  try {
    await ctx.resume();
  } catch {
    // Still locked: the next click tries again.
  }
  return ctx.state === "running";
}

/**
 * The output chain every tone goes through: a boost, then a limiter. The
 * boost is what makes the tones loud enough to carry across a counter; the
 * limiter (a DynamicsCompressor with a hard knee) is what keeps the boost
 * from clipping into a crackle when notes overlap.
 */
const BOOST = 2.2;
let output: AudioNode | undefined;

function outputChain(ctx: AudioContext): AudioNode {
  if (output) return output;
  const boost = ctx.createGain();
  boost.gain.value = BOOST;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  boost.connect(limiter).connect(ctx.destination);
  output = boost;
  return output;
}

/**
 * Plays one tone at a volume from 0 to 100. Returns false when the browser
 * did not let it play (still locked, or no Web Audio at all), so the caller
 * can say so instead of assuming the attendant heard it.
 */
export function playSound(sound: SoundId, volume: number): boolean {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return false;
  const gainValue = volumeGain(volume);
  if (gainValue === 0) return true;

  const destination = outputChain(ctx);
  const now = ctx.currentTime;
  for (const note of SOUNDS[sound].notes as readonly Note[]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = note.wave;
    const start = now + note.start;
    const end = start + note.duration;
    oscillator.frequency.setValueAtTime(note.frequency, start);
    if (note.slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(note.slideTo, end);
    }
    // A quick attack, a short hold and an exponential fade: a bell, not a
    // click, and long enough at full level to be heard.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
    gain.gain.setValueAtTime(
      gainValue,
      start + Math.min(0.06, note.duration / 2),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(end + 0.05);
  }
  return true;
}
