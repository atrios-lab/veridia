import assert from "node:assert/strict";
import { test } from "node:test";
import { auditLevel, validJustification } from "./severity.ts";

test("faixas dos atos: exclusões, dinheiro e acesso são urgentes", () => {
  assert.equal(auditLevel("service-request.delete"), "urgente");
  assert.equal(auditLevel("office-pix.save"), "urgente");
  assert.equal(auditLevel("session.denied-tenant"), "urgente");
  // An act added later that removes something is urgent without a list.
  assert.equal(auditLevel("algo-novo.remove"), "urgente");
  assert.equal(auditLevel("service-request.amount"), "atencao");
  assert.equal(auditLevel("office-settings.role-permissions"), "atencao");
  assert.equal(auditLevel("publication.update"), "analise");
  assert.equal(auditLevel("session.sign-in"), "rotina");
  assert.equal(auditLevel("signed-document.file-purge"), "rotina");
});

test("só alerta o que pode esconder erro, fraude ou má intenção", () => {
  // Training material and taking access away: kept for searching.
  assert.equal(auditLevel("course.delete"), "analise");
  assert.equal(auditLevel("tutorial.delete"), "analise");
  assert.equal(auditLevel("user.deactivate"), "atencao");
  // Acts and money stay urgent.
  assert.equal(auditLevel("tax-guide.delete"), "urgente");
  assert.equal(auditLevel("office-pix.remove"), "urgente");
  assert.equal(auditLevel("user.email-changed"), "urgente");
});

test("justificativa curta demais não vale", () => {
  assert.equal(validJustification("ok"), false);
  assert.equal(validJustification("TESTEEEE"), true);
  assert.equal(validJustification("Pedido duplicado por engano."), true);
});
