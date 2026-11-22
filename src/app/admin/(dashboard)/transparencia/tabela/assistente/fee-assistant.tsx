"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useState } from "react";
import {
  ADJUSTABLE_COLUMNS,
  type Adjustment,
  COLUMN_LABELS,
  formatFactor,
} from "@/core/fees/custas.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  type PreviewState,
  type PublishState,
  previewAction,
  publishAction,
  type ReadState,
  readAdjustmentAction,
} from "./actions.ts";

export interface BaseInfo {
  id: string;
  title: string;
  metaTitle: string;
  validity: string;
  presentation: string;
  year: string;
  issPercent: string;
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function lawLabelOf(law: { name: string; number: string; date: string }) {
  return [
    law.name,
    law.number ? `nº ${law.number.replace(/^n[º°o.]?\s*/i, "")}` : "",
    law.date ? `, de ${law.date}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(" ,", ",")
    .trim();
}

/**
 * The assistant that redoes the tabela de custas (decision of 22/11/2026):
 * 1. what changes (the law or table read by the assistente virtual, a
 *    "código; valor" spreadsheet, or an index typed in);
 * 2. every row that changes, before and after, and the checks;
 * 3. the PDF in the office's standard, to download or publish as the
 *    table in force, with the name and the law.
 */
export function FeeAssistant({
  base,
  tables,
}: {
  base: BaseInfo;
  tables: { id: string; title: string }[];
}) {
  const ids = {
    base: useId(),
    column: useId(),
    index: useId(),
    note: useId(),
    files: useId(),
    law: useId(),
    docTitle: useId(),
    title: useId(),
    year: useId(),
    validity: useId(),
    presentation: useId(),
    checked: useId(),
  };
  const [read, readAction, reading] = useActionState<ReadState, FormData>(
    readAdjustmentAction,
    { status: "idle" },
  );
  const [preview, previewDispatch, previewing] = useActionState<
    PreviewState,
    FormData
  >(previewAction, { status: "idle" });
  const [published, publishDispatch, publishing] = useActionState<
    PublishState,
    FormData
  >(publishAction, { status: "idle" });
  const [checked, setChecked] = useState(false);

  const adjustments: Adjustment[] =
    read.status === "read" ? read.adjustments : [];
  const columns = [
    ...new Set(adjustments.map((a) => COLUMN_LABELS[a.column])),
  ].join(", ");
  const factor = adjustments.find((a) => a.mode === "indice");
  const law =
    read.status === "read"
      ? read.law
      : { name: "", number: "", date: "", effective: "" };
  const suggestedLaw = lawLabelOf(law);

  // Keyed by the reading: a new reading brings new suggestions.
  const readKey =
    read.status === "read"
      ? JSON.stringify(read.adjustments).length + read.summary
      : "none";

  const [fields, setFields] = useState<Record<string, string>>({});
  const value = (name: string, fallback: string) =>
    fields[`${readKey}:${name}`] ?? fallback;
  const set = (name: string) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [`${readKey}:${name}`]: e.target.value }));

  const lawText = value("law", suggestedLaw);

  const defaults = useMemo(() => {
    const newIndex =
      factor?.mode === "indice"
        ? `Índice: ${formatFactor(factor.factorMicro)}`
        : "";
    const validity = law.effective
      ? [
          `Vigência do ${columns}: ${law.effective}`,
          law.date ? `Publicação: ${law.date}` : "",
          newIndex,
        ]
          .filter(Boolean)
          .join(" · ")
      : newIndex && /Índice: [\d.,]+/.test(base.validity)
        ? base.validity.replace(/Índice: [\d.,]+/, newIndex)
        : base.validity;
    const intro = `Esta versão atualiza a tabela (${base.title}) conforme ${lawText || "o ajuste informado"}${read.status === "read" && read.summary ? `: ${read.summary}` : "."} Os valores alterados foram recalculados pela plataforma: o ISS à alíquota de ${base.issPercent} sobre os emolumentos e o total como a soma das colunas.`;
    return {
      validity,
      documentTitle:
        `Tabela de Custas ${base.year} (${columns || "ajuste"}${lawText ? `: ${lawText}` : ""})`.slice(
          0,
          200,
        ),
      presentation: `${intro}\n\n${base.presentation}`,
    };
  }, [base, columns, factor, law, read, lawText]);

  const plan = JSON.stringify({
    base: base.id,
    adjustments,
    title: value("title", base.metaTitle),
    validity: value("validity", defaults.validity),
    presentation: value("presentation", defaults.presentation),
    documentTitle: value("documentTitle", defaults.documentTitle),
    yearLabel: value("year", base.year),
    law: lawText,
  });

  return (
    <div className="flex flex-col gap-5">
      <Step n={1} title="O que mudou">
        <p className="text-sm text-muted-foreground">
          Anexe a lei, o provimento, a tabela do fundo (por exemplo, a tabela do
          FRMP) ou a planilha com os novos valores. O assistente virtual lê e
          diz o que muda; as contas de ISS e total são feitas pela plataforma,
          em centavos, linha por linha. Sem anexo, escolha a coluna e informe o
          índice.
        </p>
        <form action={readAction} className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor={ids.base}>Tabela base</Label>
            <NativeSelect id={ids.base} name="base" defaultValue={base.id}>
              {tables.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.title}
                  {t.id === base.id ? " (vigente)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor={ids.files}>
              Lei, tabela ou planilha (PDF, Word, Excel ou CSV)
            </Label>
            <Input
              id={ids.files}
              name="anexos"
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.txt,application/pdf"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.column}>Coluna que mudou</Label>
            <NativeSelect id={ids.column} name="coluna" defaultValue="">
              <NativeSelectOption value="">
                O assistente virtual diz
              </NativeSelectOption>
              {ADJUSTABLE_COLUMNS.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {COLUMN_LABELS[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.index}>Índice (só sem anexo)</Label>
            <Input
              id={ids.index}
              name="indice"
              placeholder="Ex.: 1,0521 ou 5,21%"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor={ids.note}>
              O que mudou, nas suas palavras (opcional)
            </Label>
            <Textarea
              id={ids.note}
              name="nota"
              rows={2}
              placeholder="Ex.: o FRMP aumentou a partir de 1º de janeiro, conforme a lei anexa."
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={reading}>
              {reading
                ? "Lendo... (pode levar um minuto)"
                : "Ler e montar a nova tabela"}
            </Button>
          </div>
        </form>
        {read.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {read.message}
          </p>
        )}
        {read.status === "read" && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <p>
              <strong>
                {read.source === "assistente"
                  ? "Lido pelo assistente virtual:"
                  : read.source === "planilha"
                    ? "Lido da planilha:"
                    : "Índice informado:"}
              </strong>{" "}
              {read.summary}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {adjustments.map((a, i) => (
                <li key={`${a.column}-${i}`}>
                  {COLUMN_LABELS[a.column]}:{" "}
                  {a.mode === "indice"
                    ? `índice ${formatFactor(a.factorMicro)}`
                    : `${a.values.length} valores por código`}
                </li>
              ))}
            </ul>
            {read.doubts && (
              <p className="mt-1 text-warning-text">Conferir: {read.doubts}</p>
            )}
            {read.dropped.length > 0 && (
              <p className="mt-1 text-warning-text">
                Deixado de fora por estar ilegível: {read.dropped.join("; ")}.
              </p>
            )}
          </div>
        )}
      </Step>

      {read.status === "read" && (
        <Step n={2} title="Nome, lei e textos da nova tabela">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor={ids.law}>
                Lei ou ato que alterou (vai para a auditoria e para a
                apresentação)
              </Label>
              <Input
                id={ids.law}
                value={value("law", suggestedLaw)}
                onChange={set("law")}
                placeholder="Ex.: Lei Estadual nº 0.000, de 01/01/2027"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.docTitle}>
                Nome do documento em Transparência
              </Label>
              <Input
                id={ids.docTitle}
                value={value("documentTitle", defaults.documentTitle)}
                onChange={set("documentTitle")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.year}>Ano (ou período) do documento</Label>
              <Input
                id={ids.year}
                value={value("year", base.year)}
                onChange={set("year")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.title}>Título na capa</Label>
              <Input
                id={ids.title}
                value={value("title", base.metaTitle)}
                onChange={set("title")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.validity}>Linha de vigência na capa</Label>
              <Input
                id={ids.validity}
                value={value("validity", defaults.validity)}
                onChange={set("validity")}
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor={ids.presentation}>
                Apresentação (um parágrafo por bloco, separados por linha em
                branco)
              </Label>
              <Textarea
                id={ids.presentation}
                rows={8}
                value={value("presentation", defaults.presentation)}
                onChange={set("presentation")}
              />
            </div>
          </div>
          <form action={previewDispatch}>
            <input type="hidden" name="plano" value={plan} />
            <Button type="submit" disabled={previewing}>
              {previewing ? "Conferindo..." : "Ver o que muda, linha por linha"}
            </Button>
          </form>
          {preview.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {preview.message}
            </p>
          )}
        </Step>
      )}

      {read.status === "read" && preview.status === "ok" && (
        <Step n={3} title="Conferir e publicar">
          <p className="text-sm text-foreground">
            <strong>{preview.changed}</strong> de {preview.rowsTotal} linhas
            mudam ({preview.adjustmentLabels.join("; ")}). ISS e total de cada
            linha alterada foram recalculados.
          </p>
          <ul className="flex flex-wrap gap-2 text-xs">
            {preview.totals.map((t) => (
              <li
                key={t.column}
                className="rounded-full bg-muted px-3 py-1 text-foreground"
              >
                {t.column}: {t.rows} linhas, soma das diferenças {t.delta}
              </li>
            ))}
          </ul>
          {(preview.notFound.length > 0 || preview.ambiguous.length > 0) && (
            <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-text">
              {preview.notFound.length > 0 &&
                `Códigos do anexo que não existem na tabela (não aplicados): ${preview.notFound.join(", ")}. `}
              {preview.ambiguous.length > 0 &&
                `Códigos com número de valores diferente do número de faixas (deixados como estavam): ${preview.ambiguous.join(", ")}.`}
            </p>
          )}
          {(preview.baseErrors.length > 0 || preview.issExceptions > 0) && (
            <p className="text-xs text-muted-foreground">
              Da tabela base, sem mudança aqui:{" "}
              {preview.baseErrors.length > 0 &&
                `total que não fecha em ${preview.baseErrors.join("; ")}; `}
              {preview.issExceptions > 0 &&
                `${preview.issExceptions} linhas com ISS fora da alíquota (isentas ou especiais), mantido como está.`}
            </p>
          )}
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="px-2 py-1.5">Código</th>
                  <th className="px-2 py-1.5">Discriminação</th>
                  <th className="px-2 py-1.5">O que mudou (antes → depois)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.shown.map((r, i) => (
                  <tr key={`${r.code}-${i}`}>
                    <td className="px-2 py-1 font-mono">{r.code}</td>
                    <td className="px-2 py-1">{r.description}</td>
                    <td className="px-2 py-1">
                      {r.cells.map((c) => (
                        <span key={c.column} className="mr-3 inline-block">
                          {c.column}: {c.before} → <strong>{c.after}</strong>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.changed > preview.shown.length && (
            <p className="text-xs text-muted-foreground">
              Mostrando {preview.shown.length} de {preview.changed}: o PDF traz
              todas.
            </p>
          )}

          <label
            htmlFor={ids.checked}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <input
              id={ids.checked}
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1"
            />
            Conferi os valores alterados com a lei e a tabela oficial.
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <form
              method="post"
              action="/admin/transparencia/tabela/assistente/pdf"
              target="_blank"
              rel="noopener"
            >
              <input type="hidden" name="plano" value={plan} />
              <Button type="submit" variant="outline">
                Baixar o PDF da nova tabela
              </Button>
            </form>
            <ConfirmAction
              action={publishDispatch}
              pending={publishing}
              error={published.status === "error" ? published.message : null}
              trigger="Publicar como vigente"
              triggerClassName={buttonVariants({ variant: "default" })}
              question="Publicar esta tabela como a vigente?"
              consequence={`"${value("documentTitle", defaults.documentTitle)}" vai para Transparência, publicada e no topo: o site e as análises passam a usá-la. A tabela anterior continua guardada, logo abaixo. A lei fica registrada na auditoria.`}
              confirmLabel="Publicar como vigente"
              pendingLabel="Publicando..."
              justify={false}
            >
              <input type="hidden" name="plano" value={plan} />
              <input
                type="hidden"
                name="conferido"
                value={checked ? "sim" : ""}
              />
            </ConfirmAction>
          </div>
          {published.status === "success" && (
            <p className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-text">
              Publicada como a tabela vigente, com {published.changes} linhas
              alteradas.{" "}
              <Link
                href="/admin/transparencia"
                className="font-medium underline"
              >
                Ver em Transparência
              </Link>
            </p>
          )}
        </Step>
      )}
    </div>
  );
}
