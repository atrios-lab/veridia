/**
 * The notes the office prints near the foot of its certidões, atos and
 * books (decision of 26/11/2026). The custas note is the Tribunal de
 * Justiça do RN's (Portaria Conjunta nº 10/2022), only for offices in RN.
 */

export const CUSTAS_NOTE_RN =
  "“Foram recolhidas para o referido ato as custas constantes dos selos digitais que podem ser conferidas em https://selodigital.tjrn.jus.br/.” “A obrigatoriedade das custas nos atos ficou dispensada por meio da Portaria Conjunta nº 10 - TJRN de 04/03/2022 em seu parágrafo único, publicada no DJe e assinada pelos Desembargadores Vivaldo Pinheiro e Dilermando Mota.”";

/**
 * Lei nº 6.015/1973, art. 17 (conferido no texto oficial em 26/11/2026):
 * "Qualquer pessoa pode requerer certidão do registro sem informar ao
 * oficial ou ao funcionário o motivo ou interesse do pedido." The LGPD is
 * the Lei nº 13.709/2018.
 */
export const LGPD_ATTENTION =
  "A presente Certidão foi lavrada com base no art. 17 da Lei nº 6.015/1973, e os dados nela consignados encontram-se protegidos pela Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018) e devem ser utilizados exclusivamente para os fins a que se destinam. O uso indevido sujeitará o detentor desta certidão à responsabilização por eventuais danos causados às partes e/ou a terceiros.";

export function custasNoteFor(state: string): string | null {
  return state.toUpperCase() === "RN" ? CUSTAS_NOTE_RN : null;
}
