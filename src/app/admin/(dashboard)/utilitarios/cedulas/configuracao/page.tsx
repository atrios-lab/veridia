import { can } from "@/core/auth/roles.ts";
import { CHARGE_BASES, CHARGE_LABELS } from "@/core/cedulas/analise.ts";
import { KIND_INFO } from "@/core/cedulas/especies.ts";
import { db } from "@/db/index.ts";
import {
  feeTableReferenceWith,
  getChargeNotesWith,
  listLearnedWith,
} from "@/lib/cedulas.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { FeeTableReminder } from "../../../../_components/fee-table-reminder.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireCedulas } from "../_access.ts";
import { ChargeNotesForm, LearnedRow } from "../cedula-forms.tsx";

export const metadata = { title: "Aprendizado e cobrança das cédulas" };

/** The federal rule behind each charging basis (Lei nº 10.169/2000). */
const LAW: Record<(typeof CHARGE_BASES)[number], string> = {
  "valor-credito":
    "Registro da garantia: ato com valor declarado, base no valor do crédito garantido (art. 2º, III, b). No crédito rural, cobra-se o menor entre 0,3% do crédito e a tabela estadual (art. 2º, § 2º, I e II).",
  "valor-suplementar":
    "Aditivo do crédito rural que libera crédito suplementar: averbação com valor declarado, base de cálculo no crédito suplementar (art. 2º, § 2º, II, b).",
  "conteudo-financeiro":
    "Aditivo que muda o valor do crédito (para mais ou para menos): averbação com valor declarado, cobra-se pelo valor (art. 2º, III, b). Escreva aqui se o item da tabela usa o valor alterado ou o novo valor total.",
  "sem-conteudo":
    "Aditivo que não muda o valor (prazo, encargos, retificação): averbação sem valor declarado, ato sem conteúdo econômico (art. 2º, III, a, e § 2º, II, c).",
  nenhum: "Ato que cabe a outro cartório ou órgão: nada a cobrar aqui.",
};

export default async function CedulasConfigPage() {
  const session = await requireCedulas();
  const tenant = await getTenant();
  const [learned, notes, feeTable] = await Promise.all([
    listLearnedWith(db, tenant.slug, { all: true }),
    getChargeNotesWith(db, tenant.slug),
    feeTableReferenceWith(db, tenant.slug),
  ]);
  return (
    <>
      <AdminPageHeader
        maxWidth={900}
        title="Aprendizado e cobrança"
        description="O que a análise aprendeu com as correções da equipe, sem dados pessoais, e como a serventia cobra cada tipo de ato das cédulas."
      />
      <main className="flex max-w-[900px] flex-col gap-6 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/cedulas"
          label="Análise de cédulas"
        />
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            O que a análise aprendeu
          </h2>
          <p className="text-sm text-muted-foreground">
            Quando alguém corrige a espécie de uma cédula, o sistema guarda só
            as palavras do título, sem número nem nome. Altere a espécie ou
            apague; apagar não tira do banco e dá para restaurar.
          </p>
          {learned.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
              Nada aprendido ainda.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
              {learned.map((l) => (
                <LearnedRow
                  key={l.id}
                  item={{
                    id: l.id,
                    cue: l.cue,
                    kind: l.kind,
                    uses: l.uses,
                    removed: Boolean(l.removedAt),
                  }}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Espécies conhecidas:{" "}
            {Object.values(KIND_INFO)
              .map((k) => k.label)
              .join(", ")}
            .
          </p>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Como a serventia cobra
          </h2>
          <p className="text-sm text-muted-foreground">
            O valor vem da tabela de emolumentos do Estado. Escreva, para cada
            tipo de ato, o item da tabela e como se calcula: a nota aparece ao
            lado de cada ato sugerido.
          </p>
          <FeeTableReminder
            table={feeTable}
            canUpdate={can(
              session.user.role ?? "",
              "transparency.manage",
              session.user.permissions,
            )}
          />
          <ChargeNotesForm
            bases={CHARGE_BASES.map((key) => ({
              key,
              label: CHARGE_LABELS[key],
              law: LAW[key],
            }))}
            notes={notes}
          />
        </section>
      </main>
    </>
  );
}
