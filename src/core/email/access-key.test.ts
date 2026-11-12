import assert from "node:assert/strict";
import { test } from "node:test";
import { accessKeySteps, consultLink } from "./access-key.ts";

test("the link opens the consult with the protocol filled in", () => {
  assert.equal(
    consultLink("cartorio.exemplo.com.br", "REQ.2026.000148"),
    "https://cartorio.exemplo.com.br/acompanhar?numero=REQ.2026.000148",
  );
  assert.equal(consultLink(undefined, "REQ.2026.000148"), "");
});

test("with the key, the link opens the request: key after the #, never in the query", () => {
  const link = consultLink(
    "cartorio.exemplo.com.br",
    "REQ.2026.000148",
    "BBM8-6XVB-8PUK",
  );
  assert.equal(
    link,
    "https://cartorio.exemplo.com.br/acompanhar?numero=REQ.2026.000148#chave=BBM8-6XVB-8PUK",
  );
  const [beforeHash] = link.split("#");
  assert.equal(beforeHash?.includes("BBM8"), false);
});

test("the step by step names the button and asks only for the key", () => {
  const steps = accessKeySteps();
  assert.ok(steps[0]?.includes("Acompanhar o pedido"));
  assert.ok(steps[0]?.includes("já preenchidos"));
  assert.ok(steps[1]?.includes("chave de acesso"));
});
