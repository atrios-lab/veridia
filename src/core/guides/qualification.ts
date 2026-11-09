import type { GuideParty } from "./schema.ts";

/**
 * The party's qualification as the deed and the registry write it, from
 * the structured fields (schema.ts): Lei 6.015/1973, art. 176, § 1º, III,
 * 2, with the união estável and the e-mail of the CPC, art. 319, II. The
 * order is the notary's: name in capitals, nationality, civil status with
 * the regime, união estável, profession, documents, filiation, address,
 * e-mail, representation.
 */

const CIVIL: Record<
  NonNullable<GuideParty["civilStatus"]>,
  [feminino: string, masculino: string]
> = {
  solteiro: ["solteira", "solteiro"],
  casado: ["casada", "casado"],
  divorciado: ["divorciada", "divorciado"],
  viuvo: ["viúva", "viúvo"],
  separado: ["separada judicialmente", "separado judicialmente"],
};

export const MARRIAGE_REGIME_LABELS: Record<
  NonNullable<GuideParty["marriageRegime"]>,
  string
> = {
  "comunhao-parcial": "comunhão parcial de bens",
  "comunhao-universal": "comunhão universal de bens",
  "separacao-total": "separação total de bens",
  "separacao-obrigatoria": "separação obrigatória de bens",
  "participacao-final": "participação final nos aquestos",
};

/**
 * How the union is written in the qualification. The two declarations are
 * what the registry asks of a party who is not married (solteiro, viúvo,
 * separado, divorciado): stated "sob as penas da lei". The shorter two stay
 * for the guias issued before; "nao-informado" writes nothing.
 */
const STABLE_UNION_TEXT: Record<GuideParty["stableUnion"], string> = {
  "declara-nao-mantem":
    "que declara, sob as penas da lei, que não mantém união estável",
  "declara-mantem":
    "que declara, sob as penas da lei, que mantém união estável",
  nao: "declarante não convivente em união estável",
  sim: "convivente em união estável",
  "nao-informado": "",
};

/** The union options as the forms offer them. */
export const STABLE_UNION_LABELS: Record<GuideParty["stableUnion"], string> = {
  "declara-nao-mantem":
    "Declara, sob as penas da lei, que não mantém união estável",
  "declara-mantem": "Declara, sob as penas da lei, que mantém união estável",
  nao: "Declarante não convivente em união estável",
  sim: "Convivente em união estável",
  "nao-informado": "Não informar",
};

export const CIVIL_STATUS_LABELS: Record<
  NonNullable<GuideParty["civilStatus"]>,
  string
> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  separado: "Separado(a) judicialmente",
};

function formatTaxId(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return value.trim();
}

/** "MARIA EXEMPLO DA SILVA, brasileira, solteira, ..." */
export function qualify(party: GuideParty): string {
  const f = party.gender === "feminino";
  const g = (feminine: string, masculine: string) => (f ? feminine : masculine);
  const name = party.name.trim().toLocaleUpperCase("pt-BR");
  const parts: string[] = [];

  if (party.personType === "juridica") {
    parts.push("pessoa jurídica de direito privado");
    if (party.taxId.trim()) {
      parts.push(`inscrita no CNPJ sob o nº ${formatTaxId(party.taxId)}`);
    }
    if (party.address.trim()) parts.push(`com sede na ${party.address.trim()}`);
    if (party.email.trim()) {
      parts.push(`endereço eletrônico ${party.email.trim()}`);
    }
    if (party.representation.trim()) parts.push(party.representation.trim());
    return [name, ...parts].join(", ");
  }

  if (party.nationality.trim()) parts.push(party.nationality.trim());
  if (party.civilStatus) {
    const status = CIVIL[party.civilStatus][f ? 0 : 1];
    const regime =
      party.civilStatus === "casado" && party.marriageRegime
        ? ` sob o regime da ${MARRIAGE_REGIME_LABELS[party.marriageRegime]}`
        : "";
    const record = party.marriageRecord.trim()
      ? `, ${party.marriageRecord.trim()}`
      : "";
    parts.push(`${status}${regime}${record}`);
  }
  const union = STABLE_UNION_TEXT[party.stableUnion];
  if (union) parts.push(union);
  if (party.profession.trim()) parts.push(party.profession.trim());
  if (party.identity.trim()) {
    parts.push(
      `${g("portadora", "portador")} da Carteira de Identidade ${party.identity.trim()}`,
    );
  }
  if (party.taxId.trim()) {
    parts.push(
      `${g("inscrita", "inscrito")} no CPF sob o nº ${formatTaxId(party.taxId)}`,
    );
  }
  if (party.filiation.trim()) {
    parts.push(`${g("filha", "filho")} de ${party.filiation.trim()}`);
  }
  if (party.address.trim()) {
    parts.push(
      `${g("residente e domiciliada", "residente e domiciliado")} na ${party.address.trim()}`,
    );
  }
  if (party.email.trim())
    parts.push(`endereço eletrônico ${party.email.trim()}`);
  if (party.representation.trim()) parts.push(party.representation.trim());
  return [name, ...parts].join(", ");
}

/**
 * What the registry requires and is missing (Lei 6.015, art. 176): shown
 * to the clerk before the guia is issued, never blocking it, because a
 * guia for the fisco may go out while a document is being chased.
 */
export function missingQualification(party: GuideParty): string[] {
  const missing: string[] = [];
  if (party.personType === "juridica") {
    if (!party.taxId.trim()) missing.push("CNPJ");
    if (!party.address.trim()) missing.push("sede");
    return missing;
  }
  if (!party.nationality.trim()) missing.push("nacionalidade");
  if (!party.civilStatus) missing.push("estado civil");
  if (party.civilStatus === "casado" && !party.marriageRegime) {
    missing.push("regime de bens");
  }
  if (!party.profession.trim()) missing.push("profissão");
  if (
    !party.taxId.trim() &&
    !party.identity.trim() &&
    !party.filiation.trim()
  ) {
    missing.push("CPF, RG ou, na falta deles, a filiação");
  }
  if (!party.address.trim()) missing.push("domicílio");
  return missing;
}
