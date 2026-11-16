import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  grantsFrom,
  isSignKind,
  isStationMode,
  jobExpired,
  mayRequest,
  requestContextAt,
  type SignKind,
  type StationCertificate,
  type StationGrant,
  type StationMode,
  type StationPolicy,
  stationCertificatesFrom,
  stationOnline,
} from "@/core/signature/station.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  signedDocuments,
  signingStations,
  stationCertificatePolicies,
  stationSignJobs,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The signing stations of the office (decision of 16/11/2026): computers
 * with an A3 token plugged in that sign for the people the Tabelião
 * authorized. The station calls in with its key; only the key's hash is
 * kept. Nothing here is ever deleted: a station is switched off by a mark,
 * and each signature asked stays as the record of the use.
 */

export class StationError extends Error {}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new station: its key is shown once, to the computer being paired. */
export async function createStationWith(
  database: Database,
  tenantSlug: string,
  name: string,
  actorId: string,
): Promise<{ id: string; key: string }> {
  const clean = name.trim().slice(0, 80);
  if (clean.length < 2) throw new StationError("Dê um nome ao computador.");
  const key = randomBytes(32).toString("base64url");
  const [row] = await database
    .insert(signingStations)
    .values({
      tenantSlug,
      name: clean,
      keyHash: hashKey(key),
      createdBy: actorId,
    })
    .returning({ id: signingStations.id });
  if (!row) throw new StationError("Não foi possível criar a estação.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "signing-station.create",
    targetType: "signing-station",
    targetId: clean,
  });
  return { id: row.id, key };
}

export type StationRow = typeof signingStations.$inferSelect;

/** The live station this key belongs to, if any. */
export async function stationByKeyWith(
  database: Database,
  key: string,
): Promise<StationRow | undefined> {
  if (!key || key.length > 200) return undefined;
  const [row] = await database
    .select()
    .from(signingStations)
    .where(
      and(
        eq(signingStations.keyHash, hashKey(key)),
        isNull(signingStations.revokedAt),
      ),
    )
    .limit(1);
  return row;
}

async function policiesOf(
  database: Database,
  stationIds: readonly string[],
): Promise<Map<string, StationPolicy & { updatedAt: Date }>> {
  if (!stationIds.length) return new Map();
  const rows = await database
    .select()
    .from(stationCertificatePolicies)
    .where(inArray(stationCertificatePolicies.stationId, [...stationIds]));
  return new Map(
    rows.map((row) => [
      `${row.stationId}:${row.certificateKey}`,
      {
        shared: row.shared,
        mode: isStationMode(row.mode) ? row.mode : "cada",
        grants: grantsFrom(row.grants),
        releasedUntil: row.releasedUntil,
        updatedAt: row.updatedAt,
      },
    ]),
  );
}

export interface StationTask {
  id: string;
  certificadoId: string;
  dados: string;
  modo: StationMode;
  pedidoPor: string;
  titulo: string;
}

/**
 * The station calls in: what is plugged in is recorded, jobs too old are
 * given up, and the waiting ones it may sign now are handed over.
 */
