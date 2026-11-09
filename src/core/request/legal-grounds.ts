import type { Attribution } from "../tenant/schema.ts";

/**
 * O fundamento jurídico de cada especialidade, para o requerimento: a quem
 * ele se dirige, o que a especialidade faz e com base em quê, e por que a
 * serventia só age quando provocada (princípio da instância, ou rogação).
 *
 * Só cita dispositivo cujo conteúdo o texto descreve: Constituição Federal,
 * Lei 6.015/1973 (Registros Públicos), Lei 8.935/1994 (Lei dos Notários e
 * Registradores), Lei 9.492/1997 (Protesto), Código Civil e o Código
 * Nacional de Normas do Foro Extrajudicial (Provimento CNJ n. 149/2023).
 * O fundamento do ato em si vem de cada ato do catálogo (`Act.legalBasis`).
 */
export interface Specialty {
  /** O nome da especialidade, como a lei a chama. */
  name: string;
  /** Quem a exerce, a quem o requerimento se dirige. */
  officer: string;
  /** O que a especialidade faz, com a base legal. */
  scope: string;
  /** Por que o ato depende do pedido do interessado. */
  instance: string;
  /** A referência curta da instância, para o parágrafo de abertura. */
  instanceBasis: string;
  /** O exame que a serventia faz antes de praticar o ato. */
  qualification: string;
  /** As normas da especialidade, cada uma com o que diz. */
  grounds: string[];
}

const REGISTRY_INSTANCE =
  "Os serviços de registro são regidos pelo princípio da instância (ou rogação): a serventia é " +
  "inerte e não pratica atos de ofício, ressalvadas as anotações e averbações obrigatórias, de " +
  "modo que os atos do registro são praticados por ordem judicial, a requerimento verbal ou " +
  "escrito dos interessados ou a requerimento do Ministério Público, quando a lei autorizar " +
  "(Lei n. 6.015/1973, art. 13). Este requerimento é o instrumento pelo qual o requerente " +
  "provoca a serventia para a prática do ato aqui indicado.";

