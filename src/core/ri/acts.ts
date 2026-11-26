/**
 * The atos of a matrícula and what they leave in force (the "situação
 * jurídica atual" of CNN art. 125: description, titularidade and the ônus
 * not cancelled). Pure: the database hands the atos in, the screens and the
 * indicators read the result.
 *
 * Numbering (Lei nº 6.015/1973, art. 232): registros take "R", averbações
 * "AV", then the order number of the lançamento and the matrícula's, one
 * sequence for both: R-1-1.234, AV-2-1.234, R-3-1.234.
 */

/**
 * "M": the situação as it stood when the matrícula came into the system
 * (the migration of the acervo, CNN art. 336). It is not a lançamento of
 * the ficha: order number 0, never printed as R or AV.
 */
export type ActKind = "R" | "AV" | "M";

/** What an ato does to the matrícula's situação. */
export type ActEffect =
  | "titularidade"
  | "transmissao"
  | "onus"
  | "cancelamento"
  | "descricao"
  | "encerramento"
  | "outro";

export const ACT_EFFECT_LABELS: Record<ActEffect, string> = {
  titularidade: "Define quem são os proprietários (abertura ou atualização)",
  transmissao:
    "Transmite a propriedade (entra o adquirente, sai o transmitente)",
  onus: "Cria um ônus ou gravame (hipoteca, alienação fiduciária, penhora…)",
  cancelamento: "Cancela um ato anterior (baixa do ônus)",
  descricao: "Altera a descrição do imóvel",
  encerramento: "Encerra a matrícula",
  outro: "Outra averbação (sem mudar dono nem ônus)",
};

export type PartyRole =
  | "titular"
  | "adquirente"
  | "transmitente"
  | "credor"
  | "devedor"
  | "outro";

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  titular: "Proprietário",
  adquirente: "Adquirente",
  transmitente: "Transmitente",
  credor: "Credor",
  devedor: "Devedor",
  outro: "Outra parte",
};

/** The roles that make sense for each effect, the first one the default. */
export const ROLES_BY_EFFECT: Record<ActEffect, PartyRole[]> = {
  titularidade: ["titular"],
  transmissao: ["adquirente", "transmitente"],
  onus: ["credor", "devedor", "outro"],
  cancelamento: ["credor", "devedor", "outro"],
  descricao: ["titular", "outro"],
  encerramento: ["outro"],
  outro: ["titular", "outro"],
};

/**
 * The natures the office writes most, with the kind and effect suggested.
 * A suggestion only: the registrador decides the kind of each lançamento.
 */
/**
 * The averbações at the margin of a registro of the Livro 3 (a cédula, a
 * penhor, a pacto): what changes the título, who holds the crédito, and
 * its baixa (Lei nº 6.015/1973, art. 250).
 */
export const AUX_ACT_NATURES: readonly {
  name: string;
  kind: ActKind;
  effect: ActEffect;
}[] = [
  { name: "Aditivo (aditamento) do título", kind: "AV", effect: "outro" },
  { name: "Endosso ou cessão do crédito", kind: "AV", effect: "outro" },
  { name: "Prorrogação do vencimento", kind: "AV", effect: "outro" },
  { name: "Substituição ou reforço de garantia", kind: "AV", effect: "outro" },
  {
    name: "Alteração de nome ou estado civil das partes",
    kind: "AV",
    effect: "outro",
  },
  {
    name: "Quitação e cancelamento (baixa) do registro",
    kind: "AV",
    effect: "encerramento",
  },
  {
    name: "Cancelamento por ordem judicial",
    kind: "AV",
    effect: "encerramento",
  },
];

export const ACT_NATURES: readonly {
  name: string;
  kind: ActKind;
  effect: ActEffect;
}[] = [
  { name: "Abertura de matrícula", kind: "AV", effect: "titularidade" },
  { name: "Compra e venda", kind: "R", effect: "transmissao" },
  { name: "Doação", kind: "R", effect: "transmissao" },
  { name: "Permuta", kind: "R", effect: "transmissao" },
  {
    name: "Partilha (inventário ou divórcio)",
    kind: "R",
    effect: "transmissao",
  },
  { name: "Adjudicação", kind: "R", effect: "transmissao" },
  { name: "Arrematação", kind: "R", effect: "transmissao" },
  { name: "Usucapião", kind: "R", effect: "transmissao" },
  { name: "Dação em pagamento", kind: "R", effect: "transmissao" },
  { name: "Integralização de capital", kind: "R", effect: "transmissao" },
  {
    name: "Consolidação da propriedade fiduciária",
    kind: "AV",
    effect: "transmissao",
  },
  { name: "Hipoteca", kind: "R", effect: "onus" },
  { name: "Alienação fiduciária", kind: "R", effect: "onus" },
  { name: "Cédula de crédito", kind: "R", effect: "onus" },
  { name: "Penhora", kind: "R", effect: "onus" },
  { name: "Usufruto", kind: "R", effect: "onus" },
  { name: "Servidão", kind: "R", effect: "onus" },
  { name: "Indisponibilidade", kind: "AV", effect: "onus" },
  { name: "Cancelamento", kind: "AV", effect: "cancelamento" },
  { name: "Construção", kind: "AV", effect: "descricao" },
  { name: "Retificação de área", kind: "AV", effect: "descricao" },
  { name: "Georreferenciamento", kind: "AV", effect: "descricao" },
  { name: "Desmembramento", kind: "AV", effect: "descricao" },
  { name: "Casamento ou alteração de nome", kind: "AV", effect: "outro" },
  { name: "CCIR, CAR ou ITR", kind: "AV", effect: "outro" },
  { name: "Encerramento da matrícula", kind: "AV", effect: "encerramento" },
];

