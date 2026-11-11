import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { paragraphsOf } from "@/core/paper-orders/docx-model.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addStarterSuppliersWith,
  findOrderWith,
  issueOrderWith,
  listOrdersWith,
  listSuppliersWith,
  PaperOrderError,
  removeOrderWith,
  removeSupplierWith,
  renderOrderModel,
  renderOrderPdf,
  supplierOf,
  updateOrderWith,
  updateSupplierWith,
} from "./paper-orders.ts";
import { storeSupplierModel } from "./uploads.ts";

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "pedidos-"));

let db: Database;
let close: () => Promise<void>;
const TENANT = "cartorio-marinho";
const tenant = TENANTS[TENANT];
const office = {
  office: "CARTÓRIO FICTÍCIO",
  cns: "00.000-0",
  holderName: "MARIA EXEMPLO",
  holderCpf: "000.000.000-00",
  billingCnpj: "00.000.000/0001-00",
  billingCpf: "",
  address: "RUA EXEMPLO, 1",
  cep: "59000-000",
  city: "CIDADE EXEMPLO/RN",
  phone: "(84) 0000-0000",
  email: "contato@exemplo.com",
};
const line = (quantity: number) => ({
  itemId: "traslado",
  name: "Traslado",
  unit: "Folhas",
  minimum: 1000,
  quantity,
  unitPriceCents: null,
  note: "",
});
const order = (quantity: number) => ({
  lines: [line(quantity)],
  freight: "Frete FOB",
  payment: "Boleto, 21 ddl",
  notes: "",
  orderDate: "2026-11-11",
  signer: 0,
});

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("empresas de partida, pedido numerado, editar e excluir sem apagar", async () => {
  await addStarterSuppliersWith(db, TENANT, "titular");
  await addStarterSuppliersWith(db, TENANT, "titular");
  const suppliers = await listSuppliersWith(db, TENANT);
  assert.equal(suppliers.length, 2);
  const igb = suppliers[0];
  assert.ok(igb);

  await assert.rejects(
    issueOrderWith(db, TENANT, igb.id, order(500), "escrevente"),
    PaperOrderError,
  );
  const now = new Date("2026-11-11T12:00:00Z");
  const first = await issueOrderWith(
    db,
    TENANT,
    igb.id,
    order(1000),
    "escrevente",
    now,
  );
  const second = await issueOrderWith(
    db,
    TENANT,
    igb.id,
    order(2000),
    "escrevente",
    now,
  );
  assert.deepEqual([first.sequence, second.sequence], [1, 2]);

  await updateOrderWith(db, TENANT, first.id, order(3000), "escrevente");
  const edited = await findOrderWith(db, TENANT, first.id);
  assert.equal(
    (edited?.order as { lines: { quantity: number }[] }).lines[0]?.quantity,
    3000,
  );

  await removeOrderWith(db, TENANT, second.id, "pedido em dobro", "titular");
  assert.equal((await listOrdersWith(db, TENANT)).length, 1);
  assert.equal(
    (await listOrdersWith(db, TENANT, { withRemoved: true })).length,
    2,
  );
  // An order excluded keeps its number.
  const third = await issueOrderWith(
    db,
    TENANT,
    igb.id,
    order(1000),
    "escrevente",
    now,
  );
  assert.equal(third.sequence, 3);

  const pdf = await PDFDocument.load(
    await renderOrderPdf(tenant, first, office, []),
  );
  assert.ok(pdf.getPageCount() >= 1);

  // The supplier changes its data: the next edit of the order follows it.
  const data = supplierOf(igb);
  await updateSupplierWith(
    db,
    TENANT,
    igb.id,
    { ...data, phone: "(11) 0000-0000" },
    "titular",
  );
  await updateOrderWith(db, TENANT, first.id, order(1000), "escrevente");
  const refreshed = await findOrderWith(db, TENANT, first.id);
  assert.equal(
    (refreshed?.supplier as { phone: string }).phone,
    "(11) 0000-0000",
  );

  await removeSupplierWith(db, TENANT, igb.id, "mudou de empresa", "titular");
  assert.equal((await listSuppliersWith(db, TENANT)).length, 1);
  assert.equal((await listOrdersWith(db, TENANT)).length, 2);
});

test("o formulário Word da empresa volta preenchido com o pedido", async () => {
  const [m2] = await listSuppliersWith(db, TENANT);
  assert.ok(m2);
  const zip = new JSZip();
  const p = (t: string) =>
    `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  zip.file(
    "word/document.xml",
    `<w:document><w:body>${p("PEDIDO RIBBON")}${p("(07) sete unidade(s) de ribbon(s) misto premium \u2013 valor unitário R$ 27,63")}${p("Valor total do pedido (quant. X valor do ribbon: R$ 193,41)")}${p("CARTÓRIO: ANTIGO")}${p("CNPJ: 11.111.111/0001-11")}</w:body></w:document>`,
  );
  const path = await storeSupplierModel(
    TENANT,
    await zip.generateAsync({ type: "nodebuffer" }),
  );
  const row = await issueOrderWith(
    db,
    TENANT,
    m2.id,
    {
      ...order(2),
      lines: [
        {
          itemId: "ribbon",
          name: "Ribbon",
          unit: "Unidades",
          minimum: 0,
          quantity: 2,
          unitPriceCents: 2763,
          note: "",
        },
      ],
    },
    "escrevente",
  );
  const out = await JSZip.loadAsync(
    await renderOrderModel(tenant, row, { path }, office),
  );
  const filled = out.file("word/document.xml");
  assert.ok(filled);
  const lines = paragraphsOf(await filled.async("string")).map((q) => q.text);
  assert.match(lines[1] ?? "", /^\(02\) dois unidade\(s\)/);
  assert.match(lines[2] ?? "", /R\$ 55,26\)$/);
  assert.equal(lines[3], "CARTÓRIO: CARTÓRIO FICTÍCIO");
  assert.equal(lines[4], "CNPJ: 00.000.000/0001-00");
});
