/**
 * Text-length limits shared by the forms and the server (decision of
 * 11/11/2026): every free-text, multi-line field takes up to
 * `LONG_TEXT_MAX` characters, and a justification needs at least
 * `MIN_JUSTIFICATION` to say something.
 */

/** The cap for every free-text, multi-line field (client and server). */
export const LONG_TEXT_MAX = 5000;

/**
 * The minimum a justification or reason needs: not empty, not a single
 * letter, but short words like "erro" or "TESTEEEE" are accepted.
 */
export const MIN_JUSTIFICATION = 3;

/** The message when a long text passes `LONG_TEXT_MAX`. */
export const LONG_TEXT_TOO_LONG = `Use até ${LONG_TEXT_MAX.toLocaleString("pt-BR")} caracteres.`;