export const SPECIALTIES: Record<Attribution, Specialty> = {
  RCPN: {
    name: "Registro Civil das Pessoas Naturais",
    officer: "Oficial de Registro Civil das Pessoas Naturais",
    scope:
      "O Registro Civil das Pessoas Naturais é a especialidade incumbida dos registros de " +
      "nascimento, casamento e óbito, da emancipação, da interdição, da sentença declaratória " +
      "de ausência e de morte presumida e dos demais atos relativos ao estado da pessoa " +
      "natural, das averbações e anotações a eles referentes e das respectivas certidões " +
      "(Código Civil, arts. 9º e 10; Lei n. 6.015/1973, arts. 29 e seguintes; Lei n. " +
      "8.935/1994, art. 12).",
    instance: REGISTRY_INSTANCE,
    instanceBasis: "art. 13 da Lei n. 6.015/1973",
    qualification: "qualificação registral",
    grounds: [
      "Código Civil, arts. 9º e 10: atos do estado da pessoa natural sujeitos a registro e a averbação em registro público.",
      "Lei n. 6.015/1973, arts. 29 e seguintes: registro civil das pessoas naturais.",
      "Lei n. 6.015/1973, arts. 16 a 21: publicidade e expedição de certidões.",
      "Lei n. 8.935/1994, art. 12: competência dos oficiais de registro civil das pessoas naturais.",
    ],
  },
  NOTAS: {
    name: "Tabelionato de Notas",
    officer: "Tabelião(ã) de Notas",
    scope:
      "O Tabelionato de Notas é a especialidade a que compete formalizar juridicamente a " +
      "vontade das partes, intervir nos atos e negócios jurídicos a que as partes devam ou " +
      "queiram dar forma legal ou autenticidade e autenticar fatos (Lei n. 8.935/1994, art. " +
      "6º), com competência exclusiva para lavrar escrituras e procurações públicas, lavrar " +
      "testamentos públicos e aprovar os cerrados, lavrar atas notariais, reconhecer firmas " +
      "e autenticar cópias (Lei n. 8.935/1994, art. 7º). A escritura pública lavrada em notas " +
      "de tabelião é documento dotado de fé pública e faz prova plena (Código Civil, art. 215).",
    instance:
      "A atividade notarial é regida pelo princípio da rogação: o tabelião é inerte, não age de ofício e " +
      "atua mediante solicitação das partes, cuja vontade lhe compete formalizar juridicamente " +
      "(Lei n. 8.935/1994, art. 6º, I), cabendo às partes a livre escolha do tabelião de notas " +
      "(Lei n. 8.935/1994, art. 8º). Este requerimento é o instrumento pelo qual o requerente " +
      "solicita a prática do ato aqui indicado.",
    instanceBasis: "art. 6º, I, da Lei n. 8.935/1994",
    qualification: "análise notarial",
    grounds: [
      "Lei n. 8.935/1994, art. 6º: competência dos notários.",
      "Lei n. 8.935/1994, art. 7º: competência exclusiva dos tabeliães de notas.",
      "Lei n. 8.935/1994, art. 8º: livre escolha do tabelião de notas pelas partes.",
      "Código Civil, art. 215: fé pública e prova plena da escritura pública.",
    ],
  },
  RI: {
    name: "Registro de Imóveis",
    officer: "Oficial de Registro de Imóveis",
    scope:
      "O Registro de Imóveis é a especialidade incumbida da matrícula, do registro e da " +
      "averbação dos títulos ou atos constitutivos, declaratórios, translativos e extintivos " +
      "de direitos reais sobre imóveis, para sua constituição, transferência e extinção, " +
      "validade em relação a terceiros e disponibilidade (Lei n. 6.015/1973, arts. 167 e " +
      "172). Os direitos reais sobre imóveis constituídos ou transmitidos por atos entre vivos " +
      "só se adquirem com o registro no Cartório de Registro de Imóveis (Código Civil, arts. " +
      "1.227 e 1.245).",
    instance:
      `${REGISTRY_INSTANCE} No Registro de Imóveis, o registro e a averbação podem ser ` +
      "provocados por qualquer pessoa, incumbindo-lhe as despesas respectivas (Lei n. " +
      "6.015/1973, art. 217), e o título apresentado é prenotado no Protocolo, o que lhe " +
      "assegura a prioridade (Lei n. 6.015/1973, arts. 12, 182 e 186).",
    instanceBasis: "arts. 13 e 217 da Lei n. 6.015/1973",
    qualification: "qualificação registral",
    grounds: [
      "Lei n. 6.015/1973, arts. 167 e 172: atos de registro e de averbação no Registro de Imóveis.",
      "Lei n. 6.015/1973, arts. 12, 182 e 186: prenotação no Protocolo e prioridade do título.",
      "Lei n. 6.015/1973, art. 217: legitimidade de qualquer pessoa para provocar o registro.",
      "Código Civil, arts. 1.227 e 1.245: aquisição de direitos reais sobre imóveis pelo registro.",
      "Lei n. 8.935/1994, art. 12: competência dos oficiais de registro de imóveis.",
    ],
  },
  PROTESTO: {
    name: "Tabelionato de Protesto de Títulos",
    officer: "Tabelião(ã) de Protesto de Títulos",
    scope:
      "O Tabelionato de Protesto de Títulos é a especialidade incumbida do protesto, ato " +
      "formal e solene pelo qual se prova a inadimplência e o descumprimento de obrigação " +
      "originada em títulos e outros documentos de dívida (Lei n. 9.492/1997, art. 1º), " +
      "competindo privativamente ao tabelião protocolizar, intimar, acolher a devolução ou o " +
      "aceite, receber o pagamento, lavrar e registrar o protesto ou acatar a desistência do " +
      "credor, proceder às averbações, prestar informações e fornecer certidões relativas a " +
      "todos os atos praticados (Lei n. 9.492/1997, art. 3º; Lei n. 8.935/1994, art. 11).",
    instance:
      "O tabelionato de protesto é inerte: não pratica atos de ofício e atua mediante a " +
      "apresentação do título ou documento de dívida, ou o pedido de certidão ou de " +
      "cancelamento, feitos pelo interessado (Lei n. 9.492/1997, arts. 1º, 3º e 26). Todo " +
      "título ou documento protocolizado é examinado em seus caracteres formais antes do " +
      "protesto (Lei n. 9.492/1997, art. 9º). Este requerimento é o instrumento pelo qual o " +
      "requerente provoca a serventia para a prática do ato aqui indicado.",
    instanceBasis: "arts. 1º e 3º da Lei n. 9.492/1997",
    qualification: "exame formal do título (Lei n. 9.492/1997, art. 9º)",
    grounds: [
      "Lei n. 9.492/1997, art. 1º: conceito e finalidade do protesto.",
      "Lei n. 9.492/1997, art. 3º: competência privativa do tabelião de protesto.",
      "Lei n. 9.492/1997, art. 9º: exame dos caracteres formais do título.",
      "Lei n. 8.935/1994, art. 11: competência dos tabeliães de protesto.",
    ],
  },
  RTD: {
    name: "Registro de Títulos e Documentos",
    officer: "Oficial de Registro de Títulos e Documentos",
    scope:
      "O Registro de Títulos e Documentos é a especialidade incumbida do registro dos " +
      "instrumentos particulares, para a prova das obrigações convencionais de qualquer " +
      "valor, de outros títulos e documentos, para sua validade e eficácia contra terceiros " +
      "ou para sua conservação (Lei n. 6.015/1973, arts. 127 a 129), e das notificações " +
      "(Lei n. 6.015/1973, art. 160). O instrumento particular só produz efeitos perante " +
      "terceiros depois de registrado no registro público (Código Civil, art. 221).",
    instance: REGISTRY_INSTANCE,
    instanceBasis: "art. 13 da Lei n. 6.015/1973",
    qualification: "qualificação registral",
    grounds: [
      "Lei n. 6.015/1973, arts. 127 a 129: atos sujeitos ao Registro de Títulos e Documentos.",
      "Lei n. 6.015/1973, art. 160: notificações por intermédio do Registro de Títulos e Documentos.",
      "Código Civil, art. 221: efeitos do instrumento particular perante terceiros após o registro.",
      "Lei n. 8.935/1994, art. 12: competência dos oficiais de registro de títulos e documentos.",
    ],
  },
  RCPJ: {
    name: "Registro Civil das Pessoas Jurídicas",
    officer: "Oficial de Registro Civil das Pessoas Jurídicas",
    scope:
      "O Registro Civil das Pessoas Jurídicas é a especialidade incumbida da inscrição dos " +
      "contratos, atos constitutivos, estatutos ou compromissos das sociedades simples, " +
      "associações, fundações e organizações religiosas, e da averbação de suas alterações " +
      "(Lei n. 6.015/1973, arts. 114 a 121). A existência legal das pessoas jurídicas de " +
      "direito privado começa com a inscrição do ato constitutivo no respectivo registro, " +
      "averbando-se no registro todas as alterações por que passar o ato constitutivo " +
      "(Código Civil, art. 45).",
    instance: REGISTRY_INSTANCE,
    instanceBasis: "art. 13 da Lei n. 6.015/1973",
    qualification: "qualificação registral",
    grounds: [
      "Lei n. 6.015/1973, arts. 114 a 121: registro civil das pessoas jurídicas.",
      "Código Civil, art. 45: início da existência legal da pessoa jurídica de direito privado com a inscrição.",
      "Lei n. 8.935/1994, art. 12: competência dos oficiais de registro civil das pessoas jurídicas.",
    ],
  },
};

