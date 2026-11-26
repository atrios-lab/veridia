import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import polygonClipping from "polygon-clipping";
import {
  type GeoReading,
  readMemorial,
  readVertexTable,
  shapeOf,
  toUtm,
  type Vertex,
} from "@/core/ri/geo.ts";
import type { Database } from "@/db/index.ts";
import { riGeometries, riProperties } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { pdfText } from "./guide-reading.ts";
import { type Actor, RiError } from "./ri.ts";
import { odsRows, transferFile } from "./ri-sheet.ts";
import { docxText } from "./titularidade-reading.ts";

/**
 * The georreferenciamento of the matrículas (change
 * registro-de-imoveis-mapa): read the memorial or the Sigef table, keep
 * the perímetro, draw it and find where two imóveis overlap. Nothing is
 * deleted: "apagar" marks the geometry, and the newest one in force is
 * the matrícula's.
 */

export type GeometryRow = typeof riGeometries.$inferSelect;

const UUID = /^[0-9a-f-]{36}$/i;

/** The vértices from what the office sent: a file, a pasted text, or both. */
export async function readGeometrySource(input: {
  text: string;
  file?: { name: string; bytes: Uint8Array } | null;
}): Promise<GeoReading & { source: "memorial" | "sigef"; sourceText: string }> {
  const file = input.file;
  if (file && file.bytes.byteLength > 0) {
    const name = file.name.toLowerCase();
    const head = new TextDecoder().decode(file.bytes.subarray(0, 4));
    if (name.endsWith(".ods")) {
      const rows = await odsRows(file.bytes);
      return {
        ...readVertexTable(rows),
        source: "sigef",
        sourceText: rows.map((r) => r.join(";")).join("\n"),
      };
    }
    if (name.endsWith(".xlsx") || name.endsWith(".csv")) {
      const read = await transferFile(file);
      const rows = read.type === "table" ? read.rows : [];
      return {
        ...readVertexTable(rows),
        source: "sigef",
        sourceText: rows.map((r) => r.join(";")).join("\n"),
      };
    }
    const text =
      head === "%PDF"
        ? await pdfText(file.bytes)
        : head.startsWith("PK")
          ? await docxText(file.bytes)
          : new TextDecoder().decode(file.bytes);
    return { ...readMemorial(text), source: "memorial", sourceText: text };
  }
  const text = input.text.trim();
  if (!text)
    throw new RiError(
      "Cole o memorial descritivo ou anexe a planilha do Sigef.",
    );
  // A pasted table (vértice; longitude; latitude) or the memorial's text.
  if (/longitude|;\s*-?\d/i.test(text.split("\n")[0] ?? "")) {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.split(/;|\t/).map((c) => c.trim()));
    const table = readVertexTable(rows);
    if (table.vertices.length >= 3) {
      return { ...table, source: "sigef", sourceText: text };
    }
  }
  return { ...readMemorial(text), source: "memorial", sourceText: text };
}

export async function addGeometryWith(
  database: Database,
  tenantSlug: string,
  propertyId: string,
  input: {
    vertices: Vertex[];
    source: string;
    sourceText: string;
    actId?: string | null;
    sigefCode?: string;
    notes?: string;
  },
  actor: Actor,
): Promise<string> {
  if (!UUID.test(propertyId)) throw new RiError("Matrícula não encontrada.");
  const [property] = await database
    .select({ id: riProperties.id, deletedAt: riProperties.deletedAt })
    .from(riProperties)
    .where(
      and(
        eq(riProperties.tenantSlug, tenantSlug),
        eq(riProperties.id, propertyId),
      ),
    )
    .limit(1);
  if (!property || property.deletedAt)
    throw new RiError("Matrícula não encontrada.");
  const shape = shapeOf(input.vertices);
  if (input.vertices.length < 3) {
    throw new RiError("Não achei pelo menos 3 vértices com coordenadas.");
  }
  if (shape.problems.length > 0) throw new RiError(shape.problems.join(" "));
  const [row] = await database
    .insert(riGeometries)
    .values({
      tenantSlug,
      propertyId,
      actId: input.actId && UUID.test(input.actId) ? input.actId : null,
      source: input.source,
      sourceText: input.sourceText.slice(0, 200_000),
      vertices: input.vertices,
      zone: shape.zone,
      areaM2: shape.areaM2,
      perimeterM: shape.perimeterM,
      sigefCode: (input.sigefCode ?? "").trim().slice(0, 80),
      notes: (input.notes ?? "").trim().slice(0, 2000),
      createdBy: actor.id,
    })
    .returning({ id: riGeometries.id });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.geometry-add",
    targetType: "ri-property",
    targetId: propertyId,
  });
  return row?.id as string;
}

