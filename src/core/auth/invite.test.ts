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

test("troca de e-mail names the address still in use and says nothing changes without confirming", () => {
  const text = buildAccountEmailText({
    kind: "troca-email",
    recipientName: "Júlia Santos",
    currentEmail: "julia.antiga@exemplo.com",
  });

  assert.equal(text.subject, "Confirme o novo e-mail do painel");
  assert.match(text.paragraphs[0], /Olá, Júlia\./);
  // The address in use has to be named: the whole promise of the two-step
  // change is that the account keeps working until this link is opened.
  assert.match(text.paragraphs[1], /julia\.antiga@exemplo\.com/);
  assert.equal(text.buttonLabel, "Confirmar novo e-mail");
  assert.match(text.footnote, /48 horas/);
  assert.match(text.footnote, /nada muda/);
});

test("o aviso ao endereço antigo nomeia o novo e-mail e diz o que fazer se não foi a pessoa", () => {
  const text = buildAccountEmailText({
    kind: "email-alterado",
    recipientName: "Júlia Santos",
    newEmail: "julia.nova@exemplo.com",
  });

  assert.equal(text.subject, "O e-mail da sua conta do painel mudou");
  assert.match(text.paragraphs[0], /julia\.nova@exemplo\.com/);
  assert.equal(text.buttonLabel, "Entrar no painel");
  assert.match(text.footnote, /avise a serventia/i);
});
