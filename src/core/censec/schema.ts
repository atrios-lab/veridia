/**
 * Checks a file against an official JSON Schema before it is downloaded,
 * so the office learns here, and not on the CENSEC's screen, that a field
 * is missing or too long. It covers the parts the official schemas use
 * (the CENSEC's Swagger and the RFB's DOI-Web layout): $ref to $defs,
 * type with nullable, required, additionalProperties false, properties,
 * items, sizes, pattern, date formats, enum and oneOf of constants.
 */

export type JsonSchema = Record<string, unknown>;

/** Field names in the office's words, for the messages. */
const FIELD_LABELS: Record<string, string> = {
  tipoAtoCep: "tipo do ato",
  tipoAtoCesdi: "natureza do ato",
  tipoTestamento: "tipo do testamento",
  data: "data do ato",
  dataTestamento: "data do testamento",
  dataNascimento: "data de nascimento",
  livro: "livro",
  folha: "folha",
  numeroLivro: "livro",
  partes: "partes",
  nome: "nome",
  qualidade: "qualidade da parte",
  tipoDocumento: "tipo do documento",
  documentos: "documentos da parte",
  cpf: "CPF",
  mne: "MNE",
  matriculaNotarialEletronica: "MNE",
  codigoIbge: "código IBGE do município",
  cep: "CEP",
  formaPagamento: "forma de pagamento",
  tipoParteTransacionada: "parte transacionada",
  valorParteTransacionada: "valor da parte transacionada",
  destinacao: "destinação (urbano ou rural)",
  tipoOperacaoImobiliaria: "operação imobiliária",
  dataLavraturaRegistroAverbacao: "data do ato",
  adquirentes: "adquirentes",
  ni: "CPF ou CNPJ",
};

const label = (path: string) => {
  const last =
    path
      .split(".")
      .pop()
      ?.replace(/\[\d+\]$/, "") ?? path;
  return FIELD_LABELS[last] ?? last;
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number")
    return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

const DATE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

export function schemaProblems(
  value: unknown,
  schema: JsonSchema,
  root: JsonSchema = schema,
  path = "$",
): string[] {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.replace(/^#\/\$defs\//, "");
    const defs = (root.$defs ?? {}) as Record<string, JsonSchema>;
    const target = defs[name];
    if (!target) return [`${path}: esquema ${name} não encontrado`];
    return schemaProblems(value, target, root, path);
  }
  if (Array.isArray(schema.allOf)) {
    return (schema.allOf as JsonSchema[]).flatMap((s) =>
      schemaProblems(value, s, root, path),
    );
  }
  if (value === null || value === undefined) {
    return schema.nullable === true || value === undefined
      ? []
      : [`${label(path)}: não pode ficar vazio (${path})`];
  }
  const problems: string[] = [];
  const expected = schema.type as string | undefined;
  const actual = typeOf(value);
  if (expected) {
    const fits =
      expected === actual || (expected === "number" && actual === "integer");
    if (!fits) {
      return [
        `${label(path)}: deveria ser ${expected}, veio ${actual} (${path})`,
      ];
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    problems.push(
      `${label(path)}: valor ${String(value)} fora da tabela (${path})`,
    );
  }
  if (Array.isArray(schema.oneOf)) {
    const consts = (schema.oneOf as JsonSchema[])
      .map((o) => o.const)
      .filter((c) => c !== undefined);
    if (consts.length > 0 && !consts.includes(value)) {
      problems.push(
        `${label(path)}: código ${String(value)} fora da tabela (${path})`,
      );
    }
  }
  if (typeof value === "string") {
    if (
      typeof schema.maxLength === "number" &&
      value.length > schema.maxLength
    ) {
      problems.push(
        `${label(path)}: mais de ${schema.maxLength} caracteres (${path})`,
      );
    }
    if (
      typeof schema.minLength === "number" &&
      value.length < schema.minLength
    ) {
      problems.push(
        `${label(path)}: menos de ${schema.minLength} caracteres (${path})`,
      );
    }
    if (
      typeof schema.pattern === "string" &&
      !new RegExp(schema.pattern).test(value)
    ) {
      problems.push(`${label(path)}: formato inválido "${value}" (${path})`);
    }
    if (
      (schema.format === "date-time" || schema.format === "date") &&
      !DATE.test(value)
    ) {
      problems.push(`${label(path)}: data inválida "${value}" (${path})`);
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => {
      problems.push(
        ...schemaProblems(
          item,
          schema.items as JsonSchema,
          root,
          `${path}[${i}]`,
        ),
      );
    });
  }
  if (actual === "object") {
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    for (const key of (schema.required ?? []) as string[]) {
      if (object[key] === undefined || object[key] === null) {
        problems.push(
          `${label(`${path}.${key}`)}: obrigatório (${path}.${key})`,
        );
      }
    }
    for (const [key, item] of Object.entries(object)) {
      const sub = properties[key];
      if (!sub) {
        if (schema.additionalProperties === false) {
          problems.push(`${path}.${key}: campo que o leiaute não aceita`);
        }
        continue;
      }
      problems.push(...schemaProblems(item, sub, root, `${path}.${key}`));
    }
  }
  return problems;
}
