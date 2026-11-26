import Link from "next/link";
import {
  AUX_ROLE_LABELS,
  type AuxData,
  auxGuideFor,
} from "@/core/ri/auxiliary.ts";
import { brDate } from "@/core/ri/property.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { setAnnotationDeletedAction } from "../actions.ts";
import { AnnotationForm } from "./annotation-form.tsx";
import { ConfirmButton } from "./client.tsx";
import { Field, Panel } from "./page.tsx";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * A registro of the Livro 3, as it is: no imóvel (Lei nº 6.015/1973, art.
 * 177), but the título, the parties, what it secures and where, and the
 * matrículas it refers to (remissões recíprocas), with the "Como fazer".
 */
export function AuxPanel({
  kind,
  aux,
  linked,
  propertyId,
  canEdit = false,
}: {
  kind: string;
  aux: AuxData;
  linked: string;
  propertyId?: string;
  canEdit?: boolean;
}) {
  const live = aux.annotations.filter((n) => !n.deletedAt);
  const gone = aux.annotations.filter((n) => n.deletedAt);
  const guide = auxGuideFor(kind);
  const numbers = linked
    .split(/[;,\n]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  return (
    <Panel
      title="Registro auxiliar"
      description="O Livro 3 recebe os atos que a lei atribui ao Registro de Imóveis e que não dizem respeito diretamente a imóvel matriculado (Lei nº 6.015/1973, arts. 177 e 178)."
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Natureza" value={kind || "não informada"} />
        <Field label="Título" value={aux.title} />
        {aux.issuedOn && (
          <Field label="Emitido ou lavrado em" value={brDate(aux.issuedOn)} />
        )}
        {aux.protocolNumber && (
          <Field
            label="Protocolo"
            value={`nº ${aux.protocolNumber}${aux.protocolOn ? `, em ${brDate(aux.protocolOn)}` : ""}`}
          />
        )}
        {aux.valueCents !== null && (
          <Field label="Valor" value={money(aux.valueCents)} />
        )}
        {aux.dueOn && <Field label="Vencimento" value={brDate(aux.dueOn)} />}
        {aux.paymentPlace && (
          <Field label="Praça de pagamento" value={aux.paymentPlace} />
        )}
        {aux.regime && <Field label="Regime de bens" value={aux.regime} />}
        {aux.weddingOn && (
          <Field label="Casamento" value={brDate(aux.weddingOn)} />
        )}
        {aux.domicile && (
          <Field label="Domicílio do casal" value={aux.domicile} />
        )}
        {aux.deed && <Field label="Escritura" value={aux.deed} />}
      </dl>
      {aux.parties.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Partes
          </h3>
          <ul className="mt-1 divide-y text-sm">
            {aux.parties.map((party) => (
              <li
                key={`${party.role}-${party.name}-${party.document}`}
                className="flex flex-wrap justify-between gap-2 py-1.5"
              >
                <span className="font-medium text-foreground">
                  {party.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {AUX_ROLE_LABELS[party.role]}
                  {party.document ? ` · ${formatTaxId(party.document)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {(aux.terms || aux.guarantees || aux.goodsPlace) && (
        <dl className="mt-4 grid gap-3">
          {aux.terms && (
            <Field label="Forma de pagamento e encargos" value={aux.terms} />
          )}
          {aux.guarantees && <Field label="Garantias" value={aux.guarantees} />}
          {aux.goodsPlace && (
            <Field label="Onde estão os bens" value={aux.goodsPlace} />
          )}
        </dl>
      )}
      {numbers.length > 0 && (
        <p className="mt-4 text-sm">
          <span className="font-medium">Matrícula(s) relacionada(s): </span>
          {numbers.map((n, i) => (
            <span key={n}>
              {i > 0 ? "; " : ""}
              <Link
                href={`/admin/ri/matriculas?q=${encodeURIComponent(n)}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {n}
              </Link>
            </span>
          ))}
          <span className="block text-xs text-muted-foreground">
            Faça a remissão recíproca: na matrícula, o ato correspondente cita
            este registro do Livro 3.
          </span>
        </p>
      )}
      <section className="mt-5 border-t pt-4">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Anotações
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Remissões, registro do mesmo título no RTD, observações do oficial.
          Cada alteração guarda o texto anterior; apagar só oculta.
        </p>
        {live.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma anotação.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {live.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border bg-background p-3 text-sm"
              >
                <p className="whitespace-pre-line">
                  {n.on && (
                    <span className="mr-1 font-medium">{brDate(n.on)}:</span>
                  )}
                  {n.text}
                </p>
                {n.history.length > 0 && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">
                      Alterada {n.history.length} vez(es): ver o texto anterior
                    </summary>
                    <ul className="mt-1 list-disc pl-5">
                      {n.history.map((h) => (
                        <li key={h.at}>{h.text}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {canEdit && propertyId && (
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-xs font-medium text-primary">
                        Editar
                      </summary>
                      <div className="mt-2">
                        <AnnotationForm
                          propertyId={propertyId}
                          noteId={n.id}
                          on={brDate(n.on)}
                          text={n.text}
                        />
                      </div>
                    </details>
                    <ConfirmButton
                      action={setAnnotationDeletedAction}
                      fields={{ propertyId, noteId: n.id, op: "delete" }}
                      trigger="Apagar"
                      question="Apagar esta anotação?"
                      consequence="Ela some do registro e da ficha, mas continua guardada e pode ser restaurada. Escreva a justificativa."
                      confirmLabel="Apagar"
                      pendingLabel="Apagando…"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && propertyId && (
          <div className="mt-3 rounded-lg border border-dashed p-3">
            <AnnotationForm propertyId={propertyId} />
          </div>
        )}
        {canEdit && propertyId && gone.length > 0 && (
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              Anotações apagadas ({gone.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {gone.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="line-through">{n.text.slice(0, 200)}</span>
                  <ConfirmButton
                    action={setAnnotationDeletedAction}
                    fields={{ propertyId, noteId: n.id, op: "restore" }}
                    trigger="Restaurar"
                    question="Restaurar esta anotação?"
                    consequence="Ela volta ao registro e à ficha. Escreva a justificativa."
                    confirmLabel="Restaurar"
                    pendingLabel="Salvando…"
                    destructive={false}
                  />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <details className="mt-4 rounded-lg border bg-background px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Como fazer</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
          {guide.howTo.map((h) => (
            <li key={h.step}>
              {h.step}
              <span className="block text-xs text-muted-foreground">
                Fonte: {h.source}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </Panel>
  );
}
