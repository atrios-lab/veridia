import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closedByForCitizen,
  closedByForStaff,
  emailHelpLine,
  GIVE_UP_REASONS,
  giveUpMessage,
  isGiveUpReason,
} from "./closing.ts";

test("the citizen is told who ended the conversation", () => {
  assert.equal(
    closedByForCitizen("citizen"),
    "Você encerrou este atendimento.",
  );
  assert.equal(
    closedByForCitizen("staff", "Maria"),
    "Maria encerrou este atendimento.",
  );
  assert.equal(
    closedByForCitizen("staff"),
    "O cartório encerrou este atendimento.",
  );
  assert.equal(
    closedByForCitizen("inactivity"),
    "O atendimento foi encerrado por falta de resposta.",
  );
});

test("the office is told who ended the conversation", () => {
  assert.equal(closedByForStaff("citizen"), "Conversa encerrada pelo cidadão.");
  assert.equal(
    closedByForStaff("inactivity"),
    "Conversa encerrada por inatividade do cidadão.",
  );
});

test("a give-up reason is one of the list, with the citizen's words", () => {
  assert.equal(isGiveUpReason(GIVE_UP_REASONS[0]), true);
  assert.equal(isGiveUpReason("qualquer coisa"), false);
  assert.equal(
    giveUpMessage("Entrei por engano"),
    "Motivo do encerramento pelo cidadão: Entrei por engano.",
  );
  assert.equal(
    giveUpMessage("Outro motivo", "  preciso   sair "),
    'Motivo do encerramento pelo cidadão: Outro motivo. "preciso sair"',
  );
});

test("the e-mail line names the office's address", () => {
  assert.equal(
    emailHelpLine("contato@cartorio.com.br"),
    "Em caso de dúvida, escreva para contato@cartorio.com.br.",
  );
});
