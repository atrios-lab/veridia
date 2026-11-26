"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import {
  ACT_EFFECT_LABELS,
  ACT_NATURES,
  type ActEffect,
  AUX_ACT_NATURES,
  PARTY_ROLE_LABELS,
  type PartyRole,
  ROLES_BY_EFFECT,
} from "@/core/ri/acts.ts";
import { TaxIdInput } from "../../_components/tax-id-input.tsx";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import { type RiState, saveActAction } from "../actions.ts";

const IDLE: RiState = { status: "idle" };

export interface ActFormValue {
  id: string;
  kind: "R" | "AV" | "M";
  effect: ActEffect;
  nature: string;
  registeredOn: string;
  summary: string;
  cancelsActId: string;
  protocol: string;
  seal: string;
  /** An image of the selo is attached. */
  hasSealImage?: boolean;
  value: string;
  parties: PartyRow[];
}

interface PartyRow {
  key: number;
  personId?: string;
  name: string;
  document: string;
  role: PartyRole;
  share: string;
}

let next = 1;
const blank = (role: PartyRole): PartyRow => ({
  key: next++,
  name: "",
  document: "",
  role,
  share: "",
});

export function ActForm({
  propertyId,
  nextLabel,
  act,
  burdens,
  people,
  fromProtocol,
  auxiliary = false,
}: {
  propertyId: string;
  /** "R-8 / AV-8": the number this one takes when saved. */
  nextLabel: string;
  act?: ActFormValue;
  burdens: { actId: string; label: string }[];
  people: { name: string; document: string }[];
  /** A new ato from a protocolo: its number and the natureza asked. */
  fromProtocol?: { number: string; nature: string };
  /** A registro of the Livro 3: only averbações, with its own natures. */
  auxiliary?: boolean;
}) {
  const [state, action, pending] = useActionState(saveActAction, IDLE);
  const migration = act?.kind === "M";
  const [kind, setKind] = useState<"R" | "AV">(
    act && act.kind !== "M" ? act.kind : auxiliary ? "AV" : "R",
  );
  const [effect, setEffect] = useState<ActEffect>(
    act?.effect ?? (auxiliary ? "outro" : "transmissao"),
  );
  const [nature, setNature] = useState(
    act?.nature ??
      (fromProtocol?.nature ||
        (auxiliary ? "Aditivo (aditamento) do título" : "Compra e venda")),
  );
  const [parties, setParties] = useState<PartyRow[]>(
    act?.parties.length
      ? act.parties.map((p) => ({ ...p, key: next++ }))
      : [
          blank(
            auxiliary
              ? "outro"
              : (ROLES_BY_EFFECT[act?.effect ?? "transmissao"][0] ?? "outro"),
          ),
        ],
  );
  const roles = ROLES_BY_EFFECT[effect];

  function pickNature(value: string) {
    setNature(value);
    const known = (auxiliary ? AUX_ACT_NATURES : ACT_NATURES).find(
      (n) => n.name === value,
    );
    if (known && !act) {
      setKind(known.kind === "M" ? "AV" : known.kind);
      changeEffect(known.effect);
    }
  }

  function changeEffect(value: ActEffect) {
    setEffect(value);
    const allowed = ROLES_BY_EFFECT[value];
    setParties((rows) => {
      const kept = rows
        .filter((row) => row.name || row.document)
        .map((row) =>
          allowed.includes(row.role)
            ? row
            : { ...row, role: allowed[0] ?? "outro" },
        );
      return kept.length ? kept : [blank(allowed[0] ?? "outro")];
    });
  }

  const update = (key: number, patch: Partial<PartyRow>) =>
    setParties((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const serialized = JSON.stringify(
    parties
      .filter((p) => p.name.trim())
      .map(({ personId, name, document, role, share }) => ({
        personId,
        name,
        document,
        role,
        share,
      })),
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="propertyId" value={propertyId} />
      {act && <input type="hidden" name="actId" value={act.id} />}
      <input type="hidden" name="parties" value={serialized} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="effect" value={effect} />
      {migration && <input type="hidden" name="nature" value={nature} />}

      <fieldset className="rounded-xl border bg-card px-4 py-4 shadow-xs md:px-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          {migration ? "Situação na migração" : `O ato (${nextLabel})`}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {!migration && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-nature">Natureza</Label>
                <Input
                  id="a-nature"
                  name="nature"
                  list="ri-natures"
                  value={nature}
                  onChange={(event) => pickNature(event.target.value)}
                  className="bg-background"
                />
                <datalist id="ri-natures">
                  {(auxiliary ? AUX_ACT_NATURES : ACT_NATURES)
                    .filter((n) => n.kind !== "M")
                    .map((n) => (
                      <option key={n.name} value={n.name} />
                    ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Lançamento</span>
                <div className="flex gap-2">
                  {(auxiliary ? (["AV"] as const) : (["R", "AV"] as const)).map(
                    (k) => (
                      <label
                        key={k}
                        className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
                      >
                        <input
                          type="radio"
                          name="kind-choice"
                          value={k}
                          checked={kind === k}
                          onChange={() => setKind(k)}
                          className="sr-only"
                        />
                        {k === "R" ? "Registro (R)" : "Averbação (AV)"}
                      </label>
                    ),
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="a-effect">
                  {auxiliary
                    ? "O que a averbação faz no registro"
                    : "O que o ato faz na matrícula"}
                </Label>
                <NativeSelect
                  id="a-effect"
                  value={effect}
                  onChange={(event) =>
                    changeEffect(event.target.value as ActEffect)
                  }
                  className="w-full"
                >
                  {(Object.keys(ACT_EFFECT_LABELS) as ActEffect[])
                    .filter((e) => e !== "titularidade" || effect === e)
                    .map((e) => (
                      <option key={e} value={e}>
                        {ACT_EFFECT_LABELS[e]}
                      </option>
                    ))}
                </NativeSelect>
              </div>
            </>
          )}
          {effect === "cancelamento" && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="a-cancels">Ônus que este ato cancela</Label>
              <NativeSelect
                id="a-cancels"
                name="cancelsActId"
                defaultValue={act?.cancelsActId ?? ""}
                className="w-full"
              >
                <option value="">Escolha</option>
                {burdens.map((b) => (
                  <option key={b.actId} value={b.actId}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
              {burdens.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Não há ônus em vigor nesta matrícula.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-date">Data</Label>
            <Input
              id="a-date"
              name="registeredOn"
              placeholder="dd/mm/aaaa"
              defaultValue={act?.registeredOn ?? ""}
              className="bg-background"
            />
          </div>
          {!migration && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-protocol">Protocolo (Livro 1)</Label>
                <Input
                  id="a-protocol"
                  name="protocol"
                  defaultValue={act?.protocol ?? fromProtocol?.number ?? ""}
                  className="bg-background"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-value">Valor do negócio ou da dívida</Label>
                <Input
                  id="a-value"
                  name="value"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  defaultValue={act?.value ?? ""}
                  className="bg-background"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-seal">Selo</Label>
                <Input
                  id="a-seal"
                  name="seal"
                  defaultValue={act?.seal ?? ""}
                  required={Boolean(fromProtocol)}
                  placeholder="Digite o selo do ato"
                  className="bg-background"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-seal-image">Imagem do selo (opcional)</Label>
                <input
                  id="a-seal-image"
                  name="sealImage"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="text-xs"
                />
                {act?.hasSealImage && (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="removeSealImage" value="1" />
                    Tirar a imagem atual (ela fica guardada no histórico)
                  </label>
                )}
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="a-summary">Texto do ato</Label>
            <Textarea
              id="a-summary"
              name="summary"
              rows={5}
              defaultValue={act?.summary ?? ""}
              className="field-sizing-fixed bg-background"
              placeholder="O texto do lançamento, como vai na ficha."
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border bg-card px-4 py-4 shadow-xs md:px-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Partes
        </legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Entram no Indicador Pessoal (Livro 5). Com o CPF ou CNPJ a pessoa é a
          mesma do cadastro; sem ele, o sistema procura pelo nome igual.
        </p>
        <datalist id="ri-people">
          {people.map((p) => (
            <option key={`${p.name}-${p.document}`} value={p.name}>
              {p.document}
            </option>
          ))}
        </datalist>
        <ul className="flex flex-col gap-3">
          {parties.map((row) => (
            <li
              key={row.key}
              className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-12"
            >
              <div className="flex flex-col gap-1 sm:col-span-4">
                <Label htmlFor={`p-name-${row.key}`}>Nome</Label>
                <Input
                  id={`p-name-${row.key}`}
                  list="ri-people"
                  value={row.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    const known = people.find((p) => p.name === name);
                    update(row.key, {
                      name,
                      personId: undefined,
                      ...(known && !row.document
                        ? { document: known.document }
                        : {}),
                    });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-3">
                <Label htmlFor={`p-doc-${row.key}`}>CPF ou CNPJ</Label>
                <TaxIdInput
                  id={`p-doc-${row.key}`}
                  value={row.document}
                  onValueChange={(document) =>
                    update(row.key, { document, personId: undefined })
                  }
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor={`p-role-${row.key}`}>Papel</Label>
                <NativeSelect
                  id={`p-role-${row.key}`}
                  value={row.role}
                  onChange={(event) =>
                    update(row.key, { role: event.target.value as PartyRole })
                  }
                  className="w-full"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {PARTY_ROLE_LABELS[role]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor={`p-share-${row.key}`}>Fração</Label>
                <Input
                  id={`p-share-${row.key}`}
                  value={row.share}
                  placeholder="Ex.: 50%"
                  onChange={(event) =>
                    update(row.key, { share: event.target.value })
                  }
                />
              </div>
              <div className="flex items-end sm:col-span-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Tirar esta parte"
                  onClick={() =>
                    setParties((rows) =>
                      rows.length > 1
                        ? rows.filter((r) => r.key !== row.key)
                        : [blank(roles[0] ?? "outro")],
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            setParties((rows) => [
              ...rows,
              blank(
                effect === "transmissao" &&
                  rows.some((r) => r.role === "adquirente")
                  ? "transmitente"
                  : (roles[0] ?? "outro"),
              ),
            ])
          }
        >
          <Plus className="size-4" /> Mais uma parte
        </Button>
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : act ? "Salvar alterações" : "Lançar o ato"}
        </Button>
      </div>
    </form>
  );
}
