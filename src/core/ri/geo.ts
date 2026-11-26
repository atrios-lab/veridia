/**
 * The geometry of an imóvel from its memorial descritivo or from the
 * planilha of the Sigef (change registro-de-imoveis-mapa): the vértices,
 * whether the perímetro closes, the área and the perímetro, the planta in
 * SVG and the sobreposições with the other imóveis of the office.
 *
 * Coordinates are in SIRGAS 2000 (the GRS80 ellipsoid): geographic
 * (latitude and longitude) or UTM (E, N, fuso). Áreas and distances are
 * computed in the UTM plane of the fuso, which is how a memorial writes
 * them; the área certified by the Incra (Sigef) prevails over this one.
 */

export interface Vertex {
  code: string;
  /** Decimal degrees, negative to the south and to the west. */
  lat: number;
  lon: number;
}

export interface UtmPoint {
  e: number;
  n: number;
}

export interface GeoReading {
  vertices: Vertex[];
  /** Where the coordinates came from: "geograficas" or "utm (fuso 24 S)". */
  system: string;
  notes: string[];
}

// GRS80 (SIRGAS 2000).
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const K0 = 0.9996;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The UTM fuso of a longitude (1 to 60). */
export function zoneOf(lon: number): number {
  return Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
}

/** Geographic → UTM in a given fuso (south hemisphere false northing). */
export function toUtm(lat: number, lon: number, zone: number): UtmPoint {
  const lon0 = rad((zone - 1) * 6 - 180 + 3);
  const phi = rad(lat);
  const lam = rad(lon);
  const ep2 = E2 / (1 - E2);
  const n = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = ep2 * Math.cos(phi) ** 2;
  const a = Math.cos(phi) * (lam - lon0);
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) *
        Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi));
  const e =
    K0 *
      n *
      (a +
        ((1 - t + c) * a ** 3) / 6 +
        ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * a ** 5) / 120) +
    500000;
  let north =
    K0 *
    (m +
      n *
        Math.tan(phi) *
        (a ** 2 / 2 +
          ((5 - t + 9 * c + 4 * c ** 2) * a ** 4) / 24 +
          ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * a ** 6) / 720));
  if (lat < 0) north += 10000000;
  return { e, n: north };
}

/** UTM (south hemisphere when `south`) → geographic. */
export function fromUtm(
  e: number,
  north: number,
  zone: number,
  south = true,
): { lat: number; lon: number } {
  const ep2 = E2 / (1 - E2);
  const x = e - 500000;
  const y = south ? north - 10000000 : north;
  const m = y / K0;
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const t1 = Math.tan(phi1) ** 2;
  const c1 = ep2 * Math.cos(phi1) ** 2;
  const r1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5;
  const d = x / (n1 * K0);
  const lat =
    phi1 -
    ((n1 * Math.tan(phi1)) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) *
          d ** 6) /
          720);
  const lon0 = rad((zone - 1) * 6 - 180 + 3);
  const lon =
    lon0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) /
        120) /
      Math.cos(phi1);
  return { lat: deg(lat), lon: deg(lon) };
}

const num = (text: string) => {
  const t = text.trim().replace(/\s/g, "");
  // 9.358.123,45 or 9358123.45 or 245678,90
  const normal = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t.split(".").length > 2
      ? t.replace(/\./g, "")
      : t;
  return Number(normal);
};

/**
 * "-36°12'34,567"", "36° 12' 34.567" W", "-5,7534" → decimal degrees.
 * NaN when it is not a coordinate.
 */
