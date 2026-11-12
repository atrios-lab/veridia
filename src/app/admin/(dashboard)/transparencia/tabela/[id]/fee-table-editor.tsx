"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type {
  FeeItem,
  PrenotationAttribution,
  PrenotationItems,
  ReadFeeItem,
} from "@/core/fees/prenotation.ts";
import { Button, buttonVariants } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import {
  type FeeTableReadState,
  readFeeTablePdfAction,
  type SaveState,
  saveFeeTableAction,
} from "../../actions.ts";

const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-foreground";
const cardClass = "rounded-xl border border-border bg-card px-5 py-4";

/** What the reading says about one registry, under its fields. */
function readNote(item: ReadFeeItem | undefined): {
  text: string;
  warn: boolean;
} {
  if (!item) {
    return {
      text: "Não encontrada no PDF. Digite o código e o total como estão na tabela.",
      warn: true,
    };
  }
  if (item.foundBy === "section") {
    return {
      text: `Achamos o código ${item.code} pelo título da seção, não pelo código esperado. Confira na tabela antes de salvar.`,
      warn: true,
    };
  }
  if (item.check === "unchecked") {
    return {
      text: "Lida pelo código, mas as parcelas não somam o último valor da linha. Confira o total na tabela antes de salvar.",
      warn: true,
    };
  }
  return {
    text:
      item.check === "sum"
        ? `Lida na linha do código ${item.code}: as parcelas somam o total.`
        : `Lida na linha do código ${item.code}, que tem um só valor. Confira se é o total.`,
    warn: item.check !== "sum",
  };
}

interface Registry {
  attribution: PrenotationAttribution;
  /** The code the state's table uses for it, when known. */
  expectedCode?: string;
  label: string;
  item?: FeeItem;
}

interface Fields {
  code: string;
  description: string;
  total: string;
}

