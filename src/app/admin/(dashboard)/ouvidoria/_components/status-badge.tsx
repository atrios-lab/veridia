import { Badge } from "../../../_ui/badge.tsx";

const STATUS_STYLES: Record<string, string> = {
  new: "border-warning/30 bg-warning-soft text-warning-text",
  "in-review": "border-warning/30 bg-warning-soft text-warning-text",
  answered: "border-success/30 bg-success-soft text-success-text",
  done: "bg-primary text-primary-foreground",
  // Terminal like "done", and saying something else: nothing to see to.
  archived: "bg-muted text-muted-foreground",
};

export function ManifestationStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <Badge
      className={STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}
    >
      {label}
    </Badge>
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
