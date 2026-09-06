import { formatDate } from "../scheduling/calendar.ts";
import { displayValue, formatMoney } from "./answers.ts";
import type { Classification } from "./classification.ts";
import type { Pendency, UnknownAnswer } from "./pendencies.ts";
import {
  type Answers,
  findSection,
  type ListItem,
  list,
  multi,
  optionsOf,
  text,
} from "./sections.ts";

/**
 * The file the Átrios downloads and feeds to the document generator, outside
 * the panel. Keys follow the generator's own vocabulary (Portuguese, snake
 * case: `tit_cpf`, `rt_nome`, `sem_marca`), which is why they do not look
 * like the rest of this codebase. Values are already the words the documents
 * print: option labels, formatted money and dates, never internal codes.
 */
export interface ExportInput {
  tenantSlug: string;
  answers: Answers;
  classification: Classification | null;
  pendencies: Pendency[];
  unknowns: UnknownAnswer[];
  attachments: { displayName: string; mimeType: string; sizeBytes: number }[];
  submittedAt: string | null;
  version: number;
}

/** The option label of a stored code, or the text as typed. */
function label(answers: Answers, sectionId: string, name: string): string {
  const field = findSection(sectionId)?.fields.find((f) => f.name === name);
  if (!field) return text(answers, sectionId, name);
  return displayValue(field, answers[sectionId]?.[name], { answers });
}

/** One option's label, for a code picked out of a multi-choice answer. */
function optionLabel(sectionId: string, name: string, code: string): string {
  const field = findSection(sectionId)?.fields.find((f) => f.name === name);
  if (!field) return code;
  return (
    optionsOf(field, { answers: {} }).find((o) => o.value === code)?.label ??
    code
  );
}

function itemLabel(
  sectionId: string,
  listName: string,
  item: ListItem,
  name: string,
): string {
  const field = findSection(sectionId)
    ?.fields.find((f) => f.name === listName)
    ?.items?.find((f) => f.name === name);
  const value = item[name];
  if (!field || value === undefined) return String(value ?? "");
  return displayValue(field, value, { answers: {}, item });
}

const GENDER_WORD: Record<string, string> = {
  feminine: "feminino",
  masculine: "masculino",
};

function longDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function toGeneratorJson(input: ExportInput): Record<string, unknown> {
  const { answers, classification } = input;
  const team = list(answers, "equipe", "team");
  const titular = text(answers, "titular", "name");
  const substitute = team.find((p) => p.role === "substitute");
  const rtName = text(answers, "responsavel-tecnico", "person");
  const rt = team.find((p) => p.name === rtName);
  const dpoWho = text(answers, "encarregado", "who");
  const dpoAppointed = text(answers, "encarregado", "willAppoint") !== "no";
  const dpoName =
    dpoWho === "team"
      ? text(answers, "encarregado", "teamMember")
      : text(answers, "encarregado", "name");
  const signing = text(answers, "formalidades", "signingDate");
  const lastOrdinance = text(answers, "formalidades", "lastOrdinance");

  return {
    nome: text(answers, "serventia", "officialName"),
    nome_fantasia: text(answers, "serventia", "tradeName"),
    cns: text(answers, "serventia", "cns"),
    cnpj: text(answers, "serventia", "cnpj"),
    endereco: text(answers, "serventia", "address"),
    municipio: text(answers, "serventia", "city"),
    cep: text(answers, "serventia", "zip"),
    telefone: text(answers, "serventia", "phone"),
    ramais: text(answers, "serventia", "extensions"),
    email: text(answers, "serventia", "email"),
    atribuicoes: multi(answers, "serventia", "attributions"),
    receita_semestre: label(answers, "serventia", "revenueLastSemester"),
    receita_semestre_anterior: label(
      answers,
      "serventia",
      "revenuePreviousSemester",
    ),

    titular,
    cargo: label(answers, "titular", "role"),
    tit_genero: GENDER_WORD[text(answers, "titular", "gender")] ?? "",
    tit_nacionalidade: text(answers, "titular", "nationality"),
    tit_cpf: text(answers, "titular", "cpf"),

    classe: classification?.classe ?? null,
    subclasse: classification?.subclasse ?? null,
    prazo: classification ? formatDate(classification.stage1Deadline) : null,
    prazo_conclusao: classification
      ? formatDate(classification.completionDeadline)
      : null,

    rt_nome: rtName,
    rt_qualificacao: text(answers, "responsavel-tecnico", "qualification"),
    rt_cpf: text(answers, "responsavel-tecnico", "cpf"),
    rt_genero: GENDER_WORD[String(rt?.gender ?? "")] ?? "",

    dpo_nomeado: dpoAppointed,
    dpo_nome: dpoAppointed ? dpoName : "",
    dpo_cpf_cnpj: dpoAppointed ? text(answers, "encarregado", "document") : "",
    dpo_email: dpoAppointed ? text(answers, "encarregado", "email") : "",
    dpo_telefone: dpoAppointed ? text(answers, "encarregado", "phone") : "",

    substituto_nome: String(substitute?.name ?? ""),
    substituto_genero: GENDER_WORD[String(substitute?.gender ?? "")] ?? "",
    equipe: team.map((p) => ({
      nome: p.name,
      cargo: itemLabel("equipe", "team", p, "role"),
      genero: GENDER_WORD[String(p.gender ?? "")] ?? "",
    })),
    equipe_curta: `${team.length} ${team.length === 1 ? "pessoa" : "pessoas"}`,
    ciencia: team.map((p) => String(p.name ?? "")).filter((n) => n !== titular),
    equipamento_pessoal: label(answers, "equipe", "personalDevices"),

    sis_rcpn:
      text(answers, "sistemas", "rcpnSystem") === "other"
        ? text(answers, "sistemas", "rcpnSystemOther")
        : label(answers, "sistemas", "rcpnSystem"),
    sis_notas:
      text(answers, "sistemas", "notarySystem") === "other"
        ? text(answers, "sistemas", "notarySystemOther")
        : label(answers, "sistemas", "notarySystem"),
    sistemas: [
      label(answers, "sistemas", "rcpnSystem"),
      label(answers, "sistemas", "notarySystem"),
    ]
      .filter(Boolean)
      .join(" e "),
    hospedagem: label(answers, "sistemas", "hosting"),
    email_provedor: label(answers, "sistemas", "emailProvider"),
    portais: multi(answers, "sistemas", "portals").map((p) =>
      p === "other"
        ? text(answers, "sistemas", "portalsOther")
        : optionLabel("sistemas", "portals", p),
    ),

    inventario: inventory(answers),
    infra: list(answers, "equipamentos", "inventory")
      .map((i) => itemLabel("equipamentos", "inventory", i, "type"))
      .join(", "),

    softwares: [
      { item: "Windows", valor: label(answers, "softwares", "windows") },
      { item: "Servidor", valor: label(answers, "softwares", "serverOs") },
      { item: "Escritório", valor: label(answers, "softwares", "office") },
      {
        item: "Antivírus",
        valor: [
          text(answers, "softwares", "antivirus") === "other"
            ? text(answers, "softwares", "antivirusOther")
            : label(answers, "softwares", "antivirus"),
          label(answers, "softwares", "antivirusPaid"),
        ]
          .filter(Boolean)
          .join(", "),
      },
      { item: "Backup", valor: label(answers, "softwares", "backupSoftware") },
      { item: "Outros", valor: text(answers, "softwares", "otherSoftware") },
    ].filter((s) => s.valor),

    backup: {
      existe: label(answers, "backup", "hasBackup"),
      onde: label(answers, "backup", "locations"),
      outra_nuvem: text(answers, "backup", "otherCloud"),
      frequencia: label(answers, "backup", "frequency"),
      midia_onde: label(answers, "backup", "mediaLocation"),
      conta: label(answers, "backup", "cloudAccount"),
      restauracao: label(answers, "backup", "restoreTested"),
    },
    energia: {
      nobreak: label(answers, "energia", "hasUps"),
      nobreak_minutos: label(answers, "energia", "upsMinutes"),
      gerador: label(answers, "energia", "hasGenerator"),
      quedas: label(answers, "energia", "outageFrequency"),
      duracao: label(answers, "energia", "outageDuration"),
      queimou: label(answers, "energia", "surgeDamage"),
      aterramento: label(answers, "energia", "grounding"),
      trifasico: label(answers, "energia", "threePhase"),
    },
    rede: {
      operadora: text(answers, "internet", "provider"),
      velocidade: text(answers, "internet", "speed"),
      tipo: label(answers, "internet", "type"),
      desde: label(answers, "internet", "since"),
      valor: label(answers, "internet", "monthlyCost"),
      roteador: label(answers, "internet", "routerBrand"),
      switch: label(answers, "internet", "switchBrand"),
      reserva: label(answers, "internet", "backupLink"),
      wifi: label(answers, "internet", "wifi"),
    },
    acessos: {
      logins: label(answers, "acessos", "logins"),
      mfa: label(answers, "acessos", "mfa"),
      senha_boot: label(answers, "acessos", "bootPassword"),
      sala: label(answers, "acessos", "equipmentRoom"),
      extintor: label(answers, "acessos", "extinguisher"),
      ambiente: label(answers, "acessos", "environmentIncident"),
    },
    certificados: list(answers, "certificados", "certificates").map((c) => ({
      de: itemLabel("certificados", "certificates", c, "holder"),
      tipo: itemLabel("certificados", "certificates", c, "type"),
      certificadora: c.authority ?? "",
      emissao: itemLabel("certificados", "certificates", c, "issuedOn"),
      validade: itemLabel("certificados", "certificates", c, "validity"),
    })),
    fornecedores: list(answers, "fornecedores", "suppliers").map((s) => ({
      empresa: s.company ?? "",
      servico: s.service ?? "",
      valor: s.monthlyCost ? formatMoney(String(s.monthlyCost)) : "",
      desde: s.since ?? "",
      vigencia: itemLabel("fornecedores", "suppliers", s, "term"),
      contrato_escrito: itemLabel(
        "fornecedores",
        "suppliers",
        s,
        "writtenContract",
      ),
      acesso_dados: itemLabel("fornecedores", "suppliers", s, "dataAccess"),
    })),
    aditivo_fornecedores: label(answers, "fornecedores", "sendAddendum"),
    canais_cgj: label(answers, "corregedoria", "channels")
      .split(", ")
      .filter(Boolean),
    incidente: label(answers, "corregedoria", "hadIncident"),
    incidente_detalhe: text(answers, "corregedoria", "incidentDetails"),

    num_portaria_ultima: lastOrdinance,
    num_portaria_inicial: lastOrdinance ? "" : "001",
    data: longDate(signing),
    data_curta: /^\d{4}-\d{2}-\d{2}$/.test(signing) ? formatDate(signing) : "",
    sem_marca: text(answers, "formalidades", "branding") !== "atrios",

    pendencias: input.pendencies.map((p) => ({
      codigo: p.code,
      gravidade: p.severity,
      secao: p.sectionId,
      titulo: p.title,
      detalhe: p.detail,
    })),
    nao_sei: input.unknowns.map((u) => `${u.sectionTitle}: ${u.label}`),
    anexos: input.attachments.map((a) => ({
      nome: a.displayName,
      tipo: a.mimeType,
      bytes: a.sizeBytes,
    })),
    envio: {
      serventia: input.tenantSlug,
      versao: input.version,
      enviado_em: input.submittedAt,
    },
  };
}

function inventory(answers: Answers): Record<string, unknown> {
  const items = list(answers, "equipamentos", "inventory");
  const byType: Record<string, ListItem[]> = {};
  for (const item of items) {
    const type = String(item.type ?? "other");
    byType[type] ??= [];
    byType[type].push(item);
  }
  return {
    computadores: (byType.workstation ?? []).length,
    servidor: (byType.server ?? []).length > 0,
    nobreaks: (byType.ups ?? []).length,
    hd_externo: (byType["external-hdd"] ?? []).length > 0,
    itens: items.map((i) => ({
      tipo: itemLabel("equipamentos", "inventory", i, "type"),
      marca: i.brand ?? "",
      ano: i.year ?? "",
      uso: i.use ?? "",
      sistema: itemLabel("equipamentos", "inventory", i, "serverOs"),
      minutos: itemLabel("equipamentos", "inventory", i, "upsMinutes"),
      ligado_em: i.upsLoad ?? "",
      capacidade: i.capacity ?? "",
      local: itemLabel("equipamentos", "inventory", i, "location"),
    })),
  };
}
