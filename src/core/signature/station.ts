import { z } from "zod";

/**
 * The signing station (decision of 16/11/2026): the computer where an A3
 * token stays plugged signs for the people of the office the Tabelião
 * authorized. Per certificate, the Tabelião chooses how the holder agrees:
 * "periodo" (the use is released until a time) or "cada" (each signature
 * is confirmed at the station).
 */

export const STATION_MODES = {
  periodo: {
    label: "Liberação por período",
    description:
      "O Tabelião libera o uso por algumas horas; enquanto estiver liberado, a estação assina sem perguntar. O driver do token pede o PIN na estação na primeira assinatura.",
  },
  cada: {
    label: "Confirmar cada assinatura",
    description:
      "Cada pedido aparece numa janela na estação e só é assinado depois que alguém ali confirma (e o driver pede o PIN).",
  },
} as const;
export type StationMode = keyof typeof STATION_MODES;
export const isStationMode = (value: string): value is StationMode =>
  Object.hasOwn(STATION_MODES, value);

/** A station that called in the last seconds is on. */
export const STATION_ONLINE_MS = 20_000;
/** A job nobody signed in this time is given up. */
export const STATION_JOB_TTL_MS = 3 * 60_000;
/** The release lengths offered, in hours. */
export const RELEASE_HOURS = [1, 2, 4, 8, 10] as const;

export function stationOnline(lastSeenAt: Date | null, now: Date): boolean {
  return Boolean(
    lastSeenAt && now.getTime() - lastSeenAt.getTime() <= STATION_ONLINE_MS,
  );
}

/** A certificate plugged in at a station, as the station reports it. */
export const StationCertificateSchema = z.object({
  id: z.string().regex(/^[0-9A-F]{40}$/),
  nome: z.string().max(300),
  emissor: z.string().max(300),
  validade: z.string().max(40),
  certificado: z.string().max(20_000),
  cadeia: z.array(z.string().max(20_000)).max(6),
});
export type StationCertificate = z.infer<typeof StationCertificateSchema>;

/** What the station reports, cleaned: unknown or malformed entries out. */
export function stationCertificatesFrom(raw: unknown): StationCertificate[] {
  if (!Array.isArray(raw)) return [];
  const out: StationCertificate[] = [];
  for (const item of raw.slice(0, 20)) {
    const parsed = StationCertificateSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export interface StationPolicy {
  shared: boolean;
  mode: StationMode;
  signerIds: string[];
  releasedUntil: Date | null;
}

/**
 * Whether this person may ask the station for a signature now, and why
 * not. The station being on is checked apart: an off station keeps the
 * request waiting a little before giving up.
 */
export function mayRequest(
  policy: StationPolicy | undefined,
  userId: string,
  now: Date,
): { ok: true } | { ok: false; message: string } {
  if (!policy?.shared) {
    return { ok: false, message: "Este certificado não está compartilhado." };
  }
  if (!policy.signerIds.includes(userId)) {
    return {
      ok: false,
      message: "Você não foi autorizado a usar este certificado.",
    };
  }
  if (
    policy.mode === "periodo" &&
    (!policy.releasedUntil || policy.releasedUntil <= now)
  ) {
    return {
      ok: false,
      message:
        "O uso deste certificado não está liberado agora. Peça ao Tabelião para liberar.",
    };
  }
  return { ok: true };
}

/** A job still waiting after its time is given up. */
export function jobExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > STATION_JOB_TTL_MS;
}

/** "Liberado até 18:30", for the lists. */
export function releaseUntil(hours: number, now: Date): Date {
  return new Date(now.getTime() + hours * 3_600_000);
}
