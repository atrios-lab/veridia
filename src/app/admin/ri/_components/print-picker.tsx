"use client";

import { useId, useState } from "react";
import { type Period, periodRange } from "@/core/ri/books.ts";
import { SignOrPrint } from "../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import type { PrintSignerOption, PrintTarget } from "./book-print-options.tsx";

export interface PrintGroup {
  label: string;
  /** One or more documents; with several, a second row picks one. */
  options: PrintTarget[];
}

const PERIODS: Record<Period, string> = {
  dia: "Diário",
  mes: "Mensal",
  semestre: "Semestral",
  ano: "Anual",
};

const withQuery = (href: string, query: string) =>
  query ? `${href}${href.includes("?") ? "&" : "?"}${query}` : href;

function Segmented({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <fieldset className="inline-flex w-fit max-w-full flex-wrap self-start overflow-hidden rounded-lg border">
      <legend className="sr-only">{label}</legend>
      {items.map((item, i) => (
        <button
          key={item}
          type="button"
          aria-pressed={i === value}
          onClick={() => onChange(i)}
          className={`border-r px-3 py-1.5 text-sm font-semibold last:border-r-0 ${i === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
        >
          {item}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * Printing the book in one place (decision of 28/11/2026, the Protocolo
 * redrawn): 1. what, 2. who rubricates and signs, 3. how (sign digitally,
 * print to sign by hand, or Word). It replaces the same buttons repeated
 * for every document.
 */
export function PrintPicker({
  signers,
  defaultIndex,
  groups,
  period,
  today,
}: {
  signers: PrintSignerOption[];
  defaultIndex: number;
  groups: PrintGroup[];
  /** The Livro 1 printed by period (dia, mês, semestre, ano). */
  period?: { href: string; label: string };
  today: string;
}) {
  const id = useId();
  const all = [
    ...groups.map((g) => g.label),
    ...(period ? [period.label] : []),
  ];
  const [group, setGroup] = useState(0);
  const [option, setOption] = useState(0);
  const [who, setWho] = useState(String(defaultIndex));
  const [rubric, setRubric] = useState(false);
  const [signature, setSignature] = useState(false);
  const [kind, setKind] = useState<Period>("dia");
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [half, setHalf] = useState<1 | 2>(
    Number(today.slice(5, 7)) <= 6 ? 1 : 2,
  );
  const chosen = signers.find((s) => String(s.index) === who);
  const query = [
    signers.length ? `quem=${who}` : "",
    rubric ? "rubrica=1" : "",
    signature ? "imagem=1" : "",
  ]
    .filter(Boolean)
    .join("&");
  const isPeriod = period !== undefined && group === groups.length;
  const current = isPeriod ? undefined : groups[group];
  const target = current?.options[Math.min(option, current.options.length - 1)];
  const range = isPeriod ? periodRange(kind, day, month, year, half) : null;
  const href = isPeriod
    ? range && period
      ? `${period.href}${period.href.includes("?") ? "&" : "?"}de=${range.from}&ate=${range.to}`
      : null
    : (target?.href ?? null);
  const title = isPeriod
    ? `${period?.label ?? ""}, ${PERIODS[kind].toLowerCase()}`
    : current && current.options.length > 1
      ? `${current.label}: ${target?.label ?? ""}`
      : (target?.label ?? "");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          1. O que
        </p>
        <Segmented
          label="O que imprimir"
          items={all}
          value={group}
          onChange={(i) => {
            setGroup(i);
            setOption(0);
          }}
        />
        {current && current.options.length > 1 && (
          <Segmented
            label={current.label}
            items={current.options.map((o) => o.label)}
            value={option}
            onChange={setOption}
          />
        )}
        {isPeriod && (
          <div className="flex flex-wrap items-end gap-2">
            <NativeSelect
              aria-label="Período da impressão"
              value={kind}
              onChange={(e) => setKind(e.target.value as Period)}
            >
              {(Object.keys(PERIODS) as Period[]).map((p) => (
                <option key={p} value={p}>
                  {PERIODS[p]}
                </option>
              ))}
            </NativeSelect>
            {kind === "dia" && (
              <Input
                type="date"
                aria-label="Dia"
                value={day}
                max={today}
                onChange={(e) => setDay(e.target.value)}
                className="w-auto bg-background"
              />
            )}
            {kind === "mes" && (
              <Input
                type="month"
                aria-label="Mês"
                value={month}
                max={today.slice(0, 7)}
                onChange={(e) => setMonth(e.target.value)}
                className="w-auto bg-background"
              />
            )}
            {kind === "semestre" && (
              <NativeSelect
                aria-label="Semestre"
                value={String(half)}
                onChange={(e) => setHalf(e.target.value === "2" ? 2 : 1)}
              >
                <option value="1">1º semestre</option>
                <option value="2">2º semestre</option>
              </NativeSelect>
            )}
            {(kind === "semestre" || kind === "ano") && (
              <Input
                type="number"
                aria-label="Ano"
                value={year}
                min={1900}
                max={Number(today.slice(0, 4))}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 bg-background"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          2. Quem rubrica e assina
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {signers.length > 0 && (
            <NativeSelect
              id={`${id}-who`}
              aria-label="Quem rubrica e assina"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              {signers.map((s) => (
                <option key={s.index} value={s.index}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox-admin"
              checked={rubric}
              onChange={(e) => setRubric(e.target.checked)}
            />
            Rubrica em todas as folhas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox-admin"
              checked={signature}
              onChange={(e) => setSignature(e.target.checked)}
            />
            Assinatura nos termos e nos encerramentos
          </label>
        </div>
        {(rubric && chosen && !chosen.hasRubric) ||
        (signature && chosen && !chosen.hasSignature) ? (
          <p className="text-xs text-warning-text">
            {chosen?.label} ainda não tem{" "}
            {rubric && !chosen?.hasRubric ? "rubrica" : "assinatura"}{" "}
            cadastrada: cadastre em Configurações do Registro de Imóveis.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          3. Como
        </p>
        {href ? (
          <span className="flex flex-wrap gap-2">
            <SignOrPrint pdfHref={withQuery(href, query)} title={title} />
            {!isPeriod && target?.word && (
              <a
                href={withQuery(target.word, query)}
                className={buttonVariants({ variant: "outline" })}
              >
                Word (.docx)
              </a>
            )}
          </span>
        ) : (
          <p className="text-xs text-destructive">Escolha uma data válida.</p>
        )}
        <p className="text-xs text-muted-foreground">
          {title}
          {rubric || signature
            ? ` · ${[rubric ? "rubrica em todas as folhas" : "", signature ? "assinatura nos termos" : ""].filter(Boolean).join(" e ")}${chosen ? ` de ${chosen.label}` : ""}`
            : " · sem rubrica nem assinatura: sai em branco para assinar à mão"}
          .
        </p>
      </div>
    </div>
  );
}
