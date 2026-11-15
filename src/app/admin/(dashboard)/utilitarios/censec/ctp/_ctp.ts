import schema from "@/core/censec/censec-carga.schema.json" with {
  type: "json",
};
import { schemaProblems } from "@/core/censec/schema.ts";
import {
  ctpObject,
  type OfficeForExport,
} from "@/core/titularidade/exports.ts";
import type { TitleTransfer } from "@/core/titularidade/titularidade.ts";

/**
 * What keeps an act of notas out of the Carga CTP: the CENSEC's own schema
 * (Swagger, Doi.CtpData) checked against its declaration.
 */
export function ctpPending(
  office: OfficeForExport,
  mes: string,
  t: TitleTransfer,
): string[] {
  return schemaProblems(
    ctpObject(office, mes, [t]),
    schema as Record<string, unknown>,
  ).map((p) => p.replace(/\s*\(\$[^)]*\)\s*$/, ""));
}
