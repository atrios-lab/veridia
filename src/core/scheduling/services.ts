import {
  type AgendaConfig,
  type AgendaId,
  addMinutes,
  hasGrid,
  type SlotTime,
} from "./agenda.ts";

/**
 * Every counter service a cartório de ofício único performs, with what the
 * citizen has to bring. The office does not type these in: it ticks, per
 * agenda, which ones that agenda takes (see `agenda.ts`), and the citizen who
 * books one gets this list on the screen, in the e-mail and in the PDF.
 *
 * Code, not config: the papers a habilitação de casamento needs are the same
 * in every serventia of the state, and a list typed by each office would be
 * typed wrong by some. What is particular to one office (a service nobody
 * else has) goes in its own services, `AgendaConfig.services`.
 *
 * Ids carry a dot on purpose. The office's own services get ids slugified
 * from their label (`[a-z0-9-]`), so a dot can never collide with one, and an
 * appointment's `serviceId` says by itself which list it came from.
 *
 * The lists are the usual minimum, not an exhaustive legal opinion: every one
 * of them ends, on every screen, with the line that the serventia may ask for
 * more depending on the case (`CHECKLIST_CAVEAT`).
 */

export interface CounterService {
  id: string;
  /** The heading it is listed under, the attribution in the citizen's words. */
  group: CounterServiceGroup;
  label: string;
  /** What to bring, beyond what every visit needs (`BASE_CHECKLIST`). */
  bring: string[];
  /** A sentence of guidance, when the list alone would mislead. */
  note?: string;
  /** Where a newly configured office starts it: the notary's own acts go to
   * the notary's agenda, everything else to the counter. Only a suggestion:
   * the office ticks what it wants in each agenda. */
  suggestedAgenda: "geral" | "tabeliao";
}

export const COUNTER_SERVICE_GROUPS = [
  "Atendimento geral",
  "Registro Civil",
  "Tabelionato de Notas",
  "Registro de Imóveis",
  "Protesto",
  "Títulos e Documentos",
  "Pessoas Jurídicas",
] as const;
export type CounterServiceGroup = (typeof COUNTER_SERVICE_GROUPS)[number];

/** Asked of everyone, whatever the service. */
export const BASE_CHECKLIST = [
  "Documento oficial de identidade com foto, original (RG, CNH, passaporte ou carteira profissional)",
  "CPF, se o número não constar no documento de identidade",
  "Este comprovante de agendamento, impresso ou no celular",
];

/** Said under every list, so none of them reads as the last word. */
export const CHECKLIST_CAVEAT =
  "Se for tratar de assunto de outra pessoa, traga procuração. Conforme o caso, a serventia pode pedir outros documentos.";

/** How early the citizen is asked to arrive. */
export const ARRIVAL_ADVANCE_MINUTES = 15;

const SPOUSE_DOCS =
  "Certidão de nascimento (solteiro) ou de casamento atualizada (casado, divorciado ou viúvo)";
const PROPERTY_CERTIFICATE =
  "Certidão de matrícula do imóvel atualizada, com ônus reais (até 30 dias)";

