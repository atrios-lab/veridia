import Link from "next/link";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { Icon } from "./icon.tsx";

/**
 * A resposta da busca de registro, nas duas telas de consulta do protocolo.
 * A busca é uma consulta: não há documento a baixar nem valor a pagar, e quem
 * quiser a certidão faz um pedido novo, no ato certo, onde vai fundamentar o
 * pedido. Os dois botões levam direto a ele.
 */
export function SearchAnswerCard({
  answer,
  closed,
}: {
  answer?: { found: boolean; text: string; answeredAt: string };
  /** Cancelada ou indeferida: não há resposta a esperar. */
  closed?: boolean;
}) {
  if (!answer) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          Resposta da busca
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-brand-text">
          {closed
            ? "A busca foi encerrada sem resposta. O motivo aparece nesta consulta."
            : "A serventia está procurando o registro. A resposta aparece aqui, e avisamos por e-mail quando ela chegar."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-brand-primary bg-brand-card p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          Resposta da busca
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold text-white ${
            answer.found ? "bg-brand-primary" : "bg-brand-alert"
          }`}
        >
          <Icon
            name={answer.found ? "check" : "alert"}
            className="h-3.5 w-3.5"
            strokeWidth={2.2}
          />
          {answer.found ? "Registro localizado" : "Registro não localizado"}
        </span>
      </div>
      <p className="whitespace-pre-line [overflow-wrap:anywhere] text-[14px] leading-relaxed text-brand-text">
        {answer.text}
      </p>
      <p className="text-[11.5px] text-brand-faint">
        Respondida em {formatOfficeDateTime(new Date(answer.answeredAt))}
      </p>
      {answer.found && (
        <div className="border-t border-brand-border pt-3">
          <p className="text-[13px] leading-relaxed text-brand-text">
            <strong className="text-brand-primary">
              Quer a certidão deste registro?
            </strong>{" "}
            A busca não é a certidão. Faça um novo pedido no ato certo: no
            inteiro teor, você informa o motivo do pedido.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link
              href="/solicitar?atribuicao=RCPN&ato=rcpn-certidao"
              className="btn btn-secondary btn-md"
            >
              Pedir certidão
            </Link>
            <Link
              href="/solicitar?atribuicao=RCPN&ato=rcpn-certidao-inteiro-teor"
              className="btn btn-primary btn-md"
            >
              Pedir certidão de inteiro teor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
