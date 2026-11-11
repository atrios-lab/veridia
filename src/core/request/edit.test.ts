import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import { MAX_MESSAGE_LENGTH } from "../chat/message.ts";
import {
  purposeFor,
  requestDataEditSchema,
  resolveIdentityEdit,
  resolveVariantEdit,
} from "./edit.ts";

const ZONE = "America/Sao_Paulo";
const NOW = new Date("2026-08-10T12:00:00Z");
const schema = requestDataEditSchema(NOW, ZONE);

const valid = {
  applicantName: "Maria José da Silva",
  contact: "maria@exemplo.com",
  phone: "(84) 99999-0000",
  cpf: "529.982.247-25",
  purpose: "",
  description: "  Queremos casar em outubro.  ",
  createdAt: "2026-08-09T14:30",
};

const DOCUMENT = { type: "rg", number: "123456" } as const;
const noInput = {
  cpf: null,
  noCpf: false,
  alternateDocumentType: undefined,
  alternateDocumentNumber: undefined,
};

test("a valid CPF replaces whatever was stored", () => {
  assert.deepEqual(
    resolveIdentityEdit(
      { alternateDocument: DOCUMENT },
      { ...noInput, cpf: "52998224725" },
    ),
    { ok: true, cpf: "52998224725", alternateDocument: null },
  );
});

test("the way out replaces a stored CPF", () => {
  assert.deepEqual(
    resolveIdentityEdit(
      { cpf: "52998224725" },
      {
        ...noInput,
        noCpf: true,
        alternateDocumentType: "rg",
        alternateDocumentNumber: "123456",
      },
    ),
    { ok: true, cpf: null, alternateDocument: DOCUMENT },
  );
});

test("the way out without a document, or next to a CPF, is refused", () => {
  assert.equal(resolveIdentityEdit({}, { ...noInput, noCpf: true }).ok, false);
  assert.equal(
    resolveIdentityEdit(
      {},
      {
        ...noInput,
        cpf: "52998224725",
        noCpf: true,
        alternateDocumentType: "rg",
        alternateDocumentNumber: "123456",
      },
    ).ok,
    false,
  );
});

test("what was stored cannot be erased without a replacement", () => {
  assert.equal(resolveIdentityEdit({ cpf: "52998224725" }, noInput).ok, false);
  assert.equal(
    resolveIdentityEdit({ alternateDocument: DOCUMENT }, noInput).ok,
    false,
  );
});

test("an old request with neither stays correctable with neither", () => {
  assert.deepEqual(resolveIdentityEdit({ cpf: null }, noInput), {
    ok: true,
    cpf: null,
    alternateDocument: null,
  });
});

test("a blank kind changes nothing, so an old request stays correctable", () => {
  assert.deepEqual(resolveVariantEdit(getAct("rcpn-certidao"), undefined, ""), {
    ok: true,
  });
  assert.deepEqual(
    resolveVariantEdit(getAct("rcpn-certidao"), undefined, " "),
    {
      ok: true,
    },
  );
});

test("the operator may store a kind of the request's own act", () => {
  assert.deepEqual(
    resolveVariantEdit(getAct("rcpn-certidao"), undefined, "casamento"),
    { ok: true, actVariant: "casamento" },
  );
});

test("a kind of another act, or of an act without kinds, is refused", () => {
  for (const [actId, value] of [
    ["rcpn-certidao", "procuracao"],
    ["rcpn-habilitacao-casamento", "casamento"],
  ] as const) {
    assert.equal(resolveVariantEdit(getAct(actId), undefined, value).ok, false);
  }
  assert.equal(resolveVariantEdit(undefined, undefined, "casamento").ok, false);
});

test("on a gratuidade the kinds are the requested act's", () => {
  const gratuidade = getAct("gratuidade-rcpn");
  assert.deepEqual(resolveVariantEdit(gratuidade, "rcpn-certidao", "obito"), {
    ok: true,
    actVariant: "obito",
  });
  assert.equal(
    resolveVariantEdit(gratuidade, "rcpn-habilitacao-casamento", "obito").ok,
    false,
  );
  // Filed before the gratuidade named its act: nothing to check against.
  assert.equal(resolveVariantEdit(gratuidade, undefined, "obito").ok, false);
});

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

test("the telephone may be corrected, and may be cleared", () => {
  // Empty is a real answer here, unlike on the contact: it is how a number
  // typed by mistake gets taken back off the request.
  assert.equal(schema.parse({ ...valid, phone: "" }).phone, "");
  assert.equal(
    schema.safeParse({ ...valid, phone: "9999-0000" }).success,
    false,
  );
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
    assert.match(parsed.error.issues[0].message, /5\.000/, field);
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

test("no inteiro teor do RCPN a finalidade depende da opção", () => {
  const act = getAct("rcpn-certidao-inteiro-teor");
  assert.equal(
    purposeFor(act, "aposentadoria", { variantId: "nascimento" }),
    "aposentadoria",
  );
  assert.equal(purposeFor(act, "aposentadoria", { variantId: "obito" }), null);
  assert.equal(purposeFor(act, "aposentadoria"), null);
});

test("nas demais certidões, só a opção de inteiro teor guarda o motivo", () => {
  const matricula = getAct("ri-certidao-matricula");
  assert.equal(
    purposeFor(matricula, "inventário", { variantId: "inteiro-teor" }),
    "inventário",
  );
  assert.equal(
    purposeFor(matricula, "inventário", { variantId: "onus" }),
    null,
  );
  const notas = getAct("notas-certidao");
  assert.equal(
    purposeFor(notas, "inventário", { variantId: "testamento" }),
    "inventário",
  );
  assert.equal(
    purposeFor(notas, "inventário", { variantId: "ato-notarial" }),
    null,
  );
});

test("na gratuidade, o motivo vale só com inteiro teor e fora do óbito", () => {
  const gratuidade = getAct("gratuidade-rcpn");
  const inteiroTeor = {
    exemptionActId: "rcpn-certidao",
    certificateType: "inteiro-teor",
  };
  assert.equal(
    purposeFor(gratuidade, "pensão", {
      ...inteiroTeor,
      variantId: "nascimento",
    }),
    "pensão",
  );
  assert.equal(
    purposeFor(gratuidade, "pensão", { ...inteiroTeor, variantId: "obito" }),
    null,
  );
  assert.equal(
    purposeFor(gratuidade, "pensão", {
      ...inteiroTeor,
      certificateType: "sem-busca",
      variantId: "nascimento",
    }),
    null,
  );
});
