import type { Attribution } from "./qualificacao.ts";

/**
 * The first exigências of the library (decision of 15/11/2026), written
 * for this panel in generic words: no client's data, no copy of another
 * office's text. Each office edits, adds and excludes its own in the
 * panel; these only seed it. The fundamentos name the provisions in
 * force as read in the compiled text; the office confirms them before
 * using, and the panel says so.
 */
export interface LibrarySeed {
  key: string;
  attribution: Attribution;
  /** The acts it serves (ACTS keys); empty: every act of the attribution. */
  acts: string[];
  title: string;
  description: string;
  howToComply: string;
  basis: string;
}

const LRP = "Lei nº 6.015/1973";
const CNN = "Código Nacional de Normas (Provimento CNJ nº 149/2023)";

export const LIBRARY_SEEDS: LibrarySeed[] = [
  // ------------------------------------------------ RCPN, any act
  {
    key: "rcpn-requerimento",
    attribution: "rcpn",
    acts: [],
    title: "Requerimento do interessado",
    description:
      "O ato depende de requerimento escrito do interessado, que não foi apresentado ou não está assinado.",
    howToComply:
      "Apresentar requerimento escrito, datado e assinado pelo interessado ou por procurador com poderes para o ato.",
    basis: `${LRP}, art. 13, II.`,
  },
  {
    key: "rcpn-identificacao",
    attribution: "rcpn",
    acts: [],
    title: "Identificação do requerente",
    description:
      "Não foi apresentado documento oficial de identificação com foto de quem requer o ato.",
    howToComply:
      "Apresentar documento oficial de identificação com foto, original ou cópia autenticada.",
    basis: `${LRP}, art. 13, e regras de identificação das partes do ${CNN}.`,
  },
  {
    key: "rcpn-procuracao",
    attribution: "rcpn",
    acts: [],
    title: "Procuração com poderes especiais",
    description:
      "O requerimento foi feito por procurador sem instrumento de mandato, ou o mandato não traz poderes especiais e expressos para o ato pedido.",
    howToComply:
      "Apresentar procuração com poderes especiais e expressos para o ato, na forma que a lei exige para ele.",
    basis: "Código Civil, arts. 657 e 661, § 1º.",
  },
  {
    key: "rcpn-certidao-registro",
    attribution: "rcpn",
    acts: [
      "retificacao",
      "prenome",
      "sobrenome",
      "filiacao",
      "socioafetiva",
      "divorcio",
      "sentenca",
    ],
    title: "Certidão atualizada do registro",
    description:
      "O registro a ser alterado é de outra serventia, e não foi apresentada certidão atualizada dele.",
    howToComply:
      "Apresentar certidão atualizada (de inteiro teor, quando necessária) do registro em que o ato será praticado.",
    basis: `${LRP}, arts. 29, § 1º, e 109.`,
  },
  {
    key: "rcpn-documento-estrangeiro",
    attribution: "rcpn",
    acts: [],
    title: "Documento estrangeiro: apostila e tradução",
    description:
      "Foi apresentado documento expedido no exterior sem apostila (ou legalização consular) e sem tradução para o português.",
    howToComply:
      "Apresentar o documento apostilado (ou legalizado no consulado, se o país não aderiu à Convenção da Apostila) e sua tradução por tradutor público.",
    basis: `${LRP}, art. 148; Decreto nº 8.660/2016 (Convenção da Apostila).`,
  },
  // ------------------------------------------------ RCPN, by act
  {
    key: "rcpn-retificacao-prova",
    attribution: "rcpn",
    acts: ["retificacao"],
    title: "Prova do erro a retificar",
    description:
      "Não foi apresentado documento que comprove o erro apontado no registro, ou o erro exige indagação que não cabe na via administrativa.",
    howToComply:
      "Apresentar documento que comprove de plano o dado correto (por exemplo, certidão ou documento anterior ao registro). Se a correção exigir produção de prova, ela deve ser pedida ao juízo.",
    basis: `${LRP}, arts. 109 e 110.`,
  },
  {
    key: "rcpn-prenome-idade",
    attribution: "rcpn",
    acts: ["prenome"],
    title: "Alteração imotivada de prenome: requisitos",
    description:
      "A alteração imotivada de prenome no cartório cabe à pessoa maior de 18 anos, uma única vez; o requerimento não demonstra esses requisitos.",
    howToComply:
      "Apresentar documento que comprove a maioridade e declarar, no requerimento, que não houve alteração imotivada anterior; para menor de 18 anos, a alteração depende de outra via prevista em lei.",
    basis: `${LRP}, art. 56.`,
  },
  {
    key: "rcpn-prenome-certidoes",
    attribution: "rcpn",
    acts: ["prenome", "sobrenome"],
    title: "Certidões e documentos exigidos pela norma",
    description:
      "Não foram apresentados todos os documentos e certidões que a norma nacional exige para a alteração de nome no cartório.",
    howToComply:
      "Apresentar os documentos e certidões relacionados pela serventia conforme o Código Nacional de Normas, todos atualizados.",
    basis: `${LRP}, arts. 56 e 57; ${CNN}.`,
  },
  {
    key: "rcpn-sobrenome-hipotese",
    attribution: "rcpn",
    acts: ["sobrenome"],
    title: "Hipótese legal de alteração do sobrenome",
    description:
      "O pedido de alteração de sobrenome não se enquadra, ou não demonstra se enquadrar, em hipótese em que a lei a admite diretamente no cartório.",
    howToComply:
      "Indicar a hipótese legal do pedido e apresentar o documento que a comprove (por exemplo, a certidão que mostra o sobrenome de família a incluir).",
    basis: `${LRP}, art. 57.`,
  },
  {
    key: "rcpn-filiacao-anuencia",
    attribution: "rcpn",
    acts: ["filiacao"],
    title: "Anuência do filho maior ou da mãe",
    description:
      "O reconhecimento depende da anuência de quem a lei indica (o filho maior, ou o representante do filho menor), que não foi apresentada.",
    howToComply:
      "Apresentar a anuência escrita, com firma reconhecida ou colhida na serventia, de quem deve consentir com o reconhecimento.",
    basis: "Código Civil, arts. 1.609 e 1.614; Lei nº 8.560/1992, art. 1º.",
  },
  {
    key: "rcpn-socioafetiva-requisitos",
    attribution: "rcpn",
    acts: ["socioafetiva"],
    title: "Requisitos do reconhecimento socioafetivo",
    description:
      "Não foram demonstrados os requisitos do reconhecimento voluntário da filiação socioafetiva no cartório (idade do filho, consentimento, prova do vínculo).",
    howToComply:
      "Apresentar os documentos que provem o vínculo socioafetivo e o consentimento exigido, conforme a seção do Código Nacional de Normas sobre o tema.",
    basis: `${CNN}, reconhecimento voluntário da filiação socioafetiva.`,
  },
  {
    key: "rcpn-divorcio-titulo",
    attribution: "rcpn",
    acts: ["divorcio"],
    title: "Título do divórcio ou da separação",
    description:
      "Não foi apresentado o título hábil: escritura pública de divórcio ou separação, ou sentença com certidão de trânsito em julgado (ou o mandado judicial).",
    howToComply:
      "Apresentar o traslado ou a certidão da escritura pública, ou o mandado ou a carta de sentença com o trânsito em julgado.",
    basis: `${LRP}, art. 29, § 1º; Código de Processo Civil, art. 733.`,
  },
  {
    key: "rcpn-tardio-requerimento",
    attribution: "rcpn",
    acts: ["registro-tardio"],
    title: "Registro fora do prazo: requerimento e provas",
    description:
      "O registro de nascimento fora do prazo legal exige requerimento com os elementos do assento e as declarações e provas previstas, que não foram apresentadas por completo.",
    howToComply:
      "Apresentar o requerimento com os elementos do registro, assinado, e as declarações e documentos que a lei e a norma exigem para o registro tardio.",
    basis: `${LRP}, art. 46.`,
  },
  {
    key: "rcpn-traslado-documentos",
    attribution: "rcpn",
    acts: ["traslado"],
    title: "Certidão do assento estrangeiro",
    description:
      "Para o traslado é preciso a certidão do assento lavrado no exterior, legalizada ou apostilada, e traduzida, ou a certidão do registro consular.",
    howToComply:
      "Apresentar a certidão do registro consular brasileiro ou a certidão estrangeira apostilada e traduzida, com os demais documentos exigidos para o traslado.",
    basis: `${LRP}, art. 32, § 1º; Resolução CNJ nº 155/2012.`,
  },
  {
    key: "rcpn-uniao-titulo",
    attribution: "rcpn",
    acts: ["uniao-estavel"],
    title: "Título da união estável",
    description:
      "O registro no Livro E se faz por sentença, por termo declaratório formalizado perante o oficial ou por escritura pública, título que não foi apresentado.",
    howToComply:
      "Apresentar a sentença, o termo declaratório ou a escritura pública de reconhecimento (ou de dissolução) da união estável.",
    basis: `${LRP}, art. 94-A.`,
  },
  {
    key: "rcpn-conversao-requisitos",
    attribution: "rcpn",
    acts: ["conversao"],
    title: "Conversão em casamento: documentos da habilitação",
    description:
      "A conversão da união estável em casamento depende dos documentos e da habilitação exigidos para o casamento, que não foram apresentados por completo.",
    howToComply:
      "Apresentar o requerimento dos companheiros e os documentos da habilitação para o casamento.",
    basis: `Código Civil, art. 1.726; ${LRP}, art. 70-A.`,
  },
  {
    key: "rcpn-religioso-prazo",
    attribution: "rcpn",
    acts: ["casamento-religioso"],
    title: "Casamento religioso: habilitação e prazo",
    description:
      "O registro civil do casamento religioso depende de habilitação prévia e do pedido dentro do prazo legal após a celebração; não foram demonstrados.",
    howToComply:
      "Apresentar a certidão de habilitação e o termo ou assento do casamento religioso, com o pedido de registro dentro do prazo; fora dele, será necessária nova habilitação.",
    basis: `Código Civil, arts. 1.515 e 1.516; ${LRP}, arts. 71 a 75.`,
  },
  {
    key: "rcpn-sentenca-transito",
    attribution: "rcpn",
    acts: ["sentenca"],
    title: "Mandado judicial com trânsito em julgado",
    description:
      "A averbação de decisão judicial exige o mandado ou a carta de sentença com a certidão do trânsito em julgado, que não foram apresentados.",
    howToComply:
      "Apresentar o mandado judicial (ou a carta de sentença) acompanhado da certidão do trânsito em julgado.",
    basis: `${LRP}, art. 29, § 1º.`,
  },
  {
    key: "rcpn-obito-atestado",
    attribution: "rcpn",
    acts: ["obito"],
    title: "Atestado de óbito e declarante",
    description:
      "O registro do óbito depende do atestado médico (ou da declaração de duas testemunhas, onde não houver médico) e dos dados do declarante, que não foram apresentados.",
    howToComply:
      "Apresentar a declaração de óbito assinada pelo médico ou, na falta, a declaração de duas testemunhas, e o documento de identificação do declarante.",
    basis: `${LRP}, arts. 77 e 80.`,
  },
  // ------------------------------------------------ Registro de Imóveis
  {
    key: "ri-continuidade",
    attribution: "ri",
    acts: ["registro", "averbacao"],
    title: "Continuidade: registro anterior em nome do transmitente",
    description:
      "O imóvel não está matriculado ou registrado em nome de quem o transmite ou onera no título.",
    howToComply:
      "Apresentar para registro o título anterior que põe o imóvel em nome do transmitente, ou retificar o título para constar o titular registral.",
    basis: `${LRP}, arts. 195 e 237.`,
  },
  {
    key: "ri-especialidade-objetiva",
    attribution: "ri",
    acts: ["registro", "abertura-matricula", "retificacao"],
    title: "Descrição do imóvel igual à da matrícula",
    description:
      "A descrição do imóvel no título não coincide com a da matrícula ou do registro anterior (medidas, confrontações, área ou localização).",
    howToComply:
      "Retificar o título para que a descrição do imóvel corresponda à da matrícula, ou promover antes a retificação do registro.",
    basis: `${LRP}, arts. 176, § 1º, e 225.`,
  },
  {
    key: "ri-especialidade-subjetiva",
    attribution: "ri",
    acts: [],
    title: "Qualificação completa das partes",
    description:
      "O título não traz a qualificação completa de todas as partes (nome, nacionalidade, estado civil, profissão, documento, CPF ou CNPJ, domicílio e, se casadas, o regime de bens).",
    howToComply:
      "Retificar o título, ou apresentar declaração com os dados que faltam acompanhada dos documentos que os comprovem.",
    basis: `${LRP}, art. 176, § 1º, III.`,
  },
  {
    key: "ri-imposto-transmissao",
    attribution: "ri",
    acts: ["registro"],
    title: "Imposto de transmissão",
    description:
      "Não foi comprovado o pagamento, a isenção ou a não incidência do imposto de transmissão (ITBI ou ITCD) devido pelo ato.",
    howToComply:
      "Apresentar a guia quitada do imposto, ou a declaração de isenção ou de não incidência expedida pelo fisco.",
    basis: `${LRP}, art. 289.`,
  },
  {
    key: "ri-rural-ccir-itr",
    attribution: "ri",
    acts: ["registro", "abertura-matricula"],
    title: "Imóvel rural: CCIR e ITR",
    description:
      "Para imóvel rural não foram apresentados o Certificado de Cadastro de Imóvel Rural (CCIR) quitado e a prova de quitação do ITR dos últimos exercícios.",
    howToComply:
      "Apresentar o CCIR do exercício, quitado, e a certidão negativa (ou positiva com efeito de negativa) de débitos do ITR.",
    basis: "Lei nº 4.947/1966, art. 22; Lei nº 9.393/1996, art. 21.",
  },
  {
    key: "ri-georreferenciamento",
    attribution: "ri",
    acts: ["registro", "abertura-matricula", "retificacao"],
    title: "Georreferenciamento do imóvel rural",
    description:
      "O ato exige a identificação do imóvel rural por georreferenciamento certificado pelo INCRA, nos casos e prazos da lei, que não foi apresentada.",
    howToComply:
      "Apresentar a planta e o memorial descritivo georreferenciados, com a certificação do INCRA, e as anuências dos confrontantes quando exigidas.",
    basis: `${LRP}, art. 176, §§ 3º e 4º; Decreto nº 4.449/2002.`,
  },
  {
    key: "ri-outorga-conjugal",
    attribution: "ri",
    acts: ["registro"],
    title: "Outorga do cônjuge",
    description:
      "O transmitente é casado em regime que exige a autorização do outro cônjuge para alienar ou gravar imóvel, e ela não consta do título.",
    howToComply:
      "Apresentar o título com o comparecimento ou a anuência do cônjuge, ou o suprimento judicial da outorga.",
    basis: "Código Civil, art. 1.647, I.",
  },
  {
    key: "ri-titulo-habil",
    attribution: "ri",
    acts: [],
    title: "Título hábil a registro",
    description:
      "O documento apresentado não é título admitido a registro (escritura pública, escrito particular autorizado em lei com firmas reconhecidas, ato estrangeiro legalizado, carta de sentença ou formal de partilha, entre outros).",
    howToComply:
      "Apresentar o ato na forma de título que a lei admite a registro, com os requisitos próprios dele.",
    basis: `${LRP}, art. 221.`,
  },
  {
    key: "ri-titulo-judicial",
    attribution: "ri",
    acts: [],
    title: "Título judicial: peças e trânsito em julgado",
    description:
      "A carta de sentença, o formal de partilha ou o mandado não traz as peças necessárias ou a certidão do trânsito em julgado.",
    howToComply:
      "Apresentar o título judicial completo, com as peças exigidas e a certidão do trânsito em julgado (ou a decisão que autoriza o cumprimento).",
    basis: `${LRP}, art. 221, IV.`,
  },
  // ------------------------------------------------ Notas
  {
    key: "notas-certidoes-imovel",
    attribution: "notas",
    acts: ["escritura"],
    title: "Certidões do imóvel e fiscais",
    description:
      "Para lavrar a escritura relativa a imóvel faltam a certidão de propriedade e de ônus reais atualizada, as certidões fiscais e a prova do pagamento do imposto de transmissão.",
    howToComply:
      "Apresentar a certidão de inteiro teor da matrícula com ônus reais, atualizada, as certidões fiscais do imóvel e a guia quitada do ITBI ou ITCD (ou a declaração de isenção).",
    basis: "Lei nº 7.433/1985, art. 1º, § 2º; Decreto nº 93.240/1986.",
  },
  {
    key: "notas-identificacao-partes",
    attribution: "notas",
    acts: [],
    title: "Identificação e capacidade das partes",
    description:
      "Não foram apresentados os documentos de identificação e de estado civil das partes, necessários à qualificação na escritura.",
    howToComply:
      "Apresentar documento oficial com foto, CPF e certidão de nascimento ou casamento atualizada de cada parte.",
    basis: "Código Civil, art. 215, § 1º.",
  },
  {
    key: "notas-indisponibilidade",
    attribution: "notas",
    acts: ["escritura"],
    title: "Consulta de indisponibilidade de bens",
    description:
      "A consulta à Central Nacional de Indisponibilidade de Bens em nome do alienante indicou ordem de indisponibilidade que impede o ato.",
    howToComply:
      "Apresentar a decisão que levantou a indisponibilidade, ou a autorização judicial para o ato.",
    basis: `${CNN}, Central Nacional de Indisponibilidade de Bens.`,
  },
  {
    key: "notas-inventario-advogado",
    attribution: "notas",
    acts: ["escritura"],
    title: "Inventário, partilha ou divórcio: advogado e requisitos",
    description:
      "O inventário, a partilha ou o divórcio extrajudicial exige partes capazes e concordes e a assistência de advogado, que não foram demonstradas.",
    howToComply:
      "Apresentar a qualificação e a procuração do advogado que assistirá as partes e os documentos que provem os requisitos da via extrajudicial.",
    basis: "Código de Processo Civil, arts. 610, §§ 1º e 2º, e 733.",
  },
  {
    key: "notas-procuracao",
    attribution: "notas",
    acts: [],
    title: "Procuração com a forma e os poderes do ato",
    description:
      "A parte será representada por procuração que não tem a forma pública exigida para o ato ou não traz os poderes especiais e expressos necessários.",
    howToComply:
      "Apresentar procuração por instrumento público, atualizada, com poderes especiais e expressos para o ato.",
    basis: "Código Civil, arts. 657 e 661, § 1º.",
  },
  // ------------------------------------------------ Títulos e Documentos
  {
    key: "rtd-traducao",
    attribution: "rtd",
    acts: [],
    title: "Documento em língua estrangeira",
    description:
      "O documento está em língua estrangeira e não veio acompanhado da tradução para o português.",
    howToComply:
      "Apresentar a tradução por tradutor público, para ser registrada junto com o original.",
    basis: `${LRP}, art. 148.`,
  },
  {
    key: "rtd-cabimento",
    attribution: "rtd",
    acts: ["registro"],
    title: "Cabimento do registro em Títulos e Documentos",
    description:
      "O documento apresentado não se enquadra nas hipóteses de registro em Títulos e Documentos indicadas no pedido, ou o pedido não diz se o registro é para conservação ou para valer contra terceiros.",
    howToComply:
      "Indicar no requerimento a finalidade do registro (conservação ou eficácia contra terceiros) e a hipótese legal em que o documento se enquadra.",
    basis: `${LRP}, arts. 127 e 129.`,
  },
  {
    key: "rtd-notificacao-endereco",
    attribution: "rtd",
    acts: ["notificacao"],
    title: "Notificação: destinatário e endereço",
    description:
      "O pedido de notificação não traz a qualificação completa do destinatário e o endereço em que ele deve ser procurado.",
    howToComply:
      "Completar o requerimento com o nome, o documento e o endereço completo do destinatário.",
    basis: `${LRP}, art. 160.`,
  },
  // ------------------------------------------------ Pessoas Jurídicas
  {
    key: "rcpj-requisitos-estatuto",
    attribution: "rcpj",
    acts: ["registro", "averbacao"],
    title: "Requisitos do estatuto ou contrato social",
    description:
      "O estatuto ou contrato não traz todos os elementos que a lei exige (denominação, fins, sede, tempo de duração, administração, representação, reforma do estatuto, destino do patrimônio na extinção, entre outros).",
    howToComply:
      "Apresentar o estatuto ou o contrato reformado com os elementos que faltam, aprovado na forma que ele mesmo prevê.",
    basis: `Código Civil, arts. 46 e 54; ${LRP}, art. 120.`,
  },
  {
    key: "rcpj-visto-advogado",
    attribution: "rcpj",
    acts: ["registro"],
    title: "Visto de advogado no ato constitutivo",
    description:
      "O ato constitutivo da pessoa jurídica não traz o visto de advogado, sem o qual não pode ser admitido a registro.",
    howToComply:
      "Apresentar o ato constitutivo visado por advogado, com o nome e o número de inscrição na OAB.",
    basis: "Lei nº 8.906/1994, art. 1º, § 2º.",
  },
  {
    key: "rcpj-ata-assembleia",
    attribution: "rcpj",
    acts: ["averbacao"],
    title: "Ata: convocação, quórum e presença",
    description:
      "A ata não demonstra a convocação, o quórum e a deliberação exigidos pelo estatuto para a matéria, ou não veio acompanhada da lista de presença.",
    howToComply:
      "Apresentar a ata com a menção à convocação, o quórum de instalação e de deliberação, e a lista de presença assinada.",
    basis: "Código Civil, art. 59; estatuto da entidade.",
  },
  // ------------------------------------------------ Protesto
  {
    key: "protesto-requisitos-formais",
    attribution: "protesto",
    acts: ["protesto"],
    title: "Requisitos formais do título",
    description:
      "O título ou documento de dívida apresentado tem vício formal que impede o protesto (falta de requisito essencial, rasura, valor ou vencimento ilegíveis).",
    howToComply:
      "Apresentar o título sem o vício, ou o documento de dívida com todos os requisitos que a lei própria dele exige.",
    basis: "Lei nº 9.492/1997, art. 9º.",
  },
  {
    key: "protesto-devedor-endereco",
    attribution: "protesto",
    acts: ["protesto"],
    title: "Identificação e endereço do devedor",
    description:
      "A indicação do devedor não traz o documento de identificação (CPF ou CNPJ) ou o endereço para a intimação.",
    howToComply:
      "Completar a indicação com o nome, o CPF ou CNPJ e o endereço completo do devedor.",
    basis: "Lei nº 9.492/1997, arts. 9º e 14.",
  },
  {
    key: "protesto-duplicata",
    attribution: "protesto",
    acts: ["protesto"],
    title: "Duplicata sem aceite: comprovação do negócio",
    description:
      "A duplicata sem aceite foi apresentada sem a declaração ou o comprovante da entrega da mercadoria ou da prestação do serviço.",
    howToComply:
      "Apresentar a declaração do sacador de que mantém o comprovante da entrega ou da prestação, ou o próprio comprovante.",
    basis: "Lei nº 5.474/1968, arts. 13 e 15; Lei nº 9.492/1997, art. 8º.",
  },
  {
    key: "protesto-cancelamento",
    attribution: "protesto",
    acts: ["cancelamento"],
    title: "Cancelamento: título original ou anuência",
    description:
      "O pedido de cancelamento não veio com o título protestado original ou com a carta de anuência do credor com a firma reconhecida.",
    howToComply:
      "Apresentar o título original ou a declaração de anuência do credor, com a identificação e a firma reconhecida.",
    basis: "Lei nº 9.492/1997, art. 26.",
  },
];

/** The seeds of an attribution, as the panel shows them before editing. */
export const seedsOf = (attribution: Attribution) =>
  LIBRARY_SEEDS.filter((s) => s.attribution === attribution);

/** Whether a library item serves the act (no acts: all of them). */
export const servesAct = (item: { acts: string[] }, act: string) =>
  item.acts.length === 0 || item.acts.includes(act);
