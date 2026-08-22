import "server-only";
// Relative import, not the "@/" alias: scripts/capture-seal-fixture.ts runs
// this module under plain node, which does not read tsconfig paths.
import { parseSealLookup, type SealLookup } from "../core/seal/parse.ts";

/**
 * Client of the TJRN public seal lookup (SIEX).
 *
 * There is no webservice: this drives the same public form a citizen would
 * use, in the citizen's place and with the citizen's own answer to the TJ's
 * captcha. Nothing here solves, bypasses or caches a captcha: the challenge
 * is displayed as the TJ issued it and only the person in front of the screen
 * answers it.
 *
 * The whole exchange is the office's guest at somebody else's system, so it
 * asks for as little as possible: one attempt per submission, no retries, no
 * forged User-Agent, and a short timeout.
 */

const BASE = "https://selodigital.tjrn.jus.br/siex";
const VIEW =
  "tjdf.siex.cadastro.consulta.apresentacao.VisaoConsultaPorCodigoNaInternet";
const CONTROLLER =
  "tjdf.siex.cadastro.consulta.apresentacao.ControladorConsultaPorCodigoNaInternet";

/** The address a citizen can always fall back to, ours broken or not. */
export const TJ_LOOKUP_URL = `${BASE}/siexnet?visaoId=${VIEW}`;

const TIMEOUT_MS = 10_000;

/** The TJ's session, which is what a captcha image is bound to. */
export type SealSession = string;

export type SealLookupOutcome =
  | SealLookup
  /** The TJ did not answer (down, timeout, blocked). Not our data to invent. */
  | { kind: "unavailable" };

function sessionOf(response: Response): SealSession | undefined {
  for (const cookie of response.headers.getSetCookie()) {
    const match = cookie.match(/JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return undefined;
}

/** Opens a session on the TJ, which every later call in the pair rides on. */
export async function openSession(): Promise<SealSession | undefined> {
  try {
    const response = await fetch(TJ_LOOKUP_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok ? sessionOf(response) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The captcha image of a session.
 *
 * The unique query string is not decoration: the TJ sits behind a CDN that
 * caches `jcaptcha.jpg`, so without it the answer is a stale image that
 * belongs to no session, and every lookup fails as "wrong captcha" no matter
 * what the citizen types. The TJ's own page busts the cache the same way.
 */
export async function fetchCaptcha(
  session: SealSession,
): Promise<{ body: ArrayBuffer; contentType: string } | undefined> {
  try {
    const response = await fetch(
      `${BASE}/jcaptcha.jpg?ts=${Date.now()}-${Math.random().toString(36).slice(2)}`,
      {
        headers: { cookie: `JSESSIONID=${session}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!response.ok) return undefined;
    return {
      body: await response.arrayBuffer(),
      // The file is named .jpg and served as PNG; trust the header.
      contentType: response.headers.get("content-type") ?? "image/png",
    };
  } catch {
    return undefined;
  }
}

/**
 * Submits the lookup on the session the captcha came from, and hands the
 * answer to the core parser.
 *
 * `codes` goes through as typed: the TJ accepts several seals separated by
 * ";" and is the authority on what a valid code looks like, so validating the
 * format here would only invent refusals it would not make.
 */
export async function submitLookup(
  session: SealSession,
  codes: string,
  captcha: string,
): Promise<SealLookupOutcome> {
  const html = await fetchLookupHtml(session, codes, captcha);
  return html === undefined ? { kind: "unavailable" } : parseSealLookup(html);
}

/**
 * The same request `submitLookup` makes, stopping at the raw page.
 *
 * Exported for `scripts/capture-seal-fixture.ts`: a fixture is only worth
 * testing against if it came from the exact request the application sends,
 * so the recapture tool shares this code instead of reimplementing it.
 */
export async function fetchLookupHtml(
  session: SealSession,
  codes: string,
  captcha: string,
): Promise<string | undefined> {
  const form = new URLSearchParams({
    visaoId: VIEW,
    controladorId: CONTROLLER,
    idDoUsuarioDaSessao: "usuarioExterno",
    nomeDaPagina: "relacao",
    comando: "abrirConsulta",
    enderecoDoServlet: "siexnet",
    visaoAnterior: VIEW,
    skin: "",
    // The session's page counter. It advances with every answer, which is
    // why a session is used for one submission and then dropped.
    tokenDePaginacao: "1",
    codigo: codes,
    captcha,
  });

  try {
    const response = await fetch(`${BASE}/siexnet`, {
      method: "POST",
      headers: {
        cookie: `JSESSIONID=${session}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    // The SIEX predates UTF-8 on the web and says so in its own meta tag.
    return new TextDecoder("iso-8859-1").decode(await response.arrayBuffer());
  } catch {
    return undefined;
  }
}
