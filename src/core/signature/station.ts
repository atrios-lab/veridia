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

/**
 * The kinds of document a shared certificate may sign, by the screen the
 * request comes from (decision of 16/11/2026: "o que está autorizado a
 * assinar").
 */
export const SIGN_KINDS = {
  pedidos: "Pedidos: entregas, exigências e notas aos clientes",
  qualificacao: "Qualificação de títulos",
  assinador: "Assinador digital (documentos avulsos)",
  rcpn: "Registro Civil: certidões e habilitação",
  "livro-diario": "Livro Diário e prestação de contas",
  iss: "Declaração de ISS",
  guias: "Guias imobiliárias",
  "papel-seguranca": "Papel de segurança e ofícios",
  transparencia: "Transparência e boletins",
  lgpd: "LGPD e DPO",
  outros: "Outros documentos do painel",
} as const;
export type SignKind = keyof typeof SIGN_KINDS;
export const isSignKind = (value: string): value is SignKind =>
  Object.hasOwn(SIGN_KINDS, value);

/** The kind of a request, by the panel address it was made from. */
export function kindFromPath(path: string): SignKind {
  const p = path.split("?")[0] ?? "";
  if (p.startsWith("/admin/pedidos")) return "pedidos";
  if (p.startsWith("/admin/utilitarios/qualificacao")) return "qualificacao";
  if (p.startsWith("/admin/utilitarios/assinador")) return "assinador";
  if (p.startsWith("/admin/rcpn")) return "rcpn";
  if (p.startsWith("/admin/utilitarios/livro-diario")) return "livro-diario";
  if (p.startsWith("/admin/utilitarios/iss")) return "iss";
  if (p.startsWith("/admin/utilitarios/guias")) return "guias";
  if (
    p.startsWith("/admin/utilitarios/papel-seguranca") ||
    p.startsWith("/admin/utilitarios/solicitacao-papeis")
  )
    return "papel-seguranca";
  if (p.startsWith("/admin/transparencia")) return "transparencia";
  if (p.startsWith("/admin/lgpd") || p.startsWith("/admin/dpo")) return "lgpd";
  return "outros";
}

/**
 * One person's authorization on a certificate: what kinds (none: all), at
 * what hours of the day ("08:00" to "18:00", office time; none: any hour)
 * and until which day (none: until changed).
 */
export interface StationGrant {
  userId: string;
  kinds: SignKind[];
  from?: string;
  until?: string;
  expiresOn?: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The grants as stored, cleaned: bad entries out, one per person. */
export function grantsFrom(raw: unknown): StationGrant[] {
  if (!Array.isArray(raw)) return [];
  const out: StationGrant[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const g = item as Record<string, unknown>;
    if (typeof g.userId !== "string" || !g.userId) continue;
    if (out.some((o) => o.userId === g.userId)) continue;
    const kinds = Array.isArray(g.kinds)
      ? [
          ...new Set(
            g.kinds.filter(
              (k): k is SignKind => typeof k === "string" && isSignKind(k),
            ),
          ),
        ]
      : [];
    const from =
      typeof g.from === "string" && HHMM.test(g.from) ? g.from : undefined;
    const until =
      typeof g.until === "string" && HHMM.test(g.until) ? g.until : undefined;
    const expiresOn =
      typeof g.expiresOn === "string" && ISO_DAY.test(g.expiresOn)
        ? g.expiresOn
        : undefined;
    out.push({
      userId: g.userId,
      kinds,
      ...(from && until ? { from, until } : {}),
      ...(expiresOn ? { expiresOn } : {}),
    });
  }
  return out;
}

/** "Só Pedidos e Qualificação · das 08:00 às 18:00 · até 31/12/2026". */
export function describeGrant(grant: StationGrant): string {
  const parts = [
    grant.kinds.length
      ? `Só ${grant.kinds.map((k) => SIGN_KINDS[k].split(":")[0]).join(", ")}`
      : "Todos os documentos",
  ];
  if (grant.from && grant.until)
    parts.push(`das ${grant.from} às ${grant.until}`);
  if (grant.expiresOn) {
    parts.push(`até ${grant.expiresOn.split("-").reverse().join("/")}`);
  }
  return parts.join(" · ");
}

export interface StationPolicy {
  shared: boolean;
  mode: StationMode;
  grants: StationGrant[];
  releasedUntil: Date | null;
}

/** Where and when a request is made, in the office's own clock. */
export interface RequestContext {
  kind: SignKind;
  /** "14:35", office time. */
  clock: string;
  /** "2026-11-16", office day. */
  today: string;
}

const OFFICE_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Fortaleza",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const OFFICE_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza",
});

/** The request context at this instant, on the office's wall clock. */
export function requestContextAt(kind: SignKind, now: Date): RequestContext {
  return {
    kind,
    clock: OFFICE_CLOCK.format(now),
    today: OFFICE_DAY.format(now),
  };
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
  context: RequestContext,
): { ok: true } | { ok: false; message: string } {
  if (!policy?.shared) {
    return { ok: false, message: "Este certificado não está compartilhado." };
  }
  const grant = policy.grants.find((g) => g.userId === userId);
  if (!grant) {
    return {
      ok: false,
      message: "Você não foi autorizado a usar este certificado.",
    };
  }
  if (grant.expiresOn && context.today > grant.expiresOn) {
    return {
      ok: false,
      message: "A sua autorização para usar este certificado venceu.",
    };
  }
  if (grant.kinds.length && !grant.kinds.includes(context.kind)) {
    return {
      ok: false,
      message: `Você não está autorizado a assinar ${SIGN_KINDS[context.kind].split(":")[0].toLowerCase()} com este certificado.`,
    };
  }
  if (
    grant.from &&
    grant.until &&
    (context.clock < grant.from || context.clock > grant.until)
  ) {
    return {
      ok: false,
      message: `Você só pode assinar com este certificado das ${grant.from} às ${grant.until}.`,
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
