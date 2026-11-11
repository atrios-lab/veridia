import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { bulletinFingerprint, renderBulletinPdf } from "./bulletin-pdf.ts";

const tenant = TENANTS["cartorio-marinho"];
// Fictitious figures (LGPD).
const stored = {
  kind: "current" as const,
  figures: {
    actsCount: 120,
    fundAmountsCents: {
      fdj: 50_000,
      frmp: 15_000,
      fcrcpn: 16_000,
      funaf: 2_500,
    },
    issCents: 9_000,
    grossRevenueCents: 292_500,
    expensesCents: 150_000,
  },
};

test("a assinatura do boletim só vale enquanto os números e a situação forem os mesmos", () => {
  const signed = bulletinFingerprint(
    tenant,
    "2026-10-01",
    "consolidated",
    stored,
  );
  assert.equal(
    bulletinFingerprint(tenant, "2026-10-01", "consolidated", stored),
    signed,
  );
  const edited = { ...stored, figures: { ...stored.figures, issCents: 9_100 } };
  assert.notEqual(
    bulletinFingerprint(tenant, "2026-10-01", "consolidated", edited),
    signed,
  );
  assert.notEqual(
    bulletinFingerprint(tenant, "2026-10-01", "preliminary", stored),
    signed,
  );
  assert.notEqual(
    bulletinFingerprint(
      {
        ...tenant,
        publishBulletinPrivateFigures: !tenant.publishBulletinPrivateFigures,
      },
      "2026-10-01",
      "consolidated",
      stored,
    ),
    signed,
  );
});

test("o PDF do boletim é gerado para assinar antes de publicar", async () => {
  const pdf = await renderBulletinPdf(
    tenant,
    "2026-10-01",
    "consolidated",
    stored,
  );
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});
