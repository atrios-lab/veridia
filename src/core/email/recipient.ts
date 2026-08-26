/**
 * Where an outgoing message actually goes, as data: no I/O, no provider.
 *
 * A deployment that is not the real thing still sends real e-mail, and the
 * addresses typed into it while someone tries the panel are made up. Those
 * bounce, the provider suppresses them, and the bounce rate is counted
 * against the whole account: past ten per cent Postmark starts refusing to
 * send at all, for every serventia at once. One mistyped test address is
 * cheap; a suppressed sending account is every office going silent.
 *
 * So a non-production deployment names one real inbox and every message
 * lands there instead, with the address it was meant for kept in the
 * subject, because a pile of redirected mail with no addressee is unreadable
 * two messages in.
 */
export interface Recipient {
  /** The address to hand the provider. */
  to: string;
  /** The subject to send, prefixed when the message was redirected. */
  subject: string;
  /** True when this is not going where the record says. */
  redirected: boolean;
}

export function resolveRecipient(
  intendedTo: string,
  subject: string,
  redirectTo: string | undefined,
): Recipient {
  const inbox = redirectTo?.trim();
  if (!inbox) return { to: intendedTo, subject, redirected: false };

  return {
    to: inbox,
    subject: `[teste → ${intendedTo}] ${subject}`,
    redirected: true,
  };
}