/** O que vale para todo requerimento, em qualquer especialidade. */
export function generalGrounds(state: string): string[] {
  return [
    "Constituição Federal, art. 236: serviços notariais e de registro exercidos em caráter privado, por delegação do Poder Público.",
    "Lei n. 8.935/1994, arts. 1º e 3º: finalidade dos serviços (publicidade, autenticidade, segurança e eficácia dos atos jurídicos) e fé pública do notário e do registrador.",
    "Lei n. 8.935/1994, art. 30, II: dever de atender as partes com eficiência, urbanidade e presteza.",
    "Código Nacional de Normas da Corregedoria Nacional de Justiça, Foro Extrajudicial (Provimento CNJ n. 149/2023).",
    `Código de Normas do Foro Extrajudicial da Corregedoria-Geral de Justiça (CGJ/${state}).`,
    "Lei n. 13.709/2018 (LGPD): tratamento dos dados pessoais para a prática do ato.",
  ];
}

const LAW_YEARS: Record<string, string> = {
  "6.015": "1973",
  "8.935": "1994",
  "9.492": "1997",
  "10.169": "2000",
  "13.709": "2018",
};

/**
 * O fundamento de um ato como o catálogo o escreve ("Lei 6.015 art. 30 §1º",
 * "Prov. 149 art. 123 par. 2 e 4", "CC art. 1.525"), por extenso, como se
 * cita num requerimento: "Lei n. 6.015/1973, art. 30, § 1º".
 */
