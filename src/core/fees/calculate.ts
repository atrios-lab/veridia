// Amounts are integer cents. Money in floating point drifts, and this is the
// number the citizen pays at the counter.

export interface FeeInput {
  /** Office fee ("emolumento"), the part the office charges for the act. */
  emolumentCents: number;
  /** Mandatory state funds collected on top of the fee ("fundos"). */
  fundsCents: number;
  /** Municipal ISS rate as a decimal, from the office config (5% = 0.05). */
  issRate: number;
}

export interface FeeBreakdown {
  /** What the citizen pays. */
  totalCents: number;
  /** ISS due on the office fee. */
  issCents: number;
  /** What is left for the office after ISS. */
  netCents: number;
  /** Tax base of the electronic invoice (NFS-e). */
  nfseBaseCents: number;
}

export function calculateFee({
  emolumentCents,
  fundsCents,
  issRate,
}: FeeInput): FeeBreakdown {
  // ISS is a deduction from the office's share, never a line the citizen
  // pays. Adding it to the total overcharges every single act.
  const issCents = Math.round(emolumentCents * issRate);
  return {
    totalCents: emolumentCents + fundsCents,
    issCents,
    netCents: emolumentCents - issCents,
    // The funds are collected on behalf of the state, so they are outside
    // the invoice base. Only the office fee is billed as a service.
    nfseBaseCents: emolumentCents,
  };
}
