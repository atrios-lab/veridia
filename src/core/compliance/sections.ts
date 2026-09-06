import { ATTRIBUTIONS, type Attribution } from "../tenant/schema.ts";

/**
 * The seventeen sections of the Provimento intake, as data.
 *
 * One renderer reads this list and draws every screen; there is no component
 * per section. The alternative, seventeen hand-written forms, is seventeen
 * places for the autosave, the "não sei" option and the help text to drift
 * apart. Everything the office sees is in Portuguese here; the identifiers
 * (`name`, option `value`) are the keys the answers are stored under and the
 * generator reads, so they stay stable and in English.
 *
 * Conditions (`showWhen`, `options`, `defaultValue`) are functions of the
 * answers so far: a question about the generator's autonomy only exists once
 * the office said it has a generator. Pure over the answers, never over I/O.
 */

/** A stored value: text, one choice, several choices, or a repeatable list. */
export type Value = string | string[] | ListItem[];
export type ListItem = Record<string, string | string[]>;
/** answers[sectionId][fieldName] */
export type Answers = Record<string, Record<string, Value>>;

export type FieldType =
  | "text"
  | "email"
  | "number"
  | "money"
  | "date"
  | "textarea"
  | "choice"
  | "multi"
  | "list";

export interface Option {
  value: string;
  label: string;
}

export interface FieldContext {
  answers: Answers;
  /** The item this field belongs to, when it sits inside a list. */
  item?: ListItem;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Why the question exists and where to find the answer. */
  help?: string;
  placeholder?: string;
  options?: readonly Option[] | ((ctx: FieldContext) => Option[]);
  /** Offers "Não sei" as an answer. On text fields it is a checkbox. */
  unknown?: boolean | string;
  showWhen?: (ctx: FieldContext) => boolean;
  /** What the field starts with when the office has not answered it yet. */
  defaultValue?: (ctx: FieldContext) => Value | undefined;
  /** For `list`: the fields of each item, and what one item is called. */
  items?: readonly FieldDef[];
  itemLabel?: string;
}

export interface SectionDef {
  /** URL slug and answers key. */
  id: string;
  number: number;
  /** Short name for the list and the header. */
  title: string;
  /** The question the screen asks, in the office's own words. */
  question: string;
  intro?: string;
  /** True when the panel already knows the answers and the office confirms. */
  prefilled?: boolean;
  fields: readonly FieldDef[];
}

export const UNKNOWN = "unknown";

export const YES_NO: readonly Option[] = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
];
const YES_NO_UNKNOWN: readonly Option[] = [
  ...YES_NO,
  { value: UNKNOWN, label: "Não sei" },
];

export const ATTRIBUTION_OPTIONS: readonly Option[] = [
  { value: "RCPN", label: "Registro civil das pessoas naturais" },
  { value: "NOTAS", label: "Notas" },
  { value: "RI", label: "Registro de imóveis" },
  { value: "PROTESTO", label: "Protesto" },
  { value: "RTD", label: "Títulos e documentos" },
  { value: "RCPJ", label: "Pessoas jurídicas" },
];

export const TEAM_ROLES: readonly Option[] = [
  { value: "owner", label: "Titular" },
  { value: "substitute", label: "Substituto ou substituta" },
  { value: "clerk", label: "Escrevente autorizado ou autorizada" },
  { value: "assistant", label: "Auxiliar" },
  { value: "intern", label: "Estagiário ou estagiária" },
  { value: "other", label: "Outro" },
];

export const GENDER_OPTIONS: readonly Option[] = [
  { value: "feminine", label: "Feminino" },
  { value: "masculine", label: "Masculino" },
];

export const EQUIPMENT_TYPES: readonly Option[] = [
  { value: "workstation", label: "Computador (estação)" },
  { value: "server", label: "Servidor" },
  { value: "router", label: "Roteador" },
  { value: "switch", label: "Switch" },
  { value: "ups", label: "Nobreak" },
  { value: "external-hdd", label: "HD externo" },
  { value: "printer", label: "Impressora" },
  { value: "label-printer", label: "Impressora de etiquetas" },
  { value: "scanner", label: "Scanner" },
  { value: "biometric-reader", label: "Leitor biométrico" },
  { value: "webcam", label: "Webcam" },
  { value: "landline", label: "Telefone fixo" },
  { value: "token", label: "Token ou cartão de certificado" },
  { value: "other", label: "Outro" },
];

const PORTAL_OPTIONS: readonly Option[] = [
  { value: "crc", label: "CRC e Meu Registro Civil" },
  { value: "sirc", label: "SIRC" },
  { value: "e-notariado", label: "e-Notariado" },
  { value: "censec", label: "CENSEC" },
  { value: "cenprot", label: "CENPROT" },
  { value: "onr", label: "ONR/SREI" },
  { value: "rtdpj", label: "RTDPJ" },
  { value: "selo-tjrn", label: "Selo digital do TJRN" },
  { value: "doi", label: "DOI" },
  { value: "justica-aberta", label: "Justiça Aberta" },
  { value: "malote", label: "Malote Digital" },
  { value: "sigajus", label: "SIGAJUS" },
  { value: "other", label: "Outras" },
];

const PORTALS_BY_ATTRIBUTION: Record<Attribution, string[]> = {
  RCPN: ["crc", "sirc"],
  NOTAS: ["e-notariado", "censec"],
  RI: ["onr", "doi"],
  PROTESTO: ["cenprot"],
  RTD: ["rtdpj"],
  RCPJ: ["rtdpj"],
};
const PORTALS_FOR_ALL = ["selo-tjrn", "justica-aberta", "malote", "sigajus"];