export function parseAngle(text: string): number {
  const t = text.trim().replace(/[″”]/g, '"').replace(/[′’]/g, "'");
  const negative = /^-|\b[SWO]\s*$/i.test(t);
  const dms = /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*'\s*([\d.,]+)\s*"?/.exec(t);
  let value: number;
  if (dms) {
    value = Number(dms[1]) + Number(dms[2]) / 60 + num(dms[3] ?? "0") / 3600;
  } else {
    const plain = /-?\d+(?:[.,]\d+)?/.exec(t)?.[0];
    if (!plain) return Number.NaN;
    value = Math.abs(num(plain));
  }
  return negative ? -value : value;
}

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The planilha of the Sigef (or any table with vértice, longitude, latitude). */
export function readVertexTable(rows: string[][]): GeoReading {
  const notes: string[] = [];
  const at = rows.findIndex((row) =>
    row.some((c) => /longitude|^e(ste)?$|coordenada e/.test(fold(c ?? ""))),
  );
  const header = (rows[at] ?? []).map((c) => fold(c ?? ""));
  const col = (rule: RegExp) => header.findIndex((h) => rule.test(h));
  const code = col(/codigo|vertice|ponto/);
  const lon = col(/^longitude/);
  const lat = col(/^latitude/);
  const east = col(/^e(ste)?$|coordenada e|^e \(m\)/);
  const north = col(/^n(orte)?$|coordenada n|^n \(m\)/);
  const zoneText = rows
    .flat()
    .join(" ")
    .match(/fuso\s*(\d{2})|mc\s*-?\s*(\d{2})/i);
  const zone = zoneText?.[1]
    ? Number(zoneText[1])
    : zoneText?.[2]
      ? (183 - Number(zoneText[2])) / 6
      : null;
  const vertices: Vertex[] = [];
  for (const row of rows.slice(at + 1)) {
    const name = String(row[code] ?? "").trim() || `P${vertices.length + 1}`;
    if (lon >= 0 && lat >= 0) {
      const lo = parseAngle(String(row[lon] ?? ""));
      const la = parseAngle(String(row[lat] ?? ""));
      if (Number.isFinite(lo) && Number.isFinite(la)) {
        vertices.push({ code: name, lat: la, lon: lo });
      }
    } else if (east >= 0 && north >= 0) {
      const e = num(String(row[east] ?? ""));
      const n = num(String(row[north] ?? ""));
      if (Number.isFinite(e) && Number.isFinite(n) && zone) {
        vertices.push({ code: name, ...fromUtm(e, n, zone) });
      }
    }
  }
  if (east >= 0 && !zone) {
    notes.push(
      "A tabela está em UTM sem o fuso: informe o fuso (ex.: Fuso 24).",
    );
  }
  return {
    vertices,
    system: lon >= 0 ? "geográficas (SIRGAS 2000)" : `UTM, fuso ${zone ?? "?"}`,
    notes,
  };
}

