import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  checkLevels,
  frameFrom,
  groupByLevel,
  guessLevel,
  levelsFrom,
  NAME_MAX,
  type PublicPerson,
  publicPerson,
  type StaffInput,
  StaffInputSchema,
  type StaffParsed,
  type StaffRecord,
  signersFrom,
  storedLevels,
  type TeamFileKind,
  type TeamGroup,
  type TeamLevel,
} from "@/core/team/team.ts";
import { type Database, db } from "@/db/index.ts";
import { officeStaff, tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { OFFICE_TEAM_LEVELS_KEY } from "./office-config.ts";

/**
 * The office's team (decision of 18/11/2026). Nothing here deletes a row: a
 * person leaves the lists by being archived, and a file taken off only
 * clears its columns (the stored file is removed by the caller).
 */

export class TeamError extends Error {}

export type StaffRow = typeof officeStaff.$inferSelect;

export function toRecord(row: StaffRow): StaffRecord {
  return {
    id: row.id,
    name: row.name,
    levelId: row.levelId,
    profession: row.profession,
    registration: row.registration,
    portariaDate: row.portariaDate,
    position: row.position,
    showOnSite: row.showOnSite,
    imageConsent: row.imageConsent,
    canSign: row.canSign,
    signerOrder: row.signerOrder,
    hasPhoto: Boolean(row.photoPath),
    hasPortaria: Boolean(row.portariaPath),
    hasWord: Boolean(row.wordPath),
    archived: row.archivedAt !== null,
    frame: frameFrom(row.photoFrame),
  };
}

// Levels -----------------------------------------------------------------

export async function getLevelsWith(
  database: Database,
  tenantSlug: string,
): Promise<TeamLevel[]> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_TEAM_LEVELS_KEY),
      ),
    )
    .limit(1);
  return levelsFrom(row?.published);
}

/** Changes the levels (names and order). A level with people, even archived ones, stays. */
export async function saveLevelsWith(
  database: Database,
  tenantSlug: string,
  input: TeamLevel[],
  actorId: string,
): Promise<void> {
  const levels = input.map((level) => ({
    id: level.id,
    label: level.label.trim(),
  }));
  const problem = checkLevels(levels);
  if (problem) throw new TeamError(problem);
  const current = await getLevelsWith(database, tenantSlug);
  const used = await database
    .selectDistinct({ levelId: officeStaff.levelId })
    .from(officeStaff)
    .where(eq(officeStaff.tenantSlug, tenantSlug));
  const keep = new Set(levels.map((level) => level.id));
  for (const { levelId } of used) {
    if (keep.has(levelId)) continue;
    const name =
      current.find((level) => level.id === levelId)?.label ?? levelId;
    throw new TeamError(
      `O nível "${name}" ainda tem pessoas (inclusive arquivadas). Mude-as de nível antes de tirá-lo.`,
    );
  }
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_TEAM_LEVELS_KEY,
      published: storedLevels(levels),
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: storedLevels(levels),
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "team.levels",
    targetType: "team",
    targetId: levels
      .map((level) => level.label)
      .join(", ")
      .slice(0, 200),
  });
}

// People -----------------------------------------------------------------

export async function listStaffRowsWith(
  database: Database,
  tenantSlug: string,
  options: { archived?: boolean } = {},
): Promise<StaffRow[]> {
  return database
    .select()
    .from(officeStaff)
    .where(
      and(
        eq(officeStaff.tenantSlug, tenantSlug),
        options.archived ? undefined : isNull(officeStaff.archivedAt),
      ),
    )
    .orderBy(asc(officeStaff.position), asc(officeStaff.name));
}

async function ownRow(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StaffRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new TeamError("Pessoa não encontrada.");
  const [row] = await database
    .select()
    .from(officeStaff)
    .where(and(eq(officeStaff.tenantSlug, tenantSlug), eq(officeStaff.id, id)))
    .limit(1);
  if (!row) throw new TeamError("Pessoa não encontrada.");
  return row;
}

function parseInput(raw: StaffInput): StaffParsed {
  const parsed = StaffInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TeamError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  return parsed.data;
}

async function assertLevel(
  database: Database,
  tenantSlug: string,
  levelId: string,
): Promise<void> {
  const levels = await getLevelsWith(database, tenantSlug);
  if (!levels.some((level) => level.id === levelId)) {
    throw new TeamError("Escolha um nível da lista.");
  }
}

