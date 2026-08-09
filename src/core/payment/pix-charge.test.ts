import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPixCharge,
  canBuildPixCharge,
  crc16Ccitt,
  deriveTxId,
} from "./pix-charge.ts";

// An independent second implementation of the same CRC16-CCITT-FALSE
// algorithm (table-driven instead of bit-by-bit), so the payload test below
// checks pix-charge.ts's arithmetic against a different code path, not
// against itself.
function crc16CcittTableDriven(payload: string): string {
  const table: number[] = [];
  for (let byte = 0; byte < 256; byte++) {
    let crc = byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
    table[byte] = crc;
  }
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    const top = (crc >> 8) ^ payload.charCodeAt(i);
    crc = ((crc << 8) ^ table[top & 0xff]) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

test("crc16: matches the standard CRC-16/CCITT-FALSE check value for '123456789'", () => {
  // The catalogued check value for this exact variant (poly 0x1021, init
  // 0xFFFF, no reflection, no xor-out) — the one Pix specifies.
  assert.equal(crc16Ccitt("123456789"), "29B1");
});

test("crc16: agrees with an independently written table-driven implementation", () => {
  const samples = [
    "",
    "A",
    "00020101021226580014br.gov.bcb.pix",
    "REQ.2026.000148",
    "the quick brown fox jumps over the lazy dog",
  ];
  for (const sample of samples) {
    assert.equal(crc16Ccitt(sample), crc16CcittTableDriven(sample));
  }
});

test("txid: protocol number loses its punctuation", () => {
  assert.equal(deriveTxId("REQ.2026.000148"), "REQ2026000148");
});

test("txid: truncates to 25 characters", () => {
  assert.equal(deriveTxId("A".repeat(40)), "A".repeat(25));
});

test("payload: differs only in amount and CRC when the value changes", () => {
  const base = {
    pixKey: "52998224725",
    city: "IELMO MARINHO",
    merchantName: "CARTORIO MARINHO",
    protocolNumber: "REQ.2026.000148",
  };
  const cheap = buildPixCharge({ ...base, amountCents: 25000 });
  const expensive = buildPixCharge({ ...base, amountCents: 99900 });

  assert.notEqual(cheap, expensive);
  assert.match(cheap, /5406250\.00/);
  assert.match(expensive, /5406999\.00/);
});

test("payload: carries the protocol number as its txid, without punctuation", () => {
  const payload = buildPixCharge({
    pixKey: "52998224725",
    city: "IELMO MARINHO",
    merchantName: "CARTORIO MARINHO",
    amountCents: 25000,
    protocolNumber: "REQ.2026.000148",
  });
  assert.match(payload, /0513REQ2026000148/);
});

test("payload: ends with a 4-digit CRC that verifies against everything before it", () => {
  const payload = buildPixCharge({
    pixKey: "52998224725",
    city: "IELMO MARINHO",
    merchantName: "CARTORIO MARINHO",
    amountCents: 25000,
    protocolNumber: "REQ.2026.000148",
  });
  const withoutCrc = payload.slice(0, -4);
  const crc = payload.slice(-4);
  assert.equal(crc, crc16Ccitt(withoutCrc));
});

test("canBuildPixCharge: true only when amount, key and city are all present", () => {
  assert.equal(
    canBuildPixCharge({ amountCents: 25000, pixKey: "key", city: "CITY" }),
    true,
  );
});

test("canBuildPixCharge: false with no amount", () => {
  assert.equal(canBuildPixCharge({ pixKey: "key", city: "CITY" }), false);
});

test("canBuildPixCharge: false with a key but no city", () => {
  assert.equal(canBuildPixCharge({ amountCents: 25000, pixKey: "key" }), false);
});

test("canBuildPixCharge: false with a city but no key", () => {
  assert.equal(canBuildPixCharge({ amountCents: 25000, city: "CITY" }), false);
});

test("canBuildPixCharge: false with nothing at all", () => {
  assert.equal(canBuildPixCharge({}), false);
});

test("payload: merchant name and city are truncated and stripped of accents", () => {
  const payload = buildPixCharge({
    pixKey: "52998224725",
    city: "São Gonçalo do Amarante", // 23 chars unaccented, truncated to 15
    merchantName: "Cartório de Registro Civil e Notas de Ielmo Marinho", // > 25 chars
    amountCents: 25000,
    protocolNumber: "REQ.2026.000148",
  });
  assert.match(payload, /6015SAO GONCALO DO/);
  assert.match(payload, /5925CARTORIO DE REGISTRO C/);
});
