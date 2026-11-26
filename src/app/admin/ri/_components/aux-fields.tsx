"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AUX_ROLE_LABELS,
  type AuxData,
  type AuxParty,
  type AuxRole,
  auxGuideFor,
} from "@/core/ri/auxiliary.ts";
import { brDate } from "@/core/ri/property.ts";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Textarea } from "../../_ui/textarea.tsx";

function Field({
  name,
  label,
  defaultValue,
  hint,
  placeholder,
  wide,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div
      className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}
    >
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="bg-background"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Area({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        rows={3}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="field-sizing-fixed bg-background"
      />
    </div>
  );
}

const money = (cents: number | null) =>
  cents === null
    ? ""
    : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

/**
 * The part of the form that only the Livro 3 has: no imóvel, but the
 * título, the parties, the money, the goods and where they are, the pacto.
 * Which blocks show, and the "Como fazer", follow the natureza chosen.
 */
export function AuxFields({ kind, aux }: { kind: string; aux: AuxData }) {
  const guide = auxGuideFor(kind);
  const [parties, setParties] = useState<AuxParty[]>(
    aux.parties.length > 0
      ? aux.parties
      : [{ name: "", document: "", role: guide.roles[0] as AuxRole }],
  );
  const set = (i: number, patch: Partial<AuxParty>) =>
    setParties((list) =>
      list.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    );
  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm sm:col-span-2 lg:col-span-3">
        <p className="font-semibold text-foreground">Como fazer</p>
        <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5">
          {guide.howTo.map((h) => (
            <li key={h.step}>
              {h.step}
              <span className="block text-xs text-muted-foreground">
                Fonte: {h.source}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <Field
        name="aux.title"
        label="Título"
        defaultValue={aux.title}
        placeholder="Ex.: Cédula de crédito industrial nº 123/2026"
        wide
      />
      <Field
        name="aux.issuedOn"
        label="Emitido ou lavrado em"
        placeholder="dd/mm/aaaa"
        defaultValue={brDate(aux.issuedOn)}
      />
      <Field
        name="aux.protocolNumber"
        label="Protocolo (Livro 1) nº"
        defaultValue={aux.protocolNumber}
      />
      <Field
        name="aux.protocolOn"
        label="Data do protocolo"
        placeholder="dd/mm/aaaa"
        defaultValue={brDate(aux.protocolOn)}
      />

      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
        <p className="text-sm font-medium">Partes</p>
        {parties.map((party, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved
            key={i}
            className="grid gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[12rem_1fr_11rem_auto]"
          >
            <NativeSelect
              aria-label="Papel"
              name={`aux.party.${i}.role`}
              value={party.role}
              onChange={(e) => set(i, { role: e.target.value as AuxRole })}
            >
              {guide.roles
                .concat(guide.roles.includes(party.role) ? [] : [party.role])
                .map((role) => (
                  <option key={role} value={role}>
                    {AUX_ROLE_LABELS[role]}
                  </option>
                ))}
            </NativeSelect>
            <Input
              aria-label="Nome"
              name={`aux.party.${i}.name`}
              value={party.name}
              placeholder="Nome completo ou razão social"
              onChange={(e) => set(i, { name: e.target.value })}
              className="bg-background"
            />
            <Input
              aria-label="CPF ou CNPJ"
              name={`aux.party.${i}.document`}
              value={party.document}
              inputMode="numeric"
              placeholder="CPF ou CNPJ"
              onChange={(e) => set(i, { document: e.target.value })}
              className="bg-background"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Tirar esta parte"
              onClick={() =>
                setParties((list) => list.filter((_, j) => j !== i))
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setParties((list) => [
                ...list,
                {
                  name: "",
                  document: "",
                  role: (guide.roles[1] ?? "outro") as AuxRole,
                },
              ])
            }
          >
            <Plus className="size-4" /> Acrescentar parte
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          As partes entram no Indicador Pessoal (Lei nº 6.015/1973, art. 180).
        </p>
      </div>

      {guide.money && (
        <>
          <Field
            name="aux.value"
            label="Valor (R$)"
            defaultValue={money(aux.valueCents)}
          />
          <Field
            name="aux.dueOn"
            label="Vencimento"
            placeholder="dd/mm/aaaa"
            defaultValue={brDate(aux.dueOn)}
          />
          <Field
            name="aux.paymentPlace"
            label="Praça de pagamento"
            defaultValue={aux.paymentPlace}
          />
          <Area
            name="aux.terms"
            label="Forma de pagamento, juros e encargos"
            defaultValue={aux.terms}
          />
        </>
      )}
      {guide.goods && (
        <>
          <Area
            name="aux.guarantees"
            label="Garantias (bens empenhados ou hipotecados)"
            defaultValue={aux.guarantees}
            placeholder="Ex.: em penhor cedular de 1º grau, 30 bovinos da raça Nelore, marcados…"
          />
          <Area
            name="aux.goodsPlace"
            label="Onde estão os bens"
            defaultValue={aux.goodsPlace}
            placeholder="Ex.: no imóvel rural Sítio Exemplo, matrícula 1.234 deste Registro"
          />
        </>
      )}
      {guide.pacto && (
        <>
          <Field
            name="aux.regime"
            label="Regime de bens"
            defaultValue={aux.regime}
            placeholder="Ex.: separação total de bens"
          />
          <Field
            name="aux.weddingOn"
            label="Data do casamento"
            placeholder="dd/mm/aaaa"
            defaultValue={brDate(aux.weddingOn)}
          />
          <Field
            name="aux.domicile"
            label="Domicílio do casal"
            defaultValue={aux.domicile}
          />
          <Field
            name="aux.deed"
            label="Escritura (tabelionato, livro e folhas)"
            defaultValue={aux.deed}
            wide
          />
        </>
      )}
    </>
  );
}
