import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import {
  buildOrderDocument,
  fillInputOf,
  guessPaperKind,
  itemId,
  type OfficeOrderData,
  type OrderInput,
  orderProblems,
  orderTotal,
  STARTER_SUPPLIERS,
  SupplierSchema,
  sameItem,
} from "./catalog.ts";

const tenant = {
  name: "Cartório Fictício",
  officialName: "Cartório Único Fictício",
  subtitle: "Notas e Registros",
  cns: "00.000-0",
  location: { city: "Cidade Exemplo", state: "RN" },
  owner: { name: "Maria Exemplo" },
  holderTitle: "Tabeliã",
  legalFooter: "Rodapé fictício",
} as unknown as Tenant;

const office: OfficeOrderData = {
  office: "CARTÓRIO ÚNICO FICTÍCIO",
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

test("as empresas de partida são válidas e editáveis", () => {
  for (const s of STARTER_SUPPLIERS)
    assert.ok(SupplierSchema.safeParse(s).success, s.name);
  const igb = STARTER_SUPPLIERS[0];
  assert.equal(igb?.items.find((i) => i.id === "apostila")?.minimum, 500);
  assert.equal(itemId("Certidão RCPN", ["certidao-rcpn"]), "certidao-rcpn-2");
});

test("abaixo do mínimo da empresa o pedido não sai", () => {
  const lines = [
    {
      itemId: "traslado",
      name: "Traslado",
      unit: "Folhas",
      minimum: 1000,
      quantity: 500,
      unitPriceCents: null,
      note: "",
    },
  ];
  assert.match(orderProblems(lines)[0] ?? "", /mínimo é 1\.000 folhas/);
  assert.equal(orderTotal(lines), null);
});

test("o pedido sai no padrão da empresa, com total e dados do cartório", () => {
  const m2 = STARTER_SUPPLIERS[1];
  assert.ok(m2);
  const order: OrderInput = {
    lines: [
      {
        itemId: "ribbon",
        name: "Ribbon misto premium 110mm x 74m",
        unit: "Unidades",
        minimum: 0,
        quantity: 7,
        unitPriceCents: 2763,
        note: "",
      },
      {
        itemId: null,
        name: "Item novo fictício",
        unit: "Caixas",
        minimum: 0,
        quantity: 1,
        unitPriceCents: null,
        note: "",
      },
    ],
    freight: "",
    payment: "",
    notes: "",
    orderDate: "2026-11-11",
    signer: 0,
  };
  assert.equal(orderTotal(order.lines), 19341);
  const doc = buildOrderDocument(tenant, {
    number: "001/2026",
    supplier: m2,
    order,
    office,
  });
  const text = JSON.stringify(doc);
  assert.equal(doc.eyebrow, "Pedido nº 001/2026");
  assert.match(text, /Autorizamos a M2/);
  assert.match(text, /R\$ 193,41/);
  assert.match(text, /00\.000\.000\/0001-00/);
  assert.match(doc.dateLine ?? "", /11 de novembro de 2026/);

  const fill = fillInputOf({ supplier: m2, order, office, city: office.city });
  assert.deepEqual(fill.priced, {
    quantity: 7,
    words: "sete",
    unitPrice: "27,63",
    total: "193,41",
  });
  assert.equal(fill.fields.data, "11 DE NOVEMBRO DE 2026");
});

test("no formulário da empresa, item não pedido é limpo e rolos têm 2 dígitos", () => {
  const igb = STARTER_SUPPLIERS[0];
  assert.ok(igb);
  const fill = fillInputOf({
    supplier: igb,
    order: {
      lines: [
        {
          itemId: "etiquetas",
          name: "Etiquetas 89x48",
          unit: "Rolos",
          minimum: 2,
          quantity: 7,
          unitPriceCents: null,
          note: "",
        },
      ],
      freight: "",
      payment: "",
      notes: "",
      orderDate: "2026-11-11",
      signer: 0,
    },
    office,
    city: office.city,
  });
  assert.deepEqual(
    fill.items.map((i) => i.quantity),
    ["", "", "", "", "07"],
  );
});

test("item lido do formulário liga ao estoque pelo nome", () => {
  assert.equal(guessPaperKind("Traslado"), "traslado");
  assert.equal(guessPaperKind("Certidão RCPN"), "certidao-rcpn");
  assert.equal(guessPaperKind("Apostila da Haia"), "apostila");
  assert.equal(guessPaperKind("Etiquetas 89x48"), "etiqueta");
  assert.equal(guessPaperKind("Extensor de Documentos"), null);
  assert.ok(sameItem("Certidão  RCPN", "certidao rcpn"));
});