/** The vértices written in a memorial descritivo. */
export function readMemorial(text: string): GeoReading {
  const notes: string[] = [];
  const t = text.replace(/\s+/g, " ");
  const vertices: Vertex[] = [];
  // Geographic: "vértice ABCD-M-0001, de coordenadas Longitude: -36°12'34,567", Latitude: -5°45'12,345""
  const geo =
    /v[ée]rtice\s+([\w.-]+)[^;]{0,80}?longitude:?\s*(-?\d{1,3}\s*°\s*\d{1,2}\s*'\s*[\d.,]+\s*"?\s*[WO]?)[^;]{0,20}?latitude:?\s*(-?\d{1,2}\s*°\s*\d{1,2}\s*'\s*[\d.,]+\s*"?\s*S?)/gi;
  for (const m of t.matchAll(geo)) {
    vertices.push({
      code: m[1] ?? `P${vertices.length + 1}`,
      lon: parseAngle(m[2] ?? ""),
      lat: parseAngle(m[3] ?? ""),
    });
  }
  if (vertices.length >= 3) {
    return {
      vertices: dedupe(vertices),
      system: "geográficas (SIRGAS 2000)",
      notes,
    };
  }
  // UTM: "vértice P1, de coordenadas N 9.358.123,45m e E 245.678,90m"
  const zoneMatch =
    /fuso\s*(\d{2})/i.exec(t) ??
    /meridiano central[^\d-]{0,20}(-?\d{2})/i.exec(t);
  let zone: number | null = null;
  if (zoneMatch?.[0].toLowerCase().startsWith("fuso"))
    zone = Number(zoneMatch[1]);
  else if (zoneMatch?.[1]) zone = (183 - Math.abs(Number(zoneMatch[1]))) / 6;
  const utm =
    /v[ée]rtice\s+([\w.-]+)[^;]{0,60}?(?:N|Y)\s*[:=]?\s*([\d.,]{7,})\s*m?[^;]{0,10}?(?:E|X)\s*[:=]?\s*([\d.,]{6,})\s*m?/gi;
  const points: { code: string; e: number; n: number }[] = [];
  for (const m of t.matchAll(utm)) {
    points.push({ code: m[1] ?? "", n: num(m[2] ?? ""), e: num(m[3] ?? "") });
  }
  if (points.length >= 3) {
    if (!zone) {
      notes.push(
        "O memorial está em UTM sem o fuso ou o meridiano central: confira. Usei o fuso 24, o do Rio Grande do Norte.",
      );
      zone = 24;
    }
    for (const p of points) {
      vertices.push({ code: p.code, ...fromUtm(p.e, p.n, zone) });
    }
    return { vertices: dedupe(vertices), system: `UTM, fuso ${zone}`, notes };
  }
  notes.push(
    "Não achei os vértices com coordenadas no memorial. Anexe a planilha do Sigef (ODS ou CSV) ou digite os vértices.",
  );
  return { vertices: [], system: "", notes };
}

/** The memorial repeats the first vértice at the end: once is enough. */
function dedupe(list: Vertex[]): Vertex[] {
  const out: Vertex[] = [];
  for (const v of list) {
    const same = out.find((o) => o.code === v.code);
    if (!same) out.push(v);
  }
  return out;
}

export interface Shape {
  zone: number;
  points: (UtmPoint & { code: string })[];
  areaM2: number;
  perimeterM: number;
  /** Sides: from, to, distance in metres and azimuth in degrees. */
  sides: { from: string; to: string; distance: number; azimuth: number }[];
  problems: string[];
}

/** The polygon in the UTM plane: área, perímetro, lados and what is wrong. */
export function shapeOf(vertices: readonly Vertex[]): Shape {
  const problems: string[] = [];
  if (vertices.length < 3) {
    problems.push("Um perímetro precisa de pelo menos 3 vértices.");
  }
  const lonMean =
    vertices.reduce((s, v) => s + v.lon, 0) / Math.max(1, vertices.length);
  const zone = zoneOf(lonMean);
  const points = vertices.map((v) => ({
    code: v.code,
    ...toUtm(v.lat, v.lon, zone),
  }));
  let twice = 0;
  let perimeter = 0;
  const sides: Shape["sides"] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length] as UtmPoint & { code: string };
    twice += p.e * q.n - q.e * p.n;
    const de = q.e - p.e;
    const dn = q.n - p.n;
    const d = Math.hypot(de, dn);
    perimeter += d;
    sides.push({
      from: p.code,
      to: q.code,
      distance: d,
      azimuth: (deg(Math.atan2(de, dn)) + 360) % 360,
    });
  });
  if (points.length >= 4 && selfIntersects(points)) {
    problems.push(
      "Os lados do perímetro se cruzam: a ordem dos vértices está errada ou falta um vértice.",
    );
  }
  return {
    zone,
    points,
    areaM2: Math.abs(twice) / 2,
    perimeterM: perimeter,
    sides,
    problems,
  };
}

function cross(a: UtmPoint, b: UtmPoint, c: UtmPoint) {
  return (b.e - a.e) * (c.n - a.n) - (b.n - a.n) * (c.e - a.e);
}

function selfIntersects(points: UtmPoint[]): boolean {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i] as UtmPoint;
    const b = points[(i + 1) % n] as UtmPoint;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = points[j] as UtmPoint;
      const d = points[(j + 1) % n] as UtmPoint;
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      ) {
        return true;
      }
    }
  }
  return false;
}

