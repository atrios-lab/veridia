import Link from "next/link";

/**
 * "Quem assina" once the team feeds it (change equipe-do-cartorio): the list
 * is read-only here, with where to change it. The documents keep who signs
 * by its place in this list, so the order shown is the one in use.
 */
export function TeamSignersNotice({
  signers,
  canEditTeam,
}: {
  signers: { name: string; title: string; note: string }[];
  canEditTeam: boolean;
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Quem assina</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Esta lista agora vem da Equipe do cartório: quem está marcado como "Pode
        assinar documentos" assina as guias, o ISS e as declarações, na ordem
        abaixo.{" "}
        {canEditTeam ? (
          <>
            Para mudar, abra a{" "}
            <Link
              href="/admin/configuracoes/equipe"
              className="font-medium text-primary underline underline-offset-4"
            >
              Equipe do cartório
            </Link>
            .
          </>
        ) : (
          "Para mudar, peça ao Tabelião."
        )}
      </p>
      <ol className="mt-4 flex flex-col divide-y text-sm">
        {signers.map((signer, index) => (
          <li
            key={`${signer.name}-${index}`}
            className="flex flex-wrap items-baseline gap-x-3 py-2"
          >
            <span className="font-medium text-foreground">
              {index + 1}. {signer.name}
            </span>
            <span className="text-muted-foreground">
              {signer.title}
              {signer.note ? ` · ${signer.note}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
