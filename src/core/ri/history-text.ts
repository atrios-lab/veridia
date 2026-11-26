/** A value of the history in plain Portuguese, never "null" or JSON. */
export function plainValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "vazio";
  if (value === true) return "sim";
  if (value === false) return "não";
  if (Array.isArray(value)) {
    return value.length === 0
      ? "vazio"
      : `${value.length} ${value.length === 1 ? "item" : "itens"}`;
  }
  if (typeof value === "object") {
    const filled = Object.values(value as Record<string, unknown>).filter(
      (v) => v !== null && v !== undefined && v !== "",
    ).length;
    return filled ? `${filled} dado(s) preenchido(s)` : "vazio";
  }
  return String(value);
}

/** The fields of the Protocolo, as the office names them. */
export const PROTOCOL_FIELD_NAMES: Record<string, string> = {
  presentedOn: "Data da apresentação",
  presenterName: "Apresentante",
  presenterDocument: "CPF/CNPJ do apresentante",
  presenterContact: "Contato do apresentante",
  titleKind: "Natureza do título",
  actsSummary: "Atos pedidos",
  propertyIds: "Matrículas",
  fast: "Prioridade (prazo reduzido)",
  reurb: "Reurb",
  qualifyBy: "Prazo da qualificação",
  prenotationEnds: "Fim da prenotação",
  fees: "Emolumentos",
  feeCents: "Valor cobrado",
  notes: "Observações",
  requirements: "Exigências",
};
