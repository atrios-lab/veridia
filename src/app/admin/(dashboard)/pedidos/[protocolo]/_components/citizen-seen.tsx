import { AdminIcon } from "../../../../_components/icon.tsx";

/** The citizen's ciência of one thing, already written for the screen. */
export interface SeenLabels {
  /** When the citizen first had it in front of them on the consult. */
  viewed?: string;
  /** When the citizen first opened or downloaded it (documents only). */
  opened?: string;
}

/**
 * The eye beside what the office put on the request (decision of
 * 16/11/2026): closed while the citizen has not seen it, open once seen,
 * and, for a document, when it was opened or downloaded. The date and the
 * hour are the first ones: they certify the delivery.
 */
export function CitizenSeen({
  seen,
  document = false,
  className = "",
}: {
  seen?: SeenLabels;
  /** A file: says also whether it was opened or downloaded. */
  document?: boolean;
  className?: string;
}) {
  const viewed = seen?.viewed;
  const opened = seen?.opened;
  const title =
    "Ciência do cidadão: data e hora em que ele viu na consulta do protocolo" +
    (document ? " e em que abriu ou baixou o documento." : ".");
  if (!viewed && !opened) {
    return (
      <span
        title={title}
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
      >
        <AdminIcon name="eyeOff" className="size-3.5 flex-none" />
        Ainda não visto pelo cidadão
      </span>
    );
  }
  return (
    <span
      title={title}
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-success-text ${className}`}
    >
      <AdminIcon name="eye" className="size-3.5 flex-none" />
      {viewed && <span>Visto pelo cidadão em {viewed}</span>}
      {document &&
        (opened ? (
          <span className="font-medium">
            {viewed ? "· " : ""}Aberto/baixado em {opened}
          </span>
        ) : (
          <span className="text-muted-foreground">· ainda não aberto</span>
        ))}
    </span>
  );
}
