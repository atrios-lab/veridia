import assert from "node:assert/strict";
import { test } from "node:test";
import { backgroundCss, parseBackground } from "./theme.ts";

test("o fundo guardado volta com a cor e a intensidade, e o padrão não muda nada", () => {
  assert.deepEqual(parseBackground("azul:20"), { tint: "azul", intensity: 20 });
  assert.deepEqual(parseBackground("xyz:20"), { tint: "padrao", intensity: 0 });
  assert.equal(parseBackground("verde:99").intensity, 40);
  assert.equal(backgroundCss("padrao", 0), "");
  const css = backgroundCss("sepia", 10);
  assert.match(
    css,
    /html\{--color-background: color-mix\(in oklab, rgb\(255 255 255\) 90%/,
  );
  assert.match(
    css,
    /html\.dark\{--color-background: color-mix\(in oklab, var\(--palette-dark-background\) 90%/,
  );
});
