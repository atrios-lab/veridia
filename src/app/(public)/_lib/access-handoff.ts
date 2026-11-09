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
