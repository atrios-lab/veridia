import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSize, recognizeFile, xmlRoot } from "./files.ts";

const enc = (text: string) => new TextEncoder().encode(text);

test("reconhece pelo conteúdo, não pelo nome", () => {
  assert.equal(recognizeFile(enc("%PDF-1.7 ..."), "a.txt").label, "PDF");
  assert.equal(
    recognizeFile(new Uint8Array([0x50, 0x4b, 3, 4, 0]), "modelo.docx").label,
    "DOCX",
  );
  assert.equal(
    recognizeFile(new Uint8Array([0x50, 0x4b, 3, 4]), "x").label,
    "ZIP",
  );
  assert.equal(recognizeFile(enc("Rar!\u001a"), "x").label, "RAR");
  assert.equal(recognizeFile(enc("{\\rtf1\\ansi"), "m.doc").label, "RTF");
  assert.equal(
    recognizeFile(enc('{"declaracoes": []}'), "doi.txt").label,
    "JSON",
  );
  const access = new Uint8Array(32);
  access.set(enc("Standard Jet DB"), 4);
  assert.equal(recognizeFile(access, "base.mdb").label, "Banco Access");
});

test("XML diz o elemento principal, sem prólogo nem comentário", () => {
  const xml =
    '﻿<?xml version="1.0"?><!-- ficticio --><REMESSA versao="1"><A/></REMESSA>';
  const kind = recognizeFile(enc(xml), "r.xml");
  assert.equal(kind.label, "XML");
  assert.match(kind.note, /REMESSA/);
  assert.equal(xmlRoot("<ns:Titulo/>"), "ns:Titulo");
});

test("texto, planilha e o que não se conhece", () => {
  assert.equal(recognizeFile(enc("nome;cpf\nFulano;1"), "a").label, "CSV");
  assert.equal(recognizeFile(enc("linha um\nlinha dois"), "a").label, "Texto");
  assert.equal(
    recognizeFile(new Uint8Array([0, 1, 2, 3, 250]), "x.sys").label,
    "SYS",
  );
});

test("tamanho em português", () => {
  assert.equal(formatSize(900), "900 B");
  assert.equal(formatSize(1536), "1,5 KB");
  assert.equal(formatSize(5 * 1024 * 1024), "5 MB");
});
