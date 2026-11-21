import Link from "next/link";

/**
 * The reminder next to every mention of the fee table (decision of
 * 21/11/2026: "faça o lembrete para observar se a tabela que está lá é de
 * fato a vigente e caso não for instrua (clicar aqui) para atualizar").
 */
export function FeeTableReminder({
  table,
  canUpdate,
}: {
  table: { id: string; title: string; year: string } | null;
  canUpdate: boolean;
}) {
  const where = "/admin/transparencia";
  const action = canUpdate ? (
    <Link href={where} className="font-semibold underline underline-offset-4">
      clique aqui para atualizar
    </Link>
  ) : (
    "peça a quem cuida da Transparência para atualizar"
  );
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-text">
      {table ? (
        <>
          <p>
            <strong className="font-semibold">Tabela de referência:</strong>{" "}
            {table.title}
            {table.year ? ` (${table.year})` : ""}, a vigente cadastrada em
            Transparência.
          </p>
          <p>
            Confira se esta é de fato a tabela de emolumentos vigente do Estado.
            Se não for, {action}: publique a tabela nova em Transparência ›
            Documentos, na categoria Tabela de emolumentos, e deixe-a em
            primeiro lugar na lista.
          </p>
        </>
      ) : (
        <p>
          Nenhuma tabela de emolumentos vigente cadastrada. Para usar a tabela
          como referência, {action}: publique a tabela vigente em Transparência
          › Documentos, na categoria Tabela de emolumentos.
        </p>
      )}
    </div>
  );
}