async function nextPosition(
  database: Database,
  tenantSlug: string,
  levelId: string,
): Promise<number> {
  const [last] = await database
    .select({ position: officeStaff.position })
    .from(officeStaff)
    .where(
      and(
        eq(officeStaff.tenantSlug, tenantSlug),
        eq(officeStaff.levelId, levelId),
        isNull(officeStaff.archivedAt),
      ),
    )
    .orderBy(desc(officeStaff.position))
    .limit(1);
  return (last?.position ?? 0) + 1;
}

async function nextSignerOrder(
  database: Database,
  tenantSlug: string,
): Promise<number> {
  const [last] = await database
    .select({ order: officeStaff.signerOrder })
    .from(officeStaff)
    .where(eq(officeStaff.tenantSlug, tenantSlug))
    .orderBy(desc(officeStaff.signerOrder))
    .limit(1);
  return (last?.order ?? 0) + 1;
}

export async function createStaffWith(
  database: Database,
  tenantSlug: string,
  raw: StaffInput,
  actorId: string,
): Promise<string> {
  const input = parseInput(raw);
  await assertLevel(database, tenantSlug, input.levelId);
  const now = new Date();
  const [row] = await database
    .insert(officeStaff)
    .values({
      tenantSlug,
      name: input.name,
      levelId: input.levelId,
      profession: input.profession,
      registration: input.registration,
      portariaDate: input.portariaDate || null,
      position: await nextPosition(database, tenantSlug, input.levelId),
      showOnSite: input.showOnSite,
      imageConsent: input.imageConsent,
      imageConsentAt: input.imageConsent ? now : null,
      photoFrame: input.frame,
      canSign: input.canSign,
      signerOrder: input.canSign
        ? await nextSignerOrder(database, tenantSlug)
        : null,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning({ id: officeStaff.id });
  if (!row) throw new TeamError("Não foi possível cadastrar a pessoa.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "team.create",
    targetType: "team",
    targetId: input.name,
  });
  return row.id;
}

export async function updateStaffWith(
  database: Database,
  tenantSlug: string,
  id: string,
  raw: StaffInput,
  actorId: string,
): Promise<void> {
  const row = await ownRow(database, tenantSlug, id);
  const input = parseInput(raw);
  await assertLevel(database, tenantSlug, input.levelId);
  const now = new Date();
  await database
    .update(officeStaff)
    .set({
      name: input.name,
      levelId: input.levelId,
      profession: input.profession,
      registration: input.registration,
      portariaDate: input.portariaDate || null,
      // A new level takes the person to its end.
      position:
        input.levelId === row.levelId
          ? row.position
          : await nextPosition(database, tenantSlug, input.levelId),
      showOnSite: input.showOnSite,
      imageConsent: input.imageConsent,
      imageConsentAt: input.imageConsent
        ? input.imageConsent === row.imageConsent
          ? row.imageConsentAt
          : now
        : null,
      photoFrame: input.frame,
      canSign: input.canSign,
      // Given once and kept: a person who stops signing and comes back
      // returns to the same place.
      signerOrder:
        input.canSign && row.signerOrder === null
          ? await nextSignerOrder(database, tenantSlug)
          : row.signerOrder,
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(officeStaff.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "team.update",
    targetType: "team",
    targetId:
      `${input.name}${input.showOnSite ? " · no site" : " · só no painel"}${input.canSign ? " · assina" : ""}`.slice(
        0,
        200,
      ),
  });
}

/** Puts a file on a person; returns the path it replaced, for the caller to remove. */
export async function setFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
  kind: TeamFileKind,
  file: { path: string; name: string; mime: string },
  actorId: string,
): Promise<string | null> {
  const row = await ownRow(database, tenantSlug, id);
  const now = new Date();
  const base = { updatedBy: actorId, updatedAt: now };
  let previous: string | null;
  if (kind === "photo") {
    previous = row.photoPath;
    await database
      .update(officeStaff)
      .set({
        ...base,
        photoPath: file.path,
        photoMime: file.mime,
        photoUpdatedAt: now,
      })
      .where(eq(officeStaff.id, row.id));
  } else if (kind === "portaria") {
    previous = row.portariaPath;
    await database
      .update(officeStaff)
      .set({
        ...base,
        portariaPath: file.path,
        portariaName: file.name,
        portariaUpdatedAt: now,
      })
      .where(eq(officeStaff.id, row.id));
  } else {
    previous = row.wordPath;
    await database
      .update(officeStaff)
      .set({
        ...base,
        wordPath: file.path,
        wordName: file.name,
        wordMime: file.mime,
        wordUpdatedAt: now,
      })
      .where(eq(officeStaff.id, row.id));
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action:
      kind === "photo"
        ? "team.photo-set"
        : kind === "portaria"
          ? "team.portaria-attach"
          : "team.word-set",
    targetType: "team",
    targetId: row.name,
  });
  return previous;
}

