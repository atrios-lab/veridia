import type { Attribution } from "./qualificacao.ts";

/**
 * The first exigências of the library (decision of 15/11/2026), written
 * for this panel in generic words: no client's data, no copy of another
 * office's text. Each office edits, adds and excludes its own in the
 * panel; these only seed it. The citations of the Código Nacional de
 * Normas were checked on 15/11/2026 in the CNJ's compiled text (socio-
 * afetiva, arts. 505 ff.; alteração de nome, arts. 515-A ff.; CNIB, arts.
 * 320 ff.); the laws' articles are confirmed by the office before using,
 * and the panel says so.
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
const CNRN = "Código de Normas da CGJ/RN (Provimento CGJ/RN nº 156/2016)";

export const LIBRARY_SEEDS: LibrarySeed[] = [
  // ------------------------------------------------ RI, certidões
  // Lei nº 6.015/1973, arts. 17, 19, 179 and 180, checked on 27/11/2026
  // in the compiled text (planalto.gov.br).
  {
    key: "ri-certidao-dados-busca",
    attribution: "ri",
    acts: ["certidao"],
    title: "Dados para a busca",
    description:
      "O pedido de certidão não traz os dados que a busca exige: pelo Indicador Pessoal, o nome completo e o CPF ou CNPJ da pessoa; pelo Indicador Real, a matrícula, a transcrição ou a identificação e a localização do imóvel.",
    howToComply:
      "Informar o nome completo e o CPF ou CNPJ da pessoa pesquisada (busca pessoal) ou a matrícula, a transcrição ou a localização do imóvel (busca real).",
    basis: `${LRP}, arts. 179 e 180 (Indicadores Real e Pessoal).`,
  },
  {
    key: "ri-certidao-especie",
    attribution: "ri",
    acts: ["certidao"],
    title: "Espécie da certidão e período da busca",
    description:
      "O pedido não diz que certidão quer (inteiro teor, ônus reais, negativa ou positiva de propriedade, vintenária, em relatório conforme quesitos) nem o período da busca, quando ele importa.",
    howToComply:
      "Indicar a espécie da certidão e, sendo busca, o período a pesquisar; em relatório, formular os quesitos.",
    basis: `${LRP}, art. 19.`,
  },
  {
    key: "ri-certidao-assinatura-internet",
    attribution: "ri",
    acts: ["certidao"],
    title: "Assinatura do pedido feito pela internet",
    description:
      "O pedido chegou pela internet sem assinatura eletrônica avançada ou qualificada.",
    howToComply:
      "Assinar o requerimento com assinatura eletrônica avançada ou qualificada (por exemplo, gov.br ou certificado ICP-Brasil) e reenviar.",
    basis: `${LRP}, art. 17, § 1º.`,
  },
  {
    key: "ri-certidao-emolumentos",
    attribution: "ri",
    acts: ["certidao"],
    title: "Emolumentos da certidão",
    description:
      "Os emolumentos da certidão, pela tabela vigente, ainda não foram pagos.",
    howToComply:
      "Pagar os emolumentos indicados pela serventia, conforme a tabela de emolumentos vigente.",
    basis: `${LRP}, art. 14; tabela de emolumentos vigente.`,
  },
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
    basis: `${LRP}, art. 56; ${CNN}, arts. 515-A e seguintes.`,
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
    basis: `${LRP}, arts. 56 e 57; ${CNN}, arts. 515-A e seguintes.`,
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
    basis: `${LRP}, art. 57; ${CNN}, arts. 515-A e seguintes.`,
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
    basis: `${CNN}, arts. 505 e seguintes (parentalidade socioafetiva).`,
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
  // ------------------------- Registro de Imóveis: retificação de área e
  // georreferenciamento (decision of 16/11/2026: "aprenda isso para a base
  // jurídica"). Taken, generic and without anyone's data, from a
  // qualificação-modelo the office sent, whose fundamentos it checked in
  // the official sources on 15/11/2026.
  ...[
    {
      key: "ri-geo-requerimento",
      title: "Requerimento do proprietário",
      description:
        "Não há requerimento do proprietário pedindo a averbação do georreferenciamento e a retificação de área.",
      howToComply:
        "Apresentar requerimento do proprietário, com firma reconhecida ou assinatura eletrônica avançada ou qualificada, dizendo o que se pede (averbação do georreferenciamento e retificação da área, da área registrada para a área levantada) e o destino das glebas, quando forem mais de uma (encerramento da matrícula e abertura de uma matrícula por gleba).",
      basis: `${LRP}, art. 213, II; Decreto nº 4.449/2002, art. 9º, § 5º; ${CNN}, art. 440-AX, caput e §§ 2º, 4º a 6º; ${CNRN}, arts. 338, 414 e 418.`,
    },
    {
      key: "ri-geo-averbacoes-previas",
      title: "Averbações prévias do proprietário",
      description:
        "Os dados do proprietário na matrícula estão desatualizados (por exemplo, estado civil, nome ou CPF).",
      howToComply:
        "Requerer, com os documentos que provam a mudança (certidão de casamento, documento com o CPF), a averbação do casamento, da alteração do nome e do CPF antes da retificação.",
      basis: `${CNN}, arts. 440-AS, I e II, e 440-AU.`,
    },
    {
      key: "ri-geo-itr",
      title: "ITR dos últimos cinco exercícios e NIRF ou CIB",
      description:
        "Não foi comprovada a quitação do ITR dos últimos cinco exercícios nem informado o número do imóvel na Receita Federal.",
      howToComply:
        "Apresentar a certidão negativa de débitos do ITR, ou as guias pagas dos últimos cinco exercícios, e informar o NIRF ou o CIB do imóvel.",
      basis: `Decreto nº 4.449/2002, art. 9º, § 5º; ${CNN}, art. 440-AQ, IV, b; ${CNRN}, art. 413, VII.`,
    },
    {
      key: "ri-geo-ccir",
      title: "CCIR do último exercício",
      description:
        "O CCIR apresentado não é do último exercício ou está vencido.",
      howToComply:
        "Apresentar o CCIR do último exercício, quitado, ou o protocolo de recadastramento com o certificado anterior.",
      basis: `Decreto nº 4.449/2002, art. 9º, § 5º; ${CNRN}, arts. 410 e 413, VI.`,
    },
    {
      key: "ri-geo-memorial-certificado",
      title: "Memorial descritivo igual ao certificado pelo SIGEF",
      description:
        "O memorial descritivo apresentado diverge do memorial certificado no SIGEF (em azimutes, distâncias, sistema de cálculo ou texto incompleto).",
      howToComply:
        "Apresentar o memorial de cada gleba idêntico ao certificado pelo SIGEF, com o número da certificação, assinado pelo responsável técnico e sem lacunas.",
      basis: `${LRP}, art. 213, § 14; Decreto nº 4.449/2002, art. 9º, §§ 5º e 9º; ${CNRN}, art. 413, I.`,
    },
    {
      key: "ri-geo-planta",
      title: "Planta assinada pelo responsável técnico",
      description:
        "A planta apresentada não está assinada pelo responsável técnico ou não indica os confrontantes.",
      howToComply:
        "Apresentar a planta de cada gleba assinada pelo responsável técnico, com os confrontantes e as matrículas deles, as vias públicas e as faixas de servidão ou de domínio que cortam ou limitam o imóvel.",
      basis: `${LRP}, art. 213, II; ${CNRN}, arts. 339 e 413, I.`,
    },
    {
      key: "ri-geo-assinaturas-verificaveis",
      title: "Assinaturas das anuências verificáveis",
      description:
        "As anuências foram apresentadas como digitalização de folhas impressas, sem assinatura digital embutida, e as assinaturas eletrônicas não podem ser validadas.",
      howToComply:
        "Apresentar os PDFs originais assinados, verificáveis no validador do ITI, ou as vias com firma reconhecida.",
      basis: `${CNN}, art. 440-AX, § 2º; ${CNRN}, art. 339.`,
    },
    {
      key: "ri-geo-confrontante-falecido",
      title: "Confrontante falecido: herdeiros ou inventariante",
      description:
        "A anuência em nome do espólio ou dos herdeiros de confrontante falecido veio sem prova de quem a assina.",
      howToComply:
        "Apresentar a certidão de óbito e a prova da qualidade de herdeiro de quem assina ou, havendo inventário, o termo de inventariante com a anuência deste. Informar a matrícula do imóvel confrontante. Cabe ao oficial dizer se a anuência de um herdeiro basta.",
      basis: `${LRP}, art. 213, § 10, I; Código Civil, art. 1.791, parágrafo único; ${CNRN}, art. 339.`,
    },
    {
      key: "ri-geo-correspondencia",
      title: "Correspondência entre o polígono medido e a matrícula",
      description:
        "As confrontações, a orientação ou a área do levantamento não coincidem com as da matrícula, e não há explicação técnica de que se trata do mesmo imóvel.",
      howToComply:
        "Apresentar declaração do responsável técnico, ou laudo, que demonstre que o polígono medido é o imóvel da matrícula, explicando a mudança de orientação e de confrontantes e justificando a diferença de área.",
      basis: `${CNN}, art. 440-AX, §§ 7º e 8º; ${CNRN}, arts. 342, III, e 346, I.`,
    },
    {
      key: "ri-geo-faixa-terceiros",
      title: "Faixa de servidão ou de terceiro sem anuência",
      description:
        "Há trechos do perímetro confrontando com faixa de duto, linha ou outra servidão, sem anuência e sem esclarecer a natureza da faixa.",
      howToComply:
        "Esclarecer se a faixa é servidão sobre o imóvel vizinho (então o confrontante é o dono desse imóvel, e a anuência dele deve abranger os trechos) ou área de domínio de terceiro (então é preciso a anuência do titular). Informar se a servidão dentro do imóvel tem título inscrito. A dispensa de anuência vale só para águas públicas e vias de uso comum.",
      basis: `${LRP}, art. 213, § 10; ${CNN}, art. 440-AX, § 3º, II; ${CNRN}, art. 346, II.`,
    },
    {
      key: "ri-geo-declaracao-limites",
      title: "Declaração de respeito de limites coerente",
      description:
        "A declaração de respeito de limites troca proprietários, diverge do memorial e das anuências ou deixa as matrículas em branco.",
      howToComply:
        "Corrigir a declaração para que coincida com o memorial e as anuências, com as matrículas dos confrontantes, e reapresentá-la assinada.",
      basis: `Decreto nº 4.449/2002, art. 9º, § 5º; ${CNRN}, art. 413, V.`,
    },
    {
      key: "ri-geo-matriculas-confrontantes",
      title: "Matrícula ou transcrição de cada confrontante",
      description:
        "Não foram informadas as matrículas ou transcrições dos imóveis confrontantes.",
      howToComply:
        "Informar a matrícula ou transcrição e a serventia de cada confrontante. Para quem não tiver registro, declarar que se trata de área de posse.",
      basis: `${CNRN}, art. 339 e parágrafo único.`,
    },
    {
      key: "ri-geo-via-publica",
      title: "Via pública no perímetro",
      description:
        "O imóvel confronta com estrada ou via pública, que não está indicada na planta e no memorial com a faixa excluída.",
      howToComply:
        "Indicar na planta e no memorial a via pública que limita ou separa as glebas e a faixa excluída. A anuência do ente público é dispensada, respeitada a faixa de domínio.",
      basis: `${CNN}, art. 440-AX, § 3º, II, b.`,
    },
    {
      key: "ri-geo-pontos-cardeais",
      title: "Confrontações pelos pontos cardeais",
      description:
        "O memorial e a declaração de limites não indicam o lado (Norte, Sul, Leste, Oeste) em que fica cada confrontante.",
      howToComply:
        "Reapresentar o memorial de cada gleba e a declaração de limites com as confrontações pelos pontos cardeais, indicando o lado de cada confrontante e a extensão desse lado; em lados inclinados, podem constar os colaterais.",
      basis: `${LRP}, art. 176, § 1º, II, 3, a; ${CNRN}, art. 312, IV. Entendimento: CSM/SP, Apelação 990.10.019.093-8 (no imóvel rural, as confrontações se referem aos pontos cardeais).`,
    },
    {
      key: "ri-geo-localizacao",
      title: "Ponto de referência e distrito do imóvel rural",
      description:
        "O memorial e o requerimento não localizam o imóvel em relação à via ou ao ponto de referência mais próximo, nem informam o distrito ou povoado.",
      howToComply:
        "Indicar a distância métrica e a direção do imóvel até o cruzamento de vias ou ponto de referência mais próximo, e o distrito ou povoado.",
      basis: `${LRP}, arts. 176, § 1º, II, 3, a, e 225, caput; ${CNN}, art. 440-AQ, § 2º, b e c; ${CNRN}, art. 312, III.`,
    },
  ].map((seed) => ({
    ...seed,
    attribution: "ri" as const,
    acts: ["retificacao", "averbacao"],
  })),
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
    basis: `${CNN}, arts. 320 e seguintes (Central Nacional de Indisponibilidade de Bens).`,
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
