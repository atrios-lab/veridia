const STATUS_STYLES: Record<string, string> = {
  new: "bg-admin-warning-bg text-admin-warning-text",
  "in-review": "bg-admin-warning-bg text-admin-warning-text",
  answered: "bg-admin-success-bg text-admin-success-text",
  done: "bg-admin-primary text-white",
  // Terminal like "done", and saying something else: nothing to see to.
  archived: "bg-admin-readonly-bg text-admin-muted",
};

export function ManifestationStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
        STATUS_STYLES[status] ?? "bg-admin-readonly-bg text-admin-muted"
      }`}
    >
      {label}
    </span>
  );
}

/** "Identificada", "Anônima" or "Identidade em sigilo": the line every
 * queue row and detail header needs next to the manifestation's type. */
export function identificationLabel(input: {
  applicantName?: string | null;
  contact?: string | null;
  confidential: boolean;
}): string {
  if (!input.applicantName && !input.contact) return "Anônima";
  return input.confidential ? "Identidade em sigilo" : "Identificada";
}