export async function pulseWith(
  database: Database,
  station: StationRow,
  report: { version?: unknown; certificates?: unknown },
  now = new Date(),
): Promise<StationTask[]> {
  await database
    .update(signingStations)
    .set({
      lastSeenAt: now,
      version:
        typeof report.version === "string" ? report.version.slice(0, 20) : null,
      certificates: stationCertificatesFrom(report.certificates),
    })
    .where(eq(signingStations.id, station.id));

  const waiting = await database
    .select()
    .from(stationSignJobs)
    .where(
      and(
        eq(stationSignJobs.stationId, station.id),
        or(
          eq(stationSignJobs.status, "pendente"),
          eq(stationSignJobs.status, "enviada"),
        ),
      ),
    )
    .orderBy(stationSignJobs.createdAt)
    .limit(20);
  const policies = await policiesOf(database, [station.id]);
  const tasks: StationTask[] = [];
  for (const job of waiting) {
    if (jobExpired(job.createdAt, now)) {
      await database
        .update(stationSignJobs)
        .set({
          status: "expirada",
          error: "A estação não assinou a tempo.",
          doneAt: now,
        })
        .where(eq(stationSignJobs.id, job.id));
      continue;
    }
    // Already handed over: it is the station's now; never sent twice (it
    // would be signed twice). It ends answered, or given up above.
    if (job.status === "enviada") continue;
    // Checked again at hand-over: the rule may have changed meanwhile.
    const allowed = mayRequest(
      policies.get(`${station.id}:${job.certificateKey}`),
      job.requestedBy,
      now,
      requestContextAt(isSignKind(job.kind) ? job.kind : "outros", now),
    );
    if (!allowed.ok) {
      await database
        .update(stationSignJobs)
        .set({ status: "recusada", error: allowed.message, doneAt: now })
        .where(eq(stationSignJobs.id, job.id));
      continue;
    }
    await database
      .update(stationSignJobs)
      .set({ status: "enviada", sentAt: now })
      .where(eq(stationSignJobs.id, job.id));
    tasks.push({
      id: job.id,
      certificadoId: job.certificateKey,
      dados: job.toBeSigned,
      modo: isStationMode(job.mode) ? job.mode : "cada",
      pedidoPor: job.requestedByName,
      titulo: job.title,
    });
  }
  return tasks;
}

/** The station answers a job: the signature, or why it did not sign. */
export async function finishJobWith(
  database: Database,
  station: StationRow,
  jobId: string,
  answer: { assinatura?: unknown; erro?: unknown },
  now = new Date(),
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return false;
  const signature =
    typeof answer.assinatura === "string" &&
    /^[A-Za-z0-9+/=]{16,4096}$/.test(answer.assinatura)
      ? answer.assinatura
      : null;
  const error =
    typeof answer.erro === "string" ? answer.erro.slice(0, 200) : null;
  const [row] = await database
    .update(stationSignJobs)
    .set(
      signature
        ? { status: "assinada", signature, doneAt: now }
        : {
            status: "recusada",
            error: error || "A estação não assinou.",
            doneAt: now,
          },
    )
    .where(
      and(
        eq(stationSignJobs.id, jobId),
        eq(stationSignJobs.stationId, station.id),
        eq(stationSignJobs.status, "enviada"),
      ),
    )
    .returning({
      requestedBy: stationSignJobs.requestedBy,
      title: stationSignJobs.title,
    });
  if (!row) return false;
  await recordAuditWith(database, {
    tenantSlug: station.tenantSlug,
    actorId: row.requestedBy,
    action: signature ? "signing-station.signed" : "signing-station.refused",
    targetType: "signing-station",
    targetId: `${station.name} · ${row.title}`,
    ...(signature ? {} : { reason: error || "A estação não assinou." }),
  });
  return true;
}

export interface StationView {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: Date | null;
  version: string | null;
  certificates: (StationCertificate & { policy: StationPolicy })[];
}

/** The office's live stations, each with what is plugged in and its rules. */
export async function listStationsWith(
  database: Database,
  tenantSlug: string,
  now = new Date(),
): Promise<StationView[]> {
  const rows = await database
    .select()
    .from(signingStations)
    .where(
      and(
        eq(signingStations.tenantSlug, tenantSlug),
        isNull(signingStations.revokedAt),
      ),
    )
    .orderBy(signingStations.name);
  const policies = await policiesOf(
    database,
    rows.map((r) => r.id),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    online: stationOnline(row.lastSeenAt, now),
    lastSeenAt: row.lastSeenAt,
    version: row.version,
    certificates: stationCertificatesFrom(row.certificates).map((c) => ({
      ...c,
      policy: policies.get(`${row.id}:${c.id}`) ?? {
        shared: false,
        mode: "cada",
        grants: [],
        releasedUntil: null,
      },
    })),
  }));
}

