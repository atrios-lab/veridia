import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_MESSAGE_LENGTH } from "../chat/message.ts";
import { purposeFor, requestDataEditSchema } from "./edit.ts";

const ZONE = "America/Sao_Paulo";
const NOW = new Date("2026-08-10T12:00:00Z");
const schema = requestDataEditSchema(NOW, ZONE);

const valid = {
  applicantName: "Maria José da Silva",
  contact: "(84) 99999-0000",
  cpf: "529.982.247-25",
  purpose: "",
  description: "  Queremos casar em outubro.  ",
  createdAt: "2026-08-09T14:30",
};

test("the counter's correction is read on the office's wall clock", () => {
  const parsed = schema.parse(valid);
  // 14:30 in Ielmo Marinho, not 14:30 wherever the server happens to run.
  assert.equal(parsed.createdAt.toISOString(), "2026-08-09T17:30:00.000Z");
});

test("what the operator left blank becomes null, not an empty string", () => {
  const parsed = schema.parse({ ...valid, purpose: "", cpf: "  " });
  assert.equal(parsed.purpose, null);
  assert.equal(parsed.cpf, null);
  assert.equal(parsed.description, "Queremos casar em outubro.");
});

test("the CPF is checked, not just shaped", () => {
  const bad = schema.safeParse({ ...valid, cpf: "111.111.111-11" });
  assert.equal(bad.success, false);
  assert.match(bad.error?.issues[0]?.message ?? "", /CPF inválido/);
  // Digits only, so the mask the operator typed does not reach the database.
  assert.equal(schema.parse(valid).cpf, "52998224725");
});

test("a request cannot have been filed in the future", () => {
  // The counter files late, never early.
  const ahead = schema.safeParse({ ...valid, createdAt: "2026-08-11T09:00" });
  assert.equal(ahead.success, false);
  assert.match(ahead.error?.issues[0]?.message ?? "", /futuro/);
});

test("name and contact are required, because the office calls these people", () => {
  assert.equal(
    schema.safeParse({ ...valid, applicantName: "M" }).success,
    false,
  );
  assert.equal(schema.safeParse({ ...valid, contact: "" }).success, false);
});

test("neither the act nor the protocol can be corrected here", () => {
  // Passing them changes nothing: they are not part of what this schema takes.
  const parsed = schema.parse({
    ...valid,
    actId: "rcpn-certidao",
    protocolNumber: "REQ.2026.999999",
  } as never);
  assert.equal("actId" in parsed, false);
  assert.equal("protocolNumber" in parsed, false);
});

test("the operator may write long on purpose and description", () => {
  const long = "a".repeat(MAX_MESSAGE_LENGTH);
  const parsed = schema.parse({ ...valid, purpose: long, description: long });
  assert.equal(parsed.purpose, long);
  assert.equal(parsed.description, long);
});

test("past the ceiling, the error says how long is too long", () => {
  for (const field of ["purpose", "description"]) {
    const parsed = schema.safeParse({
      ...valid,
      [field]: "a".repeat(MAX_MESSAGE_LENGTH + 1),
    });
    assert.ok(!parsed.success, field);
    assert.match(parsed.error.issues[0].message, /4\.000/, field);
  }
});

test("only the acts the law allows may carry a purpose", () => {
  // Lei 6.015 art. 17: a certificate may not be asked what it is for, and the
  // counter is the same office asking as the public form.
  assert.equal(purposeFor({ requiresPurpose: false }, "para inventário"), null);
  assert.equal(
    purposeFor({ requiresPurpose: true }, "para inventário"),
    "para inventário",
  );
  // An act that could not be resolved is not a licence to ask.
  assert.equal(purposeFor(undefined, "para inventário"), null);
});