/** Takes a file off a person; returns its path, for the caller to remove. */
export async function clearFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
  kind: TeamFileKind,
  actorId: string,
): Promise<string | null> {
  const row = await ownRow(database, tenantSlug, id);
  const now = new Date();
  const base = { updatedBy: actorId, updatedAt: now };
  let previous: string | null;
  if (kind === "photo") {
    previous = row.photoPath;
    await database
      .update(officeStaff)
      .set({ ...base, photoPath: null, photoMime: null, photoUpdatedAt: null })
      .where(eq(officeStaff.id, row.id));
  } else if (kind === "portaria") {
    previous = row.portariaPath;
    await database
      .update(officeStaff)
      .set({
        ...base,
        portariaPath: null,
        portariaName: null,
        portariaUpdatedAt: null,
      })
      .where(eq(officeStaff.id, row.id));
  } else {
    previous = row.wordPath;
    await database
      .update(officeStaff)
      .set({
        ...base,
        wordPath: null,
        wordName: null,
        wordMime: null,
        wordUpdatedAt: null,
      })
      .where(eq(officeStaff.id, row.id));
  }
  if (previous) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId,
      action: "team.file-clear",
      targetType: "team",
      targetId: `${row.name} · ${kind === "photo" ? "foto" : kind === "portaria" ? "portaria" : "Word"}`,
    });
  }
  return previous;
}

export async function archiveStaffWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await ownRow(database, tenantSlug, id);
  if (row.archivedAt) return;
  const now = new Date();
  await database
    .update(officeStaff)
    .set({
      archivedAt: now,
      archivedBy: actorId,
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(officeStaff.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "team.archive",
    targetType: "team",
    targetId: row.name,
  });
}

export async function restoreStaffWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await ownRow(database, tenantSlug, id);
  if (!row.archivedAt) return;
  const now = new Date();
  await database
    .update(officeStaff)
    .set({
      archivedAt: null,
      archivedBy: null,
      position: await nextPosition(database, tenantSlug, row.levelId),
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(eq(officeStaff.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "team.restore",
    targetType: "team",
    targetId: row.name,
  });
}

/** Moves a person one place up or down inside their level. */
export async function moveStaffWith(
  database: Database,
  tenantSlug: string,
  id: string,
  direction: "up" | "down",
  actorId: string,
): Promise<void> {
  const row = await ownRow(database, tenantSlug, id);
  const sameLevel = await database
    .select({ id: officeStaff.id, name: officeStaff.name })
    .from(officeStaff)
    .where(
      and(
        eq(officeStaff.tenantSlug, tenantSlug),
        eq(officeStaff.levelId, row.levelId),
        isNull(officeStaff.archivedAt),
      ),
    )
    .orderBy(asc(officeStaff.position), asc(officeStaff.name));
  const at = sameLevel.findIndex((p) => p.id === row.id);
  const to = direction === "up" ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= sameLevel.length) return;
  const order = sameLevel.map((p) => p.id);
  [order[at], order[to]] = [order[to] as string, order[at] as string];
  // Renumbered from 1, so places never tie.
  for (const [index, personId] of order.entries()) {
    await database
      .update(officeStaff)
      .set({ position: index + 1, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(officeStaff.id, personId));
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "team.move",
    targetType: "team",
    targetId: row.name,
  });
}

// The site ---------------------------------------------------------------

export interface PublicTeam {
  levels: TeamLevel[];
  groups: TeamGroup<PublicPerson>[];
}

/** What the visitor sees: the people marked for the site, by level. */
export async function publicTeamWith(
  database: Database,
  tenantSlug: string,
): Promise<PublicTeam> {
  const levels = await getLevelsWith(database, tenantSlug);
  const rows = await listStaffRowsWith(database, tenantSlug);
  const people = rows.flatMap((row) => {
    const shown = publicPerson(toRecord(row));
    return shown ? [{ ...shown, position: row.position }] : [];
  });
  return { levels, groups: groupByLevel(levels, people) };
}

