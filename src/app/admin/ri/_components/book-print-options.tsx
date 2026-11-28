"use client";

import { useId, useState } from "react";
import { type Period, periodRange } from "@/core/ri/books.ts";
import { SignOrPrint } from "../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";

export interface PrintSignerOption {
  index: number;
  label: string;
  hasSignature: boolean;
  hasRubric: boolean;
}

export interface PrintTarget {
  label: string;
  /** The PDF route; the choice is added to it. */
  href: string;
  /** The same document in Word, when there is one. */
  word?: string;
}

const PERIODS: Record<Period, string> = {
  dia: "Diário",
  mes: "Mensal",
  semestre: "Semestral",
  ano: "Anual",
};

const withQuery = (href: string, query: string) =>
  query ? `${href}${href.includes("?") ? "&" : "?"}${query}` : href;

/**
 * Who signs and how, for every print of the book, the termos and the
 * índice (decision of 28/11/2026): the person of "Quem assina", the rubrica
 * on every folha, the signature (image) on the termos and on each day's
 * "Ass.:", and then printing, signing digitally (with the rubrica and the
 * signature too) or Word. One, two or all of them.
 */
export function BookPrintOptions({
  signers,
  defaultIndex,
  targets,
  period,
  today,
}: {
  signers: PrintSignerOption[];
  defaultIndex: number;
  targets: PrintTarget[];
  /** The Livro 1 printed by period (dia, mês, semestre, ano). */
  period?: { href: string; label: string };
  today: string;
}) {
  const id = useId();
  const [who, setWho] = useState(String(defaultIndex));
  const [rubric, setRubric] = useState(false);
  const [signature, setSignature] = useState(false);
  const chosen = signers.find((s) => String(s.index) === who);
  const query = [
    signers.length ? `quem=${who}` : "",
    rubric ? "rubrica=1" : "",
    signature ? "imagem=1" : "",
  ]
    .filter(Boolean)
    .join("&");

  const [kind, setKind] = useState<Period>("dia");
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [half, setHalf] = useState<1 | 2>(
    Number(today.slice(5, 7)) <= 6 ? 1 : 2,
  );
  const range = periodRange(kind, day, month, year, half);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
        <div className="flex flex-wrap items-end gap-3">
          {signers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-who`}>Quem rubrica e assina</Label>
              <NativeSelect
                id={`${id}-who`}
                value={who}
                onChange={(e) => setWho(e.target.value)}
              >
                {signers.map((s) => (
                  <option key={s.index} value={s.index}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
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
        <p className="text-xs text-muted-foreground">
          Marque uma, as duas ou nenhuma. &quot;Assinar digitalmente&quot; leva
          a rubrica e a assinatura marcadas e assina com o certificado
          ICP-Brasil; sem nada marcado, sai em branco para assinar à mão.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {targets.map((t) => (
          <div key={t.label} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t.label}
            </p>
            <span className="flex flex-wrap gap-2">
              <SignOrPrint
                pdfHref={withQuery(t.href, query)}
                title={t.label}
                size="sm"
              />
              {t.word && (
                <a
                  href={withQuery(t.word, query)}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Word (.docx)
                </a>
              )}
            </span>
          </div>
        ))}
        {period && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {period.label}
            </p>
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
            {range ? (
              <SignOrPrint
                pdfHref={withQuery(
                  `${period.href}${period.href.includes("?") ? "&" : "?"}de=${range.from}&ate=${range.to}`,
                  query,
                )}
                title={`${period.label}, ${PERIODS[kind].toLowerCase()}`}
                size="sm"
              />
            ) : (
              <p className="text-xs text-destructive">
                Escolha uma data válida.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
