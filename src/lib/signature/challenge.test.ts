import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSigningChallenge,
  maskEmail,
  verifySigningChallenge,
} from "./challenge.ts";

process.env.BETTER_AUTH_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";

test("o código enviado confere só para a mesma pessoa, no mesmo cartório, dentro de 10 minutos", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const { code, token } = createSigningChallenge("u1", "cartorio-a", now);
  assert.match(code, /^\d{6}$/);
  assert.equal(
    verifySigningChallenge(token, code, "u1", "cartorio-a", now),
    "ok",
  );
  assert.equal(
    verifySigningChallenge(
      token,
      ` ${code.slice(0, 3)} ${code.slice(3)} `,
      "u1",
      "cartorio-a",
      now,
    ),
    "ok",
  );
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal(
    verifySigningChallenge(token, wrong, "u1", "cartorio-a", now),
    "wrong",
  );
  assert.equal(
    verifySigningChallenge(token, code, "u2", "cartorio-a", now),
    "missing",
  );
  assert.equal(
    verifySigningChallenge(token, code, "u1", "cartorio-b", now),
    "missing",
  );
  const later = new Date(now.getTime() + 10 * 60_000 + 1);
  assert.equal(
    verifySigningChallenge(token, code, "u1", "cartorio-a", later),
    "expired",
  );
  // A token altered by hand is refused.
  const [body, sig] = token.split(".");
  assert.equal(
    verifySigningChallenge(`${body}x.${sig}`, code, "u1", "cartorio-a", now),
    "missing",
  );
  assert.equal(
    verifySigningChallenge(undefined, code, "u1", "cartorio-a", now),
    "missing",
  );
});

test("o e-mail aparece mascarado", () => {
  assert.equal(maskEmail("maria.exemplo@exemplo.com"), "m***o@exemplo.com");
  assert.equal(maskEmail("ab@exemplo.com"), "a***@exemplo.com");
});
