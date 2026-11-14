import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { readImportFile } from "./rcpn-reader.ts";

// Fictitious registros only (LGPD).
const M = "09461501552020100008530001146600";
const xml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><dataroot xmlns:od="urn:schemas-microsoft-com:officedata" generated="2026-11-14T10:00:00">${body}</dataroot>`;

test("tabelas do Access exportadas em XML são lidas juntas, com a certidão impressa", async () => {
  const zip = new JSZip();
  zip.file(
    "NASCIMENTO.xml",
    xml(
      `<NASCIMENTO><ID>7</ID><no_pessoa>Criança Fictícia</no_pessoa><nu_livro>A08</nu_livro><nu_folha>530</nu_folha><cd_registro>11466</cd_registro><dt_registro>2020-07-07T00:00:00</dt_registro><dt_nascimento>2020-04-12T00:00:00</dt_nascimento><ho_nascimento>1899-12-30T12:00:00</ho_nascimento><nu_matriculaCNJ>${M}</nu_matriculaCNJ></NASCIMENTO>`,
    ),
  );
  zip.file(
    "NA_PAIS.xml",
    xml(`<NA_PAIS><ID>7</ID><NO_MAE>Mãe Fictícia</NO_MAE></NA_PAIS>`),
  );
  zip.file(
    "NA_DECLARANTE.xml",
    xml(
      `<NA_DECLARANTE><ID>7</ID><NO_NOME>Declarante Um</NO_NOME><no_nome_2>Declarante Dois</no_nome_2></NA_DECLARANTE>`,
    ),
  );
  zip.file(
    "CV_NASCIMENTO.xml",
    xml(
      `<CV_NASCIMENTO><CV_MATRICULA_CNJ>${M}</CV_MATRICULA_CNJ><CV_AVOS_MATERNOS>Avô Materno; Avó Materna</CV_AVOS_MATERNOS><CV_OBSERVACOES_AVERBACOES>Averbação fictícia.</CV_OBSERVACOES_AVERBACOES><CV_LOCAL_NASCIMENTO>Hospital Fictício</CV_LOCAL_NASCIMENTO></CV_NASCIMENTO>`,
    ),
  );
  zip.file(
    "NA_AVOS.xsd",
    `<?xml version="1.0" encoding="UTF-8"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"></xsd:schema>`,
  );
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const reading = await readImportFile(bytes, "BancoDeDados.zip");
  assert.equal(reading.records.length, 1);
  const [r] = reading.records;
  assert.equal(r?.people[0]?.name, "Criança Fictícia");
  assert.equal(r?.people[0]?.motherName, "Mãe Fictícia");
  assert.equal(r?.registeredOn, "2020-07-07");
  assert.equal(r?.details?.hora, "12:00 horas");
  assert.equal(r?.details?.avos1, "Avô Materno; Avó Materna");
  assert.equal(r?.details?.observacoes, "Averbação fictícia.");
  assert.equal(r?.details?.localNascimento, "Hospital Fictício");
  assert.equal(r?.details?.declarante, "Declarante Um e Declarante Dois");
  assert.ok(
    reading.notes.some((n) => n.includes("esquema de tabela do Access")),
  );
  assert.ok(reading.notes.some((n) => n.includes("lidas juntas: 1 registros")));
});
