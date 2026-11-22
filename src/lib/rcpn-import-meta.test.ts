import assert from "node:assert/strict";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { rcpnImports } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  editImportWith,
  hideImportWith,
  ImportMetaError,
  importMetaWith,
  purgeImportFileWith,
  restoreImportWith,
} from "./rcpn-import-meta.ts";

const OFFICE = "cartorio-importacoes";
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => close());

async function importRow(status: string, storedPath: string | null) {
  const [row] = await db
    .insert(rcpnImports)
    .values({
      tenantSlug: OFFICE,
      fileName: "carga-ficticia.zip",
      sizeBytes: 10,
      sha256: `${status}-${Math.random()}`,
      storedPath,
      status,
      records: [],
    })
    .returning({ id: rcpnImports.id });
  if (!row) throw new Error("fixture");
  return row.id;
}

test("apagar o arquivo mantém os dados lidos e a importação aberta", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rcpn-meta-"));
  const path = join(dir, "carga.zip");
  await writeFile(path, "conteúdo fictício");
  const id = await importRow("lida", path);
  await purgeImportFileWith(db, OFFICE, id, "escrevente");
  const [row] = await db
    .select()
    .from(rcpnImports)
    .where(eq(rcpnImports.id, id));
  assert.equal(row?.storedPath, null);
  assert.equal(row?.status, "lida");
  assert.deepEqual(row?.records, []);
  await assert.rejects(stat(path));
});

test("editar guarda o anterior; tirar da lista e restaurar não apagam nada", async () => {
  const id = await importRow("publicada", null);
  await editImportWith(db, OFFICE, id, { label: "Carga 1", note: "" }, "u1");
  await editImportWith(
    db,
    OFFICE,
    id,
    { label: "Carga de novembro", note: "livros A" },
    "u1",
  );
  let meta = (await importMetaWith(db, OFFICE))[id];
  assert.equal(meta?.label, "Carga de novembro");
  assert.equal(meta?.history.at(-1)?.label, "Carga 1");

  await hideImportWith(db, OFFICE, id, "u1");
  meta = (await importMetaWith(db, OFFICE))[id];
  assert.ok(meta?.hiddenAt);
  await restoreImportWith(db, OFFICE, id, "u1");
  meta = (await importMetaWith(db, OFFICE))[id];
  assert.equal(meta?.hiddenAt, undefined);
  assert.equal(meta?.label, "Carga de novembro");

  const [row] = await db
    .select()
    .from(rcpnImports)
    .where(eq(rcpnImports.id, id));
  assert.equal(row?.status, "publicada");
});

test("importação ainda aberta não sai da lista", async () => {
  const id = await importRow("lida", null);
  await assert.rejects(hideImportWith(db, OFFICE, id, "u1"), ImportMetaError);
});
