import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAppointmentBookedEmail } from "./emails.ts";

const facts = {
  officeName: "Cartório de Tibau do Sul",
  citizenName: "Maria José",
  date: "2098-05-04",
  slotTime: "08:00",
  serviceLabel: "Reconhecimento de firma",
  mode: "Presencial",
  address: "Rua da Praia, 1",
};

test("a confirmação traz o protocolo e a chave para consultar e enviar documentos", () => {
  const text = buildAppointmentBookedEmail({
    ...facts,
    access: {
      protocolNumber: "AGD.2098.000001",
      accessKey: "BBM8-6XVB-8PUK",
      consultUrl: "https://exemplo.com.br/protocolo",
    },
  }).paragraphs.join("\n");
  assert.match(
    text,
    /Protocolo: AGD\.2098\.000001\. Chave de acesso: BBM8-6XVB-8PUK\./,
  );
  assert.match(
    text,
    /envia documentos antes de vir, em https:\/\/exemplo\.com\.br\/protocolo/,
  );
});

test("sem chave, a confirmação não fala em chave", () => {
  const text = buildAppointmentBookedEmail(facts).paragraphs.join("\n");
  assert.doesNotMatch(text, /Chave de acesso/);
});
