export const STATUS_LABELS: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  lida: { label: "Aguardando conferência", variant: "default" },
  "nao-lida": { label: "Guardado, não lido", variant: "destructive" },
  publicada: { label: "Publicado", variant: "secondary" },
  descartada: { label: "Descartado", variant: "outline" },
};

export const when = (date: Date) =>
  date.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    dateStyle: "short",
    timeStyle: "short",
  });

export function statusOf(status: string) {
  return (
    STATUS_LABELS[status] ?? { label: status, variant: "outline" as const }
  );
}
