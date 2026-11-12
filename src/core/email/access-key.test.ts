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

test("the key never goes in the link", () => {
  const link = consultLink("cartorio.exemplo.com.br", "REQ.2026.000148");
  assert.equal(link.includes("chave"), false);
  assert.equal(link.includes("accessKey"), false);
});

test("the step by step names the button and asks only for the key", () => {
  const steps = accessKeySteps();
  assert.ok(steps[0]?.includes("Acompanhar o pedido"));
  assert.ok(steps[0]?.includes("já preenchido"));
  assert.ok(steps[1]?.includes("chave de acesso"));
});
