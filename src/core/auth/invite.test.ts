import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAccountEmailText } from "./invite.ts";

test("convite names the inviter, the role, and never a password", () => {
  const text = buildAccountEmailText({
    kind: "convite",
    recipientName: "Júlia Santos",
    inviterName: "Helena Duarte",
    roleLabel: "Operador",
  });

  assert.equal(text.subject, "Seu acesso ao painel administrativo");
  assert.match(text.paragraphs[0], /Olá, Júlia\./);
  assert.match(text.paragraphs[0], /Helena Duarte/);
  assert.match(text.paragraphs[0], /Operador/);
  assert.equal(text.buttonLabel, "Criar minha senha");
  assert.match(text.footnote, /48 horas/);
  assert.match(text.footnote, /só funciona uma vez/);
  for (const part of [...text.paragraphs, text.footnote]) {
    assert.doesNotMatch(part, /senha:|\bsenha=/i);
  }
});

test("nova senha warns the current password still works and to flag a request nobody made", () => {
  const text = buildAccountEmailText({
    kind: "nova-senha",
    recipientName: "Júlia Santos",
  });

  assert.equal(text.subject, "Crie uma nova senha para o painel");
  assert.match(text.paragraphs[0], /Olá, Júlia\./);
  assert.equal(text.buttonLabel, "Criar nova senha");
  assert.match(text.footnote, /48 horas/);
  assert.match(text.footnote, /continua valendo/);
  assert.match(text.footnote, /se não foi você quem pediu, avise a serventia/i);
});

test("uses only the first name to greet", () => {
  const text = buildAccountEmailText({
    kind: "nova-senha",
    recipientName: "Júlia Maria Santos",
  });
  assert.match(text.paragraphs[0], /Olá, Júlia\./);
});