/** 5790 as "57,90", the way the field takes it. */
function totalText(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

function fieldsOf(item: FeeItem | undefined): Fields {
  return item
    ? {
        code: item.code,
        description: item.description,
        total: totalText(item.totalCents),
      }
    : { code: "", description: "", total: "" };
}

function fieldsByRegistry(
  registries: Registry[],
  items?: PrenotationItems,
): Record<PrenotationAttribution, Fields> {
  return Object.fromEntries(
    registries.map((registry) => [
      registry.attribution,
      fieldsOf(items ? items[registry.attribution] : registry.item),
    ]),
  ) as Record<PrenotationAttribution, Fields>;
}

/**
 * Three fieldsets, one per registry, with "Ler do PDF" filling them from the
 * table's file. Reading saves nothing: the office looks, corrects and saves,
 * and the citizen is charged only what was saved.
 */
export function FeeTableEditor({
  id,
  pdfHref,
  isPdf,
  inForce,
  inForceTitle,
  status,
  source,
  updatedAt,
  registries,
}: {
  id: string;
  pdfHref: string;
  isPdf: boolean;
  /** Whether this is the table the site charges from now. */
  inForce: boolean;
  inForceTitle?: string;
  status: string;
  source?: "pdf" | "manual";
  updatedAt?: string;
  registries: Registry[];
}) {
  const [fields, setFields] = useState(() => fieldsByRegistry(registries));
  const [saveState, saveAction, saving] = useActionState<SaveState, FormData>(
    saveFeeTableAction,
    { status: "idle" },
  );
  const [readState, readAction, reading] = useActionState<
    FeeTableReadState,
    FormData
  >(readFeeTablePdfAction, { status: "idle" });

  const lastSave = useRef(saveState);
  useEffect(() => {
    if (saveState === lastSave.current) return;
    lastSave.current = saveState;
    if (saveState.status === "success") toast.success("Valores salvos.");
  }, [saveState]);

  const lastRead = useRef(readState);
  useEffect(() => {
    if (readState === lastRead.current) return;
    lastRead.current = readState;
    if (readState.status !== "success") return;
    // What the PDF holds replaces what it found; a registry it did not find
    // keeps what the office had typed.
    setFields((previous) => {
      const read = fieldsByRegistry(registries, readState.items);
      const next = { ...previous };
      for (const registry of registries) {
        if (readState.items[registry.attribution]) {
          next[registry.attribution] = read[registry.attribution];
        }
      }
      return next;
    });
    toast.success(
      `Encontramos ${readState.found} de 3 prenotações no PDF. Confira cada uma e salve.`,
    );
  }, [readState, registries]);

  const errors = saveState.status === "error" ? saveState.fieldErrors : {};
  const expectedCodes = registries
    .map((registry) => registry.expectedCode)
    .filter(Boolean)
    .join(", ");

  function update(
    attribution: PrenotationAttribution,
    key: keyof Fields,
    value: string,
  ) {
    setFields((previous) => ({
      ...previous,
      [attribution]: { ...previous[attribution], [key]: value },
    }));
  }

  function readPdf() {
    const data = new FormData();
    data.set("id", id);
    startTransition(() => readAction(data));
  }

  return (
    <form
      action={saveAction}
      className="grid items-start gap-4.5 lg:grid-cols-[1fr_340px]"
    >
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-col gap-4.5">
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-foreground">
            Valores da prenotação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o código e o <strong>total</strong> de cada prenotação, como
            estão na tabela (por exemplo, Imóveis: código 2600103, total 57,90).
            É o valor cobrado quando o cidadão pede a prenotação (análise) para
            anotação, averbação, registro, retificação ou ratificação, com o
            código e o nome desta tabela no pedido. Deixe em branco o registro
            que a tabela não traz.
          </p>
        </section>

        {registries.map(({ attribution, label, expectedCode }) => {
          const value = fields[attribution];
          const note =
            readState.status === "success"
              ? readNote(readState.items[attribution])
              : undefined;
          const otherCode =
            expectedCode &&
            value.code.trim() !== "" &&
            value.code.trim() !== expectedCode;
          const error = (key: keyof Fields) => errors[`${attribution}.${key}`];
          return (
            <fieldset key={attribution} className={cardClass}>
              <legend className="float-left w-full text-base font-semibold text-foreground">
                {label}
              </legend>
              <div className="clear-both grid gap-3 pt-3 sm:grid-cols-[150px_1fr_130px]">
                <label
                  htmlFor={`prenotacao-${attribution}-code`}
                  className={labelClass}
                >
                  Código
                  <Input
                    id={`prenotacao-${attribution}-code`}
                    name={`${attribution}.code`}
                    value={value.code}
                    onChange={(event) =>
                      update(attribution, "code", event.target.value)
                    }
                    inputMode="numeric"
                    placeholder="2600103"
                    aria-invalid={Boolean(error("code"))}
                  />
                  {error("code") && (
                    <span className="text-xs font-normal text-destructive">
                      {error("code")}
                    </span>
                  )}
                </label>
                <label
                  htmlFor={`prenotacao-${attribution}-description`}
                  className={labelClass}
                >
                  Descrição na tabela
                  <Input
                    id={`prenotacao-${attribution}-description`}
                    name={`${attribution}.description`}
                    value={value.description}
                    onChange={(event) =>
                      update(attribution, "description", event.target.value)
                    }
                    placeholder="Prenotação"
                    aria-invalid={Boolean(error("description"))}
                  />
                  {error("description") && (
                    <span className="text-xs font-normal text-destructive">
                      {error("description")}
                    </span>
                  )}
                </label>
                <label
                  htmlFor={`prenotacao-${attribution}-total`}
                  className={labelClass}
                >
                  Total (R$)
                  <Input
                    id={`prenotacao-${attribution}-total`}
                    name={`${attribution}.total`}
                    value={value.total}
                    onChange={(event) =>
                      update(attribution, "total", event.target.value)
                    }
                    inputMode="decimal"
                    placeholder="57,90"
                    aria-invalid={Boolean(error("total"))}
                    className="tabular-nums"
                  />
                  {error("total") && (
                    <span className="text-xs font-normal text-destructive">
                      {error("total")}
                    </span>
                  )}
                </label>
              </div>
              {note && (
                <p
                  className={`mt-2 text-xs ${note.warn ? "font-medium text-destructive" : "text-muted-foreground"}`}
                >
                  {note.text}
                </p>
              )}
              {otherCode && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  Atenção: na tabela do estado, a prenotação de {label} tem o
                  código {expectedCode}. Confira se {value.code.trim()} é mesmo
                  o item certo.
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      <aside className="flex flex-col gap-4.5 lg:sticky lg:top-4">
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-foreground">
            {inForce ? "Tabela vigente" : "Tabela fora de vigência"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {inForce
              ? "É desta tabela que o site tira a prenotação agora. Ao salvar, o valor novo já vale para os próximos pedidos."
              : status !== "published"
                ? "Esta tabela ainda não está publicada. Para que o site cobre por ela, publique e deixe-a acima das outras tabelas de emolumentos na lista."
                : `O site cobra pela tabela que está acima na lista${inForceTitle ? ` (${inForceTitle})` : ""}. Para usar esta, mova-a para cima das outras tabelas de emolumentos.`}
          </p>
          {source && (
            <p className="mt-2 text-xs text-muted-foreground">
              {source === "pdf"
                ? "Valores lidos do PDF e ainda não conferidos"
                : "Valores conferidos pelo cartório"}
              {updatedAt ? ` · ${updatedAt}` : ""}
            </p>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-foreground">Ler do PDF</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lê a tabela linha a linha pelo código de cada prenotação
            {expectedCodes ? ` (${expectedCodes})` : ""}, pega o total e confere
            se as parcelas somam esse total. Nada é salvo antes de você
            conferir.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={readPdf}
              disabled={!isPdf || reading}
            >
              {reading ? "Lendo o PDF..." : "Ler do PDF"}
            </Button>
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Abrir a tabela
            </a>
          </div>
          {readState.status === "error" && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {readState.message}
            </p>
          )}
        </section>

        {saveState.status === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive-soft px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {saveState.message}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Salvando..." : "Salvar valores"}
          </Button>
          <Link
            href="/admin/transparencia"
            className={buttonVariants({ variant: "outline" })}
          >
            Voltar à transparência
          </Link>
        </div>
      </aside>
    </form>
  );
}
