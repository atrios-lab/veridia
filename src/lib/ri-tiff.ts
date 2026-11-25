import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as fontkit from "fontkit";
import sharp from "sharp";
import type { FichaContent } from "@/core/ri/ficha.ts";

/**
 * The image of a matrícula for the ONR (the CSL2 sends the images of the
 * Livro 2 to the SAEC): black and white, 1 bit, CCITT Group 4, 300 dpi,
 * A4, one page per folha, in a multipage TIFF. The text is drawn from the
 * outlines of the Tinos font (metrics of Times New Roman), so the image
 * never depends on fonts installed on the server.
 *
 * The ONR names "18 padrões de imagem" in the CSL2 manual; the list was not
 * in the manuals the office sent. This is the usual archival choice (TIFF
 * G4 bilevel); confirm with the ONR before the first carga.
 */

const DPI = 300;
const MM = DPI / 25.4;
const PAGE_W = Math.round(210 * MM);
const PAGE_H = Math.round(297 * MM);
const MARGIN = Math.round(20 * MM);
const pt = (n: number) => (n * DPI) / 72;

let fonts: { regular: fontkit.Font; bold: fontkit.Font } | null = null;
function loadFonts() {
  if (!fonts) {
    const dir = join(process.cwd(), "node_modules/@fontsource/tinos/files");
    fonts = {
      regular: fontkit.create(
        readFileSync(join(dir, "tinos-latin-400-normal.woff")),
      ),
      bold: fontkit.create(
        readFileSync(join(dir, "tinos-latin-700-normal.woff")),
      ),
    };
  }
  return fonts;
}

/** Characters the latin subset lacks become their closest plain form. */
const plain = (text: string) =>
  text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\n\x20-\xFF·•ºª°§]/g, "");

function width(font: fontkit.Font, text: string, size: number): number {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  return run.positions.reduce((sum, p) => sum + p.xAdvance * scale, 0);
}

function pathOf(
  font: fontkit.Font,
  text: string,
  size: number,
  x: number,
  baseline: number,
): string {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let at = x;
  let d = "";
  run.glyphs.forEach((glyph, i) => {
    d += glyph.path.scale(scale, -scale).translate(at, baseline).toSVG();
    at += (run.positions[i]?.xAdvance ?? 0) * scale;
  });
  return d;
}