// Declared before SECTIONS: the array literal below reads it at module load.
const UPS_MINUTES: readonly Option[] = [
  { value: "under-15", label: "Menos de 15" },
  { value: "15-30", label: "De 15 a 30" },
  { value: "30-plus", label: "30 ou mais" },
  { value: UNKNOWN, label: "Não sei" },
];

const NOTARY_ATTRIBUTIONS: Attribution[] = [
  "NOTAS",
  "RI",
  "PROTESTO",
  "RTD",
  "RCPJ",
];

export function answer(
  answers: Answers,
  sectionId: string,
  name: string,
): Value | undefined {
  return answers[sectionId]?.[name];
}

export function text(
  answers: Answers,
  sectionId: string,
  name: string,
): string {
  const value = answer(answers, sectionId, name);
  return typeof value === "string" ? value : "";
}

export function list(
  answers: Answers,
  sectionId: string,
  name: string,
): ListItem[] {
  const value = answer(answers, sectionId, name);
  return Array.isArray(value) && value.every((v) => typeof v === "object")
    ? (value as ListItem[])
    : [];
}

export function multi(
  answers: Answers,
  sectionId: string,
  name: string,
): string[] {
  const value = answer(answers, sectionId, name);
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? (value as string[])
    : [];
}

function attributions(answers: Answers): Attribution[] {
  return multi(answers, "serventia", "attributions").filter(
    (a): a is Attribution => (ATTRIBUTIONS as readonly string[]).includes(a),
  );
}

/** Everyone listed in Seção 3, as options for the fields that pick a person. */
export function teamOptions(ctx: FieldContext): Option[] {
  return list(ctx.answers, "equipe", "team")
    .map((person) => String(person.name ?? "").trim())
    .filter(Boolean)
    .map((name) => ({ value: name, label: name }));
}

export function hasEquipment(answers: Answers, type: string): boolean {
  return list(answers, "equipamentos", "inventory").some(
    (item) => item.type === type,
  );
}

/**
 * "escrevente autorizada, devidamente nomeada": how the ordinance describes
 * the technical lead, from their role and gender in Seção 3.
 */
export function qualificationFor(role: string, gender: string): string {
  const f = gender === "feminine";
  switch (role) {
    case "owner":
      return f ? "titular da serventia" : "titular da serventia";
    case "substitute":
      return f
        ? "substituta legal, devidamente designada"
        : "substituto legal, devidamente designado";
    case "clerk":
      return f
        ? "escrevente autorizada, devidamente nomeada"
        : "escrevente autorizado, devidamente nomeado";
    case "assistant":
      return f ? "auxiliar da serventia" : "auxiliar da serventia";
    case "intern":
      return f ? "estagiária da serventia" : "estagiário da serventia";
    default:
      return "colaborador da serventia";
  }
}

function person(answers: Answers, name: string): ListItem | undefined {
  return list(answers, "equipe", "team").find((p) => p.name === name);
}