/** "12,3456 ha" and "123.456,78 m²". */
export function areaText(m2: number): string {
  const ha = m2 / 10000;
  return `${ha.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha (${m2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²)`;
}

/** "12,5000 ha", "360,00 m²", "3 hectares" → m²; null when not an área. */
export function areaOfText(text: string): number | null {
  const m = /([\d.,]+)\s*(ha\b|hectares?|m²|m2|metros quadrados)/i.exec(text);
  if (!m?.[1]) return null;
  const value = num(m[1]);
  if (!Number.isFinite(value)) return null;
  return /^h/i.test(m[2] ?? "") ? value * 10000 : value;
}

/**
 * The área of the matrícula against the área of the memorial. The 5% is
 * only where the system starts to warn; whether it is a retificação
 * (Lei nº 6.015/1973, art. 213) the office decides.
 */
export function areaCheck(
  written: string,
  computedM2: number,
): { ok: boolean; text: string } | null {
  const declared = areaOfText(written);
  if (!declared || computedM2 <= 0) return null;
  const diff = (computedM2 - declared) / declared;
  const pct = Math.abs(diff * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
  return Math.abs(diff) <= 0.05
    ? {
        ok: true,
        text: `A área calculada difere ${pct}% da área da matrícula.`,
      }
    : {
        ok: false,
        text: `A área calculada difere ${pct}% da área da matrícula (o sistema avisa acima de 5%): confira o memorial e, se a descrição mudar, a retificação (Lei nº 6.015/1973, art. 213).`,
      };
}

// ------------------------------------------------------------------ SVG

const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The planta of the imóvel: the perímetro to scale, each vértice with its
 * code, the north and a scale bar. Black on white, to print and to go in
 * the ficha.
 */
export function plantaSvg(
  shape: Shape,
  options: { title?: string; size?: number } = {},
): string {
  const size = options.size ?? 600;
  const margin = 60;
  const es = shape.points.map((p) => p.e);
  const ns = shape.points.map((p) => p.n);
  const minE = Math.min(...es);
  const maxE = Math.max(...es);
  const minN = Math.min(...ns);
  const maxN = Math.max(...ns);
  const span = Math.max(maxE - minE, maxN - minN, 1);
  const scale = (size - 2 * margin) / span;
  const x = (e: number) => margin + (e - minE) * scale;
  const y = (n: number) => size - margin - (n - minN) * scale;
  const poly = shape.points
    .map((p) => `${x(p.e).toFixed(1)},${y(p.n).toFixed(1)}`)
    .join(" ");
  const labels = shape.points
    .map((p) => {
      const px = x(p.e);
      const right = px > size * 0.65;
      return `<circle cx="${px.toFixed(1)}" cy="${y(p.n).toFixed(1)}" r="3" fill="black"/><text x="${(right ? px - 5 : px + 5).toFixed(1)}" y="${(y(p.n) - 6).toFixed(1)}" text-anchor="${right ? "end" : "start"}" font-size="10" font-family="sans-serif" fill="black">${esc(p.code)}</text>`;
    })
    .join("");
  // A scale bar with a round length near a quarter of the drawing.
  const target = span / 4;
  const pow = 10 ** Math.floor(Math.log10(target));
  const bar =
    [1, 2, 5, 10].map((k) => k * pow).find((v) => v >= target) ?? target;
  const barPx = bar * scale;
  const barLabel =
    bar >= 1000
      ? `${(bar / 1000).toLocaleString("pt-BR")} km`
      : `${bar.toLocaleString("pt-BR")} m`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 60}" width="${size}" height="${size + 60}" font-family="sans-serif">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    options.title
      ? `<text x="${size / 2}" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="black">${esc(options.title)}</text>`
      : "",
    `<polygon points="${poly}" fill="none" stroke="black" stroke-width="2"/>`,
    labels,
    `<g transform="translate(${size - 40},70)"><path d="M0,-30 L8,0 L0,-6 L-8,0 Z" fill="black"/><text y="14" text-anchor="middle" font-size="12" fill="black">N</text></g>`,
    `<g transform="translate(${margin},${size - 20})"><rect width="${barPx.toFixed(1)}" height="6" fill="black"/><text y="20" font-size="11" fill="black">0</text><text x="${barPx.toFixed(1)}" y="20" text-anchor="end" font-size="11" fill="black">${barLabel}</text></g>`,
    `<text x="${size / 2}" y="${size + 40}" text-anchor="middle" font-size="11" fill="black">Área ${esc(areaText(shape.areaM2))} · Perímetro ${shape.perimeterM.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m · SIRGAS 2000, UTM fuso ${shape.zone}</text>`,
    "</svg>",
  ].join("");
}

