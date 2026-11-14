import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { attributionFiles, auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  AttributionFileError,
  addAttributionFileWith,
  getAttributionFileWith,
  listAttributionFilesWith,
  removeAttributionFileWith,
} from "./attribution-files.ts";

// Fictitious content only (LGPD).
const OFFICE = "cartorio-marinho";
const enc = (text: string) => new TextEncoder().encode(text);

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => close());

const send = (attribution: string, text: string) =>
  addAttributionFileWith(db, OFFICE, {
    attribution,
    fileName: "remessa.xml",
    description: "Remessa fictícia",
    bytes: enc(text),
    storedPath: "",
    uploadedBy: "escrevente",
  });

test("guarda com o tipo reconhecido e recusa o mesmo arquivo", async () => {
  const id = await send("protesto", '<?xml version="1.0"?><REMESSA/>');
  const row = await getAttributionFileWith(db, OFFICE, id);
  assert.equal(row?.format, "XML");
  assert.equal(row?.attribution, "protesto");
  await assert.rejects(
    send("protesto", '<?xml version="1.0"?><REMESSA/>'),
    /já foi enviado/,
  );
  // The same file in another attribution is another file.
  await send("notas", '<?xml version="1.0"?><REMESSA/>');
  await assert.rejects(send("nao-existe", "x"), AttributionFileError);
});

test("excluir só marca: a linha e a auditoria ficam", async () => {
  const id = await send("notas", "texto fictício para excluir");
  await removeAttributionFileWith(db, OFFICE, id, "tabeliao", "enviado errado");
  assert.equal(await getAttributionFileWith(db, OFFICE, id), null);
  assert.equal(
    (await listAttributionFilesWith(db, OFFICE, "notas")).some(
      (r) => r.id === id,
    ),
    false,
  );
  const [kept] = await db
    .select()
    .from(attributionFiles)
    .where(eq(attributionFiles.id, id));
  assert.equal(kept?.removedReason, "enviado errado");
  const acts = (
    await db.select().from(auditLog).where(eq(auditLog.targetId, id))
  ).map((a) => a.action);
  assert.deepEqual(acts.sort(), [
    "attributions.file.remove",
    "attributions.file.upload",
  ]);
  // Excluded, the same file can be sent again.
  await send("notas", "texto fictício para excluir");
});
