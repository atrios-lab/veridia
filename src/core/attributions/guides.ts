/**
 * The guides of the office's attributions (decision of 14/11/2026): for
 * each specialty, what it does, the law behind it, the books and indexes
 * the law requires, the deadlines, the words explained and what the panel
 * already does for it. Only what the federal law says is stated here, with
 * the article; what each state sets (the form of a book, a local index) is
 * marked to be checked in the Código de Normas do Foro Extrajudicial do RN
 * (Provimento nº 156/2016-CGJ/RN). Nothing is invented: a line without a
 * sure source is not written.
 */

export interface GuideBook {
  /** The book as the law names it. */
  name: string;
  /** What goes in it, in plain words. */
  holds: string;
  /** The article. */
  source: string;
}

export interface GuideTerm {
  term: string;
  meaning: string;
}

export interface GuideLink {
  label: string;
  href: string;
  /** What it does, in one line. */
  does: string;
}

export interface AttributionGuide {
  slug: string;
  /** The name in the sidebar. */
  name: string;
  /** The full name. */
  title: string;
  /** One sentence: what this attribution is for. */
  summary: string;
  /** The laws that govern it. */
  laws: { name: string; about: string }[];
  /** The acts it performs. */
  acts: { name: string; about: string; source?: string }[];
  books: GuideBook[];
  indexes: GuideBook[];
  deadlines: { what: string; source: string }[];
  /** Systems and communications the office must feed. */
  duties?: { what: string; source: string }[];
  terms: GuideTerm[];
  /** What the panel already does for this attribution. */
  panel: GuideLink[];
  /** What the state norm sets and must be checked there. */
  checkLocal: string[];
  /**
   * How the main document of the attribution is laid out, part by part,
   * as the office's own model does it (the matrícula, in the Registro de
   * Imóveis).
   */
  structure?: {
    title: string;
    intro: string;
    parts: { name: string; holds: string; source: string }[];
  };
}

export const CODIGO_DE_NORMAS_RN =
  "Código de Normas do Foro Extrajudicial do RN (Provimento nº 156/2016-CGJ/RN)";

const LRP = "Lei nº 6.015/1973 (Lei de Registros Públicos)";
const LNR = "Lei nº 8.935/1994 (Lei dos Notários e Registradores)";