export const COUNTER_SERVICES: CounterService[] = [
  /* -------------------------------------------------------------- geral */
  {
    id: "geral.informacoes",
    group: "Atendimento geral",
    label: "Orientação e informações sobre atos",
    bring: ["Os documentos que você já tem sobre o assunto"],
    suggestedAgenda: "geral",
  },
  {
    id: "geral.retirada",
    group: "Atendimento geral",
    label: "Retirada de documento ou certidão pronta",
    bring: ["Número do protocolo do pedido"],
    note: "Se outra pessoa for retirar, ela precisa de autorização assinada por você ou procuração.",
    suggestedAgenda: "geral",
  },
  {
    id: "geral.apostila",
    group: "Atendimento geral",
    label: "Apostila de Haia (documento para uso no exterior)",
    bring: [
      "Documento original a ser apostilado (certidão, diploma, procuração etc.)",
    ],
    note: "Certidões de registro civil para uso no exterior costumam precisar ser em inteiro teor e recentes.",
    suggestedAgenda: "geral",
  },
  {
    id: "geral.autorizacao-viagem",
    group: "Atendimento geral",
    label: "Autorização de viagem para menor",
    bring: [
      "Documento de identidade dos pais ou responsáveis",
      "Certidão de nascimento ou documento de identidade do menor",
      "Dados da viagem: destino, datas e nome e documento do acompanhante",
    ],
    suggestedAgenda: "geral",
  },

  /* ------------------------------------------------------- registro civil */
  {
    id: "rcpn.registro-nascimento",
    group: "Registro Civil",
    label: "Registro de nascimento",
    bring: [
      "Declaração de Nascido Vivo (DNV) original, entregue pela maternidade",
      "Documento de identidade com foto dos pais",
      "Certidão de casamento dos pais, se forem casados",
      "Comprovante de residência",
    ],
    note: "Se os pais não forem casados, o pai deve comparecer para constar no registro, ou levar documento de reconhecimento de paternidade.",
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.registro-obito",
    group: "Registro Civil",
    label: "Registro de óbito",
    bring: [
      "Declaração de Óbito (DO) original, entregue pelo hospital ou médico",
      "Documento de identidade e CPF da pessoa falecida",
      "Certidão de nascimento ou casamento da pessoa falecida",
      "Documento de identidade do declarante",
      "Informações sobre filhos, bens, testamento e título de eleitor da pessoa falecida, se souber",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.habilitacao-casamento",
    group: "Registro Civil",
    label: "Habilitação de casamento",
    bring: [
      "Documento de identidade e CPF dos noivos",
      "Certidão de nascimento (solteiros) ou de casamento com averbação do divórcio ou óbito do ex-cônjuge, atualizada (até 90 dias)",
      "Comprovante de residência dos noivos",
      "Duas testemunhas maiores de 18 anos, com documento de identidade",
      "Escritura de pacto antenupcial, se o regime não for a comunhão parcial de bens",
    ],
    note: "Noivo viúvo ou divorciado com bens a partilhar deve trazer o inventário ou a partilha.",
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.celebracao-casamento",
    group: "Registro Civil",
    label: "Celebração de casamento",
    bring: [
      "Documento de identidade dos noivos",
      "Duas testemunhas maiores de 18 anos, com documento de identidade",
    ],
    note: "A celebração só é marcada depois da habilitação concluída.",
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.uniao-estavel",
    group: "Registro Civil",
    label: "Termo declaratório de união estável",
    bring: [
      "Documento de identidade e CPF dos companheiros",
      SPOUSE_DOCS,
      "Comprovante de residência",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.reconhecimento-filiacao",
    group: "Registro Civil",
    label: "Reconhecimento de paternidade ou maternidade",
    bring: [
      "Documento de identidade e CPF de quem reconhece",
      "Certidão de nascimento do filho",
      "Documento de identidade da mãe, ou do filho se for maior de 18 anos, para a concordância",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.segunda-via",
    group: "Registro Civil",
    label: "Certidão de nascimento, casamento ou óbito (2ª via)",
    bring: [
      "Nome completo da pessoa registrada e, se souber, data do registro, livro e folha",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.retificacao",
    group: "Registro Civil",
    label: "Retificação de registro civil",
    bring: [
      "Certidão do registro com o erro",
      "Documentos que provam a informação correta (certidões, documentos antigos)",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.alteracao-nome",
    group: "Registro Civil",
    label: "Alteração de prenome ou sobrenome",
    bring: [
      "Certidão de nascimento ou casamento atualizada",
      "Comprovante de residência",
      "Certidões dos distribuidores cíveis e criminais, de protesto e da Justiça Eleitoral (a serventia informa a lista completa)",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpn.averbacao",
    group: "Registro Civil",
    label: "Averbação de divórcio ou separação",
    bring: [
      "Certidão de casamento",
      "Sentença, mandado ou escritura de divórcio",
    ],
    suggestedAgenda: "geral",
  },

  /* --------------------------------------------------------------- notas */
  {
    id: "notas.reconhecimento-firma",
    group: "Tabelionato de Notas",
    label: "Reconhecimento de firma",
    bring: [
      "O documento a ser assinado ou já assinado",
      "Cartão de assinatura na serventia; se não tiver, ele é aberto na hora",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "notas.abertura-firma",
    group: "Tabelionato de Notas",
    label: "Abertura de firma (cartão de assinaturas)",
    bring: ["Comprovante de residência"],
    note: "O documento de identidade precisa estar em bom estado e com foto que permita reconhecer você.",
    suggestedAgenda: "geral",
  },
  {
    id: "notas.autenticacao",
    group: "Tabelionato de Notas",
    label: "Autenticação de cópias",
    bring: ["Os documentos originais (as cópias podem ser feitas aqui)"],
    suggestedAgenda: "geral",
  },
  {
    id: "notas.procuracao",
    group: "Tabelionato de Notas",
    label: "Procuração pública",
    bring: [
      SPOUSE_DOCS,
      "Dados completos do procurador: nome, CPF, documento de identidade, estado civil, profissão e endereço",
      "Se for para um imóvel ou veículo, os documentos dele",
    ],
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.escritura-compra-venda",
    group: "Tabelionato de Notas",
    label: "Escritura de compra e venda de imóvel",
    bring: [
      "Documento de identidade e CPF dos vendedores, compradores e cônjuges",
      SPOUSE_DOCS,
      PROPERTY_CERTIFICATE,
      "Certidão negativa de débitos do imóvel (IPTU) ou, se rural, ITR e CCIR",
      "Guia do ITBI paga",
      "Se alguma parte for empresa: contrato social e certidões da empresa",
    ],
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.escritura-doacao",
    group: "Tabelionato de Notas",
    label: "Escritura de doação",
    bring: [
      "Documento de identidade e CPF de quem doa, de quem recebe e dos cônjuges",
      SPOUSE_DOCS,
      PROPERTY_CERTIFICATE,
      "Guia do ITCMD paga ou declaração de isenção",
    ],
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.inventario",
    group: "Tabelionato de Notas",
    label: "Inventário e partilha",
    bring: [
      "Certidão de óbito",
      "Documento de identidade, CPF e certidão de nascimento ou casamento de cada herdeiro e do cônjuge",
      "Documentos dos bens: matrículas dos imóveis, documentos de veículos, extratos bancários",
      "Certidões negativas de débitos em nome da pessoa falecida",
      "Guia do ITCMD paga ou declaração de isenção",
    ],
    note: "O inventário em cartório exige a presença de advogado, e todos os herdeiros precisam estar de acordo.",
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.divorcio",
    group: "Tabelionato de Notas",
    label: "Divórcio ou separação em cartório",
    bring: [
      "Certidão de casamento atualizada (até 90 dias)",
      "Documento de identidade e CPF dos dois",
      "Escritura de pacto antenupcial, se houver",
      "Certidão de nascimento dos filhos",
      "Documentos dos bens a partilhar, se houver",
    ],
    note: "Exige a presença de advogado. Com filhos menores ou incapazes, as questões deles precisam estar resolvidas na Justiça antes.",
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.uniao-estavel",
    group: "Tabelionato de Notas",
    label: "Escritura de união estável ou de sua dissolução",
    bring: [
      "Documento de identidade e CPF dos companheiros",
      SPOUSE_DOCS,
      "Comprovante de residência",
    ],
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.testamento",
    group: "Tabelionato de Notas",
    label: "Testamento",
    bring: [
      SPOUSE_DOCS,
      "Duas testemunhas maiores de 18 anos, que não sejam herdeiros nem parentes deles, com documento de identidade",
      "Relação dos bens e do que deseja deixar a cada pessoa",
    ],
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.ata-notarial",
    group: "Tabelionato de Notas",
    label: "Ata notarial",
    bring: [
      "O que precisa ser registrado: celular com as mensagens, endereço do site, documentos ou fotos",
    ],
    suggestedAgenda: "tabeliao",
  },
  {
    id: "notas.outras-escrituras",
    group: "Tabelionato de Notas",
    label: "Outras escrituras e atos com o tabelião",
    bring: [
      "Documento de identidade e CPF de todas as partes",
      "Os documentos do bem ou do negócio de que trata a escritura",
    ],
    suggestedAgenda: "tabeliao",
  },

  /* ---------------------------------------------------- registro de imóveis */
  {
    id: "ri.registro-titulo",
    group: "Registro de Imóveis",
    label: "Registro de escritura ou contrato de imóvel",
    bring: [
      "O título original: escritura, contrato de financiamento ou formal de partilha",
      "Guia do ITBI ou do ITCMD paga",
      "Documento de identidade e CPF do adquirente",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "ri.averbacao",
    group: "Registro de Imóveis",
    label: "Averbação na matrícula (construção, casamento, demolição)",
    bring: [
      "Requerimento assinado pelo proprietário",
      "Documento que comprova o fato: habite-se e CND da obra, certidão de casamento etc.",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "ri.certidao",
    group: "Registro de Imóveis",
    label: "Certidão de matrícula ou de ônus",
    bring: ["Número da matrícula ou o endereço completo do imóvel"],
    suggestedAgenda: "geral",
  },
  {
    id: "ri.usucapiao",
    group: "Registro de Imóveis",
    label: "Usucapião em cartório",
    bring: [
      "Ata notarial de posse",
      "Planta e memorial descritivo assinados por profissional, com ART ou RRT",
      "Documentos que comprovam a posse: contas, recibos, contratos",
      "Certidões negativas dos distribuidores",
    ],
    note: "Exige a presença de advogado.",
    suggestedAgenda: "geral",
  },
  {
    id: "ri.retificacao",
    group: "Registro de Imóveis",
    label: "Retificação de área ou descrição do imóvel",
    bring: [
      PROPERTY_CERTIFICATE,
      "Planta e memorial descritivo assinados por profissional, com ART ou RRT",
      "Anuência dos confrontantes, se houver",
    ],
    suggestedAgenda: "geral",
  },

  /* -------------------------------------------------------------- protesto */
  {
    id: "protesto.apresentar",
    group: "Protesto",
    label: "Apresentar título para protesto",
    bring: [
      "O título original: cheque, nota promissória, duplicata ou contrato",
      "Nome, CPF ou CNPJ e endereço completo do devedor",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "protesto.pagamento",
    group: "Protesto",
    label: "Pagamento de título intimado",
    bring: ["A intimação recebida"],
    suggestedAgenda: "geral",
  },
  {
    id: "protesto.cancelamento",
    group: "Protesto",
    label: "Cancelamento de protesto",
    bring: [
      "Carta de anuência do credor com firma reconhecida, ou o título original",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "protesto.certidao",
    group: "Protesto",
    label: "Certidão de protesto",
    bring: ["CPF ou CNPJ a ser pesquisado"],
    suggestedAgenda: "geral",
  },

  /* ------------------------------------------------- títulos e documentos */
  {
    id: "rtd.registro",
    group: "Títulos e Documentos",
    label: "Registro de contrato ou documento",
    bring: [
      "O documento original a registrar",
      "Documento de identidade e CPF das partes",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rtd.notificacao",
    group: "Títulos e Documentos",
    label: "Notificação extrajudicial",
    bring: [
      "O texto da notificação, assinado",
      "Nome e endereço completo de quem vai ser notificado",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rtd.certidao",
    group: "Títulos e Documentos",
    label: "Certidão de documento registrado",
    bring: ["Número do registro ou nome das partes e data aproximada"],
    suggestedAgenda: "geral",
  },

  /* ---------------------------------------------------- pessoas jurídicas */
  {
    id: "rcpj.constituicao",
    group: "Pessoas Jurídicas",
    label: "Registro de associação, fundação ou sociedade simples",
    bring: [
      "Ata de fundação e lista de presença, assinadas",
      "Estatuto ou contrato social com visto de advogado",
      "Documento de identidade, CPF e endereço dos dirigentes",
      "Requerimento assinado pelo representante",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpj.averbacao",
    group: "Pessoas Jurídicas",
    label: "Averbação de ata ou alteração",
    bring: [
      "Ata e lista de presença, assinadas",
      "Estatuto ou contrato atualizado, se mudou",
      "Documento de identidade dos dirigentes eleitos",
    ],
    suggestedAgenda: "geral",
  },
  {
    id: "rcpj.certidao",
    group: "Pessoas Jurídicas",
    label: "Certidão de pessoa jurídica",
    bring: ["Nome ou CNPJ da entidade"],
    suggestedAgenda: "geral",
  },
];

export function getCounterService(id: string): CounterService | undefined {
  return COUNTER_SERVICES.find((service) => service.id === id);
}

/** The catalogue in the order it is listed, grouped under its headings. */
export function counterServicesByGroup(): Array<{
  group: CounterServiceGroup;
  services: CounterService[];
}> {
  return COUNTER_SERVICE_GROUPS.map((group) => ({
    group,
    services: COUNTER_SERVICES.filter((service) => service.group === group),
  })).filter((entry) => entry.services.length > 0);
}

/** The catalogue ids a fresh agenda starts with. */
export function suggestedServiceIds(agenda: "geral" | "tabeliao"): string[] {
  return COUNTER_SERVICES.filter(
    (service) => service.suggestedAgenda === agenda,
  ).map((service) => service.id);
}

/**
 * A service as the citizen meets it, wherever it came from: the catalogue
 * or the office's own list. `group` is the heading on the select.
 */
export interface OfferedService {
  id: string;
  label: string;
  group: string;
  bring: string[];
  note?: string;
}

const OWN_SERVICES_GROUP = "Outros serviços da serventia";

/** The service an id names, from the catalogue or the office's own list. */
export function resolveService(
  config: Pick<AgendaConfig, "services">,
  id: string,
): OfferedService | undefined {
  const known = getCounterService(id);
  if (known) {
    return {
      id: known.id,
      label: known.label,
      group: known.group,
      bring: known.bring,
      note: known.note,
    };
  }
  const own = config.services.find((service) => service.id === id);
  return own
    ? {
        id: own.id,
        label: own.label,
        group: OWN_SERVICES_GROUP,
        bring: own.bring,
      }
    : undefined;
}

/**
 * What one agenda offers, in the catalogue's order and the office's own
 * services last. An id ticked once and since gone (an own service the
 * office deleted) simply drops out.
 */
export function servicesOfAgenda(
  config: AgendaConfig,
  agenda: AgendaId,
): OfferedService[] {
  const ticked = new Set(config.agendas[agenda].serviceIds);
  const catalogue = COUNTER_SERVICES.filter((service) =>
    ticked.has(service.id),
  ).map((service) => resolveService(config, service.id) as OfferedService);
  const own = config.services
    .filter((service) => ticked.has(service.id))
    .map((service) => resolveService(config, service.id) as OfferedService);
  return [...catalogue, ...own];
}

/** The agendas the site shows: a weekly grid and at least one service. */
export function offeredAgendas(config: AgendaConfig): AgendaId[] {
  return (["geral", "tabeliao"] as const).filter(
    (id) =>
      hasGrid(config.agendas[id]) && servicesOfAgenda(config, id).length > 0,
  );
}

/** Everything to bring for a service: the base items first, then its own. */
export function checklistFor(service: Pick<OfferedService, "bring">): string[] {
  return [...BASE_CHECKLIST, ...service.bring];
}

/** "08:45" for an "09:00" appointment: when to be at the door. */
export function arrivalTime(slotTime: SlotTime): SlotTime {
  return addMinutes(slotTime, -ARRIVAL_ADVANCE_MINUTES);
}

/** The sentence that goes everywhere the appointment is confirmed. */
export function arrivalNotice(slotTime: SlotTime): string {
  return `Chegue com ${ARRIVAL_ADVANCE_MINUTES} minutos de antecedência, às ${arrivalTime(slotTime)}, para a conferência dos documentos.`;
}