/** Breaks a paragraph into lines that fit the width. */
function wrap(
  font: fontkit.Font,
  text: string,
  size: number,
  max: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of plain(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && width(font, next, size) > max) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

interface Item {
  bold?: boolean;
  size: number;
  text: string;
  gapBefore?: number;
}

/** The ficha as a multipage black-and-white TIFF (G4, 300 dpi). */
export async function fichaTiff(
  content: FichaContent,
  signatureImage?: Uint8Array | null,
): Promise<Buffer> {
  const { regular, bold } = loadFonts();
  const body = pt(11);
  const usable = PAGE_W - 2 * MARGIN;
  const items: Item[] = [];
  for (const block of content.blocks) {
    items.push({
      bold: true,
      size: body,
      text: block.label,
      gapBefore: pt(10),
    });
    if (block.meta) items.push({ size: pt(9), text: block.meta });
    for (const line of wrap(regular, block.text, body, usable)) {
      items.push({ size: body, text: line });
    }
  }
  const signerRoom = pt(120);
  const pages: string[][] = [];
  let current: string[] = [];
  let y = 0;
  const top = MARGIN + pt(56);
  const bottom = PAGE_H - MARGIN;
  const header = (page: number) => {
    const out: string[] = [];
    // CNN, art. 331: the CNM at the top right of every page.
    if (content.cnm) {
      const w = width(bold, `CNM ${content.cnm}`, pt(10));
      out.push(
        pathOf(bold, `CNM ${content.cnm}`, pt(10), PAGE_W - MARGIN - w, MARGIN),
      );
    }
    out.push(pathOf(regular, plain(content.office), pt(10), MARGIN, MARGIN));
    out.push(
      pathOf(regular, plain(content.book), pt(9), MARGIN, MARGIN + pt(14)),
    );
    const title = plain(`${content.title} · folha ${page}`);
    out.push(pathOf(bold, title, pt(14), MARGIN, MARGIN + pt(36)));
    return out;
  };
  const newPage = () => {
    if (current.length) pages.push(current);
    current = header(pages.length + 1);
    y = top;
  };
  newPage();
  for (const item of items) {
    const lineHeight = item.size * 1.35;
    y += item.gapBefore ?? 0;
    if (y + lineHeight > bottom) newPage();
    y += lineHeight;
    current.push(
      pathOf(
        item.bold ? bold : regular,
        plain(item.text),
        item.size,
        MARGIN,
        y,
      ),
    );
  }
  // The signature block: the image over the rule, the name and the title.
  let signatureAt: { left: number; top: number } | null = null;
  if (content.signer) {
    if (y + signerRoom > bottom) newPage();
    const ruleY = Math.min(bottom - pt(30), y + signerRoom - pt(25));
    const ruleW = pt(240);
    const ruleX = (PAGE_W - ruleW) / 2;
    current.push(`M${ruleX} ${ruleY}h${ruleW}v2h-${ruleW}z`);
    const name = plain(content.signer.name);
    const title = plain(content.signer.title);
    current.push(
      pathOf(
        regular,
        name,
        pt(10),
        (PAGE_W - width(regular, name, pt(10))) / 2,
        ruleY + pt(14),
      ),
    );
    current.push(
      pathOf(
        regular,
        title,
        pt(9),
        (PAGE_W - width(regular, title, pt(9))) / 2,
        ruleY + pt(26),
      ),
    );
    if (signatureImage)
      signatureAt = {
        left: Math.round(ruleX),
        top: Math.round(ruleY - pt(60)),
      };
  }
  pages.push(current);

  const rasters: Buffer[] = [];
  for (const [index, paths] of pages.entries()) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}"><rect width="100%" height="100%" fill="white"/><path fill="black" d="${paths.join("")}"/></svg>`;
    let page = sharp(Buffer.from(svg), { density: 72 }).flatten({
      background: { r: 255, g: 255, b: 255 },
    });
    if (signatureAt && signatureImage && index === pages.length - 1) {
      const sig = await sharp(signatureImage)
        .resize({
          width: Math.round(pt(240)),
          height: Math.round(pt(56)),
          fit: "inside",
        })
        .png()
        .toBuffer();
      page = sharp(await page.png().toBuffer()).composite([
        {
          input: sig,
          left: signatureAt.left,
          top: Math.max(0, signatureAt.top),
        },
      ]);
    }
    rasters.push(
      await page
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .greyscale()
        .raw()
        .toBuffer(),
    );
  }
  return sharp(Buffer.concat(rasters), {
    raw: {
      width: PAGE_W,
      height: PAGE_H * rasters.length,
      channels: 1,
      pageHeight: PAGE_H,
    },
  })
    .threshold(160)
    .toColourspace("b-w")
    .tiff({
      compression: "ccittfax4",
      bitdepth: 1,
      xres: DPI / 25.4,
      yres: DPI / 25.4,
    })
    .toBuffer();
}

/**
 * A scanned page (JPG, PNG, TIFF in colour or grey) as the ONR's black and
 * white image: 1 bit, G4, keeping its resolution.
 */
export async function imageToBwTiff(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes, { pages: -1 })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .greyscale()
    .normalise()
    .threshold(150)
    .toColourspace("b-w")
    .tiff({ compression: "ccittfax4", bitdepth: 1 })
    .toBuffer();
}

/**
 * The handwritten signature photographed on paper, made ready to sit on a
 * document: grey paper and shadows become transparent, the ink black.
 */
export async function cleanSignature(bytes: Uint8Array): Promise<Buffer> {
  const image = sharp(bytes)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true });
  const { data, info } = await image
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const v = data[i] ?? 255;
    const ink = v < 110;
    rgba[i * 4] = 0;
    rgba[i * 4 + 1] = 0;
    rgba[i * 4 + 2] = 0;
    rgba[i * 4 + 3] = ink ? 255 : 0;
  }
  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .png()
    .toBuffer();
}
