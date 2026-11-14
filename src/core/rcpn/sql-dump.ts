import type { Row, Tables } from "./cartosoft.ts";

/**
 * A MySQL backup (`.sql`, as the Cartosoft's "Backup_Cartosoft_Mysql"
 * writes it, analysis of 14/11/2026) read as text: never executed. Only
 * the `CREATE TABLE` column lists and the `INSERT INTO ... VALUES` rows of
 * the wanted tables are taken, and of each row only the wanted columns.
 * Everything else in the file (users, logs, custas, selos) stays behind.
 *
 * The MySQL base names its tables in lower case ("na_avos"); the Access
 * base, in upper case ("NA_AVOS"). Tables are matched without case, and
 * come out under the name the model uses.
 */

/** Whether the text looks like a SQL dump (by content, not by name). */
export function isSqlDump(head: string): boolean {
  return /(^|\n)\s*(--\s*MySQL|CREATE\s+TABLE|INSERT\s+INTO|DROP\s+TABLE\s+IF\s+EXISTS)/i.test(
    head.replace(/^﻿/, ""),
  );
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  "0": "",
  Z: "",
  b: "",
};

const ZERO_DATE = /^0000-00-00( 00:00:00)?$/;

/** `db`.`table`, `table` or table: the bare name. */
function bareName(raw: string): string {
  const parts = raw.split(".");
  return (parts.at(-1) ?? "").replace(/[`"]/g, "").trim();
}

/** The column names of each table, in the order the rows give them. */
function readColumns(text: string): Map<string, string[]> {
  const columns = new Map<string, string[]>();
  const create =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`|\w+)(?:\.(?:`[^`]+`|\w+))?)\s*\(/gi;
  for (let m = create.exec(text); m; m = create.exec(text)) {
    const name = bareName(m[1] ?? "").toLowerCase();
    // The body ends at the first line that closes the parenthesis.
    const end = text.indexOf("\n)", create.lastIndex);
    const body = text.slice(create.lastIndex, end < 0 ? undefined : end);
    const names: string[] = [];
    for (const line of body.split("\n")) {
      const col =
        /^\s*`([^`]+)`/.exec(line) ?? /^\s*([A-Za-z_]\w*)\s+\w/.exec(line);
      const word = col?.[1];
      if (!word) continue;
      if (
        /^(PRIMARY|UNIQUE|KEY|INDEX|CONSTRAINT|FULLTEXT|FOREIGN)$/i.test(word)
      )
        continue;
      names.push(word);
    }
    columns.set(name, names);
  }
  return columns;
}

/**
 * The rows of one `VALUES (...),(...);` list, from `start`. Returns where
 * the statement ended. Strings take both escapes MySQL writes: `\'` and
 * `''`. NULL and bare numbers come as they are (NULL as null).
 */
function readValues(
  text: string,
  start: number,
  onRow: (values: (string | null)[]) => void,
): number {
  let i = start;
  const n = text.length;
  let row: (string | null)[] | null = null;
  let token = "";
  let quoted = false;
  let wasQuoted = false;
  const push = () => {
    if (!row) return;
    const raw = token.trim();
    // MySQL's zero date is its "not informed": blank, as NULL.
    const empty = wasQuoted
      ? ZERO_DATE.test(raw)
      : raw === "" || /^NULL$/i.test(raw);
    row.push(empty ? null : wasQuoted ? token : raw);
    token = "";
    wasQuoted = false;
  };
  while (i < n) {
    const c = text[i] as string;
    if (quoted) {
      if (c === "\\") {
        const next = text[i + 1] ?? "";
        token += ESCAPES[next] ?? next;
        i += 2;
        continue;
      }
      if (c === "'") {
        if (text[i + 1] === "'") {
          token += "'";
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      // Plain text up to the next quote or backslash, in one slice.
      let stop = i + 1;
      while (stop < n && text[stop] !== "'" && text[stop] !== "\\") stop++;
      token += text.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === "'") {
      quoted = true;
      wasQuoted = true;
      token = "";
    } else if (c === "(" && !row) {
      row = [];
      token = "";
      wasQuoted = false;
    } else if (c === "," && row) {
      push();
    } else if (c === ")" && row) {
      push();
      onRow(row);
      row = null;
    } else if (c === ";" && !row) {
      return i + 1;
    } else if (row && !wasQuoted) {
      token += c;
    }
    i++;
  }
  return n;
}

/**
 * The wanted tables of a SQL dump, each row with only the wanted columns
 * (a column the dump does not have is left out, as with the Access file).
 * `wanted` is keyed by the model's table name.
 */
export function readSqlDump(
  text: string,
  wanted: Record<string, readonly string[]>,
): Tables {
  const byLower = new Map(
    Object.keys(wanted).map((name) => [name.toLowerCase(), name]),
  );
  const columns = readColumns(text);
  const tables: Tables = {};
  const insert =
    /INSERT\s+(?:IGNORE\s+)?INTO\s+((?:`[^`]+`|\w+)(?:\.(?:`[^`]+`|\w+))?)\s*(\([^)]*\))?\s*VALUES\s*/gi;
  for (let m = insert.exec(text); m; m = insert.exec(text)) {
    const lower = bareName(m[1] ?? "").toLowerCase();
    const model = byLower.get(lower);
    if (!model) continue;
    const listed = m[2]
      ? m[2]
          .slice(1, -1)
          .split(",")
          .map((c) => c.replace(/[`"\s]/g, ""))
      : (columns.get(lower) ?? []);
    // The model's spelling of each column, matched without case.
    const keep = new Map(
      (wanted[model] ?? []).map((name) => [name.toLowerCase(), name]),
    );
    const picks = listed.flatMap((name, index) => {
      const canonical = keep.get(name.toLowerCase());
      return canonical ? [{ name: canonical, index }] : [];
    });
    const rows = tables[model] ?? [];
    tables[model] = rows;
    insert.lastIndex = readValues(text, insert.lastIndex, (values) => {
      const row: Row = {};
      for (const { name, index } of picks) row[name] = values[index] ?? null;
      rows.push(row);
    });
  }
  return tables;
}