/** The visitor's view of the team; empty if the database cannot be read. */
export async function publicTeam(tenantSlug: string): Promise<PublicTeam> {
  try {
    return await publicTeamWith(db, tenantSlug);
  } catch {
    return { levels: levelsFrom(null), groups: [] };
  }
}

export interface TeamFile {
  path: string;
  mime: string;
  name: string;
}

/**
 * A person's file. For the site (`publicOnly`): the photo only with the
 * authorization, the portaria only when attached, both only for a person
 * marked for the site, and never the Word.
 */
export async function staffFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
  kind: TeamFileKind,
  options: { publicOnly: boolean },
): Promise<TeamFile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await database
    .select()
    .from(officeStaff)
    .where(and(eq(officeStaff.tenantSlug, tenantSlug), eq(officeStaff.id, id)))
    .limit(1);
  if (!row) return null;
  if (options.publicOnly) {
    if (!row.showOnSite || row.archivedAt) return null;
    if (kind === "word") return null;
    if (kind === "photo" && !row.imageConsent) return null;
  }
  if (kind === "photo" && row.photoPath) {
    return {
      path: row.photoPath,
      mime: row.photoMime ?? "image/jpeg",
      name: `${row.name}.jpg`,
    };
  }
  if (kind === "portaria" && row.portariaPath) {
    return {
      path: row.portariaPath,
      mime: "application/pdf",
      name: row.portariaName ?? "portaria.pdf",
    };
  }
  if (kind === "word" && row.wordPath) {
    return {
      path: row.wordPath,
      mime: row.wordMime ?? "application/octet-stream",
      name: row.wordName ?? "portaria.docx",
    };
  }
  return null;
}

// Quem assina -------------------------------------------------------------

/** Who "Quem assina" lists from the team; empty while nobody is marked. */
export async function teamSignersWith(
  database: Database,
  tenantSlug: string,
): Promise<{ name: string; title: string; note: string }[]> {
  const rows = await listStaffRowsWith(database, tenantSlug);
  if (!rows.some((row) => row.canSign)) return [];
  const levels = await getLevelsWith(database, tenantSlug);
  return signersFrom(levels, rows.map(toRecord));
}

/**
 * Brings the people of the old "Quem assina" list into the team, marked
 * "Pode assinar" and in the same order, so the documents that keep who signs
 * by its place keep pointing at the same person. Only while no one in the
 * team signs yet. A person already in the team with the same name is marked,
 * not copied; the others are added (not shown on the site).
 */
export async function importSignersWith(
  database: Database,
  tenantSlug: string,
  legacy: { name: string; title: string; note: string }[],
  actorId: string,
): Promise<number> {
  const rows = await listStaffRowsWith(database, tenantSlug, {
    archived: true,
  });
  if (rows.some((row) => row.canSign)) {
    throw new TeamError("A equipe já tem quem assina.");
  }
  const levels = await getLevelsWith(database, tenantSlug);
  const base = await nextSignerOrder(database, tenantSlug);
  const now = new Date();
  let done = 0;
  for (const [index, signer] of legacy.entries()) {
    const name = signer.name.trim().slice(0, NAME_MAX);
    if (name.length < 2) continue;
    const same = rows.find(
      (row) =>
        !row.archivedAt &&
        row.name.trim().toLocaleLowerCase("pt-BR") ===
          name.toLocaleLowerCase("pt-BR"),
    );
    if (same) {
      await database
        .update(officeStaff)
        .set({
          canSign: true,
          signerOrder: base + index,
          registration: same.registration || signer.note.trim().slice(0, 80),
          updatedBy: actorId,
          updatedAt: now,
        })
        .where(eq(officeStaff.id, same.id));
    } else {
      const levelId = guessLevel(levels, signer.title);
      await database.insert(officeStaff).values({
        tenantSlug,
        name,
        levelId,
        registration: signer.note.trim().slice(0, 80),
        position: await nextPosition(database, tenantSlug, levelId),
        canSign: true,
        signerOrder: base + index,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }
    done += 1;
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "team.import-signers",
    targetType: "team",
    targetId: `${done} pessoa(s)`,
  });
  return done;
}
