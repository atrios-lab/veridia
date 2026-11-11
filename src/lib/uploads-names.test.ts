import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectAttachments, storeAttachments } from "./uploads.ts";

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "nomes-"));

// A minimal PDF header is enough for the type check.
const pdf = (n: number) =>
  new File([`%PDF-1.4\n% arquivo ${n}\n`], `foto-${n}.pdf`, {
    type: "application/pdf",
  });

test("o nome digitado vira o nome do anexo, um por arquivo ou numerado", async () => {
  const each = await storeAttachments([pdf(1), pdf(2)], {
    tenantSlug: "cartorio-marinho",
    name: ["Documento de identidade (RG ou CNH)", "Comprovante de residência"],
  });
  assert.deepEqual(
    each.map((a) => a.displayName),
    ["Documento de identidade (RG ou CNH)", "Comprovante de residência"],
  );
  const one = await storeAttachments([pdf(3), pdf(4)], {
    tenantSlug: "cartorio-marinho",
    name: "Certidão",
  });
  assert.deepEqual(
    one.map((a) => a.displayName),
    ["Certidão", "Certidão (2)"],
  );
  const none = await storeAttachments([pdf(5)], {
    tenantSlug: "cartorio-marinho",
  });
  assert.equal(none[0].displayName, "anexo-1");
});

test("o formulário leva o nome ao lado do arquivo; papel fixo mantém o nome dele", async () => {
  const form = new FormData();
  form.append("anexos", pdf(6));
  form.append("anexosName", "Procuração");
  const named = await collectAttachments(form, "anexos", {
    tenantSlug: "cartorio-marinho",
  });
  assert.equal(named[0].displayName, "Procuração");
  const fixed = await collectAttachments(form, "anexos", {
    tenantSlug: "cartorio-marinho",
    kind: "Comprovante de pagamento",
  });
  assert.equal(fixed[0].displayName, "Comprovante de pagamento");
});