export function citeLegalBasis(basis: string): string {
  return (
    basis
      // Leis: número e ano.
      .replace(
        /\bLei (?:n\.\s*)?(\d{1,2}\.\d{3})(?:\/(\d{4}))?/g,
        (_match, number: string, year?: string) => {
          const known = year ?? LAW_YEARS[number];
          return known ? `Lei n. ${number}/${known}` : `Lei n. ${number}`;
        },
      )
      // Provimentos do CNJ e da corregedoria estadual.
      .replace(
        /\bProv(?:imento)?\.? (?:CNJ )?149\b/g,
        "Provimento CNJ n. 149/2023 (Código Nacional de Normas)",
      )
      .replace(/\bProv(?:imento)?\.? CGJ\//g, "Provimento CGJ/")
      .replace(/\bCC\b/g, "Código Civil")
      .replace(/\bCF\b/g, "Constituição Federal")
      // "par. 2 e 4" e "§1º": parágrafos por extenso.
      .replace(/\bpar\. (\d+) e (\d+)\b/g, "§§ $1º e $2º")
      .replace(/\bpar\. (\d+)\b/g, "§ $1º")
      .replace(/§(\d)/g, "§ $1")
      // Ordinais até o 9: "art. 1" vira "art. 1º", "arts. 1 e 3" idem.
      .replace(
        /\b(arts?\.|e|a) ([1-9])(?![\dº.,/])/g,
        (_match, lead: string, digit: string) => `${lead} ${digit}º`,
      )
      // Inciso, parágrafo e caput depois de vírgula: "art. 7º, I",
      // "art. 30, § 1º", "art. 123, caput".
      .replace(/\b(arts?\. [\d.]+º?) ([IVX]+|§|caput)\b/g, "$1, $2")
      .replace(/\b(arts?\. [\d.]+º?) (§)/g, "$1, $2")
      .replace(
        /\bProvimento CGJ\/(\w+) (\d+\/\d{4})/g,
        "Provimento CGJ/$1 n. $2",
      )
      // A citação começa a frase da lei: "Lei n. 6.015/1973 art. 17" ganha a
      // vírgula antes do artigo.
      .replace(
        /(\d{4}|\)|Código Civil|Constituição Federal)\s+(arts?\.)/g,
        "$1, $2",
      )
  );
}