async function ownStation(
  database: Database,
  tenantSlug: string,
  stationId: string,
): Promise<StationRow> {
  if (!/^[0-9a-f-]{36}$/i.test(stationId)) {
    throw new StationError("Estação não encontrada.");
  }
  const [row] = await database
    .select()
    .from(signingStations)
    .where(
      and(
        eq(signingStations.tenantSlug, tenantSlug),
        eq(signingStations.id, stationId),
        isNull(signingStations.revokedAt),
      ),
    )
    .limit(1);
  if (!row) throw new StationError("Estação não encontrada.");
  return row;
}

/** How a certificate of the station is shared: whether, how and with whom. */
export async function setPolicyWith(
  database: Database,
  tenantSlug: string,
  input: {
    stationId: string;
    certificateKey: string;
    shared: boolean;
    mode: StationMode;
    grants: StationGrant[];
  },
  actorId: string,
): Promise<void> {
  const station = await ownStation(database, tenantSlug, input.stationId);
  const known = stationCertificatesFrom(station.certificates).find(
    (c) => c.id === input.certificateKey,
  );
  if (!known) {
    throw new StationError("Este certificado não está plugado na estação.");
  }
  // Only people of this office, each once, with valid hours and dates.
  const clean = grantsFrom(input.grants);
  const office = clean.length
    ? new Set(
        (
          await database
            .select({ id: user.id })
            .from(user)
            .where(
              and(
                eq(user.tenantSlug, tenantSlug),
                inArray(
                  user.id,
                  clean.map((g) => g.userId),
                ),
              ),
            )
        ).map((r) => r.id),
      )
    : new Set<string>();
  const grants = clean.filter((g) => office.has(g.userId));
  for (const g of grants) {
    if (g.from && g.until && g.from >= g.until) {
      throw new StationError(
        "O horário de início precisa ser antes do horário de fim.",
      );
    }
  }
  const values = {
    shared: input.shared,
    mode: input.mode,
    grants,
    updatedBy: actorId,
    updatedAt: new Date(),
    // Changing the mode ends a release that was running.
    ...(input.mode === "cada" || !input.shared ? { releasedUntil: null } : {}),
  };
  await database
    .insert(stationCertificatePolicies)
    .values({
      tenantSlug,
      stationId: station.id,
      certificateKey: known.id,
      ...values,
    })
    .onConflictDoUpdate({
      target: [
        stationCertificatePolicies.stationId,
        stationCertificatePolicies.certificateKey,
      ],
      set: values,
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "signing-station.policy",
    targetType: "signing-station",
    targetId: `${station.name} · ${known.nome.split(":")[0]} · ${input.shared ? `compartilhado (${input.mode === "periodo" ? "liberação por período" : "confirmar cada assinatura"}) com ${grants.length} pessoa(s)` : "não compartilhado"}`,
  });
}

/** Releases the use until a time ("periodo"), or ends it (null). */
export async function releaseWith(
  database: Database,
  tenantSlug: string,
  input: { stationId: string; certificateKey: string; until: Date | null },
  actorId: string,
): Promise<void> {
  const station = await ownStation(database, tenantSlug, input.stationId);
  const [row] = await database
    .update(stationCertificatePolicies)
    .set({
      releasedUntil: input.until,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(stationCertificatePolicies.stationId, station.id),
        eq(stationCertificatePolicies.certificateKey, input.certificateKey),
        eq(stationCertificatePolicies.shared, true),
        eq(stationCertificatePolicies.mode, "periodo"),
      ),
    )
    .returning({ id: stationCertificatePolicies.id });
  if (!row) {
    throw new StationError(
      "Só um certificado compartilhado com liberação por período pode ser liberado.",
    );
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: input.until
      ? "signing-station.release"
      : "signing-station.release-end",
    targetType: "signing-station",
    targetId: `${station.name} · ${input.certificateKey.slice(0, 8)}${input.until ? ` · até ${input.until.toISOString()}` : ""}`,
  });
}

