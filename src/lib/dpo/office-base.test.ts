import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { emptyMeta, toMarkdown } from "@/core/conhecimento/base.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createSourceWith } from "../knowledge.ts";
import {
  formatOfficeExcerpts,
  officeExcerptsWith,
  sourceViewsWith,
} from "./office-base.ts";

// Fictitious office policy only (LGPD).
const OFFICE = "cartorio-marinho";
const POLITICA = toMarkdown(
  [
    "POLÍTICA FICTÍCIA DE PRIVACIDADE DA SERVENTIA",
    "Art. 1º O cadastro de contato do site é eliminado em até trinta dias após o pedido do titular.",
    "Art. 2º Os dados dos livros de registro são conservados por dever legal.",
  ].join("\n"),
  "Política fictícia",
);

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
  await createSourceWith(
    db,
    OFFICE,
    {
      meta: {
        ...emptyMeta(),
        kind: "outro",
        title: "Política fictícia de privacidade",
        reference: "Política de privacidade",
        areas: ["lgpd"],
      },
      markdown: POLITICA,
      origin: "politica.pdf",
    },
    "encarregada",
  );
  // A source of another attribution only: not for the DPO.
  await createSourceWith(
    db,
    OFFICE,
    {
      meta: {
        ...emptyMeta(),
        title: "Norma fictícia de imóveis",
        reference: "Norma de imóveis",
        areas: ["ri"],
      },
      markdown: toMarkdown(
        "Art. 1º O cadastro de imóveis é eliminado só por ordem judicial.",
        "Norma de imóveis",
      ),
      origin: "ri.pdf",
    },
    "escrevente",
  );
});
after(async () => {
  await close();
});

test("o DPO lê a Base jurídica da serventia na área de proteção de dados e cita o trecho", async () => {
  const found = await officeExcerptsWith(
    db,
    OFFICE,
    "eliminação cadastro contato titular",
  );
  assert.ok(found.length > 0);
  assert.ok(found.every((e) => e.id.startsWith("kb-")));
  assert.ok(found.some((e) => /cadastro de contato do site/.test(e.text)));
  assert.ok(!found.some((e) => /imóveis/.test(e.text)));
  const block = formatOfficeExcerpts(found);
  assert.match(block, /BASE DA SERVENTIA/);
  assert.match(block, /<trecho id="kb-/);
  assert.equal(formatOfficeExcerpts([]), "");

  // A stored answer shows the office's source and the platform's alike.
  const views = await sourceViewsWith(db, OFFICE, [
    found[0]?.id ?? "",
    "lgpd-art-18",
    "kb-00000000-0000-0000-0000-000000000000",
  ]);
  assert.equal(views.length, 2);
  assert.match(views[0]?.sourceName ?? "", /Política fictícia/);
  assert.match(views[1]?.citation ?? "", /18/);
  // Another office never sees it.
  assert.deepEqual(
    await sourceViewsWith(db, "outra-serventia", [found[0]?.id ?? ""]),
    [],
  );
});