export interface ActParty {
  personId: string;
  name: string;
  document: string;
  role: PartyRole;
  share: string;
}

export interface Act {
  id: string;
  seq: number;
  kind: ActKind;
  effect: ActEffect;
  nature: string;
  registeredOn: string | null;
  summary: string;
  /** The ato this one cancels (effect "cancelamento"). */
  cancelsActId: string | null;
  parties: ActParty[];
  /** The protocolo (Livro 1), the selo and the value, as lançados. */
  protocol?: string;
  seal?: string;
  valueCents?: number | null;
}

/** "R-3-1.234": the lançamento as art. 232 writes it. */
export function actLabel(
  act: Pick<Act, "kind" | "seq">,
  matricula?: number,
): string {
  if (act.kind === "M") return "Situação na migração";
  const base = `${act.kind}-${act.seq}`;
  return matricula === undefined
    ? base
    : `${base}-${matricula.toLocaleString("pt-BR")}`;
}

/**
 * The next order number: one sequence for R and AV (art. 232), after the
 * lançamentos the ficha already had before the system (`prior`).
 */
export function nextSeq(acts: readonly Pick<Act, "seq">[], prior = 0): number {
  return acts.reduce((max, act) => Math.max(max, act.seq), prior) + 1;
}

export interface Owner {
  personId: string;
  name: string;
  document: string;
  share: string;
  /** The ato that made them owner. */
  since: string;
}

export interface Burden {
  actId: string;
  label: string;
  nature: string;
  registeredOn: string | null;
  parties: ActParty[];
}

export interface Situation {
  owners: Owner[];
  burdens: Burden[];
  cancelledBurdens: (Burden & { cancelledBy: string })[];
  closed: boolean;
  /** The last ato, as the index shows it ("R-7 Compra e venda"). */
  lastAct: string | null;
}

/**
 * What the atos leave in force, read in their order. A transmissão without
 * transmitente takes the whole property; with transmitentes, only theirs
 * leaves (a partial alienation).
 */
export function situationOf(acts: readonly Act[]): Situation {
  const ordered = [...acts].sort((a, b) => a.seq - b.seq);
  let owners: Owner[] = [];
  const burdens = new Map<string, Burden>();
  const cancelled: (Burden & { cancelledBy: string })[] = [];
  let closed = false;
  for (const act of ordered) {
    const label = actLabel(act);
    const take = (role: PartyRole) =>
      act.parties.filter((party) => party.role === role);
    if (act.effect === "titularidade") {
      owners = take("titular").map((party) => ({
        personId: party.personId,
        name: party.name,
        document: party.document,
        share: party.share,
        since: label,
      }));
    } else if (act.effect === "transmissao") {
      const leaving = new Set(take("transmitente").map((p) => p.personId));
      const kept =
        leaving.size === 0
          ? []
          : owners.filter((owner) => !leaving.has(owner.personId));
      const arriving = take("adquirente").map((party) => ({
        personId: party.personId,
        name: party.name,
        document: party.document,
        share: party.share,
        since: label,
      }));
      const arrivingIds = new Set(arriving.map((owner) => owner.personId));
      owners = [
        ...kept.filter((owner) => !arrivingIds.has(owner.personId)),
        ...arriving,
      ];
    } else if (act.effect === "onus") {
      burdens.set(act.id, {
        actId: act.id,
        label,
        nature: act.nature,
        registeredOn: act.registeredOn,
        parties: act.parties,
      });
    } else if (act.effect === "cancelamento" && act.cancelsActId) {
      const target = burdens.get(act.cancelsActId);
      if (target) {
        burdens.delete(act.cancelsActId);
        cancelled.push({ ...target, cancelledBy: label });
      }
    } else if (act.effect === "encerramento") {
      closed = true;
    }
  }
  const last = ordered.at(-1);
  return {
    owners,
    burdens: [...burdens.values()],
    cancelledBurdens: cancelled,
    closed,
    lastAct: last ? `${actLabel(last)} ${last.nature}`.trim() : null,
  };
}

/** Which atos a cancelamento can point to: the ônus still in force. */
export function cancellable(acts: readonly Act[]): Burden[] {
  return situationOf(acts).burdens;
}
