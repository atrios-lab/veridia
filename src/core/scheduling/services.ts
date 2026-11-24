import {
  AGENDA_IDS,
  type AgendaConfig,
  type AgendaId,
  addMinutes,
  channelOfMode,
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
   * the notary's agenda, the e-Notariado's to its own, everything else to
   * the counter. Only a suggestion: the office ticks what it wants in each
   * agenda. */
  suggestedAgenda: AgendaId;
  /**
   * "Como fazer" for whoever attends (rule of 21/11/2026): each step with
   * its legal source, checked in the official text. Shown on the
   * appointment in the panel.
   */
  howTo?: HowToStep[];
  /** Whether the act is charged by the fee table in force, so the panel
   * shows the reminder to check the table next to the "Como fazer". */
  chargedByFeeTable?: boolean;
}

export interface HowToStep {
  step: string;
  source: string;
}

export const COUNTER_SERVICE_GROUPS = [
  "Atendimento geral",
  "Registro Civil",
  "Tabelionato de Notas",
  "Registro de Imóveis",
  "Protesto",
  "Títulos e Documentos",
  "Pessoas Jurídicas",
  "e-Notariado",
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

/**
 * The Código Nacional de Normas do Foro Extrajudicial, where the e-Notariado
 * rules live since the Provimento CNJ n. 100/2020 was revoked. Article
 * numbers checked in the official text on 24/11/2026 (Section "Dos atos
 * notariais eletrônicos por meio do e-Notariado", arts. 284 to 317).
 */
const CNN = "Código Nacional de Normas do CNJ (Provimento n. 149/2023)";

const VIDEO_DEVICE =
  "Celular ou computador com câmera, microfone e boa internet";

/**
 * The e-Notariado's agenda (decision of 24/11/2026): the Certificado
 * Digital Notarizado, the electronic acts and the platform's other
 * services, plus "Outro serviço" for whatever the list does not name.
 */
const ENOTARIADO_SERVICES: CounterService[] = [
  {
    id: "enotariado.certificado",
    group: "e-Notariado",
    label: "Emissão do Certificado Digital Notarizado (gratuito)",
    bring: ["E-mail e número de celular que você vai usar no e-Notariado"],
    note: "Gratuito (Código Nacional de Normas do CNJ, art. 292, § 4º). A identificação é presencial, perante o notário (art. 285, II): venha ao cartório no horário marcado.",
    suggestedAgenda: "enotariado",
    howTo: [
      {
        step: "Confira o documento de identidade original com foto e o CPF da pessoa, que precisa estar presente: o certificado é a identidade digital de quem o notário identificou pessoalmente.",
        source: `${CNN}, art. 285, II`,
      },
      {
        step: "No e-Notariado (www.e-notariado.org.br), com o seu acesso de usuário interno, emita o certificado para o e-mail e o celular informados pela pessoa.",
        source: `${CNN}, art. 293, III`,
      },
      {
        step: "Não cobre nada: o notário fornece o certificado gratuitamente aos clientes do serviço notarial.",
        source: `${CNN}, art. 292, § 4º`,
      },
      {
        step: "Explique que o certificado é de uso exclusivo no e-Notariado e nas plataformas autorizadas, vale por tempo determinado e pode ser revogado a pedido, para emitir outro em qualquer tabelionato.",
        source: `${CNN}, art. 292, §§ 4º e 6º`,
      },
      {
        step: "Terminado, marque o agendamento como atendido.",
        source: "Painel: Agenda de atendimentos",
      },
    ],
  },
  {
    id: "enotariado.certificado-renovacao",
    group: "e-Notariado",
    label: "Renovação ou nova emissão do certificado notarizado",
    bring: ["E-mail e número de celular que você usa no e-Notariado"],
    note: "Gratuito (art. 292, § 4º). Você pode pedir a revogação do certificado atual e emitir um novo em qualquer tabelionato (art. 292, § 6º).",
    suggestedAgenda: "enotariado",
    howTo: [
      {
        step: "Confira a identidade como na primeira emissão: documento original com foto e CPF, com a pessoa presente.",
        source: `${CNN}, art. 285, II`,
      },
      {
        step: "Se o certificado atual foi emitido por outro tabelionato, a pessoa pode pedir a revogação e a emissão de um novo aqui, mesmo antes de vencer.",
        source: `${CNN}, art. 292, § 6º`,
      },
      {
        step: "Emita o novo certificado no e-Notariado, sem cobrança.",
        source: `${CNN}, art. 292, § 4º`,
      },
    ],
  },
  {
    id: "enotariado.ato-eletronico",
    group: "e-Notariado",
    label:
      "Assinatura de ato eletrônico por videoconferência (escritura, procuração, ata notarial e outros)",
    bring: [
      "Certificado Digital Notarizado (ou ICP-Brasil) válido",
      VIDEO_DEVICE,
      "Os documentos do ato que o cartório pediu (por exemplo, os da escritura ou da procuração)",
    ],
    note: "A videoconferência com o tabelião é obrigatória e acontece dentro da plataforma e-Notariado (Código Nacional de Normas do CNJ, arts. 286 e 287). O convite chega pela própria plataforma.",
    suggestedAgenda: "enotariado",
    chargedByFeeTable: true,
    howTo: [
      {
        step: "Confira a competência. Escritura: tabelião da circunscrição do imóvel ou do domicílio do adquirente. Ata notarial: do lugar do fato ou, se não couber, do domicílio do requerente. O domicílio se comprova pelo título de eleitor ou outro meio.",
        source: `${CNN}, arts. 302, 303 e 304`,
      },
      {
        step: "Deixe o ato pronto no e-Notariado antes do horário e envie, pela plataforma, o convite da videoconferência notarial às partes.",
        source: `${CNN}, art. 287`,
      },
      {
        step: "Na videoconferência, a gravação precisa ter: identificação, capacidade e livre manifestação das partes; o consentimento e a concordância; o objeto e o preço; a data e a hora; e o livro, a página e o tabelionato do ato.",
        source: `${CNN}, art. 286, parágrafo único`,
      },
      {
        step: "As partes assinam exclusivamente pelo e-Notariado, e o tabelião assina com certificado ICP-Brasil, em formato de longa duração.",
        source: `${CNN}, art. 286, III a V`,
      },
      {
        step: "Cobre os emolumentos do ato pela tabela de emolumentos vigente, como no ato feito no papel.",
        source: "Tabela de emolumentos vigente (Transparência)",
      },
    ],
  },
  {
    id: "enotariado.e-not-assina",
    group: "e-Notariado",
    label: "Reconhecimento de assinatura eletrônica (e-Not Assina)",
    bring: [
      "O documento em PDF assinado no e-Notariado",
      "Certificado Digital Notarizado (ou ICP-Brasil) válido",
    ],
    note: "O reconhecimento tem a mesma força jurídica de um reconhecimento de firma (Código Nacional de Normas do CNJ, art. 306, III).",
    suggestedAgenda: "enotariado",
    chargedByFeeTable: true,
    howTo: [
      {
        step: "Receba o documento pelo módulo e-Not Assina do e-Notariado.",
        source: `${CNN}, art. 293, XIII`,
      },
      {
        step: "Confira a identidade de quem assinou pelos meios do e-Notariado e reconheça a assinatura eletrônica.",
        source: `${CNN}, arts. 301 e 306, III`,
      },
      {
        step: "Cobre como reconhecimento de firma, pela tabela de emolumentos vigente.",
        source: `${CNN}, art. 306, III; tabela de emolumentos vigente`,
      },
    ],
  },
  {
    id: "enotariado.firma-videoconferencia",
    group: "e-Notariado",
    label: "Reconhecimento de firma por autenticidade por videoconferência",
    bring: ["O documento que você vai assinar", VIDEO_DEVICE],
    note: "Na videoconferência o cartório confirma a sua identidade, a sua capacidade e a autoria da assinatura (Código Nacional de Normas do CNJ, art. 306, IV).",
    suggestedAgenda: "enotariado",
    chargedByFeeTable: true,
    howTo: [
      {
        step: "Por videoconferência, confirme a identidade, a capacidade de quem assina e a autoria da assinatura.",
        source: `${CNN}, art. 306, IV`,
      },
      {
        step: "Documento de veículo: é competente o tabelião do município de emplacamento ou do domicílio do adquirente indicados no CRV.",
        source: `${CNN}, art. 306, § 1º`,
      },
      {
        step: "Arquive o trecho da videoconferência em que a pessoa ratifica a assinatura, com menção expressa ao documento.",
        source: `${CNN}, art. 306, § 2º`,
      },
      {
        step: "Conste no ato que a assinatura foi feita perante o tabelião, o substituto ou o escrevente, em videoconferência.",
        source: `${CNN}, art. 308`,
      },
      {
        step: "Cobre como reconhecimento de firma por autenticidade, pela tabela de emolumentos vigente.",
        source: "Tabela de emolumentos vigente (Transparência)",
      },
    ],
  },
  {
    id: "enotariado.aev",
    group: "e-Notariado",
    label: "Autorização Eletrônica de Viagem (AEV) para criança ou adolescente",
    bring: [
      "Certidão de nascimento ou documento de identidade da criança ou do adolescente",
      "Dados da viagem: destino, datas e, se houver, quem vai acompanhar",
    ],
    note: "A AEV é feita só pelo e-Notariado, para criança ou adolescente de até 16 anos que viaja sem um ou sem os dois pais (Código Nacional de Normas do CNJ, art. 444).",
    suggestedAgenda: "enotariado",
    chargedByFeeTable: true,
    howTo: [
      {
        step: "A AEV, nacional ou internacional, é emitida exclusivamente pelo e-Notariado, para criança ou adolescente de até 16 anos desacompanhado de um ou dos dois pais.",
        source: `${CNN}, art. 444; Provimento CNJ n. 103/2020`,
      },
      {
        step: "Confira a identidade dos responsáveis, presencialmente ou por videoconferência, e reconheça as assinaturas como autênticas.",
        source: `${CNN}, arts. 301 e 306, IV`,
      },
      {
        step: "Cobre pela tabela de emolumentos vigente.",
        source: "Tabela de emolumentos vigente (Transparência)",
      },
    ],
  },
  {
    id: "enotariado.autenticacao-digital",
    group: "e-Notariado",
    label: "Autenticação digital de documento (CENAD)",
    bring: ["O documento original a ser autenticado"],
    note: "A cópia autenticada digital tem a mesma força de uma autenticação de cópia, e quem a recebe confere pela CENAD por até cinco anos (Código Nacional de Normas do CNJ, art. 305, §§ 4º e 5º).",
    suggestedAgenda: "enotariado",
    chargedByFeeTable: true,
    howTo: [
      {
        step: "Confira o documento físico original.",
        source: `${CNN}, art. 305, § 1º`,
      },
      {
        step: "Faça a desmaterialização pela CENAD: ela gera o registro com o notário ou preposto, a data, a hora e o código de verificação.",
        source: `${CNN}, art. 305, §§ 2º e 3º`,
      },
      {
        step: "Entregue a cópia digital: tem a mesma força de uma autenticação de cópia e é conferida pela CENAD por até cinco anos.",
        source: `${CNN}, art. 305, §§ 4º e 5º`,
      },
      {
        step: "Cobre como autenticação de cópia, pela tabela de emolumentos vigente.",
        source: `${CNN}, art. 305, § 5º; tabela de emolumentos vigente`,
      },
    ],
  },
  {
    id: "enotariado.cadastro",
    group: "e-Notariado",
    label: "Ajuda para se cadastrar no e-Notariado",
    bring: ["E-mail e número de celular que você usa"],
    suggestedAgenda: "enotariado",
    howTo: [
      {
        step: "Ajude a pessoa a se cadastrar em www.e-notariado.org.br/cadastro.",
        source: `${CNN}, art. 297, § 1º`,
      },
      {
        step: "Se ela vai assinar atos, ofereça a emissão do Certificado Digital Notarizado, que é gratuita.",
        source: `${CNN}, art. 292, § 4º`,
      },
    ],
  },
  {
    id: "enotariado.outro",
    group: "e-Notariado",
    label: "Outro serviço do e-Notariado (não listado acima)",
    bring: ["Os documentos relacionados ao que você precisa"],
    note: "Conte no campo de detalhes o que você precisa. O cartório confirma se é feito pelo e-Notariado (Código Nacional de Normas do CNJ, art. 309).",
    suggestedAgenda: "enotariado",
    chargedByFeeTable: true,
    howTo: [
      {
        step: "Leia o que a pessoa descreveu e confira se o ato se pratica pelo e-Notariado: outros atos eletrônicos podem ser feitos pelo sistema, observadas as regras gerais.",
        source: `${CNN}, art. 309`,
      },
      {
        step: "Se for ato notarial eletrônico, cumpra os requisitos: videoconferência notarial, concordância das partes, assinatura delas pelo e-Notariado e do tabelião com certificado ICP-Brasil.",
        source: `${CNN}, art. 286`,
      },
      {
        step: "Cobre conforme o ato, pela tabela de emolumentos vigente.",
        source: "Tabela de emolumentos vigente (Transparência)",
      },
    ],
  },
];

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
  ...ENOTARIADO_SERVICES,
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
export function suggestedServiceIds(agenda: AgendaId): string[] {
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
  /** The service's own items, before the office's changes. */
  bring: string[];
  note?: string;
  /** The whole list the citizen gets: base items and the service's, or
   * the list as the office edited it. */
  checklist: string[];
  /** Whether the office attached its own sheet for this service. */
  hasOwnFile: boolean;
}

const OWN_SERVICES_GROUP = "Outros serviços da serventia";

/** The service an id names, from the catalogue or the office's own list,
 * with the office's changes to its list applied. */
export function resolveService(
  config: Pick<AgendaConfig, "services" | "checklists">,
  id: string,
): OfferedService | undefined {
  const known = getCounterService(id);
  const own = known
    ? undefined
    : config.services.find((service) => service.id === id);
  if (!known && !own) return undefined;

  const bring = known ? known.bring : (own?.bring ?? []);
  const custom = config.checklists[id];
  return {
    id,
    label: known ? known.label : (own?.label ?? id),
    group: known ? known.group : OWN_SERVICES_GROUP,
    bring,
    note: known?.note,
    checklist: custom?.items ?? [...BASE_CHECKLIST, ...bring],
    hasOwnFile: Boolean(custom?.file),
  };
}

/** The list a service starts from, before any change by the office. */
export function defaultChecklist(
  config: Pick<AgendaConfig, "services">,
  id: string,
): string[] {
  const bring =
    getCounterService(id)?.bring ??
    config.services.find((service) => service.id === id)?.bring ??
    [];
  return [...BASE_CHECKLIST, ...bring];
}

/** Where the citizen downloads the office's own sheet for a service. */
export function checklistFileHref(serviceId: string): string {
  return `/agendar/lista/${encodeURIComponent(serviceId)}`;
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

/** The agendas the site shows: on (not paused), with a weekly grid and at
 * least one service. An office that never sets one up never shows it. */
export function offeredAgendas(config: AgendaConfig): AgendaId[] {
  return AGENDA_IDS.filter(
    (id) =>
      !config.agendas[id].paused &&
      hasGrid(config.agendas[id]) &&
      servicesOfAgenda(config, id).length > 0,
  );
}

/** Everything to bring for a service: the list as the office left it, or
 * the base items first and then the service's own. */
export function checklistFor(
  service: Pick<OfferedService, "bring"> & { checklist?: string[] },
): string[] {
  return service.checklist ?? [...BASE_CHECKLIST, ...service.bring];
}

/** "08:45" for an "09:00" appointment: when to be at the door. */
export function arrivalTime(slotTime: SlotTime): SlotTime {
  return addMinutes(slotTime, -ARRIVAL_ADVANCE_MINUTES);
}

/** The sentence that goes everywhere the appointment is confirmed. */
export function arrivalNotice(slotTime: SlotTime): string {
  return `Chegue com ${ARRIVAL_ADVANCE_MINUTES} minutos de antecedência, às ${arrivalTime(slotTime)}, para a conferência dos documentos.`;
}

/**
 * What to do before the time, by how the citizen is attended: come early
 * for the counter, be ready for the notary's call or video otherwise. A mode
 * that names no channel (the counter's modes) is in person.
 */
export function attendanceNotice(slotTime: SlotTime, mode: string): string {
  switch (channelOfMode(mode)) {
    case "video":
      return `Atendimento por vídeo: às ${slotTime}, esteja num lugar tranquilo e com internet. O link da videochamada chega no seu e-mail. Tenha os documentos da lista em mãos.`;
    case "ligacao":
      return `Atendimento por ligação: às ${slotTime}, o tabelião liga no telefone que você informou. Deixe-o por perto e tenha os documentos da lista em mãos.`;
    case "enotariado":
      return `Videoconferência no e-Notariado: às ${slotTime}, entre na plataforma e-Notariado (www.e-notariado.org.br) com o e-mail do seu cadastro, num lugar tranquilo e com internet. O convite chega pela própria plataforma. Tenha o documento de identidade original em mãos.`;
    default:
      return arrivalNotice(slotTime);
  }
}

/**
 * Said wherever the appointment's key is: documents sent ahead in PDF let
 * the office start the analysis before the visit, and only a legible,
 * searchable PDF serves for that.
 */
export const DIGITAL_DOCUMENTS_NOTICE =
  "Você pode anexar os seus documentos digitais em PDF no agendamento, pela consulta do protocolo, para adiantar a análise. O documento tem que estar legível e em PDF pesquisável (com texto que dá para selecionar, não só a imagem escaneada).";

/**
 * The way to settle a doubt about the papers before the visit: send them to
 * the office by e-mail. Said wherever the list is, so nobody finds out at the
 * counter that a document would not do.
 */
export function documentsByEmailNotice(email: string): string {
  return `Ficou com dúvida sobre algum documento? Antes do atendimento, você pode enviá-lo para ${email}, e a serventia responde por e-mail.`;
}
