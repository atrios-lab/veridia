"use client";

import { useState } from "react";
import { type Period, periodRange } from "@/core/ri/books.ts";
import { SignOrPrint } from "../../_components/sign-or-print.tsx";
import { Input } from "../../_ui/input.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";

const LABELS: Record<Period, string> = {
  dia: "Diário",
  mes: "Mensal",
  semestre: "Semestral",
  ano: "Anual",
};

/**
 * Prints the Livro 1 of one period (diário, mensal, semestral, anual):
 * the book is hybrid, kept in the system and printed for the paper book.
 */
export function ProtocolPeriodPrint({
  bookId,
  volume,
  today,
}: {
  bookId: string;
  volume: string;
  today: string;
}) {
  const [period, setPeriod] = useState<Period>("dia");
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [half, setHalf] = useState<1 | 2>(
    Number(today.slice(5, 7)) <= 6 ? 1 : 2,
  );
  const range = periodRange(period, day, month, year, half);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <NativeSelect
          aria-label="Período da impressão"
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          {(Object.keys(LABELS) as Period[]).map((p) => (
            <option key={p} value={p}>
              {LABELS[p]}
            </option>
          ))}
        </NativeSelect>
        {period === "dia" && (
          <Input
            type="date"
            aria-label="Dia"
            value={day}
            max={today}
            onChange={(e) => setDay(e.target.value)}
            className="w-auto bg-background"
          />
        )}
        {period === "mes" && (
          <Input
            type="month"
            aria-label="Mês"
            value={month}
            max={today.slice(0, 7)}
            onChange={(e) => setMonth(e.target.value)}
            className="w-auto bg-background"
          />
        )}
        {period === "semestre" && (
          <NativeSelect
            aria-label="Semestre"
            value={String(half)}
            onChange={(e) => setHalf(e.target.value === "2" ? 2 : 1)}
          >
            <option value="1">1º semestre</option>
            <option value="2">2º semestre</option>
          </NativeSelect>
        )}
        {(period === "semestre" || period === "ano") && (
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
          pdfHref={`/admin/ri/livros/${bookId}/pdf?de=${range.from}&ate=${range.to}`}
          title={`Livro ${volume} (Protocolo), ${LABELS[period].toLowerCase()}`}
          size="sm"
        />
      ) : (
        <p className="text-xs text-destructive">Escolha uma data válida.</p>
      )}
    </div>
  );
}