export const ATTRIBUTION_GUIDES: readonly AttributionGuide[] = [
  {
    slug: "registro-civil",
    name: "Registro Civil",
    title: "Registro Civil das Pessoas Naturais",
    summary:
      "Registra os fatos da vida da pessoa: nascimento, casamento e óbito, e anota ou averba o que muda o estado civil.",
    laws: [
      {
        name: LRP,
        about:
          "Arts. 29 a 113: o que se registra, os livros, os prazos e as certidões.",
      },
      { name: LNR, about: "Art. 12: a competência dos oficiais de registro." },
    ],
    acts: [
      {
        name: "Nascimento",
        about: "Registro de quem nasceu com vida.",
        source: "Lei nº 6.015/1973, art. 29, I, e arts. 50 a 66",
      },
      {
        name: "Casamento",
        about:
          "Habilitação, proclamas e registro do casamento, inclusive o religioso com efeitos civis.",
        source: "Lei nº 6.015/1973, arts. 67 a 76",
      },
      {
        name: "Óbito",
        about: "Registro do falecimento; o natimorto vai no Livro C Auxiliar.",
        source: "Lei nº 6.015/1973, arts. 77 a 88, e art. 53, § 1º",
      },
      {
        name: "Emancipação, interdição e ausência",
        about:
          "Registro das sentenças e atos que mudam a capacidade da pessoa.",
        source: "Lei nº 6.015/1973, art. 29, IV a VI",
      },
      {
        name: "Averbações e anotações",
        about:
          "O que altera um registro (divórcio, reconhecimento de filho, mudança de nome) é averbado; o que liga um registro a outro é anotado.",
        source: "Lei nº 6.015/1973, art. 29, § 1º, e arts. 97 a 108",
      },
    ],
    books: [
      {
        name: "Livro A",
        holds: "Registro de nascimento.",
        source: "Lei nº 6.015/1973, art. 33, I",
      },
      {
        name: "Livro B",
        holds: "Registro de casamento.",
        source: "Lei nº 6.015/1973, art. 33, II",
      },
      {
        name: "Livro B Auxiliar",
        holds: "Registro de casamento religioso para efeitos civis.",
        source: "Lei nº 6.015/1973, art. 33, III",
      },
      {
        name: "Livro C",
        holds: "Registro de óbito.",
        source: "Lei nº 6.015/1973, art. 33, IV",
      },
      {
        name: "Livro C Auxiliar",
        holds: "Registro de natimorto.",
        source: "Lei nº 6.015/1973, art. 33, V",
      },
      {
        name: "Livro D",
        holds: "Registro de proclamas.",
        source: "Lei nº 6.015/1973, art. 33, VI",
      },
      {
        name: "Livro E",
        holds:
          "Demais atos do estado civil (emancipação, interdição, ausência, opção de nacionalidade e outros), no 1º Ofício ou na 1ª subdivisão judiciária da comarca.",
        source: "Lei nº 6.015/1973, art. 33, parágrafo único",
      },
    ],
    indexes: [
      {
        name: "Índice alfabético de cada livro",
        holds:
          "Os assentos pelo nome das pessoas a quem se referem. Pode ser em fichas.",
        source: "Lei nº 6.015/1973, art. 34",
      },
    ],
    deadlines: [
      {
        what: "Registro de nascimento: 15 dias do parto, ampliado em até 3 meses quando o lugar fica a mais de 30 km da sede do cartório.",
        source: "Lei nº 6.015/1973, art. 50",
      },
      {
        what: "Registro de óbito: em 24 horas do falecimento; não sendo possível, com a maior urgência, dentro dos prazos do art. 50.",
        source: "Lei nº 6.015/1973, art. 78",
      },
      {
        what: "Mapa trimestral ao IBGE dos nascimentos, casamentos e óbitos, nos primeiros 8 dias de janeiro, abril, julho e outubro.",
        source: "Lei nº 6.015/1973, art. 49",
      },
    ],
    duties: [
      {
        what: "Gratuidade do registro de nascimento e do assento de óbito, e da primeira certidão de cada um.",
        source: "Lei nº 6.015/1973, art. 30",
      },
      {
        what: "Envio dos dados ao Sistema Nacional de Informações de Registro Civil (Sirc).",
        source: "Decreto nº 9.929/2019",
      },
      {
        what: "Comunicações entre cartórios para as anotações (casamento e óbito anotados no nascimento).",
        source: "Lei nº 6.015/1973, art. 106",
      },
    ],
    terms: [
      {
        term: "Registro",
        meaning:
          "O assento principal no livro (o nascimento, o casamento, o óbito).",
      },
      {
        term: "Averbação",
        meaning:
          "O que se escreve à margem do registro para mudar o que ele diz: divórcio, reconhecimento de filho, mudança de nome.",
      },
      {
        term: "Anotação",
        meaning:
          "A remissão que liga um registro a outro: o casamento e o óbito anotados no registro de nascimento.",
      },
      {
        term: "Matrícula",
        meaning:
          "O número nacional de 32 dígitos de cada registro, impresso na certidão.",
      },
      {
        term: "Natimorto",
        meaning: "A criança nascida morta. Registro no Livro C Auxiliar.",
      },
    ],
    panel: [
      {
        label: "Índice do Registro Civil",
        href: "/admin/rcpn",
        does: "Pesquisar nascimentos, casamentos e óbitos pelo nome, mãe e data.",
      },
      {
        label: "Certidões",
        href: "/admin/rcpn/certidoes",
        does: "Emitir certidão no modelo nacional, com selo, para imprimir ou assinar digitalmente.",
      },
      {
        label: "Importar arquivos",
        href: "/admin/rcpn/importar",
        does: "Enviar os arquivos do sistema do registro civil para o índice.",
      },
    ],
    checkLocal: [
      "Os modelos de termo de abertura e encerramento dos livros e a forma das fichas.",
      "As comunicações à Justiça Eleitoral, ao INSS e às demais repartições, e seus prazos.",
    ],
  },
  {
    slug: "registro-de-imoveis",
    name: "Registro de Imóveis",
    title: "Registro de Imóveis",
    summary:
      "Dá publicidade e segurança aos direitos sobre imóveis: cada imóvel tem a sua matrícula, onde se registram e averbam os atos que o atingem.",
    laws: [
      {
        name: LRP,
        about:
          "Arts. 167 a 288: atos, livros, matrícula, prioridade, prazos e dúvida.",
      },
      { name: LNR, about: "Art. 12: a competência dos oficiais de registro." },
      {
        name: "Lei nº 13.465/2017",
        about:
          "Art. 76: o Operador Nacional do Sistema de Registro Eletrônico de Imóveis (ONR).",
      },
      {
        name: "Lei nº 14.382/2022",
        about:
          "O Sistema Eletrônico dos Registros Públicos (Serp) e os prazos atuais do registro.",
      },
      {
        name: "Lei nº 5.709/1971",
        about: "Art. 10: o livro de aquisição de imóvel rural por estrangeiro.",
      },
    ],
    acts: [
      {
        name: "Registro",
        about:
          "Os atos que constituem ou transferem direitos: compra e venda, doação, hipoteca, alienação fiduciária, usucapião, partilha e os demais da lista da lei.",
        source: "Lei nº 6.015/1973, art. 167, I",
      },
      {
        name: "Averbação",
        about:
          "O que altera o registro ou o imóvel: construção, demolição, casamento, cancelamento, mudança de nome da rua.",
        source: "Lei nº 6.015/1973, art. 167, II",
      },
      {
        name: "Abertura de matrícula",
        about:
          "Cada imóvel tem matrícula própria, aberta no primeiro registro feito depois da Lei nº 6.015.",
        source: "Lei nº 6.015/1973, art. 176, § 1º, I",
      },
      {
        name: "Prenotação",
        about: "O lançamento do título no Protocolo, que garante a prioridade.",
        source: "Lei nº 6.015/1973, arts. 182 a 186",
      },
      {
        name: "Nota devolutiva e dúvida",
        about:
          "Exigências por escrito quando o título não pode ser registrado; o interessado pode pedir que o oficial suscite dúvida ao juiz.",
        source: "Lei nº 6.015/1973, art. 198",
      },
    ],
    books: [
      {
        name: "Livro nº 1: Protocolo",
        holds:
          "O apontamento de todos os títulos apresentados, na ordem de chegada. Dá o número de ordem que decide a prioridade.",
        source: "Lei nº 6.015/1973, arts. 173, I, 174 e 186",
      },
      {
        name: "Livro nº 2: Registro Geral",
        holds:
          "As matrículas dos imóveis e os registros e averbações de cada uma.",
        source: "Lei nº 6.015/1973, arts. 173, II, e 176",
      },
      {
        name: "Livro nº 3: Registro Auxiliar",
        holds:
          "Os atos que a lei manda registrar e que não dizem respeito diretamente a um imóvel matriculado (por exemplo, a convenção de condomínio e o pacto antenupcial).",
        source: "Lei nº 6.015/1973, arts. 173, III, 177 e 178",
      },
      {
        name: "Livro de aquisição de imóvel rural por estrangeiro",
        holds:
          "O cadastro especial das aquisições de terra rural por pessoa estrangeira.",
        source: "Lei nº 5.709/1971, art. 10",
      },
    ],
    indexes: [
      {
        name: "Livro nº 4: Indicador Real",
        holds:
          "O índice dos imóveis: todos os que aparecem nos demais livros, com a remissão à matrícula e aos registros.",
        source: "Lei nº 6.015/1973, arts. 173, IV, e 179",
      },
      {
        name: "Livro nº 5: Indicador Pessoal",
        holds:
          "O índice das pessoas: todas as que, ativa ou passivamente, aparecem nos demais livros, com a remissão.",
        source: "Lei nº 6.015/1973, arts. 173, V, e 180",
      },
    ],
    deadlines: [
      {
        what: "Registro ou nota devolutiva em até 10 dias do protocolo, salvo os casos de prazo próprio da lei.",
        source: "Lei nº 6.015/1973, art. 188",
      },
      {
        what: "A prenotação perde o efeito em 20 dias do lançamento no Protocolo se o título não for registrado por falta de cumprir as exigências.",
        source: "Lei nº 6.015/1973, art. 205",
      },
    ],
    duties: [
      {
        what: "Atendimento eletrônico pelo Serp e integração ao ONR.",
        source: "Lei nº 14.382/2022 e Lei nº 13.465/2017, art. 76",
      },
      {
        what: "Os livros 2 a 5 podem ser substituídos por fichas.",
        source: "Lei nº 6.015/1973, art. 173, parágrafo único",
      },
    ],
    terms: [
      {
        term: "Matrícula",
        meaning:
          "A ficha única de cada imóvel, com a sua descrição e a história dos seus donos e ônus.",
      },
      {
        term: "Prenotação",
        meaning:
          "O número de ordem que o título recebe no Protocolo. Quem prenota primeiro tem prioridade.",
      },
      {
        term: "Indicador real",
        meaning: "O índice pelos imóveis (onde fica cada um nos livros).",
      },
      {
        term: "Indicador pessoal",
        meaning: "O índice pelas pessoas (em que atos cada uma aparece).",
      },
      {
        term: "Nota devolutiva",
        meaning:
          "O documento que diz por escrito o que falta para o título ser registrado.",
      },
      {
        term: "Dúvida",
        meaning:
          "Quando o interessado não concorda com as exigências, o oficial leva a questão ao juiz.",
      },
    ],
    panel: [
      {
        label: "Pedidos de serviço",
        href: "/admin/pedidos",
        does: "Os pedidos de certidão e de registro que chegam pelo site.",
      },
      {
        label: "Guias de transmissão",
        href: "/admin/utilitarios/guias",
        does: "As guias de ITIV, ITCD e laudêmio que antecedem o registro.",
      },
    ],
    structure: {
      title: "Como é a matrícula",
      intro:
        "A ficha do Livro nº 2 (Registro Geral), como no modelo da serventia: primeiro o imóvel e quem é dono dele; depois, um abaixo do outro, cada registro (R) e cada averbação (AV), na ordem em que entram.",
      parts: [
        {
          name: "Cabeçalho",
          holds:
            "Registro de Imóveis, Registro Geral, ficha, data de abertura, CNS da serventia, CNM (Código Nacional de Matrícula) e o número da matrícula.",
          source:
            "Lei nº 6.015/1973, art. 176, § 1º, II, 1 e 2 (número de ordem e data); CNM: normas do CNJ",
        },
        {
          name: "Imóvel",
          holds:
            "Urbano ou rural, inscrição imobiliária e sequencial do cadastro municipal, área, descrição perimétrica (medidas e confrontações) e localização.",
          source: "Lei nº 6.015/1973, art. 176, § 1º, II, 3",
        },
        {
          name: "Proprietários",
          holds:
            "Nome, domicílio e nacionalidade dos proprietários atuais e, quando o modelo traz, dos anteriores, com CPF ou CNPJ.",
          source: "Lei nº 6.015/1973, art. 176, § 1º, II, 4",
        },
        {
          name: "Registro anterior",
          holds: "O número da matrícula ou do registro de onde o imóvel veio.",
          source: "Lei nº 6.015/1973, art. 176, § 1º, II, 5",
        },
        {
          name: "Atos: R e AV",
          holds:
            "Cada lançamento começa com a letra (R para registro, AV para averbação), o número de ordem e o número da matrícula, por exemplo R-3-1.788 ou AV-1-1.788; depois a data e o número do protocolo.",
          source: "Lei nº 6.015/1973, art. 232; art. 176, § 1º, III, 1",
        },
        {
          name: "Conteúdo do registro",
          holds:
            "Quem transmite e quem adquire (nome, domicílio, nacionalidade e documento), o título (por exemplo, escritura pública de compra e venda), a sua forma e procedência, e o valor.",
          source: "Lei nº 6.015/1973, art. 176, § 1º, III, 2 a 6",
        },
        {
          name: "Fecho do ato",
          holds:
            "As custas recolhidas pelos selos digitais, conferíveis em https://selodigital.tjrn.jus.br, e a certificação do oficial.",
          source: CODIGO_DE_NORMAS_RN,
        },
      ],
    },
    checkLocal: [
      "A forma de escriturar o Protocolo, as fichas e os indicadores, e o modelo de matrícula.",
      "Os prazos de certidão e as regras do atendimento eletrônico no estado.",
    ],
  },
  {
    slug: "titulos-e-documentos",
    name: "Títulos e Documentos",
    title: "Registro de Títulos e Documentos",
    summary:
      "Registra instrumentos particulares para que valham contra terceiros ou para conservá-los, e faz notificações.",
    laws: [
      {
        name: LRP,
        about:
          "Arts. 127 a 166: o que se registra, os livros, a ordem do serviço e as notificações.",
      },
      { name: LNR, about: "Art. 12: a competência dos oficiais de registro." },
    ],
    acts: [
      {
        name: "Registro para prova e efeito contra terceiros",
        about:
          "Contratos e documentos particulares que a lei manda registrar para valerem perante terceiros.",
        source: "Lei nº 6.015/1973, arts. 127 e 129",
      },
      {
        name: "Registro para conservação",
        about: "Qualquer documento, a pedido, só para guardar e provar a data.",
        source: "Lei nº 6.015/1973, art. 127, parágrafo único",
      },
      {
        name: "Notificação",
        about:
          "Levar ao conhecimento de alguém o teor de um documento registrado, com certidão do que foi feito.",
        source: "Lei nº 6.015/1973, art. 160",
      },
    ],
    books: [
      {
        name: "Livro A: Protocolo",
        holds:
          "O apontamento de todos os títulos, documentos e papéis apresentados, dia a dia.",
        source: "Lei nº 6.015/1973, art. 132, I",
      },
      {
        name: "Livro B: Trasladação integral",
        holds:
          "A cópia integral dos títulos e documentos, para conservação e validade contra terceiros.",
        source: "Lei nº 6.015/1973, art. 132, II",
      },
      {
        name: "Livro C: Inscrição por extrato",
        holds:
          "O resumo de títulos e documentos, para efeito contra terceiros e autenticação da data.",
        source: "Lei nº 6.015/1973, art. 132, III",
      },
    ],
    indexes: [
      {
        name: "Livro D: Indicador Pessoal",
        holds: "O índice das pessoas que aparecem nos registros.",
        source: "Lei nº 6.015/1973, art. 132, IV",
      },
    ],
    deadlines: [
      {
        what: "Registro em 20 dias da assinatura, no domicílio das partes, para que os atos dos arts. 128 e 129 valham a partir da data do documento.",
        source: "Lei nº 6.015/1973, art. 130",
      },
    ],
    terms: [
      {
        term: "Efeito contra terceiros",
        meaning:
          "O documento registrado passa a valer também para quem não o assinou.",
      },
      {
        term: "Trasladação integral",
        meaning: "A cópia do documento inteiro no livro.",
      },
      {
        term: "Extrato",
        meaning: "O resumo do documento, com os dados essenciais.",
      },
      {
        term: "Notificação",
        meaning:
          "Avisar formalmente uma pessoa do conteúdo de um documento, com prova de que foi avisada.",
      },
    ],
    panel: [
      {
        label: "Pedidos de serviço",
        href: "/admin/pedidos",
        does: "Os pedidos de registro e de certidão que chegam pelo site.",
      },
    ],
    checkLocal: [
      "Os procedimentos de notificação (prazos, diligências, certidão) e o registro eletrônico no estado.",
    ],
  },
  {
    slug: "pessoas-juridicas",
    name: "Pessoas Jurídicas",
    title: "Registro Civil das Pessoas Jurídicas",
    summary:
      "Dá existência legal às associações, fundações, sociedades simples e partidos, e matricula jornais, periódicos, oficinas impressoras, rádios e agências de notícias.",
    laws: [
      {
        name: LRP,
        about:
          "Arts. 114 a 126: o que se inscreve, os livros e os requisitos do registro.",
      },
      {
        name: "Código Civil (Lei nº 10.406/2002)",
        about:
          "Arts. 45 e 46: a pessoa jurídica de direito privado começa a existir com a inscrição do ato constitutivo.",
      },
      { name: LNR, about: "Art. 12: a competência dos oficiais de registro." },
    ],
    acts: [
      {
        name: "Inscrição do ato constitutivo",
        about:
          "Estatuto ou contrato das associações, fundações, organizações religiosas e sociedades simples.",
        source: "Lei nº 6.015/1973, art. 114, I e II",
      },
      {
        name: "Partidos políticos",
        about: "Inscrição dos atos constitutivos e estatutos.",
        source: "Lei nº 6.015/1973, art. 114, III",
      },
      {
        name: "Averbação",
        about: "Todas as alterações por que passar o ato constitutivo.",
        source: "Código Civil, art. 45",
      },
      {
        name: "Matrícula de imprensa",
        about:
          "Jornais, periódicos, oficinas impressoras, empresas de radiodifusão e agências de notícias.",
        source: "Lei nº 6.015/1973, arts. 114, parágrafo único, e 122",
      },
    ],
    books: [
      {
        name: "Livro A",
        holds:
          "Inscrição dos atos constitutivos e estatutos das pessoas jurídicas do art. 114, I e II.",
        source: "Lei nº 6.015/1973, art. 116",
      },
      {
        name: "Livro B",
        holds:
          "Matrícula das oficinas impressoras, jornais, periódicos, empresas de radiodifusão e agências de notícias.",
        source: "Lei nº 6.015/1973, art. 116",
      },
    ],
    indexes: [],
    deadlines: [],
    terms: [
      {
        term: "Ato constitutivo",
        meaning:
          "O documento que cria a pessoa jurídica: estatuto ou contrato social.",
      },
      {
        term: "Inscrição",
        meaning: "O registro que faz a pessoa jurídica existir para o Direito.",
      },
      {
        term: "Requisitos do art. 120",
        meaning:
          "Denominação, fins, sede, duração, fundo social, administração e representação, reforma do estatuto, responsabilidade dos membros, extinção e destino do patrimônio, e os nomes dos fundadores e diretores.",
      },
    ],
    panel: [
      {
        label: "Pedidos de serviço",
        href: "/admin/pedidos",
        does: "Os pedidos que chegam pelo site.",
      },
    ],
    checkLocal: [
      "O protocolo e o índice das pessoas jurídicas (a lei federal não fixa a forma).",
      "Os documentos exigidos para cada tipo de pessoa jurídica e o prazo do registro.",
    ],
  },
  {
    slug: "protesto",
    name: "Protesto",
    title: "Tabelionato de Protesto de Títulos",
    summary:
      "Prova formalmente que uma dívida de título ou documento não foi paga (ou aceita, ou devolvida), depois de intimar o devedor.",
    laws: [
      {
        name: "Lei nº 9.492/1997 (Lei do Protesto)",
        about:
          "Todo o serviço: apresentação, protocolo, intimação, pagamento, registro, cancelamento, certidões e livros.",
      },
      { name: LNR, about: "Art. 11: a competência dos tabeliães de protesto." },
      {
        name: "Lei nº 13.775/2018",
        about:
          "Inseriu na Lei do Protesto a central nacional de serviços eletrônicos compartilhados (art. 41-A).",
      },
    ],
    acts: [
      {
        name: "Protocolo do título",
        about: "O título entra e recebe número, na ordem de chegada.",
        source: "Lei nº 9.492/1997, art. 5º",
      },
      {
        name: "Exame formal",
        about:
          "O tabelião só confere a forma do título; não investiga prescrição nem caducidade.",
        source: "Lei nº 9.492/1997, art. 9º",
      },
      {
        name: "Intimação do devedor",
        about: "Pessoal ou por correspondência; por edital nos casos da lei.",
        source: "Lei nº 9.492/1997, arts. 14 e 15",
      },
      {
        name: "Pagamento, desistência e sustação",
        about:
          "O devedor pode pagar no tabelionato; o apresentante pode desistir; o juiz pode sustar.",
        source: "Lei nº 9.492/1997, arts. 16, 17 e 19",
      },
      {
        name: "Registro do protesto",
        about: "Por falta de pagamento, de aceite ou de devolução.",
        source: "Lei nº 9.492/1997, arts. 21 e 22",
      },
      {
        name: "Cancelamento",
        about:
          "Com a carta de anuência do credor ou o título original, ou por ordem judicial.",
        source: "Lei nº 9.492/1997, art. 26",
      },
      {
        name: "Certidões",
        about:
          "Abrangem no mínimo os 5 anos anteriores ao pedido; às entidades de proteção ao crédito, quando pedem, em relação diária dos protestos e cancelamentos.",
        source: "Lei nº 9.492/1997, arts. 27 e 29",
      },
    ],
    books: [
      {
        name: "Livro de Protocolo",
        holds: "O apontamento dos títulos e documentos apresentados.",
        source: "Lei nº 9.492/1997, art. 32",
      },
      {
        name: "Livros de Registros de Protesto",
        holds:
          "Os protestos lavrados e as averbações, abertos e encerrados pelo tabelião.",
        source: "Lei nº 9.492/1997, art. 33",
      },
    ],
    indexes: [
      {
        name: "Índice de localização dos protestos",
        holds:
          "Os índices de localização dos protestos registrados, com o nome dos devedores. Nenhum nome pode ser excluído ou omitido.",
        source: "Lei nº 9.492/1997, art. 34",
      },
    ],
    deadlines: [
      {
        what: "Registro do protesto em 3 dias úteis da protocolização do título.",
        source: "Lei nº 9.492/1997, art. 12",
      },
      {
        what: "Guarda: 3 anos para o Livro de Protocolo; 10 anos para os livros de registro de protesto e os títulos.",
        source: "Lei nº 9.492/1997, art. 36",
      },
    ],
    terms: [
      {
        term: "Apresentante",
        meaning: "Quem leva o título a protesto (o credor ou quem ele indica).",
      },
      {
        term: "Intimação",
        meaning:
          "O aviso ao devedor de que o título foi apresentado e de que pode pagar.",
      },
      { term: "Sustação", meaning: "A ordem do juiz que suspende o protesto." },
      {
        term: "Carta de anuência",
        meaning: "A declaração do credor de que concorda com o cancelamento.",
      },
    ],
    panel: [
      {
        label: "Pedidos de serviço",
        href: "/admin/pedidos",
        does: "Os pedidos de certidão e de cancelamento que chegam pelo site.",
      },
    ],
    checkLocal: [
      "As tabelas e regras de emolumentos do protesto no estado, inclusive o pagamento postergado.",
      "A integração com a central nacional de protesto e os prazos locais de remessa.",
    ],
  },
  {
    slug: "distribuicao",
    name: "Distribuição",
    title: "Registro de Distribuição",
    summary:
      "Distribui os títulos e atos entre os serviços da mesma natureza, quando há mais de um, ou registra as comunicações recebidas, e certifica o que consta.",
    laws: [
      {
        name: LNR,
        about:
          "Art. 13: o que compete privativamente ao oficial de registro de distribuição.",
      },
      {
        name: "Lei nº 9.492/1997",
        about:
          "Art. 7º: a distribuição prévia de títulos a protesto só é obrigatória onde houver mais de um tabelionato de protesto.",
      },
    ],
    acts: [
      {
        name: "Distribuição ou registro das comunicações",
        about:
          "Distribuir de forma equitativa entre os serviços quando a lei exigir; senão, registrar as comunicações recebidas.",
        source: "Lei nº 8.935/1994, art. 13, I",
      },
      {
        name: "Averbações e cancelamentos",
        about: "Os de sua competência.",
        source: "Lei nº 8.935/1994, art. 13, II",
      },
      {
        name: "Certidões",
        about: "Dos atos e documentos que constam dos seus registros e papéis.",
        source: "Lei nº 8.935/1994, art. 13, III",
      },
    ],
    books: [],
    indexes: [],
    deadlines: [],
    terms: [
      {
        term: "Distribuição equitativa",
        meaning:
          "Repartir os atos entre os cartórios da mesma natureza, em igual medida.",
      },
      {
        term: "Certidão de distribuição",
        meaning:
          "A que diz se há títulos ou ações distribuídos em nome de uma pessoa.",
      },
    ],
    panel: [
      {
        label: "Pedidos de serviço",
        href: "/admin/pedidos",
        does: "Os pedidos de certidão que chegam pelo site.",
      },
    ],
    checkLocal: [
      "Os livros e índices da distribuição (a lei federal não os lista).",
      "O que é distribuído na comarca e a forma da certidão.",
    ],
  },
  {
    slug: "notas",
    name: "Notas",
    title: "Tabelionato de Notas",
    summary:
      "Dá forma jurídica à vontade das partes: escrituras, procurações, testamentos, atas notariais, reconhecimento de firma e autenticação.",
    laws: [
      {
        name: LNR,
        about:
          "Arts. 6º e 7º: a competência dos notários e o que os tabeliães de notas fazem.",
      },
      {
        name: "Código Civil (Lei nº 10.406/2002)",
        about:
          "Art. 215: os requisitos da escritura pública; arts. 1.864 a 1.875: testamento público e cerrado.",
      },
      {
        name: "Código de Processo Civil (Lei nº 13.105/2015)",
        about:
          "Art. 384: ata notarial; art. 610, § 1º: inventário por escritura; art. 733: divórcio consensual por escritura.",
      },
      {
        name: "Normas do CNJ",
        about:
          "Código Nacional de Normas (Provimento CNJ nº 149/2023), com a CENSEC e os atos eletrônicos pelo e-Notariado.",
      },
    ],
    acts: [
      {
        name: "Escrituras públicas",
        about:
          "Compra e venda, doação, inventário e partilha, divórcio, união estável e as demais.",
        source: "Lei nº 8.935/1994, art. 7º, I",
      },
      {
        name: "Procurações públicas",
        about: "Com a qualificação das partes e os poderes outorgados.",
        source: "Lei nº 8.935/1994, art. 7º, II",
      },
      {
        name: "Testamentos",
        about: "Lavrar o público e aprovar o cerrado.",
        source:
          "Lei nº 8.935/1994, art. 7º, II; Código Civil, arts. 1.864 a 1.875",
      },
      {
        name: "Ata notarial",
        about: "O tabelião descreve um fato que presenciou ou constatou.",
        source: "Lei nº 8.935/1994, art. 7º, III; CPC, art. 384",
      },
      {
        name: "Reconhecimento de firma",
        about: "Por semelhança ou por autenticidade.",
        source: "Lei nº 8.935/1994, art. 7º, IV",
      },
      {
        name: "Autenticação de cópias",
        about: "Declarar que a cópia confere com o original.",
        source: "Lei nº 8.935/1994, art. 7º, V",
      },
    ],
    books: [],
    indexes: [],
    deadlines: [],
    duties: [
      {
        what: "Informar os atos às centrais da CENSEC (testamentos, escrituras e procurações, separações, divórcios e inventários).",
        source: "Normas do CNJ (Código Nacional de Normas)",
      },
    ],
    terms: [
      {
        term: "Escritura pública",
        meaning:
          "O documento lavrado pelo tabelião no livro de notas, com fé pública.",
      },
      {
        term: "Traslado",
        meaning: "A primeira cópia da escritura, entregue às partes.",
      },
      {
        term: "Firma por autenticidade",
        meaning: "A assinatura feita na presença do tabelião.",
      },
      {
        term: "Firma por semelhança",
        meaning: "A assinatura comparada com a ficha de firma arquivada.",
      },
      {
        term: "CENSEC",
        meaning:
          "A central nacional onde os atos de notas são informados (testamentos, escrituras, procurações).",
      },
    ],
    panel: [
      {
        label: "Pedidos de serviço",
        href: "/admin/pedidos",
        does: "Os pedidos de escritura, procuração e certidão que chegam pelo site.",
      },
      {
        label: "Guias de transmissão",
        href: "/admin/utilitarios/guias",
        does: "As guias de ITIV, ITCD e laudêmio antes da escritura.",
      },
      {
        label: "Assinador digital",
        href: "/admin/utilitarios/assinador",
        does: "Assinar com certificado ICP-Brasil os PDFs da serventia.",
      },
    ],
    checkLocal: [
      "Os livros de notas (escrituras, procurações, testamentos) e o livro ou fichário de firmas: a forma é do Código de Normas.",
      "Os índices das escrituras e procurações e a sua escrituração.",
    ],
  },
  {
    slug: "caixa",
    name: "Caixa",
    title: "Caixa da serventia",
    summary:
      "Onde o ato é selado e o financeiro nasce: selos, receitas, despesas e suprimento, com o Livro Diário Auxiliar e as prestações de contas.",
    laws: [
      {
        name: "Lei nº 10.169/2000",
        about: "As normas gerais dos emolumentos.",
      },
      {
        name: LNR,
        about:
          "Art. 28: a percepção dos emolumentos integrais pelos atos praticados.",
      },
      {
        name: "Normas do CNJ",
        about:
          "O Livro Diário Auxiliar da Receita e da Despesa, no Código Nacional de Normas.",
      },
      {
        name: "Lei Complementar nº 116/2003",
        about:
          "Item 21.01 da lista: o ISS sobre os serviços de registros públicos, cartorários e notariais.",
      },
      {
        name: CODIGO_DE_NORMAS_RN,
        about: "O selo digital de fiscalização do TJRN e o papel de segurança.",
      },
    ],
    acts: [
      {
        name: "Selar o ato",
        about:
          "Todo ato leva o selo digital de fiscalização do TJRN, conferível em https://selodigital.tjrn.jus.br. Enquanto o Caixa não existe, o selo é colado no ato (como nas certidões do Registro Civil).",
      },
      {
        name: "Receitas",
        about: "Os emolumentos de cada ato, lançados no Livro Diário Auxiliar.",
      },
      {
        name: "Despesas",
        about: "As despesas da serventia, lançadas com o comprovante.",
      },
      {
        name: "Suprimento",
        about:
          "O dinheiro posto no caixa para troco ou despesa miúda, registrado para fechar o caixa do dia.",
      },
    ],
    books: [
      {
        name: "Livro Diário Auxiliar da Receita e da Despesa",
        holds: "Cada receita e despesa do dia, com o balanço mensal e o anual.",
        source: "Normas do CNJ (Código Nacional de Normas)",
      },
    ],
    indexes: [],
    deadlines: [],
    terms: [
      {
        term: "Emolumentos",
        meaning: "O valor que o cidadão paga pelo ato, fixado em lei estadual.",
      },
      {
        term: "Selo digital",
        meaning: "O código do TJRN que identifica e fiscaliza cada ato.",
      },
      {
        term: "Suprimento",
        meaning:
          "Dinheiro que entra no caixa para troco ou despesa, sem ser receita de ato.",
      },
    ],
    panel: [
      {
        label: "Livro Diário Auxiliar",
        href: "/admin/utilitarios/livro-diario",
        does: "Lançar receitas e despesas, gerar as páginas e o balanço.",
      },
      {
        label: "Declaração de ISS",
        href: "/admin/utilitarios/iss",
        does: "Declarar o ISS do mês a partir dos emolumentos.",
      },
      {
        label: "Papel de segurança",
        href: "/admin/utilitarios/papel-seguranca",
        does: "Controlar lotes, uso e extravios do papel de segurança.",
      },
      {
        label: "Solicitação de papéis",
        href: "/admin/utilitarios/solicitacao-papeis",
        does: "Pedir papel de segurança às empresas.",
      },
    ],
    checkLocal: [
      "A tabela de emolumentos do RN e os repasses (fundos) de cada ato.",
      "As regras do selo digital (lotes, tipos, remessa dos selos usados ao TJRN).",
    ],
  },
];

export function guideFor(slug: string): AttributionGuide | undefined {
  return ATTRIBUTION_GUIDES.find((g) => g.slug === slug);
}
