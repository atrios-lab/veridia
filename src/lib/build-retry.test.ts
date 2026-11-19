import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isFontDownloadFailure,
  MAX_BUILD_ATTEMPTS,
  shouldRetryBuild,
} from "../../scripts/build-retry.ts";

// The lines the Vercel build printed on 19/11/2026, when Google Fonts did
// not answer.
const FONT_FAILURE = `
> Build error occurred
Error: Turbopack build failed with 15 errors:
[next]/internal/font/google/cormorant_garamond_7c5e4669.module.css:7:8
Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
next/font/google queries have exactly one entry
`;

const CODE_FAILURE = `
> Build error occurred
Error: Turbopack build failed with 1 errors:
./src/app/page.tsx:3:1
Module not found: Can't resolve './nao-existe'
`;

test("a falha ao baixar as fontes do Google é reconhecida, e erro de código não", () => {
  assert.equal(isFontDownloadFailure(FONT_FAILURE), true);
  assert.equal(
    isFontDownloadFailure(
      "Failed to fetch `Cormorant Garamond` from Google Fonts.",
    ),
    true,
  );
  assert.equal(isFontDownloadFailure(CODE_FAILURE), false);
  assert.equal(isFontDownloadFailure(""), false);
});

test("o build tenta de novo só na falha das fontes, e no máximo três vezes", () => {
  assert.equal(MAX_BUILD_ATTEMPTS, 3);
  assert.equal(shouldRetryBuild(1, FONT_FAILURE), true);
  assert.equal(shouldRetryBuild(2, FONT_FAILURE), true);
  assert.equal(shouldRetryBuild(3, FONT_FAILURE), false);
  assert.equal(shouldRetryBuild(1, CODE_FAILURE), false);
});
