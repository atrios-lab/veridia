// The part of fontkit the TIFF of the Registro de Imóveis uses
// (src/lib/ri-tiff.ts): opening a font, laying out a line and reading each
// glyph's outline. fontkit ships no types of its own.
declare module "fontkit" {
  export interface Path {
    scale(x: number, y?: number): Path;
    translate(x: number, y: number): Path;
    toSVG(): string;
  }
  export interface Glyph {
    path: Path;
  }
  export interface GlyphPosition {
    xAdvance: number;
  }
  export interface GlyphRun {
    glyphs: Glyph[];
    positions: GlyphPosition[];
  }
  export interface Font {
    unitsPerEm: number;
    layout(text: string): GlyphRun;
  }
  export function create(buffer: Buffer | Uint8Array): Font;
}
