import type { KnowledgeProvision } from "./types.ts";

/**
 * The platform's own guidance: short notes on the points the norms leave
 * subtle and that already cost rework. They are marked as guidance, never as
 * norm, and never name the company behind the platform (decision of
 * 15/11/2026). Each one says when it was written: guidance ages.
 */
export const ORIENTACAO: readonly KnowledgeProvision[] = [
  {
    id: "orientacao-prazo-15-dias",
    source: "orientacao",
    citation: "Orientação: prazo de 15 dias",
    text: `Orientação de 04/11/2026. A LGPD fixa 15 dias apenas para a declaração completa de acesso aos dados (art. 19, II). O acesso em formato simplificado é imediato (art. 19, I). Para os demais direitos (correção, eliminação, portabilidade, informação sobre compartilhamento, revogação do consentimento), o art. 18, § 5º, remete a prazo em regulamento, que ainda não existe. A serventia pode adotar 15 dias também para esses direitos, mas isso é regra interna dela, não prazo legal: ao responder ou informar o titular, diga que a lei fixa 15 dias para o acesso e que a serventia adota o mesmo prazo para os demais pedidos.`,
  },
  {
    id: "orientacao-dispensa-encarregado-classe-1",
    source: "orientacao",
    citation: "Orientação: dispensa do encarregado na Classe 1",
    text: `Orientação de 04/11/2026. O art. 88, § 4º, do Código Nacional de Normas, incluído pelo Provimento CNJ nº 205/2025 e com redação dada pelo Provimento CNJ nº 214/2026, dispensa da indicação de encarregado as serventias da Classe I, conforme definida pelo art. 16, I, do Provimento nº 213/2026 (receita bruta semestral de até R$ 300.000, pela redação do Provimento nº 243/2026). Ao citar, use "art. 88, § 4º, do CNN, incluído pelo Provimento 205/2025, com redação do Provimento 214/2026"; não diga que o 214 incluiu o parágrafo. A dispensa não afasta as demais obrigações da LGPD, e a Resolução CD/ANPD nº 2/2022 não admite dispensa quando há tratamento de alto risco. Continua em aberto se a dispensa vale diretamente no RN ou depende de ato da Corregedoria local. A recomendação é nomear o encarregado mesmo na Classe 1.`,
  },
  {
    id: "orientacao-prazo-legal-x-regra-interna",
    source: "orientacao",
    citation: "Orientação: o que é prazo legal",
    text: `Orientação de 04/11/2026. Ao falar de prazos com o titular, separe o que a lei fixa do que a serventia adota por conta própria. Chamar de "prazo legal" uma regra interna cria uma obrigação que a lei não impõe e expõe a serventia se ela precisar de mais tempo em um caso complexo.`,
  },
  {
    id: "orientacao-prorrogacao-cgj-rn",
    source: "orientacao",
    citation: "Orientação: prorrogação dos prazos no RN",
    text: `Orientação de 13/11/2026. A Corregedoria Geral de Justiça do RN prorrogou por 90 dias, em 02/07/2026, o prazo das Etapas 1 e 2 do Anexo IV do Provimento nº 213/2026 para todas as serventias do Estado. Essa decisão é anterior ao Provimento nº 243/2026, em vigor desde 22/08/2026, que recomeçou a contagem dos prazos e elevou para 180 dias somados o limite de prorrogação do art. 21, § 3º. Pelos prazos novos, as Etapas 1 e 2 terminam depois do que daria a prorrogação do RN. Ninguém confirmou se os 90 dias entram na conta dos 180. Não afirme quantos dias restam de prorrogação: recomende consultar a Corregedoria.`,
  },
  {
    id: "orientacao-registro-publico-nao-se-apaga",
    source: "orientacao",
    citation: "Orientação: eliminação e registro público",
    text: `Orientação de 15/11/2026. O pedido de eliminação de dados não alcança o conteúdo dos atos e registros públicos: a serventia tem dever legal de conservá-los (LGPD, art. 16, I, e a legislação registral e notarial). A eliminação vale para dados tratados com base no consentimento ou guardados além da finalidade, como cadastros auxiliares, cópias de documentos de atendimento e contatos. A resposta ao titular deve explicar a diferença, citar o fundamento da conservação e informar o que pode ser eliminado. Correção de dado em registro público segue o procedimento próprio de retificação, não o canal da LGPD.`,
  },
  {
    id: "orientacao-prazos-incidente",
    source: "orientacao",
    citation: "Orientação: prazos de comunicação de incidente",
    text: `Orientação de 15/11/2026. Três normas tratam da comunicação de incidente de segurança, com prazos e destinatários diferentes, e a serventia precisa cumprir as três: o Código Nacional de Normas (art. 91) fala em 48 horas úteis, com comunicação ao titular, à ANPD, ao juiz corregedor e à Corregedoria Geral; a Resolução CD/ANPD nº 15/2024 (arts. 6º e 9º) fixa 3 dias úteis para comunicar a ANPD e o titular; e o Provimento nº 213/2026 (Anexo II, item 4, III) prevê 72 horas para comunicar a Corregedoria nos incidentes críticos. Na prática, comunique todos dentro do menor prazo aplicável, 48 horas úteis, e registre a data e a hora de cada comunicação.`,
  },
  {
    id: "orientacao-requerimento-gov-br",
    source: "orientacao",
    citation: "Orientação: assinatura do requerimento e do ato",
    text: `Orientação de 05/11/2026. Em ato notarial, a assinatura do requerimento feito pelo site (por exemplo, pelo Gov.br) é separada da assinatura do próprio ato, que nas videoconferências notariais ocorre exclusivamente no e-Notariado (CNN, art. 286). Essa regra é do serviço de notas: não estenda o e-Notariado ao registro civil, imóveis, títulos e documentos, pessoas jurídicas ou protesto. Nos registros, o envio de documentos pela internet exige assinatura avançada ou qualificada (Lei 6.015/1973, art. 17, § 1º; CNN, art. 208); a assinatura eletrônica simples não basta.`,
  },
];