export const SECTIONS: readonly SectionDef[] = [
  {
    id: "serventia",
    number: 1,
    title: "Serventia",
    question: "Confira os dados da serventia",
    intro:
      "Estes dados vieram das Configurações do painel. Corrija o que estiver diferente e informe o que falta.",
    prefilled: true,
    fields: [
      {
        name: "officialName",
        label: "Nome oficial da serventia",
        type: "text",
        required: true,
        help: "Como consta no Justiça Aberta (ex.: Ofício Único de Bom Jesus).",
      },
      {
        name: "tradeName",
        label: "Nome fantasia",
        type: "text",
        help: "Se usar outro nome no dia a dia (ex.: Cartório Marinho).",
      },
      {
        name: "cns",
        label: "CNS",
        type: "text",
        required: true,
        help: "Código Nacional da Serventia, seis dígitos. Está no Justiça Aberta.",
      },
      {
        name: "cnpj",
        label: "CNPJ",
        type: "text",
        required: true,
        help: "O da serventia, não o da titular.",
        placeholder: "00.000.000/0000-00",
      },
      {
        name: "address",
        label: "Endereço completo",
        type: "text",
        required: true,
        help: "Rua, número e bairro.",
      },
      {
        name: "city",
        label: "Município e UF",
        type: "text",
        required: true,
      },
      { name: "zip", label: "CEP", type: "text", required: true },
      {
        name: "phone",
        label: "Telefone principal",
        type: "text",
        required: true,
      },
      {
        name: "extensions",
        label: "Tem ramais? Quais?",
        type: "text",
        help: "Ex.: ramal 1 geral, ramal 2 tabeliã.",
      },
      {
        name: "email",
        label: "E-mail institucional",
        type: "email",
        required: true,
        help: "O que a serventia usa hoje.",
      },
      {
        name: "attributions",
        label: "Atribuições",
        type: "multi",
        required: true,
        options: ATTRIBUTION_OPTIONS,
      },
      {
        name: "revenueLastSemester",
        label: "Receita bruta do último semestre (R$)",
        type: "money",
        required: true,
        help: "Emolumentos mais outras receitas, sem descontar despesas. Define a classe da serventia (art. 16 do Provimento 243).",
      },
      {
        name: "revenuePreviousSemester",
        label: "Receita bruta do semestre anterior (R$)",
        type: "money",
      },
    ],
  },
  {
    id: "titular",
    number: 2,
    title: "Titular",
    question: "Quem é a titular ou o titular da serventia?",
    prefilled: true,
    fields: [
      {
        name: "name",
        label: "Nome completo",
        type: "text",
        required: true,
        help: "Como consta nos documentos.",
      },
      {
        name: "cpf",
        label: "CPF",
        type: "text",
        required: true,
        placeholder: "000.000.000-00",
      },
      {
        name: "gender",
        label: "Gênero para os documentos",
        type: "choice",
        required: true,
        options: GENDER_OPTIONS,
        help: 'Define "Tabeliã" ou "Tabelião", "controladora" ou "controlador" nos documentos.',
      },
      {
        name: "role",
        label: "Cargo",
        type: "choice",
        required: true,
        options: ({ answers }) => {
          const f = text(answers, "titular", "gender") === "feminine";
          return [
            {
              value: "notary-and-registrar",
              label: f
                ? "Tabeliã e Oficiala de Registro"
                : "Tabelião e Oficial de Registro",
            },
            { value: "notary", label: f ? "Tabeliã" : "Tabelião" },
            {
              value: "registrar",
              label: f ? "Oficiala de Registro" : "Oficial de Registro",
            },
            { value: "interim", label: f ? "Interina" : "Interino" },
            { value: "intervenor", label: f ? "Interventora" : "Interventor" },
          ];
        },
      },
      {
        name: "nationality",
        label: "Nacionalidade",
        type: "text",
        required: true,
        defaultValue: ({ answers }) =>
          text(answers, "titular", "gender") === "masculine"
            ? "brasileiro"
            : "brasileira",
      },
    ],
  },
  {
    id: "equipe",
    number: 3,
    title: "Equipe",
    question: "Quem trabalha na serventia?",
    intro:
      "Inclua a titular. Os nomes vão para os termos de ciência da política de segurança.",
    fields: [
      {
        name: "team",
        label: "Pessoas da serventia",
        type: "list",
        required: true,
        itemLabel: "pessoa",
        defaultValue: ({ answers }) => {
          const name = text(answers, "titular", "name");
          if (!name) return undefined;
          return [
            {
              name,
              role: "owner",
              gender: text(answers, "titular", "gender"),
            },
          ];
        },
        items: [
          {
            name: "name",
            label: "Nome completo",
            type: "text",
            required: true,
          },
          {
            name: "role",
            label: "Cargo",
            type: "choice",
            required: true,
            options: TEAM_ROLES,
          },
          {
            name: "gender",
            label: "Gênero para os documentos",
            type: "choice",
            required: true,
            options: GENDER_OPTIONS,
          },
        ],
      },
      {
        name: "personalDevices",
        label:
          "Alguém usa computador ou celular pessoal para o trabalho do cartório?",
        type: "choice",
        required: true,
        options: YES_NO,
        help: "Se sim, o documento registra a vedação e a providência. Não tem problema responder sim.",
      },
    ],
  },
  {
    id: "responsavel-tecnico",
    number: 4,
    title: "Responsável técnico",
    question: "Quem vai acompanhar a parte técnica?",
    intro:
      "É a pessoa da serventia que vai acompanhar a parte técnica e guardar as evidências. Não precisa ser técnico. Pode ser o substituto, um escrevente ou a própria titular.",
    fields: [
      {
        name: "person",
        label: "Quem será o responsável técnico?",
        type: "choice",
        required: true,
        options: teamOptions,
        help: "A lista vem da Seção 3. Se a pessoa não estiver aqui, inclua lá primeiro.",
      },
      {
        name: "cpf",
        label: "CPF",
        type: "text",
        required: true,
        placeholder: "000.000.000-00",
        defaultValue: ({ answers }) =>
          text(answers, "responsavel-tecnico", "person") ===
          text(answers, "titular", "name")
            ? text(answers, "titular", "cpf")
            : undefined,
      },
      {
        name: "qualification",
        label: "Como descrever a função na portaria",
        type: "text",
        required: true,
        help: "Ex.: escrevente autorizada, devidamente nomeada. Sugerimos pelo cargo da Seção 3; ajuste se quiser.",
        defaultValue: ({ answers }) => {
          const chosen = person(
            answers,
            text(answers, "responsavel-tecnico", "person"),
          );
          if (!chosen) return undefined;
          return qualificationFor(
            String(chosen.role ?? ""),
            String(chosen.gender ?? ""),
          );
        },
      },
    ],
  },
  {
    id: "encarregado",
    number: 5,
    title: "Encarregado de dados",
    question: "Quem responde pela proteção de dados?",
    intro:
      "Para a Classe 1 a nomeação é opcional (Provimento 214). Recomendamos nomear mesmo assim. Pode ser alguém da serventia ou a Átrios (Agente DPO). O contato atual veio da aba Encarregado das Configurações.",
    prefilled: true,
    fields: [
      {
        name: "willAppoint",
        label: "Vai nomear encarregado?",
        type: "choice",
        required: true,
        options: YES_NO,
        help: "Aparece só para a Classe 1. Para as Classes 2 e 3 a nomeação é obrigatória.",
        showWhen: ({ answers }) => isClassOne(answers),
        defaultValue: () => "yes",
      },
      {
        name: "who",
        label: "Quem?",
        type: "choice",
        required: true,
        options: [
          { value: "team", label: "Uma pessoa da serventia" },
          { value: "atrios", label: "A Átrios (Agente DPO)" },
          { value: "other", label: "Outra pessoa ou empresa" },
        ],
        showWhen: appointsDpo,
      },
      {
        name: "teamMember",
        label: "Qual pessoa?",
        type: "choice",
        required: true,
        options: teamOptions,
        showWhen: (ctx) =>
          appointsDpo(ctx) &&
          text(ctx.answers, "encarregado", "who") === "team",
      },
      {
        name: "name",
        label: "Nome completo ou razão social",
        type: "text",
        required: true,
        showWhen: (ctx) =>
          appointsDpo(ctx) &&
          text(ctx.answers, "encarregado", "who") === "other",
      },
      {
        name: "document",
        label: "CPF ou CNPJ",
        type: "text",
        required: true,
        showWhen: (ctx) =>
          appointsDpo(ctx) &&
          text(ctx.answers, "encarregado", "who") !== "atrios",
      },
      {
        name: "email",
        label: "E-mail do encarregado",
        type: "email",
        required: true,
        help: "Será publicado no site. Sugerimos dpo@ no domínio novo da serventia.",
        showWhen: appointsDpo,
      },
      {
        name: "phone",
        label: "Telefone do encarregado",
        type: "text",
        required: true,
        showWhen: appointsDpo,
        defaultValue: ({ answers }) => text(answers, "serventia", "phone"),
      },
    ],
  },
  {
    id: "sistemas",
    number: 6,
    title: "Sistemas",
    question: "Que sistemas o cartório usa?",
    fields: [
      {
        name: "rcpnSystem",
        label: "Sistema do registro civil",
        type: "choice",
        required: true,
        options: [
          { value: "cartosoft", label: "Cartosoft" },
          { value: "other", label: "Outro" },
          { value: "none", label: "Não usa sistema para isso" },
        ],
        showWhen: ({ answers }) => attributions(answers).includes("RCPN"),
      },
      {
        name: "rcpnSystemOther",
        label: "Qual sistema do registro civil?",
        type: "text",
        required: true,
        showWhen: ({ answers }) =>
          text(answers, "sistemas", "rcpnSystem") === "other",
      },
      {
        name: "notarySystem",
        label:
          "Sistema de notas, imóveis, protesto, títulos e pessoas jurídicas",
        type: "choice",
        required: true,
        options: [
          { value: "notaris", label: "Notaris" },
          { value: "other", label: "Outro" },
          { value: "none", label: "Não usa sistema para isso" },
        ],
        showWhen: ({ answers }) =>
          attributions(answers).some((a) => NOTARY_ATTRIBUTIONS.includes(a)),
      },
      {
        name: "notarySystemOther",
        label: "Qual sistema?",
        type: "text",
        required: true,
        showWhen: ({ answers }) =>
          text(answers, "sistemas", "notarySystem") === "other",
      },
      {
        name: "hosting",
        label: "Esses sistemas rodam onde?",
        type: "choice",
        required: true,
        options: [
          {
            value: "vendor-cloud",
            label: "Na nuvem do fornecedor (acessa pelo navegador)",
          },
          {
            value: "local-server",
            label: "Instalado no servidor do cartório",
          },
          { value: UNKNOWN, label: "Não sei" },
        ],
        help: "Muda toda a análise de risco: com o sistema na nuvem, o risco principal passa a ser a internet e o fornecedor.",
      },
      {
        name: "emailProvider",
        label: "E-mail que usa hoje",
        type: "choice",
        required: true,
        options: [
          { value: "gmail", label: "Gmail" },
          { value: "outlook", label: "Outlook ou Hotmail" },
          { value: "own-domain", label: "Domínio próprio" },
          { value: "other", label: "Outro" },
        ],
      },
      {
        name: "portals",
        label: "Centrais e portais que usa",
        type: "multi",
        required: true,
        options: PORTAL_OPTIONS,
        help: "Já marcamos os que costumam acompanhar as atribuições da serventia. Desmarque o que não usa.",
        defaultValue: ({ answers }) => {
          const attrs = attributions(answers);
          if (attrs.length === 0) return undefined;
          return [
            ...new Set([
              ...attrs.flatMap((a) => PORTALS_BY_ATTRIBUTION[a]),
              ...PORTALS_FOR_ALL,
            ]),
          ];
        },
      },
      {
        name: "portalsOther",
        label: "Quais outras?",
        type: "text",
        showWhen: ({ answers }) =>
          multi(answers, "sistemas", "portals").includes("other"),
      },
    ],
  },
  {
    id: "equipamentos",
    number: 7,
    title: "Equipamentos",
    question: "Que equipamentos existem na serventia?",
    intro:
      "Um bloco por equipamento, inclusive um por computador. Se não souber marca ou ano, deixe em branco. Pode mandar foto da etiqueta na Seção 17.",
    fields: [
      {
        name: "inventory",
        label: "Inventário",
        type: "list",
        required: true,
        itemLabel: "equipamento",
        items: [
          {
            name: "type",
            label: "Tipo",
            type: "choice",
            required: true,
            options: EQUIPMENT_TYPES,
          },
          { name: "brand", label: "Marca e modelo", type: "text" },
          { name: "year", label: "Ano aproximado de compra", type: "text" },
          { name: "use", label: "Quem usa ou para que serve", type: "text" },
          {
            name: "serverOs",
            label: "Sistema do servidor",
            type: "choice",
            options: [
              { value: "windows-server", label: "Windows Server" },
              { value: "windows", label: "Windows comum" },
              { value: "linux", label: "Linux" },
              { value: UNKNOWN, label: "Não sei" },
            ],
            showWhen: ({ item }) => item?.type === "server",
          },
          {
            name: "upsMinutes",
            label: "Quantos minutos o nobreak segura?",
            type: "choice",
            options: UPS_MINUTES,
            showWhen: ({ item }) => item?.type === "ups",
          },
          {
            name: "upsLoad",
            label: "Ligado em quê?",
            type: "text",
            placeholder: "Ex.: servidor e roteador",
            showWhen: ({ item }) => item?.type === "ups",
          },
          {
            name: "capacity",
            label: "Capacidade",
            type: "text",
            placeholder: "Ex.: 2 TB",
            showWhen: ({ item }) => item?.type === "external-hdd",
          },
          {
            name: "location",
            label: "Fica dentro ou fora da serventia?",
            type: "choice",
            options: [
              { value: "inside", label: "Dentro da serventia" },
              { value: "outside", label: "Fora da serventia (o ideal)" },
            ],
            showWhen: ({ item }) => item?.type === "external-hdd",
          },
        ],
      },
    ],
  },
  {
    id: "softwares",
    number: 8,
    title: "Softwares e licenças",
    question: "Que programas os computadores usam?",
    fields: [
      {
        name: "windows",
        label: "Qual Windows os computadores usam?",
        type: "choice",
        required: true,
        options: [
          { value: "windows-11", label: "Windows 11" },
          { value: "windows-10", label: "Windows 10" },
          { value: "older", label: "Mais antigo" },
          { value: UNKNOWN, label: "Não sei" },
        ],
        help: 'Clique com o botão direito em "Este Computador" e depois em "Propriedades", ou mande um print da tela "Sobre" na Seção 17. O Windows 10 está sem suporte desde 14/10/2025.',
      },
      {
        name: "serverOs",
        label: "Qual Windows o servidor usa?",
        type: "choice",
        required: true,
        options: [
          { value: "windows-server", label: "Windows Server" },
          { value: "windows", label: "Windows comum" },
          { value: "linux", label: "Linux" },
          { value: UNKNOWN, label: "Não sei" },
        ],
        showWhen: ({ answers }) => hasEquipment(answers, "server"),
      },
      {
        name: "serverOsVersion",
        label: "Qual versão do Windows Server?",
        type: "text",
        placeholder: "Ex.: 2019",
        showWhen: ({ answers }) =>
          text(answers, "softwares", "serverOs") === "windows-server",
      },
      {
        name: "office",
        label: "Qual pacote de escritório (Word, Excel)?",
        type: "choice",
        required: true,
        options: [
          { value: "m365", label: "Microsoft 365" },
          { value: "office-2021", label: "Office 2021 ou 2024" },
          { value: "office-2016", label: "Office 2016 ou 2019" },
          { value: "office-2013", label: "Office 2013 ou anterior" },
          { value: "libreoffice", label: "LibreOffice" },
          { value: UNKNOWN, label: "Não sei" },
        ],
        help: "Abra o Word, vá em Arquivo e depois em Conta: a versão aparece à direita. Office 2013 ou anterior está sem suporte.",
      },
      {
        name: "antivirus",
        label: "Qual antivírus está instalado?",
        type: "choice",
        required: true,
        options: [
          { value: "kaspersky", label: "Kaspersky" },
          { value: "defender", label: "Windows Defender" },
          { value: "other", label: "Outro" },
          { value: "none", label: "Nenhum" },
        ],
        help: "Procure o ícone perto do relógio, no canto inferior direito da tela.",
      },
      {
        name: "antivirusOther",
        label: "Qual antivírus?",
        type: "text",
        required: true,
        showWhen: ({ answers }) =>
          text(answers, "softwares", "antivirus") === "other",
      },
      {
        name: "antivirusPaid",
        label: "O antivírus é pago ou gratuito?",
        type: "choice",
        required: true,
        options: [
          { value: "paid", label: "Pago" },
          { value: "free", label: "Gratuito" },
        ],
        showWhen: ({ answers }) =>
          ["kaspersky", "other"].includes(
            text(answers, "softwares", "antivirus"),
          ),
      },
      {
        name: "backupSoftware",
        label: "Programa de backup",
        type: "text",
        unknown: true,
        placeholder: "Ex.: Cobian, Duplicati, o do Cartosoft",
      },
      {
        name: "otherSoftware",
        label: "Outros programas instalados",
        type: "textarea",
        placeholder: "Ex.: Adobe Reader, AnyDesk, Chrome",
      },
    ],
  },
  {
    id: "backup",
    number: 9,
    title: "Backup",
    question: "Existe cópia de segurança dos dados?",
    fields: [
      {
        name: "hasBackup",
        label: "Existe cópia de segurança?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
      {
        name: "locations",
        label: "Onde fica a cópia?",
        type: "multi",
        required: true,
        options: [
          { value: "google-drive", label: "Google Drive" },
          { value: "onedrive", label: "OneDrive" },
          { value: "dropbox", label: "Dropbox" },
          { value: "other-cloud", label: "Outra nuvem" },
          { value: "external-hdd", label: "HD externo" },
          { value: "pendrive", label: "Pen drive" },
          { value: "other-server", label: "Outro servidor" },
          { value: UNKNOWN, label: "Não sei" },
        ],
        showWhen: hasBackup,
      },
      {
        name: "otherCloud",
        label: "Qual nuvem?",
        type: "text",
        showWhen: (ctx) =>
          hasBackup(ctx) &&
          multi(ctx.answers, "backup", "locations").includes("other-cloud"),
      },
      {
        name: "frequency",
        label: "Com que frequência?",
        type: "choice",
        required: true,
        options: [
          { value: "daily", label: "Todo dia" },
          { value: "weekly", label: "Toda semana" },
          { value: "monthly", label: "Todo mês" },
          { value: "irregular", label: "Quando lembra" },
          { value: "automatic", label: "Automática, não sei a frequência" },
        ],
        showWhen: hasBackup,
      },
      {
        name: "mediaLocation",
        label: "O HD ou pen drive fica onde?",
        type: "choice",
        required: true,
        options: [
          { value: "inside", label: "Dentro da serventia" },
          { value: "outside", label: "Fora da serventia" },
        ],
        help: "Fora da serventia é o ideal: um incêndio ou furto não leva o original e a cópia juntos.",
        showWhen: (ctx) =>
          hasBackup(ctx) &&
          multi(ctx.answers, "backup", "locations").some((l) =>
            ["external-hdd", "pendrive"].includes(l),
          ),
      },
      {
        name: "cloudAccount",
        label: "A conta da nuvem é da serventia ou pessoal?",
        type: "choice",
        required: true,
        options: [
          { value: "office", label: "Da serventia" },
          { value: "personal", label: "Pessoal" },
        ],
        showWhen: (ctx) => hasBackup(ctx) && usesCloud(ctx.answers),
      },
      {
        name: "restoreTested",
        label: "Já testou restaurar um backup?",
        type: "choice",
        required: true,
        options: [
          { value: "this-year", label: "Sim, este ano" },
          { value: "older", label: "Sim, há mais tempo" },
          { value: "never", label: "Nunca" },
        ],
        help: 'Se "nunca", o plano de continuidade prevê um teste documentado nos primeiros 30 dias.',
      },
    ],
  },
  {
    id: "energia",
    number: 10,
    title: "Energia",
    question: "Quando a luz cai, o que acontece?",
    fields: [
      {
        name: "hasUps",
        label: "Tem nobreak?",
        type: "choice",
        required: true,
        options: YES_NO,
        help: "Já respondido na Seção 7; aqui é só confirmar.",
        defaultValue: ({ answers }) =>
          hasEquipment(answers, "ups") ? "yes" : undefined,
      },
      {
        name: "upsMinutes",
        label: "Quantos minutos o nobreak segura?",
        type: "choice",
        required: true,
        options: UPS_MINUTES,
        help: "A norma pede 30 minutos.",
        showWhen: ({ answers }) => text(answers, "energia", "hasUps") === "yes",
        defaultValue: ({ answers }) => {
          const ups = list(answers, "equipamentos", "inventory").find(
            (i) => i.type === "ups" && typeof i.upsMinutes === "string",
          );
          return ups ? (ups.upsMinutes as string) : undefined;
        },
      },
      {
        name: "hasGenerator",
        label: "Tem gerador?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
      {
        name: "outageFrequency",
        label: "A luz cai com frequência?",
        type: "choice",
        required: true,
        options: [
          { value: "rarely", label: "Quase nunca" },
          { value: "monthly", label: "Algumas vezes por mês" },
          { value: "weekly", label: "Toda semana" },
        ],
      },
      {
        name: "outageDuration",
        label: "Quando cai, dura em média quanto?",
        type: "choice",
        required: true,
        options: [
          { value: "short", label: "Até 20 minutos" },
          { value: "medium", label: "De 20 minutos a 1 hora" },
          { value: "long", label: "Mais de 1 hora" },
        ],
      },
      {
        name: "surgeDamage",
        label: "Já queimou equipamento por raio ou pico de energia?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
      {
        name: "grounding",
        label: "A instalação elétrica tem aterramento?",
        type: "choice",
        required: true,
        options: [
          { value: "with-report", label: "Sim, com laudo" },
          { value: "without-report", label: "Sim, sem laudo" },
          { value: "no", label: "Não" },
          { value: UNKNOWN, label: "Não sei" },
        ],
      },
      {
        name: "threePhase",
        label: "O prédio é comercial com fornecimento trifásico?",
        type: "choice",
        required: true,
        options: YES_NO_UNKNOWN,
        help: "Prédio comercial trifásico já nasce aterrado pela norma da distribuidora: o plano de energia registra uma declaração de cumprimento no lugar da pendência de laudo.",
        showWhen: ({ answers }) =>
          text(answers, "energia", "grounding") === "without-report",
      },
    ],
  },
  {
    id: "internet",
    number: 11,
    title: "Internet e rede",
    question: "Como a serventia se conecta?",
    fields: [
      {
        name: "provider",
        label: "Operadora de internet",
        type: "text",
        required: true,
      },
      {
        name: "speed",
        label: "Velocidade contratada",
        type: "text",
        required: true,
        help: "Está na fatura.",
        placeholder: "Ex.: 300 Mega",
      },
      {
        name: "type",
        label: "Tipo",
        type: "choice",
        required: true,
        options: [
          { value: "fiber", label: "Fibra" },
          { value: "radio", label: "Rádio" },
          { value: "cable", label: "Cabo" },
          { value: UNKNOWN, label: "Não sei" },
        ],
      },
      { name: "since", label: "Desde quando", type: "date", unknown: true },
      { name: "monthlyCost", label: "Valor mensal (R$)", type: "money" },
      {
        name: "routerBrand",
        label: "Marca do roteador",
        type: "text",
        unknown: "É da operadora",
      },
      {
        name: "switchBrand",
        label: "Tem switch? Qual marca?",
        type: "text",
        unknown: "Não sei o que é",
      },
      {
        name: "backupLink",
        label: "Tem internet de reserva (celular, segundo link)?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
      {
        name: "wifi",
        label: "Wi-Fi da serventia",
        type: "choice",
        required: true,
        options: [
          {
            value: "password-separate",
            label: "Tem senha e os clientes usam outra rede",
          },
          {
            value: "password-shared",
            label: "Tem senha e os clientes usam a mesma rede",
          },
          { value: "no-password", label: "Não tem senha" },
          { value: "none", label: "Não tem Wi-Fi" },
        ],
      },
    ],
  },
  {
    id: "acessos",
    number: 12,
    title: "Acessos e segurança",
    question: "Como as pessoas entram nos sistemas?",
    intro: "Não tem resposta errada; o objetivo é saber o que já existe.",
    fields: [
      {
        name: "logins",
        label:
          "Cada pessoa tem o próprio login nos sistemas (Cartosoft, Notaris, e-mail)?",
        type: "choice",
        required: true,
        options: [
          { value: "all-own", label: "Sim, todos" },
          { value: "some-shared", label: "Alguns compartilham" },
          { value: "all-shared", label: "Todos usam o mesmo" },
        ],
      },
      {
        name: "mfa",
        label:
          "Ao entrar nos sistemas, pede um segundo código (celular, app, token) além da senha?",
        type: "choice",
        required: true,
        options: [
          { value: "all", label: "Sim, em todos" },
          { value: "some", label: "Em alguns" },
          { value: "none", label: "Em nenhum" },
          { value: UNKNOWN, label: "Não sei" },
        ],
        help: "É a autenticação em duas etapas (item 1.3 da norma).",
      },
      {
        name: "bootPassword",
        label: "Os computadores têm senha para ligar?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
      {
        name: "equipmentRoom",
        label: "Onde ficam o servidor e o roteador?",
        type: "choice",
        required: true,
        options: [
          { value: "closed-room", label: "Sala fechada" },
          { value: "work-room", label: "Sala de trabalho" },
          { value: "counter", label: "Balcão" },
          { value: "other", label: "Outro lugar" },
        ],
        help: "Item 2.3 da norma: acesso físico aos equipamentos.",
      },
      {
        name: "extinguisher",
        label: "Tem extintor de incêndio?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
      {
        name: "environmentIncident",
        label:
          "Já teve infiltração, alagamento ou calor excessivo onde ficam os equipamentos?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
    ],
  },
  {
    id: "certificados",
    number: 13,
    title: "Certificados digitais",
    question: "Quais certificados digitais a serventia usa?",
    fields: [
      {
        name: "certificates",
        label: "Certificados",
        type: "list",
        required: true,
        itemLabel: "certificado",
        items: [
          {
            name: "holder",
            label: "De quem",
            type: "choice",
            required: true,
            options: (ctx) => [
              ...teamOptions(ctx),
              { value: "e-cnpj", label: "e-CNPJ da serventia" },
            ],
          },
          {
            name: "type",
            label: "Tipo",
            type: "choice",
            required: true,
            options: [
              { value: "a1", label: "A1 (fica no computador)" },
              { value: "a3", label: "A3 (token ou cartão)" },
              { value: UNKNOWN, label: "Não sei" },
            ],
          },
          { name: "authority", label: "Certificadora", type: "text" },
          { name: "issuedOn", label: "Data de emissão", type: "date" },
          {
            name: "validity",
            label: "Validade",
            type: "choice",
            options: [
              { value: "1", label: "1 ano" },
              { value: "2", label: "2 anos" },
              { value: "3", label: "3 anos" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fornecedores",
    number: 14,
    title: "Contratos e fornecedores",
    question: "Quem presta serviço para a serventia?",
    intro:
      "Já listamos os sistemas da Seção 6, a internet, a contabilidade, a nuvem e a Átrios. Complete e inclua quem faltar.",
    fields: [
      {
        name: "suppliers",
        label: "Fornecedores",
        type: "list",
        required: true,
        itemLabel: "fornecedor",
        defaultValue: ({ answers }) => defaultSuppliers(answers),
        items: [
          {
            name: "company",
            label: "Empresa",
            type: "text",
            required: true,
          },
          { name: "service", label: "O que faz", type: "text", required: true },
          { name: "monthlyCost", label: "Valor mensal (R$)", type: "money" },
          { name: "since", label: "Desde quando", type: "text" },
          {
            name: "term",
            label: "Vigência",
            type: "choice",
            options: [
              { value: "fixed", label: "Prazo certo" },
              { value: "auto-renew", label: "Renovação automática" },
              { value: UNKNOWN, label: "Não sei" },
            ],
          },
          {
            name: "writtenContract",
            label: "Tem contrato escrito?",
            type: "choice",
            options: YES_NO_UNKNOWN,
          },
          {
            name: "dataAccess",
            label: "O fornecedor tem acesso a dados do cartório?",
            type: "choice",
            options: YES_NO_UNKNOWN,
          },
        ],
      },
      {
        name: "sendAddendum",
        label:
          "Quer que a Átrios envie aos fornecedores o termo aditivo com as cláusulas que o Provimento exige?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
    ],
  },
  {
    id: "corregedoria",
    number: 15,
    title: "Comunicação com a Corregedoria",
    question: "Como a serventia fala com a CGJ-RN?",
    fields: [
      {
        name: "channels",
        label: "Como a serventia se comunica hoje com a CGJ-RN?",
        type: "multi",
        required: true,
        options: [
          { value: "malote", label: "Malote Digital" },
          { value: "sigajus", label: "SIGAJUS" },
          { value: "email", label: "E-mail" },
          { value: "paper", label: "Ofício em papel" },
          { value: "other", label: "Outro" },
        ],
      },
      {
        name: "hadIncident",
        label:
          "Já teve algum incidente de segurança (vírus, perda de dados, invasão, equipamento roubado)?",
        type: "choice",
        required: true,
        options: YES_NO,
      },
      {
        name: "incidentDetails",
        label: "Quando e o que aconteceu?",
        type: "textarea",
        required: true,
        showWhen: ({ answers }) =>
          text(answers, "corregedoria", "hadIncident") === "yes",
      },
    ],
  },
  {
    id: "formalidades",
    number: 16,
    title: "Formalidades",
    question: "Como os documentos devem sair?",
    fields: [
      {
        name: "lastOrdinance",
        label: "A serventia já numera portarias? Qual foi o último número?",
        type: "text",
        help: "Se não numera, os documentos começam em 001 do ano.",
        placeholder: "Ex.: 007/2026",
      },
      {
        name: "signingDate",
        label: "Data em que pretende assinar os documentos",
        type: "date",
        required: true,
        help: "Vai em todos os documentos.",
      },
      {
        name: "branding",
        label: "Quer os documentos com a marca da Átrios ou limpos?",
        type: "choice",
        required: true,
        options: [
          { value: "clean", label: "Limpos, para assinar" },
          { value: "atrios", label: "Com a marca da Átrios (modelo)" },
        ],
        defaultValue: () => "clean",
      },
    ],
  },
  {
    id: "anexos",
    number: 17,
    title: "Anexos",
    question: "Quer mandar fotos ou documentos?",
    intro:
      "Opcional. Fotos das etiquetas dos equipamentos, contratos em PDF, print da tela Sobre do Windows, cartão CNPJ e logo da serventia ajudam a Átrios a conferir as respostas.",
    fields: [],
  },
];

export const ATTACHMENT_KINDS: readonly Option[] = [
  { value: "Foto de etiqueta", label: "Foto de etiqueta de equipamento" },
  { value: "Contrato", label: "Contrato" },
  { value: "Tela Sobre do Windows", label: "Print da tela Sobre do Windows" },
  { value: "Cartão CNPJ", label: "Cartão CNPJ" },
  { value: "Logo da serventia", label: "Logo da serventia" },
  { value: "Outro documento", label: "Outro documento" },
];

function hasBackup({ answers }: FieldContext): boolean {
  return text(answers, "backup", "hasBackup") === "yes";
}

export const UNENCRYPTED_CLOUDS = ["google-drive", "onedrive", "dropbox"];

function usesCloud(answers: Answers): boolean {
  return multi(answers, "backup", "locations").some((l) =>
    [...UNENCRYPTED_CLOUDS, "other-cloud"].includes(l),
  );
}

/**
 * Whether the office sits in Classe 1, read off the revenue it typed. With no
 * revenue yet the question is asked anyway: hiding it would let a Classe 2
 * office skip the appointment the norm requires of it.
 */
function isClassOne(answers: Answers): boolean {
  const revenue = Number(text(answers, "serventia", "revenueLastSemester"));
  return !(revenue > CLASS_ONE_LIMIT);
}

/** R$ 300.000,00 of semestral gross revenue: art. 16, Provimento 243. */
export const CLASS_ONE_LIMIT = 300_000;

function appointsDpo({ answers }: FieldContext): boolean {
  if (!isClassOne(answers)) return true;
  return text(answers, "encarregado", "willAppoint") !== "no";
}

function defaultSuppliers(answers: Answers): ListItem[] | undefined {
  const rows: ListItem[] = [];
  const rcpn = text(answers, "sistemas", "rcpnSystem");
  if (rcpn === "cartosoft") {
    rows.push({ company: "Cartosoft", service: "Sistema do registro civil" });
  } else if (rcpn === "other") {
    rows.push({
      company: text(answers, "sistemas", "rcpnSystemOther"),
      service: "Sistema do registro civil",
    });
  }
  const notary = text(answers, "sistemas", "notarySystem");
  if (notary === "notaris") {
    rows.push({ company: "Notaris", service: "Sistema de notas e registros" });
  } else if (notary === "other") {
    rows.push({
      company: text(answers, "sistemas", "notarySystemOther"),
      service: "Sistema de notas e registros",
    });
  }
  rows.push(
    { company: text(answers, "internet", "provider"), service: "Internet" },
    { company: "", service: "Contabilidade" },
    { company: "", service: "Nuvem (e-mail, backup)" },
    { company: "Átrios", service: "Site, painel e adequação ao Provimento" },
  );
  return rows;
}

export function findSection(id: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.id === id);
}

/** Options of a field for the answers so far, whether static or computed. */
export function optionsOf(field: FieldDef, ctx: FieldContext): Option[] {
  const raw =
    typeof field.options === "function"
      ? field.options(ctx)
      : [...(field.options ?? [])];
  if (field.unknown && (field.type === "choice" || field.type === "multi")) {
    if (!raw.some((o) => o.value === UNKNOWN)) {
      raw.push({ value: UNKNOWN, label: "Não sei" });
    }
  }
  return raw;
}

export function isVisible(field: FieldDef, ctx: FieldContext): boolean {
  return field.showWhen ? field.showWhen(ctx) : true;
}
