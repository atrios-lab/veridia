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
];

/** The seeds of an attribution, as the panel shows them before editing. */
export const seedsOf = (attribution: Attribution) =>
  LIBRARY_SEEDS.filter((s) => s.attribution === attribution);

/** Whether a library item serves the act (no acts: all of them). */
export const servesAct = (item: { acts: string[] }, act: string) =>
  item.acts.length === 0 || item.acts.includes(act);
