/**
 * The access key, carried from the success screen to the request's page
 * without the URL: the key never travels in a link (it would sit in the
 * history and the logs), so the screen that just showed it leaves it in
 * this tab's session storage, under the protocol, and the request's page
 * takes it once, on arrival, and forgets it. Another tab, or the same tab
 * after it is closed, finds nothing and asks for the key as always.
 *
 * Browser storage can be off (private mode, blocked site data): then the
 * page simply asks for the key, as it did before this existed.
 */

const PREFIX = "veridia:acesso:";

export function handOffAccess(protocolNumber: string, accessKey: string): void {
  try {
    sessionStorage.setItem(`${PREFIX}${protocolNumber}`, accessKey);
  } catch {
    // Without storage the page asks for the key: nothing breaks.
  }
}

/** The key the success screen left for this protocol, taken only once. */
export function takeHandedOffAccess(
  protocolNumber: string,
): string | undefined {
  try {
    const key = sessionStorage.getItem(`${PREFIX}${protocolNumber}`);
    sessionStorage.removeItem(`${PREFIX}${protocolNumber}`);
    return key ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The key carried by the link in the e-mail (decision of 12/11/2026: the
 * citizen only clicks). It rides after the "#", the part of an address a
 * browser never sends to the server, so it reaches no access log; taken
 * once, it is wiped from the address bar at once. The e-mail itself
 * already carries the key in writing.
 */
export function takeKeyFromLink(): string | undefined {
  try {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const key = hash.get("chave")?.trim();
    if (!key) return undefined;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    return key.slice(0, 40);
  } catch {
    return undefined;
  }
}