/** The station switched off: it stops answering; the record stays. */
export async function revokeStationWith(
  database: Database,
  tenantSlug: string,
  stationId: string,
  actorId: string,
): Promise<void> {
  const station = await ownStation(database, tenantSlug, stationId);
  await database
    .update(signingStations)
    .set({ revokedAt: new Date(), revokedBy: actorId })
    .where(eq(signingStations.id, station.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "signing-station.revoke",
    targetType: "signing-station",
    targetId: station.name,
  });
}

/** An A3 certificate shared with this person, as the signing screens list it. */
export interface SharedCertificate extends StationCertificate {
  estacao: {
    id: string;
    nome: string;
    online: boolean;
    modo: StationMode;
    liberadoAte: string | null;
    /** What this person may sign with it, and when. */
    autorizacao: StationGrant;
  };
}

/** The A3 certificates of the stations this person may ask to sign with. */
export async function sharedForUserWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  now = new Date(),
): Promise<SharedCertificate[]> {
  const stations = await listStationsWith(database, tenantSlug, now);
  const out: SharedCertificate[] = [];
  for (const station of stations) {
    for (const certificate of station.certificates) {
      const { policy, ...cert } = certificate;
      const grant = policy.grants.find((g) => g.userId === userId);
      if (!policy.shared || !grant) continue;
      out.push({
        ...cert,
        estacao: {
          id: station.id,
          nome: station.name,
          online: station.online,
          modo: policy.mode,
          liberadoAte:
            policy.releasedUntil && policy.releasedUntil > now
              ? policy.releasedUntil.toISOString()
              : null,
          autorizacao: grant,
        },
      });
    }
  }
  return out;
}

/** Asks a station for one signature; the screen then waits for the answer. */
export async function requestJobWith(
  database: Database,
  tenantSlug: string,
  input: {
    stationId: string;
    certificateKey: string;
    toBeSigned: string;
    title: string;
    kind: SignKind;
  },
  requester: { id: string; name: string },
  now = new Date(),
): Promise<string> {
  const station = await ownStation(database, tenantSlug, input.stationId);
  if (!/^[A-Za-z0-9+/=]{4,24000}$/.test(input.toBeSigned)) {
    throw new StationError("Dados para assinar inválidos.");
  }
  const policy = (await policiesOf(database, [station.id])).get(
    `${station.id}:${input.certificateKey}`,
  );
  const allowed = mayRequest(
    policy,
    requester.id,
    now,
    requestContextAt(input.kind, now),
  );
  if (!allowed.ok) throw new StationError(allowed.message);
  if (!stationOnline(station.lastSeenAt, now)) {
    throw new StationError(
      `A estação ${station.name} está desligada. Ligue o computador com o token e abra o Assinador Veridia.`,
    );
  }
  const [row] = await database
    .insert(stationSignJobs)
    .values({
      tenantSlug,
      stationId: station.id,
      certificateKey: input.certificateKey,
      requestedBy: requester.id,
      requestedByName: requester.name.slice(0, 120) || "Usuário",
      title: input.title.trim().slice(0, 200) || "Documento",
      toBeSigned: input.toBeSigned,
      mode: policy?.mode ?? "cada",
      kind: input.kind,
      holderName: (
        stationCertificatesFrom(station.certificates)
          .find((c) => c.id === input.certificateKey)
          ?.nome.split(":")[0] ?? ""
      ).slice(0, 200),
    })
    .returning({ id: stationSignJobs.id });
  if (!row) throw new StationError("Não foi possível pedir a assinatura.");
  return row.id;
}

/** How the person's own job stands. */
export async function jobStatusWith(
  database: Database,
  tenantSlug: string,
  jobId: string,
  userId: string,
  now = new Date(),
): Promise<
  | { status: "aguardando" }
  | { status: "assinada"; signature: string }
  | { status: "falhou"; message: string }
> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return { status: "falhou", message: "Pedido não encontrado." };
  }
  const [row] = await database
    .select()
    .from(stationSignJobs)
    .where(
      and(
        eq(stationSignJobs.tenantSlug, tenantSlug),
        eq(stationSignJobs.id, jobId),
        eq(stationSignJobs.requestedBy, userId),
      ),
    )
    .limit(1);
  if (!row) return { status: "falhou", message: "Pedido não encontrado." };
  if (row.status === "assinada" && row.signature) {
    return { status: "assinada", signature: row.signature };
  }
  if (row.status === "pendente" || row.status === "enviada") {
    if (jobExpired(row.createdAt, now)) {
      await database
        .update(stationSignJobs)
        .set({
          status: "expirada",
          error: "A estação não assinou a tempo.",
          doneAt: now,
        })
        .where(eq(stationSignJobs.id, row.id));
      return { status: "falhou", message: "A estação não assinou a tempo." };
    }
    return { status: "aguardando" };
  }
  return { status: "falhou", message: row.error || "A estação não assinou." };
}

/**
 * Ties a signed job to the document it produced, so the record says what
 * was signed: the person's own job, signed, and a document of this office.
 */
export async function linkJobWith(
  database: Database,
  tenantSlug: string,
  jobId: string,
  userId: string,
  signedId: string,
): Promise<boolean> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(jobId) || !uuid.test(signedId)) return false;
  const [doc] = await database
    .select({ title: signedDocuments.title, code: signedDocuments.code })
    .from(signedDocuments)
    .where(
      and(
        eq(signedDocuments.tenantSlug, tenantSlug),
        eq(signedDocuments.id, signedId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  const [row] = await database
    .update(stationSignJobs)
    .set({
      signedDocumentId: signedId,
      signedCode: doc.code,
      title: doc.title.slice(0, 200) || "Documento",
    })
    .where(
      and(
        eq(stationSignJobs.tenantSlug, tenantSlug),
        eq(stationSignJobs.id, jobId),
        eq(stationSignJobs.requestedBy, userId),
        eq(stationSignJobs.status, "assinada"),
        isNull(stationSignJobs.signedDocumentId),
      ),
    )
    .returning({ id: stationSignJobs.id });
  return Boolean(row);
}

export interface JobRecord {
  id: string;
  stationName: string;
  requestedBy: string;
  requestedByName: string;
  holderName: string;
  kind: SignKind;
  title: string;
  signedCode: string | null;
  status: string;
  error: string | null;
  createdAt: Date;
  doneAt: Date | null;
}

/**
 * The signatures asked of the office's stations, newest first: who asked,
 * whose certificate, what kind, what document, when and how it ended.
 */
export async function stationHistoryWith(
  database: Database,
  tenantSlug: string,
  filter: { userId?: string; kind?: SignKind } = {},
  limit = 50,
): Promise<JobRecord[]> {
  const rows = await database
    .select({
      id: stationSignJobs.id,
      stationName: signingStations.name,
      requestedBy: stationSignJobs.requestedBy,
      requestedByName: stationSignJobs.requestedByName,
      holderName: stationSignJobs.holderName,
      kind: stationSignJobs.kind,
      title: stationSignJobs.title,
      signedCode: stationSignJobs.signedCode,
      status: stationSignJobs.status,
      error: stationSignJobs.error,
      createdAt: stationSignJobs.createdAt,
      doneAt: stationSignJobs.doneAt,
    })
    .from(stationSignJobs)
    .innerJoin(
      signingStations,
      eq(signingStations.id, stationSignJobs.stationId),
    )
    .where(
      and(
        eq(stationSignJobs.tenantSlug, tenantSlug),
        filter.userId
          ? eq(stationSignJobs.requestedBy, filter.userId)
          : undefined,
        filter.kind ? eq(stationSignJobs.kind, filter.kind) : undefined,
      ),
    )
    .orderBy(desc(stationSignJobs.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    kind: isSignKind(r.kind) ? r.kind : "outros",
  }));
}
