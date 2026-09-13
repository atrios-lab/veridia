/**
 * Whether two e-mail addresses are the same one, for the one place the
 * platform accepts an e-mail as proof of possession instead of a password:
 * recovering an access key. Only `trim` and lowercase on both sides, no
 * normalising dots or a `+tag` away, the way some providers do internally.
 * The address the citizen typed into the recovery form is compared literally
 * against the address the pedido was filed with; treating "maria+x@" and
 * "maria@" as the same address would let someone who only knows one of them
 * pass as the other.
 */
export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