export async function geometriesOfWith(
  database: Database,
  tenantSlug: string,
  propertyId: string,
): Promise<GeometryRow[]> {
  if (!UUID.test(propertyId)) return [];
  return database
    .select()
    .from(riGeometries)
    .where(
      and(
        eq(riGeometries.tenantSlug, tenantSlug),
        eq(riGeometries.propertyId, propertyId),
      ),
    )
    .orderBy(desc(riGeometries.createdAt));
}

/** The newest geometry in force of each matrícula. */
export async function currentGeometriesWith(
  database: Database,
  tenantSlug: string,
): Promise<GeometryRow[]> {
  const rows = await database
    .select()
    .from(riGeometries)
    .where(
      and(
        eq(riGeometries.tenantSlug, tenantSlug),
        isNull(riGeometries.deletedAt),
      ),
    )
    .orderBy(desc(riGeometries.createdAt));
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.propertyId)) return false;
    seen.add(r.propertyId);
    return true;
  });
}

export async function setGeometryDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  actor: Actor,
): Promise<string> {
  if (!UUID.test(id)) throw new RiError("Geometria não encontrada.");
  const [row] = await database
    .select()
    .from(riGeometries)
    .where(
      and(eq(riGeometries.tenantSlug, tenantSlug), eq(riGeometries.id, id)),
    )
    .limit(1);
  if (!row) throw new RiError("Geometria não encontrada.");
  if (Boolean(row.deletedAt) !== deleted) {
    await database
      .update(riGeometries)
      .set(
        deleted
          ? { deletedAt: new Date(), deletedBy: actor.id }
          : { deletedAt: null, deletedBy: null },
      )
      .where(eq(riGeometries.id, id));
    await recordAuditWith(database, {
      tenantSlug,
      actorId: actor.id,
      action: deleted ? "ri.geometry-delete" : "ri.geometry-restore",
      targetType: "ri-property",
      targetId: row.propertyId,
    });
  }
  return row.propertyId;
}

export const verticesOf = (row: Pick<GeometryRow, "vertices">): Vertex[] =>
  Array.isArray(row.vertices) ? (row.vertices as Vertex[]) : [];

export interface Overlap {
  a: string;
  b: string;
  areaM2: number;
}

/**
 * Where two perímetros overlap (the Incra certifies that a parcela does
 * not, Lei nº 6.015/1973, art. 176, § 5º; the office sees it here first).
 * Shared borders are not overlaps: below 1 m² is noise of the coordinates.
 */
export function overlapsOf(
  rows: readonly Pick<GeometryRow, "propertyId" | "vertices" | "zone">[],
): Overlap[] {
  if (rows.length < 2) return [];
  const zones = new Map<number, number>();
  for (const r of rows) zones.set(r.zone, (zones.get(r.zone) ?? 0) + 1);
  const zone = [...zones].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 24;
  const polys = rows.map((r) => ({
    id: r.propertyId,
    ring: verticesOf(r).map((v) => {
      const p = toUtm(v.lat, v.lon, zone);
      return [p.e, p.n] as [number, number];
    }),
  }));
  const box = (ring: [number, number][]) => ({
    minE: Math.min(...ring.map((p) => p[0])),
    maxE: Math.max(...ring.map((p) => p[0])),
    minN: Math.min(...ring.map((p) => p[1])),
    maxN: Math.max(...ring.map((p) => p[1])),
  });
  const boxes = polys.map((p) => box(p.ring));
  const out: Overlap[] = [];
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      if (
        a.maxE < b.minE ||
        b.maxE < a.minE ||
        a.maxN < b.minN ||
        b.maxN < a.minN
      ) {
        continue;
      }
      const pa = polys[i];
      const pb = polys[j];
      if (!pa || !pb || pa.ring.length < 3 || pb.ring.length < 3) continue;
      const inter = polygonClipping.intersection([pa.ring], [pb.ring]);
      let area = 0;
      for (const polygon of inter) {
        polygon.forEach((ring, k) => {
          let twice = 0;
          ring.forEach((p, n) => {
            const q = ring[(n + 1) % ring.length] as [number, number];
            twice += p[0] * q[1] - q[0] * p[1];
          });
          area += (k === 0 ? 1 : -1) * Math.abs(twice / 2);
        });
      }
      if (area > 1) out.push({ a: pa.id, b: pb.id, areaM2: area });
    }
  }
  return out;
}
