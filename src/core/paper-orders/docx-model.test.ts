import assert from "node:assert/strict";
import { test } from "node:test";
import { fillModel, paragraphsOf, readModel } from "./docx-model.ts";

// Two fictitious forms, in the two shapes the suppliers' forms come in:
// lines of underscores with floating text boxes (Word VML) anchored in the
// empty paragraph above, and lines already filled "LABEL: value".
const p = (text: string) =>
  `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const box = (left: number, value: string) =>
  `<w:r><w:pict><v:shape style="position:absolute;margin-left:${left}pt;margin-top:4pt;width:200pt"><v:textbox style="mso-next-textbox:#x"><w:txbxContent><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></w:r>`;
const anchor = (...boxes: string[]) => `<w:p>${boxes.join("")}</w:p>`;
const doc = (...body: string[]) =>
  `<?xml version="1.0"?><w:document><w:body>${body.join("")}</w:body></w:document>`;

const BOXED = doc(
  p("FORMULÁRIO DE PEDIDO"),
  anchor(box(116, "1.000")),
  `<w:p><w:r><w:t xml:space="preserve">Traslado: ________________(Folhas) --- Mínimo de 1.000 folhas</w:t></w:r>${box(127, "1.000")}</w:p>`,
  p("Certidão RCPN: ______________ (Folhas) --- Mínimo de 1.000 folhas"),
  p(
    "Etiquetas 89x48:______________ (Rolos) --- Mínimo de 2 rolos (750 etiquetas cada)",
  ),
  p("A COBRANÇA SERÁ POR BOLETO NO E-MAIL CADASTRADO."),
  anchor(box(314, "00.000-9"), box(55, "CARTÓRIO ANTIGO FICTÍCIO")),
  p("CARTÓRIO: ______________________ CNS: ______________"),
  p("ENDEREÇO: ______________________CEP:______________"),
  anchor(box(297, "(00) 0000-0001"), box(64, "CIDADE ANTIGA")),
  `<w:p><w:r><w:t>MUNICÍPIO</w:t></w:r><w:r><w:t>__________________FONE: __________</w:t></w:r></w:p>`,
  p("DADOS DE FATURAMENTO (CNPJ):"),
  p("CPF:   ______________________"),
  p("CPF:   ______________________"),
);

const LINED = doc(
  p("PEDIDO RIBBON"),
  p(
    "Autorizamos a Empresa Fictícia Ltda a efetuar o faturamento das unidades abaixo.",
  ),
  p(
    "(07) sete unidade(s) de ribbon(s) misto premium 110mmx74m\u2013 valor unitário R$ 27,63",
  ),
  p("Valor total do pedido (quant. X valor do ribbon: R$ 193,41)"),
  p(
    "Obs.: depósito na conta da EMPRESA FICTÍCIA LTDA \u2013 CNPJ: 11.111.111/0001-11",
  ),
  p("CARTÓRIO: CARTÓRIO ANTIGO FICTÍCIO"),
  p("MUNICÍPIO: CIDADE ANTIGA/RN FONE: (00) 0000-0001"),
  p("CIDADE ANTIGA/RN, 08 DE OUTUBRO DE 2025"),
);

const FIELDS = {
  cartorio: "CARTÓRIO EXEMPLO",
  cns: "12.345-6",
  cpf: "000.000.000-00",
  endereco: "RUA EXEMPLO, 1",
  cep: "59000-000",
  municipio: "CIDADE EXEMPLO/RN",
  fone: "(84) 0000-0000",
  email: "contato@exemplo.com",
};

const texts = (xml: string) =>
  paragraphsOf(xml).map((q) => ({
    line: q.text,
    boxes: q.boxes.map((b) => b.nodes.map((n) => n.text).join("")),
  }));

test("lê o formulário: título, itens com unidade e mínimo, condições", () => {
  const boxed = readModel(BOXED);
  assert.equal(boxed.title, "FORMULÁRIO DE PEDIDO");
  assert.deepEqual(
    boxed.items.map((i) => [i.name, i.unit, i.minimum, i.note]),
    [
      ["Traslado", "Folhas", 1000, ""],
      ["Certidão RCPN", "Folhas", 1000, ""],
      ["Etiquetas 89x48", "Rolos", 2, "750 etiquetas cada"],
    ],
  );
  const lined = readModel(LINED);
  assert.equal(lined.supplierName, "Empresa Fictícia Ltda");
  assert.equal(lined.items[0]?.unitPriceCents, 2763);
  assert.match(lined.items[0]?.name ?? "", /^Ribbon misto premium/);
});

test("caixas de texto recebem os dados novos, ligadas à linha de baixo", () => {
  const filled = texts(
    fillModel(BOXED, {
      fields: FIELDS,
      items: [
        { label: "Traslado", quantity: "2.000" },
        { label: "Certidão RCPN", quantity: "" },
        { label: "Etiquetas 89x48", quantity: "03" },
      ],
      dateLine: "",
    }),
  );
  // Traslado gets the box above it; the box on its line was the certidão's,
  // not ordered now: cleared. The labels with no box are filled on the line.
  assert.deepEqual(filled[1]?.boxes, ["2.000"]);
  assert.deepEqual(filled[2]?.boxes, [""]);
  assert.match(filled[4]?.line ?? "", /^Etiquetas 89x48: 03 \(Rolos\)/);
  // Two boxes on one line: left to right, the office then the CNS.
  assert.deepEqual(filled[6]?.boxes, ["12.345-6", "CARTÓRIO EXEMPLO"]);
  assert.match(filled[8]?.line ?? "", /CEP: 59000-000/);
  assert.deepEqual(filled[9]?.boxes, ["(84) 0000-0000", "CIDADE EXEMPLO/RN"]);
  // A sentence with "e-mail" is not a blank; the second CPF is the billing.
  assert.equal(
    filled[5]?.line,
    "A COBRANÇA SERÁ POR BOLETO NO E-MAIL CADASTRADO.",
  );
  assert.match(filled[12]?.line ?? "", /000\.000\.000-00/);
  assert.match(filled[13]?.line ?? "", /^CPF:\s+_+$/);
});

test("linhas já preenchidas trocam o valor antigo; o texto da empresa fica", () => {
  const filled = texts(
    fillModel(LINED, {
      fields: { ...FIELDS, cnpj: "22.222.222/0001-22" },
      items: [],
      dateLine: "Cidade Exemplo/RN, 11 de novembro de 2026",
      priced: {
        quantity: 3,
        words: "três",
        unitPrice: "27,63",
        total: "82,89",
      },
    }),
  );
  assert.match(filled[2]?.line ?? "", /^\(03\) três unidade\(s\) de ribbon/);
  assert.match(filled[3]?.line ?? "", /R\$ 82,89\)$/);
  // The supplier's own CNPJ in its note is not the office's.
  assert.match(filled[4]?.line ?? "", /11\.111\.111\/0001-11$/);
  assert.equal(filled[5]?.line, "CARTÓRIO: CARTÓRIO EXEMPLO");
  assert.equal(
    filled[6]?.line,
    "MUNICÍPIO: CIDADE EXEMPLO/RN FONE: (84) 0000-0000",
  );
  assert.equal(filled[7]?.line, "CIDADE EXEMPLO/RN, 11 DE NOVEMBRO DE 2026");
});

test("caracteres especiais nos dados não quebram o XML", () => {
  const xml = fillModel(LINED, {
    fields: { cartorio: "A & B <Notas>" },
    items: [],
    dateLine: "",
  });
  assert.match(xml, /A &amp; B &lt;Notas&gt;/);
  assert.equal(paragraphsOf(xml)[5]?.text, "CARTÓRIO: A & B <Notas>");
});
