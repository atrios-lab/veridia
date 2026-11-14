import assert from "node:assert/strict";
import { test } from "node:test";
import { CARTOSOFT_COLUMNS, readCartosoft } from "./cartosoft.ts";
import { isSqlDump, readSqlDump } from "./sql-dump.ts";

// Fictitious registros only (LGPD). The shape follows the Cartosoft's
// MySQL backup: lower-case tables, the column list in each INSERT, both
// escapes for a quote, NULL, zero dates and Windows line breaks.
const M = "09461501552014100050123000123456";

const DUMP = `-- MySQL Administrator dump 1.4
--
-- Server version\t5.0.51a-community-nt

/*!40101 SET NAMES utf8 */;
CREATE DATABASE IF NOT EXISTS bd_ficticio;
USE bd_ficticio;

DROP TABLE IF EXISTS \`nascimento\`;
CREATE TABLE \`nascimento\` (
  \`ID\` int(11) NOT NULL auto_increment,
  \`no_pessoa\` varchar(100) default NULL,
  \`dt_nascimento\` datetime default NULL,
  \`ho_nascimento\` datetime default NULL,
  \`nu_livro\` varchar(10) default NULL,
  \`nu_folha\` varchar(10) default NULL,
  \`cd_registro\` int(11) default NULL,
  \`dt_registro\` datetime default NULL,
  \`nu_matriculaCNJ\` varchar(40) default NULL,
  \`cd_sexo\` varchar(1) default NULL,
  \`no_cidade\` varchar(50) default NULL,
  \`no_senha_interna\` varchar(50) default NULL,
  PRIMARY KEY  (\`ID\`),
  KEY \`no_pessoa\` (\`no_pessoa\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

/*!40000 ALTER TABLE \`nascimento\` DISABLE KEYS */;
INSERT INTO \`nascimento\` (\`ID\`,\`no_pessoa\`,\`dt_nascimento\`,\`ho_nascimento\`,\`nu_livro\`,\`nu_folha\`,\`cd_registro\`,\`dt_registro\`,\`nu_matriculaCNJ\`,\`cd_sexo\`,\`no_cidade\`,\`no_senha_interna\`) VALUES
 (7,'Criança D\\'Ávila Fictícia','2014-03-03 00:00:00','1899-12-30 08:05:00','A-12','34',56,'2014-03-05 00:00:00','${M}','F','Cidade (Fictícia), RN','segredo'),
 (8,'Outro O''Exemplo',NULL,'0000-00-00 00:00:00','A-12','35',57,'4979-03-06 00:00:00','','M','Cidade Fictícia','x');
INSERT INTO \`bd_ficticio\`.\`na_avos\` VALUES (7,'Avô Materno; com vírgula, e ponto','N',NULL,'','Avó Materna','N','','');
INSERT INTO \`na_anoave\` (\`ID\`,\`TEXTO\`) VALUES (7,'Anotação fictícia.\\r\\nSegunda linha.');
INSERT INTO \`sistema_usuario\` (\`login\`,\`senha\`) VALUES ('admin','nao-deve-sair');
CREATE TABLE \`na_avos\` (
  \`ID\` int(11) NOT NULL,
  \`no_pai_pai\` varchar(100) default NULL,
  \`fa_pai_pai\` varchar(1) default NULL,
  \`no_mae_pai\` varchar(100) default NULL,
  \`fa_mae_pai\` varchar(1) default NULL,
  \`no_pai_mae\` varchar(100) default NULL,
  \`fa_pai_mae\` varchar(1) default NULL,
  \`no_mae_mae\` varchar(100) default NULL,
  \`fa_mae_mae\` varchar(1) default NULL,
  PRIMARY KEY  (\`ID\`)
);
`;

test("reconhece a cópia de segurança .sql pelo conteúdo", () => {
  assert.equal(isSqlDump(DUMP.slice(0, 200)), true);
  assert.equal(isSqlDump("﻿INSERT INTO `x` VALUES (1);"), true);
  assert.equal(isSqlDump('<?xml version="1.0"?><dataroot/>'), false);
  assert.equal(isSqlDump("Relatório de atos do mês"), false);
});

test("lê só as tabelas e colunas do modelo, com aspas, NULL e quebras de linha", () => {
  const tables = readSqlDump(DUMP, CARTOSOFT_COLUMNS);
  assert.deepEqual(Object.keys(tables).sort(), [
    "NASCIMENTO",
    "NA_ANOAVE",
    "NA_AVOS",
  ]);
  const [first, second] = tables.NASCIMENTO ?? [];
  assert.equal(first?.no_pessoa, "Criança D'Ávila Fictícia");
  assert.equal(first?.no_cidade, "Cidade (Fictícia), RN");
  assert.equal(second?.no_pessoa, "Outro O'Exemplo");
  assert.equal(second?.dt_nascimento, null);
  assert.equal(second?.ho_nascimento, null, "data zerada do MySQL é vazio");
  assert.equal(
    "no_senha_interna" in (first ?? {}),
    false,
    "coluna fora do modelo fica no arquivo",
  );
  // No column list: the CREATE TABLE gives the order, even when it comes
  // after the rows; `banco`.`tabela` is read as the table.
  assert.equal(tables.NA_AVOS?.[0]?.no_pai_mae, "Avó Materna");
  assert.equal(
    tables.NA_AVOS?.[0]?.no_pai_pai,
    "Avô Materno; com vírgula, e ponto",
  );
  assert.equal(
    tables.NA_ANOAVE?.[0]?.TEXTO,
    "Anotação fictícia.\r\nSegunda linha.",
  );
});

test("da cópia .sql sai o mesmo registro que sai do banco Access", () => {
  const records = readCartosoft(readSqlDump(DUMP, CARTOSOFT_COLUMNS));
  const record = records.find((r) => r.matricula === M);
  assert.ok(record);
  assert.equal(record.book, "A-12");
  assert.equal(record.registeredOn, "2014-03-05");
  assert.equal(record.people[0]?.birthDate, "2014-03-03");
  const details = record.details ?? {};
  assert.equal(details.hora, "08:05 horas");
  assert.equal(details.sexo, "FEMININO");
  assert.equal(details.avos1, "Avó Materna");
  assert.equal(details.avos2, "Avô Materno; com vírgula, e ponto");
  assert.equal(details.observacoes, "Anotação fictícia.\nSegunda linha.");
  const other = records.find((r) => r.people[0]?.name === "Outro O'Exemplo");
  assert.equal(other?.registeredOn, "", "ano impossível fica em branco");
  assert.equal(other?.details?.hora, undefined, "hora zerada não é hora");
});
