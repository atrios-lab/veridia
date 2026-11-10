import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCodeChallenge,
  createMarker,
  maskEmail,
  verifyCodeChallenge,
  verifyMarker,
} from "./email-code.ts";

process.env.BETTER_AUTH_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";

test("o código confere só para a mesma sessão, dentro de 10 minutos", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const binding = "acesso:sessao-1:usuario-1";
  const { code, token } = createCodeChallenge(binding, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyCodeChallenge(token, code, binding, now), "ok");
  assert.equal(
    verifyCodeChallenge(
      token,
      ` ${code.slice(0, 3)} ${code.slice(3)} `,
      binding,
      now,
    ),
    "ok",
  );
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal(verifyCodeChallenge(token, wrong, binding, now), "wrong");
  assert.equal(
    verifyCodeChallenge(token, code, "acesso:sessao-2:usuario-1", now),
    "missing",
  );
  const later = new Date(now.getTime() + 10 * 60_000 + 1);
  assert.equal(verifyCodeChallenge(token, code, binding, later), "expired");
  const [body, sig] = token.split(".");
  assert.equal(
    verifyCodeChallenge(`${body}x.${sig}`, code, binding, now),
    "missing",
  );
  assert.equal(verifyCodeChallenge(undefined, code, binding, now), "missing");
});

test("a marca de acesso confirmado vale só para a sessão dela, até vencer", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const until = new Date("2026-11-17T12:00:00Z");
  const marker = createMarker("acesso:sessao-1:usuario-1", until);
  assert.equal(verifyMarker(marker, "acesso:sessao-1:usuario-1", now), true);
  assert.equal(verifyMarker(marker, "acesso:sessao-2:usuario-1", now), false);
  assert.equal(verifyMarker(marker, "acesso:sessao-1:usuario-1", until), false);
  assert.equal(
    verifyMarker(`${marker}x`, "acesso:sessao-1:usuario-1", now),
    false,
  );
});

test("o e-mail aparece mascarado", () => {
  assert.equal(maskEmail("maria.exemplo@exemplo.com"), "m***o@exemplo.com");
  assert.equal(maskEmail("ab@exemplo.com"), "a***@exemplo.com");
});
