"use client";

import { useActionState, useState } from "react";
import { auxGuideFor, EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import { cnmOf } from "@/core/ri/cnm.ts";
import {
  CNM_SITUATIONS,
  LOCATIONS,
  PROPERTY_KINDS,
  RECORD_KINDS,
  STREET_KINDS,
} from "@/core/ri/codes.ts";
import {
  AUX_KINDS,
  CONDO_LABELS,
  type CondoData,
  type PropertyInput,
  RURAL_LABELS,
  type RuralData,
} from "@/core/ri/property.ts";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import { type RiState, savePropertyAction } from "../actions.ts";
import { AuxFields } from "./aux-fields.tsx";

const IDLE: RiState = { status: "idle" };

function Text({
  name,
  label,
  defaultValue,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  hint?: string;
} & Omit<React.ComponentProps<typeof Input>, "name" | "defaultValue">) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="bg-background"
        {...rest}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Select({
  name,
  label,
  defaultValue,
  options,
  empty,
  onChange,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: [number | string, string][];
  empty?: string;
  onChange?: (value: string) => void;
}) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="w-full"
        onChange={(event) => onChange?.(event.target.value)}
      >
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border bg-card px-4 py-4 shadow-xs md:px-5">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

const withCode = (list: ReadonlyMap<number, string>) =>
  [...list].map(
    ([code, name]) => [code, `${code} · ${name}`] as [number, string],
  );

export function PropertyForm({
  cns,
  property,
  id,
  defaultBook = 2,
}: {
  cns: string;
  property?: PropertyInput;
  id?: string;
  defaultBook?: 2 | 3;
}) {
  const [state, action, pending] = useActionState(savePropertyAction, IDLE);
  const [number, setNumber] = useState(String(property?.number ?? ""));
  const [book, setBook] = useState(String(property?.book ?? defaultBook));
  const [rural, setRural] = useState(String(property?.location ?? 1) === "1");
  const [auxKind, setAuxKind] = useState(property?.auxKind ?? "");
  const n = Number(number.replace(/\D/g, ""));
  let computed = "";
  try {
    computed = n > 0 ? cnmOf(cns, book === "3" ? 3 : 2, n) : "";
  } catch {
    computed = "";
  }
  const p = property;
  return (
    <form action={action} className="flex flex-col gap-5">
      {id && <input type="hidden" name="id" value={id} />}
      <Group title="Identificação">
        <Select
          name="book"
          label="Livro"
          defaultValue={book}
          onChange={setBook}
          options={[
            [2, "Livro 2 · Registro Geral"],
            [3, "Livro 3 · Registro Auxiliar"],
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-number">Número</Label>
          <Input
            id="f-number"
            name="number"
            inputMode="numeric"
            required
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="bg-background"
          />
        </div>
        {book !== "3" && (
          <Select
            name="recordKind"
            label="Tipo de registro (ONR)"
            defaultValue={String(p?.recordKind ?? 1)}
            options={[...RECORD_KINDS]}
          />
        )}
        <Select
          name="status"
          label="Situação (PGV-CNM)"
          defaultValue={String(p?.status ?? 0)}
          options={withCode(CNM_SITUATIONS)}
        />
        <Text
          name="openedOn"
          label={book === "3" ? "Data do registro" : "Data de abertura"}
          placeholder="dd/mm/aaaa"
          defaultValue={
            p?.openedOn ? p.openedOn.split("-").reverse().join("/") : ""
          }
        />
        <Text
          name="ficha"
          label="Ficha"
          placeholder="Ex.: Livro 2-I, ficha 1"
          defaultValue={p?.ficha}
        />
        {book !== "3" && (
          <Text
            name="origin"
            label="Origem (registro anterior)"
            placeholder="Ex.: Transcrição 1.234, Livro 3-B, fls. 10"
            defaultValue={p?.origin}
          />
        )}
        <Text
          name="priorActs"
          label={
            book === "3"
              ? "Averbações já feitas à margem"
              : "Atos já lançados na ficha"
          }
          inputMode="numeric"
          defaultValue={p?.priorActs ?? 0}
          hint={
            book === "3"
              ? "A próxima averbação à margem continua desta numeração."
              : "O próximo R ou AV no sistema continua desta numeração (Lei nº 6.015/1973, art. 232)."
          }
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-cnm">CNM</Label>
          <Input
            id="f-cnm"
            name="cnm"
            defaultValue={p?.cnm ?? ""}
            placeholder={computed || "CCCCCC.L.NNNNNNN-DD"}
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">
            {computed
              ? `Calculado: ${computed}. Vale o que o PGV-CNM devolver (CNN, art. 333).`
              : "Informe o número para ver o CNM calculado."}
          </p>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="cnmInPgv"
              defaultChecked={p?.cnmInPgv ?? false}
              className="size-4"
            />
            O CNM já está cadastrado no PGV-CNM
          </label>
        </div>
      </Group>

      {book === "3" && (
        <Group title="Registro Auxiliar (Lei nº 6.015/1973, arts. 177 e 178)">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="f-auxKind">O que se registra</Label>
            <Input
              id="f-auxKind"
              name="auxKind"
              list="ri-aux-kinds"
              required
              value={auxKind}
              onChange={(event) => setAuxKind(event.target.value)}
              className="bg-background"
            />
            <datalist id="ri-aux-kinds">
              {AUX_KINDS.map((k) => (
                <option key={k.name} value={k.name}>
                  {k.source}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              O que não diz respeito diretamente a imóvel matriculado (art.
              177): debêntures, cédula de crédito industrial, convenção de
              condomínio, penhor industrial ou rural, pacto antenupcial, título
              no inteiro teor (art. 178).
            </p>
          </div>
          <Text
            name="linkedNumbers"
            label="Matrícula(s) relacionada(s), se houver"
            placeholder="Ex.: 1.234; 1.235"
            defaultValue={p?.linkedNumbers}
            hint="O Livro 3 não precisa de imóvel. Preencha só quando houver ato ligado no Livro 2 (hipoteca cedular, pacto averbado, bens num imóvel), para a remissão recíproca."
          />
          <AuxFields
            key={auxGuideFor(auxKind).match.source}
            kind={auxKind}
            aux={p?.aux ?? { ...EMPTY_AUX, parties: [] }}
          />
        </Group>
      )}

      {book !== "3" && (
        <>
          <Group title="Localização (Indicador Real, Livro 4)">
            <Select
              name="location"
              label="Localização"
              defaultValue={rural ? "1" : "0"}
              onChange={(value) => setRural(value === "1")}
              options={[...LOCATIONS]}
            />
            <Select
              name="propertyKind"
              label="Tipo de imóvel"
              defaultValue={String(p?.propertyKind ?? (rural ? 9 : ""))}
              empty="Não informado"
              options={[...PROPERTY_KINDS]}
            />
            <Select
              name="streetKind"
              label="Tipo de logradouro"
              defaultValue={String(p?.streetKind ?? (rural ? 177 : ""))}
              empty="Escolha"
              options={withCode(STREET_KINDS)}
            />
            <Text
              name="street"
              label={
                rural
                  ? "Nome do logradouro ou da propriedade"
                  : "Nome do logradouro"
              }
              defaultValue={p?.street}
            />
            <Text
              name="streetNumber"
              label="Número"
              defaultValue={p?.streetNumber}
            />
            <Text
              name="district"
              label="Bairro ou localidade"
              defaultValue={p?.district ?? (rural ? "Zona Rural" : "")}
            />
            <Text
              name="cep"
              label="CEP"
              inputMode="numeric"
              defaultValue={p?.cep}
            />
            <Text
              name="complement"
              label="Complemento"
              defaultValue={p?.complement}
            />
            <Text name="quadra" label="Quadra" defaultValue={p?.quadra} />
            <Text name="lote" label="Lote" defaultValue={p?.lote} />
            <Text
              name="loteamento"
              label="Loteamento"
              defaultValue={p?.loteamento}
            />
            <Text name="setor" label="Setor" defaultValue={p?.setor} />
            <Text name="conjunto" label="Conjunto" defaultValue={p?.conjunto} />
            <Text
              name="contributors"
              label="Inscrição imobiliária (IPTU)"
              defaultValue={p?.contributors.join("; ")}
              hint="Mais de uma: separe com ponto e vírgula."
            />
          </Group>

          <Group title="Imóvel rural">
            {(Object.keys(RURAL_LABELS) as (keyof RuralData)[]).map((key) => (
              <Text
                key={key}
                name={`rural.${key}`}
                label={RURAL_LABELS[key]}
                defaultValue={p?.rural[key]}
              />
            ))}
          </Group>

          <details className="rounded-xl border bg-card px-4 py-3 shadow-xs md:px-5">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Condomínio (unidade autônoma)
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(CONDO_LABELS) as (keyof CondoData)[]).map((key) => (
                <Text
                  key={key}
                  name={`condo.${key}`}
                  label={CONDO_LABELS[key]}
                  defaultValue={p?.condo[key]}
                />
              ))}
            </div>
          </details>
        </>
      )}

      <fieldset className="flex flex-col gap-4 rounded-xl border bg-card px-4 py-4 shadow-xs md:px-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          {book === "3" ? "Texto e observações" : "Descrição e observações"}
        </legend>
        {book !== "3" && (
          <Text
            name="area"
            label="Área"
            placeholder="Ex.: 12,5000 ha ou 360,00 m²"
            defaultValue={p?.area}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-description">
            {book === "3"
              ? "Texto do registro (opcional, como está no livro)"
              : "Descrição do imóvel"}
          </Label>
          <Textarea
            id="f-description"
            name="description"
            rows={5}
            defaultValue={p?.description ?? ""}
            className="field-sizing-fixed bg-background"
            placeholder={
              book === "3"
                ? "As demais condições do título, se a serventia transcreve no registro."
                : "Características, confrontações e medidas, como estão na ficha."
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-notes">Observações internas</Label>
          <Textarea
            id="f-notes"
            name="notes"
            rows={3}
            defaultValue={p?.notes ?? ""}
            className="field-sizing-fixed bg-background"
          />
        </div>
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Salvando…"
            : id
              ? "Salvar alterações"
              : book === "3"
                ? "Cadastrar registro auxiliar"
                : "Cadastrar matrícula"}
        </Button>
      </div>
    </form>
  );
}
