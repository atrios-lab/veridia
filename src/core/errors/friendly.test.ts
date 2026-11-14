import assert from "node:assert/strict";
import { test } from "node:test";
import { friendlyError } from "./friendly.ts";

test("limite de tamanho e de tempo dizem que ficou muito grande", () => {
  assert.equal(
    friendlyError({ message: "Body exceeded 4.5mb limit" }).kind,
    "tamanho",
  );
  assert.equal(
    friendlyError({
      message: "An unexpected response was received from the server.",
    }).kind,
    "tamanho",
  );
  assert.equal(
    friendlyError({ message: "FUNCTION_INVOCATION_TIMEOUT" }).kind,
    "tempo",
  );
  assert.match(friendlyError({ message: "413" }).title, /muito grande/);
});

test("sem internet, servidor fora e site inteiro caído", () => {
  assert.equal(
    friendlyError({ message: "Failed to fetch", online: false }).kind,
    "conexao",
  );
  assert.equal(
    friendlyError({ message: "Failed to fetch", online: true }).kind,
    "manutencao",
  );
  assert.equal(
    friendlyError({ message: "qualquer", whole: true }).title,
    "O site está em manutenção",
  );
});

test("o resto é um erro geral, em português", () => {
  const e = friendlyError({ message: "Cannot read properties of undefined" });
  assert.equal(e.kind, "geral");
  assert.equal(e.title, "Algo deu errado nesta tela");
});