/** The vértices as GeoJSON (lon, lat), closed, for any SIG. */
export function geoJsonOf(
  items: readonly { id: string; label: string; vertices: readonly Vertex[] }[],
): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: items
      .filter((i) => i.vertices.length >= 3)
      .map((i) => ({
        type: "Feature",
        properties: { id: i.id, matricula: i.label },
        geometry: {
          type: "Polygon",
          coordinates: [
            [...i.vertices, i.vertices[0] as Vertex].map((v) => [v.lon, v.lat]),
          ],
        },
      })),
  });
}

/**
 * The mosaico: every perímetro of the office on one drawing, in one fuso,
 * each with its matrícula number; the ones that overlap another are
 * marked (the office checks them before the next registro).
 */
export function mosaicSvg(
  items: readonly { id: string; label: string; vertices: readonly Vertex[] }[],
  overlapping: ReadonlySet<string>,
  size = 900,
): string {
  const usable = items.filter((i) => i.vertices.length >= 3);
  if (usable.length === 0) return "";
  const zones = new Map<number, number>();
  for (const i of usable) {
    const z = zoneOf(
      i.vertices.reduce((s, v) => s + v.lon, 0) / i.vertices.length,
    );
    zones.set(z, (zones.get(z) ?? 0) + 1);
  }
  const zone = [...zones].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 24;
  const shapes = usable.map((i) => ({
    ...i,
    points: i.vertices.map((v) => toUtm(v.lat, v.lon, zone)),
  }));
  const all = shapes.flatMap((s) => s.points);
  const minE = Math.min(...all.map((p) => p.e));
  const maxE = Math.max(...all.map((p) => p.e));
  const minN = Math.min(...all.map((p) => p.n));
  const maxN = Math.max(...all.map((p) => p.n));
  const span = Math.max(maxE - minE, maxN - minN, 1);
  const margin = 30;
  const scale = (size - 2 * margin) / span;
  const x = (e: number) => margin + (e - minE) * scale;
  const y = (n: number) => size - margin - (n - minN) * scale;
  const body = shapes
    .map((s) => {
      const pts = s.points
        .map((p) => `${x(p.e).toFixed(1)},${y(p.n).toFixed(1)}`)
        .join(" ");
      const cx = s.points.reduce((t, p) => t + x(p.e), 0) / s.points.length;
      const cy = s.points.reduce((t, p) => t + y(p.n), 0) / s.points.length;
      const hit = overlapping.has(s.id);
      return `<a href="/admin/ri/matriculas/${esc(s.id)}"><polygon points="${pts}" fill="${hit ? "red" : "gray"}" fill-opacity="${hit ? 0.35 : 0.12}" stroke="${hit ? "red" : "black"}" stroke-width="${hit ? 2 : 1}"><title>${esc(s.label)}</title></polygon><text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" font-size="11" fill="black">${esc(s.label)}</text></a>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" font-family="sans-serif"><rect width="100%" height="100%" fill="white"/>${body}<g transform="translate(${size - 30},40)"><path d="M0,-24 L7,0 L0,-5 L-7,0 Z" fill="black"/><text y="13" text-anchor="middle" font-size="11" fill="black">N</text></g><text x="${margin}" y="${size - 8}" font-size="11" fill="black">SIRGAS 2000, UTM fuso ${zone}</text></svg>`;
}
