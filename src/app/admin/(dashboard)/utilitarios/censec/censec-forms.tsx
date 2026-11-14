"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import {
  CENTRALS,
  CEP_DOCUMENTS,
  CEP_KINDS,
  CEP_NATURES,
  CEP_QUALITIES,
  CEP_REFERENCE_KINDS,
  CESDI_DOCUMENTS,
  CESDI_KINDS,
  CESDI_QUALITIES,
  type Central,
  CUSTODY,
  LITIGATIONS,
  type Option,
  PAYMENT_FORMS,
  PAYMENT_TERMS,
  RCTO_DOCUMENTS,
  RCTO_KINDS,
  REGIMES,
  UFS,
  USUCAPIAO_NATURES,
} from "@/core/censec/censec.ts";
import { MAX_ASSETS, MAX_PARTIES } from "@/core/censec/form.ts";
import { LONG_TEXT_MAX, MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  type CensecState,
  closingAction,
  removeActAction,
  removeClosingAction,
  saveActAction,
  type UploadState,
  uploadAction,
} from "./actions.ts";

const IDLE: CensecState = { status: "idle" };
const BASE = "/admin/utilitarios/censec";

function Box({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {hint && (
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            {hint}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Text({
  name,
  label,
  value,
  hint,
  type = "text",
  wide,
  base,
}: {
  name: string;
  label: string;
  value: string;
  hint?: string;
  type?: string;
  wide?: boolean;
  base: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}
    >
      <Label htmlFor={`${base}-${name}`}>{label}</Label>
      <Input
        id={`${base}-${name}`}
        name={name}
        type={type}
        defaultValue={value}
        maxLength={300}
        autoComplete="off"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Choice({
  name,
  label,
  value,
  options,
  base,
  wide,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  base: string;
  wide?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}
    >
      <Label htmlFor={`${base}-${name}`}>{label}</Label>
      <NativeSelect
        id={`${base}-${name}`}
        name={name}
        defaultValue={value}
        className="w-full"
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

const opts = (table: readonly Option[], blank = "Escolha") => [
  ["", blank] as const,
  ...table.map((o) => [o[0], o[2]] as const),
];
const UF_OPTIONS = [["", "UF"] as const, ...UFS.map((u) => [u, u] as const)];
const YES_NO = [
  ["", "Não informado"],
  ["sim", "Sim"],
  ["nao", "Não"],
] as const;

// ---------------------------------------------------------------- upload

/**
 * Attach the documents: as many as there are, or all joined in a single
 * PDF; they are read, launched in their central and quinzena, and not kept.
 */
export function UploadForm({ quinzena }: { quinzena: string }) {
  const [state, action, pending] = useActionState(uploadAction, {
    status: "idle",
  } as UploadState);
  const id = useId();
  return (
    <div className="flex flex-col gap-5">
      <form
        action={action}
        className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-6"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-docs`}>
            Escrituras, procurações, atas, inventários, divórcios e testamentos
          </Label>
          <Input
            id={`${id}-docs`}
            name="documentos"
            type="file"
            multiple
            required
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          <p className="text-xs text-muted-foreground text-justify hyphens-auto">
            Escolha quantos arquivos tiver, de uma vez (até 60), ou um PDF único
            com todos os atos da quinzena. Cada arquivo pode ter até 50 MB, e o
            envio inteiro até 100 MB. O sistema só lê: os arquivos não ficam
            guardados.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-quinzena`}>
              Quinzena, se o ato não trouxer a data
            </Label>
            <Input
              id={`${id}-quinzena`}
              name="quinzena"
              defaultValue={quinzena}
              pattern="\d{4}-\d{2}-[12]"
              placeholder="2026-11-1"
            />
            <p className="text-xs text-muted-foreground">
              Ano-mês-1 (dias 1 a 15) ou ano-mês-2 (16 ao fim). Com a data no
              ato, a quinzena é a dele.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="aproveitar"
              value="sim"
              defaultChecked
              className="mt-1"
            />
            <span className="text-justify hyphens-auto">
              Aproveitar as escrituras, inventários e partilhas com imóvel
              também para a comunicação à prefeitura (Carga CTP) e a DOI.
            </span>
          </label>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Lendo os documentos..." : "Ler e lançar"}
          </Button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
      </form>
      {state.status === "done" && <UploadReportView report={state.report} />}
    </div>
  );
}

function UploadReportView({
  report,
}: {
  report: Extract<UploadState, { status: "done" }>["report"];
}) {
  const filesRead = report.files.filter((f) => f.acts > 0).length;
  const found = report.files.reduce((sum, f) => sum + f.acts, 0);
  const pending = report.saved.filter((s) => s.problems.length > 0).length;
  const byCentral = (c: Central) =>
    report.saved.filter((s) => s.central === c).length;
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs"
    >
      <h2 className="text-lg font-semibold text-foreground">
        Relatório da leitura
      </h2>
      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          ["Arquivos enviados", String(report.files.length)],
          ["Arquivos lidos", String(filesRead)],
          ["Atos encontrados", String(found)],
          ["Atos lançados", String(report.saved.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        CEP: {byCentral("cep")} · CESDI: {byCentral("cesdi")} · RCTO:{" "}
        {byCentral("rcto")}
        {pending > 0
          ? ` · ${pending} com pendência para completar antes de gerar o arquivo`
          : " · todos completos"}
      </p>
      {report.saved.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {report.saved.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {s.title} · {s.where || "sem livro e folha"} · {s.sourceName}
                </p>
                <p className="text-muted-foreground">
                  Lido: {s.found.join(", ") || "nada"}.
                </p>
                {s.problems.length > 0 && (
                  <p className="text-xs text-warning-text">
                    {s.problems.join(" ")}
                  </p>
                )}
              </div>
              <Link
                href={`${BASE}/${s.id}/alterar`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {s.problems.length > 0 ? "Completar" : "Conferir"}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {report.files.some((f) => f.note) && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
          <p className="font-medium">Não lidos ou com aviso</p>
          <ul className="mt-1 list-disc pl-5">
            {report.files
              .filter((f) => f.note)
              .map((f, i) => (
                <li key={`${f.name}-${i}`} className="break-words">
                  {f.name}: {f.note}
                </li>
              ))}
          </ul>
        </div>
      )}
      {report.transfers.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {report.transfers.map((t, i) => (
            <li key={`${t.sourceName}-${i}`} className="break-words">
              {t.sourceName}: {t.note}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Link href={BASE} className={buttonVariants({ variant: "outline" })}>
          Ver a quinzena e gerar os arquivos
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- act

function PartyFields({
  index,
  central,
  kind,
  values,
  base,
}: {
  index: number;
  central: Central;
  kind: string;
  values: Record<string, string>;
  base: string;
}) {
  const v = (field: string) => values[`party.${index}.${field}`] ?? "";
  const n = (field: string) => `party.${index}.${field}`;
  const couple =
    central === "cesdi" &&
    ["Separacao", "DivorcioDireto", "ConversaoDeSeparacaoEmDivorcio"].includes(
      kind,
    );
  return (
    <fieldset className="grid gap-4 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium text-foreground">
        Parte {index + 1}
      </legend>
      <Text
        name={n("name")}
        label="Nome completo"
        value={v("name")}
        wide
        base={base}
      />
      <Choice
        name={n("quality")}
        label="Qualidade"
        value={v("quality")}
        options={opts(central === "cesdi" ? CESDI_QUALITIES : CEP_QUALITIES)}
        base={base}
      />
      <Choice
        name={n("docType")}
        label="Documento principal"
        value={v("docType")}
        options={opts(central === "cesdi" ? CESDI_DOCUMENTS : CEP_DOCUMENTS)}
        base={base}
      />
      <Text
        name={n("docNumber")}
        label="Número do documento"
        value={v("docNumber")}
        base={base}
      />
      <Text
        name={n("identity")}
        label="RG (identidade)"
        value={v("identity")}
        base={base}
      />
      <Text
        name={n("issuer")}
        label="Órgão emissor do RG"
        value={v("issuer")}
        hint="Ex.: SSP/RN"
        base={base}
      />
      <Choice
        name={n("foreign")}
        label="Estrangeiro(a)?"
        value={v("foreign")}
        options={[
          ["", "Não"],
          ["sim", "Sim"],
        ]}
        base={base}
      />
      {central === "cesdi" && (
        <>
          <Text
            name={n("oab")}
            label="OAB nº (advogado)"
            value={v("oab")}
            base={base}
          />
          <Choice
            name={n("oabUf")}
            label="UF da OAB"
            value={v("oabUf")}
            options={UF_OPTIONS}
            base={base}
          />
        </>
      )}
      {couple && (
        <>
          <Choice
            name={n("spouse")}
            label="Cônjuge"
            value={v("spouse")}
            options={[
              ["", "Não é cônjuge"],
              ["Conjuge1", "Cônjuge 1"],
              ["Conjuge2", "Cônjuge 2"],
            ]}
            base={base}
          />
          <Text
            name={n("birthDate")}
            label="Nascimento"
            type="date"
            value={v("birthDate")}
            base={base}
          />
          <Choice
            name={n("sex")}
            label="Sexo"
            value={v("sex")}
            options={[
              ["", "Escolha"],
              ["F", "Feminino"],
              ["M", "Masculino"],
            ]}
            base={base}
          />
          <Text
            name={n("birthCountry")}
            label="País de nascimento"
            value={v("birthCountry")}
            hint="Por extenso: BRASIL."
            base={base}
          />
          <Choice
            name={n("birthUf")}
            label="UF de nascimento"
            value={v("birthUf")}
            options={UF_OPTIONS}
            base={base}
          />
          <Text
            name={n("residenceCountry")}
            label="País de residência"
            value={v("residenceCountry")}
            base={base}
          />
          <Choice
            name={n("residenceUf")}
            label="UF de residência"
            value={v("residenceUf")}
            options={UF_OPTIONS}
            base={base}
          />
          <Text
            name={n("residenceCity")}
            label="Município de residência (código IBGE)"
            value={v("residenceCity")}
            hint="7 números (ibge.gov.br)."
            base={base}
          />
        </>
      )}
    </fieldset>
  );
}

function AssetFields({
  index,
  central,
  values,
  base,
}: {
  index: number;
  central: Central;
  values: Record<string, string>;
  base: string;
}) {
  const v = (field: string) => values[`asset.${index}.${field}`] ?? "";
  const n = (field: string) => `asset.${index}.${field}`;
  return (
    <fieldset className="grid gap-4 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium text-foreground">
        Bem ou direito {index + 1}
      </legend>
      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${base}-${n("description")}`}>
          Descrição pormenorizada
        </Label>
        <Textarea
          id={`${base}-${n("description")}`}
          name={n("description")}
          defaultValue={v("description")}
          rows={2}
          maxLength={2000}
        />
      </div>
      <Text
        name={n("value")}
        label="Valor do bem (R$)"
        value={v("value")}
        base={base}
      />
      <Text
        name={n("fiscal")}
        label="Valor fiscal (R$)"
        value={v("fiscal")}
        base={base}
      />
      <Choice
        name={n("paymentForm")}
        label="Forma de pagamento"
        value={v("paymentForm")}
        options={opts(PAYMENT_FORMS, "Não se aplica")}
        base={base}
      />
      <Choice
        name={n("paymentTerm")}
        label="Prazo de pagamento"
        value={v("paymentTerm")}
        options={opts(PAYMENT_TERMS, "Não se aplica")}
        base={base}
      />
      {central === "cep" && (
        <>
          <Text
            name={n("matricula")}
            label="Matrícula do imóvel"
            value={v("matricula")}
            base={base}
          />
          <Text
            name={n("cnm")}
            label="Código Nacional de Matrícula (CNM)"
            value={v("cnm")}
            base={base}
          />
        </>
      )}
    </fieldset>
  );
}

/** Stable names for the party and bem boxes shown. */
const slots = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

const count = (values: Record<string, string>, prefix: string) => {
  let n = 0;
  for (const key of Object.keys(values)) {
    const m = new RegExp(`^${prefix}\\.(\\d+)\\.`).exec(key);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return n;
};

/**
 * Every field of the act, editable (decision of 14/11/2026): the fields
 * change with the central, as the CENSEC's own screens.
 */
export function ActForm({
  id,
  values,
  quinzena,
}: {
  id?: string;
  values: Record<string, string>;
  quinzena?: string;
}) {
  const [state, save, saving] = useActionState(saveActAction, IDLE);
  const base = useId();
  const v = (key: string) => values[key] ?? "";
  const [central, setCentral] = useState<Central>(
    (v("central") as Central) || "cep",
  );
  const [kind, setKind] = useState(v("kind"));
  const [parties, setParties] = useState<string[]>(() =>
    slots("p", Math.max(count(values, "party") + (id ? 1 : 3), 1)),
  );
  const [assets, setAssets] = useState<string[]>(() =>
    slots("a", count(values, "asset") + 1),
  );
  const kinds =
    central === "cep"
      ? CEP_KINDS
      : central === "cesdi"
        ? CESDI_KINDS
        : RCTO_KINDS;
  const couple =
    central === "cesdi" &&
    ["Separacao", "DivorcioDireto", "ConversaoDeSeparacaoEmDivorcio"].includes(
      kind,
    );
  return (
    <form action={save} className="flex flex-col gap-5">
      {id && <input type="hidden" name="id" value={id} />}
      {quinzena && <input type="hidden" name="quinzena" value={quinzena} />}
      <Box
        title="Ato"
        hint="A central decide o que a CENSEC pede: escrituras e procurações no CEP, separações, divórcios e inventários no CESDI, testamentos no RCTO."
      >
        <Choice
          name="central"
          label="Central"
          value={central}
          options={Object.entries(CENTRALS).map(
            ([k, c]) => [k, `${c.short}: ${c.label}`] as const,
          )}
          base={base}
          wide
          onChange={(value) => setCentral(value as Central)}
        />
        <Choice
          key={`kind-${central}`}
          name="kind"
          label="Tipo do ato"
          value={kinds.some((k) => k[0] === kind) ? kind : ""}
          options={opts(kinds)}
          base={base}
          onChange={setKind}
        />
        {central === "cep" && kind === "Escritura" && (
          <Choice
            name="nature"
            label="Natureza da escritura"
            value={v("nature")}
            options={opts(CEP_NATURES)}
            base={base}
          />
        )}
        {central === "cep" && kind === "AtaNotarialDeUsucapiao" && (
          <Choice
            name="nature"
            label="Natureza da usucapião"
            value={v("nature")}
            options={opts(USUCAPIAO_NATURES)}
            base={base}
          />
        )}
        <Text
          name="date"
          label={central === "rcto" ? "Data do testamento" : "Data do ato"}
          type="date"
          value={v("date")}
          base={base}
        />
        <Text
          name="mne"
          label="MNE (e-Notariado)"
          value={v("mne")}
          hint="Só se o ato foi feito no e-Notariado: 24 números."
          base={base}
        />
        <Text
          name="book"
          label="Livro (só números)"
          value={v("book")}
          base={base}
        />
        <Text
          name="bookSuffix"
          label="Complemento do livro"
          value={v("bookSuffix")}
          hint="Livro 100-F: informe só F."
          base={base}
        />
        <Text
          name="page"
          label="Folha inicial (só números)"
          value={v("page")}
          base={base}
        />
        <Text
          name="pageSuffix"
          label="Complemento da folha"
          value={v("pageSuffix")}
          hint="Folha 123-V: informe só V."
          base={base}
        />
        {central === "cep" && (
          <>
            <Text
              name="value"
              label="Valor do ato (R$)"
              value={v("value")}
              hint="O valor do negócio, não o dos emolumentos; 0,00 se não tem valor."
              base={base}
            />
            <Text
              name="contractDate"
              label="Data do contrato particular"
              type="date"
              value={v("contractDate")}
              base={base}
            />
            {(kind.includes("Procuracao") || kind === "Substabelecimento") && (
              <Text
                name="validity"
                label="Validade da procuração"
                type="date"
                value={v("validity")}
                base={base}
              />
            )}
            {kind === "Substabelecimento" && (
              <Choice
                name="reserve"
                label="Com reserva de poderes?"
                value={v("reserve")}
                options={YES_NO}
                base={base}
              />
            )}
            <Choice
              name="regime"
              label="Regime de bens (união estável)"
              value={v("regime")}
              options={opts(REGIMES, "Não se aplica")}
              base={base}
            />
            <Choice
              name="litigation"
              label="Natureza do litígio (conciliação, mediação)"
              value={v("litigation")}
              options={opts(LITIGATIONS, "Não se aplica")}
              base={base}
            />
            <Choice
              name="agreement"
              label="Houve acordo?"
              value={v("agreement")}
              options={YES_NO}
              base={base}
            />
            <Text
              name="complement"
              label="Complementação (procuração)"
              value={v("complement")}
              base={base}
            />
          </>
        )}
      </Box>

      {couple && (
        <Box
          title="Casal"
          hint="Separação, divórcio e conversão: o CESDI pede o casamento, o regime e os filhos."
        >
          <Text
            name="marriageDate"
            label="Data do casamento"
            type="date"
            value={v("marriageDate")}
            base={base}
          />
          <Choice
            name="regime"
            label="Regime de bens"
            value={v("regime")}
            options={opts(REGIMES)}
            base={base}
          />
          <Text
            name="adultChildren"
            label="Filhos maiores"
            value={v("adultChildren")}
            base={base}
          />
          <Text
            name="minorChildren"
            label="Filhos menores"
            value={v("minorChildren")}
            base={base}
          />
          <Choice
            name="custody"
            label="Responsável pelos filhos menores"
            value={v("custody")}
            options={opts(CUSTODY)}
            base={base}
          />
        </Box>
      )}

      {central === "rcto" ? (
        <>
          <Box
            title="Testador"
            hint="Só o testador: as testemunhas não são informadas (CNN, art. 267, § 2º)."
          >
            <Text
              name="testator.name"
              label="Nome completo"
              value={v("testator.name")}
              wide
              base={base}
            />
            <Text
              name="testator.cpf"
              label="CPF"
              value={v("testator.cpf")}
              base={base}
            />
            <Text
              name="testator.birthDate"
              label="Nascimento"
              type="date"
              value={v("testator.birthDate")}
              base={base}
            />
            <Text
              name="testator.mother"
              label="Nome da mãe"
              value={v("testator.mother")}
              base={base}
            />
            <Text
              name="testator.father"
              label="Nome do pai"
              value={v("testator.father")}
              base={base}
            />
            <Choice
              name="testator.docType"
              label="Documento"
              value={v("testator.docType")}
              options={opts(RCTO_DOCUMENTS, "Sem documento")}
              base={base}
            />
            <Text
              name="testator.doc"
              label="Número do documento"
              value={v("testator.doc")}
              base={base}
            />
            <Text
              name="testator.docComplement"
              label="Complemento (órgão emissor)"
              value={v("testator.docComplement")}
              hint="Ex.: SSP/RN, PASSAPORTE."
              base={base}
            />
            <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${base}-observations`}>Observações</Label>
              <Textarea
                id={`${base}-observations`}
                name="observations"
                defaultValue={v("observations")}
                rows={2}
                maxLength={2000}
              />
            </div>
          </Box>
          {(kind === "Revogacao" || kind === "TestamentoComRevogacao") && (
            <Box
              title="Testamento revogado"
              hint="O CNS do cartório onde foi lavrado, a data, o livro e a folha."
            >
              <Text
                name="revocation.cns"
                label="CNS do cartório"
                value={v("revocation.cns")}
                base={base}
              />
              <Text
                name="revocation.date"
                label="Data do testamento revogado"
                type="date"
                value={v("revocation.date")}
                base={base}
              />
              <Text
                name="revocation.book"
                label="Livro"
                value={v("revocation.book")}
                base={base}
              />
              <Text
                name="revocation.bookSuffix"
                label="Complemento do livro"
                value={v("revocation.bookSuffix")}
                base={base}
              />
              <Text
                name="revocation.page"
                label="Folha"
                value={v("revocation.page")}
                base={base}
              />
              <Text
                name="revocation.pageSuffix"
                label="Complemento da folha"
                value={v("revocation.pageSuffix")}
                base={base}
              />
              <Text
                name="revocation.unknown"
                label="Origem desconhecida (descreva)"
                value={v("revocation.unknown")}
                wide
                base={base}
              />
            </Box>
          )}
        </>
      ) : (
        <>
          <Box
            title="Partes"
            hint="Uma parte em cada quadro. Parte sem nome é ignorada."
          >
            {parties.map((slot, i) => (
              <PartyFields
                key={slot}
                index={i}
                central={central}
                kind={kind}
                values={values}
                base={base}
              />
            ))}
            {parties.length < MAX_PARTIES && (
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setParties((list) => [
                      ...list,
                      `p-${list.length}-${Date.now()}`,
                    ])
                  }
                >
                  Adicionar parte
                </Button>
              </div>
            )}
          </Box>
          <Box
            title="Bens e direitos"
            hint="O bem do ato, com o valor, o valor fiscal e o pagamento (CNN, art. 169). Bem sem descrição, valor e matrícula é ignorado."
          >
            {assets.map((slot, i) => (
              <AssetFields
                key={slot}
                index={i}
                central={central}
                values={values}
                base={base}
              />
            ))}
            {assets.length < MAX_ASSETS && (
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setAssets((list) => [
                      ...list,
                      `a-${list.length}-${Date.now()}`,
                    ])
                  }
                >
                  Adicionar bem ou direito
                </Button>
              </div>
            )}
          </Box>
          <Box
            title="Ato de origem"
            hint="Só para revogação, renúncia ou substabelecimento de procuração, rerratificação e retificação: o ato a que este se refere."
          >
            {central === "cep" ? (
              <Choice
                name="ref.kind"
                label="Tipo do ato de origem"
                value={v("ref.kind")}
                options={opts(CEP_REFERENCE_KINDS, "Não se aplica")}
                base={base}
              />
            ) : (
              <Choice
                name="ref.kind"
                label="Tipo do ato retificado"
                value={v("ref.kind")}
                options={opts(CESDI_KINDS, "Não se aplica")}
                base={base}
              />
            )}
            <Text
              name="ref.cns"
              label="CNS do cartório de origem"
              value={v("ref.cns")}
              base={base}
            />
            <Text
              name="ref.book"
              label="Livro"
              value={v("ref.book")}
              base={base}
            />
            <Text
              name="ref.bookSuffix"
              label="Complemento do livro"
              value={v("ref.bookSuffix")}
              base={base}
            />
            <Text
              name="ref.page"
              label="Folha"
              value={v("ref.page")}
              base={base}
            />
            <Text
              name="ref.pageSuffix"
              label="Complemento da folha"
              value={v("ref.pageSuffix")}
              base={base}
            />
          </Box>
        </>
      )}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
        <Label htmlFor={`${base}-notes`}>
          Observações internas (não vão para a CENSEC)
        </Label>
        <Textarea
          id={`${base}-notes`}
          name="notes"
          defaultValue={v("notes")}
          rows={2}
          maxLength={LONG_TEXT_MAX}
        />
        {id && (
          <>
            <Label htmlFor={`${base}-justificativa`}>Justificativa</Label>
            <Textarea
              id={`${base}-justificativa`}
              name="justificativa"
              minLength={MIN_JUSTIFICATION}
              maxLength={LONG_TEXT_MAX}
              rows={2}
              placeholder="Por exemplo: corrigida a folha conforme o livro."
            />
          </>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
        <div>
          <Button type="submit" disabled={saving}>
            {saving
              ? "Salvando..."
              : id
                ? "Salvar alterações"
                : "Lançar na quinzena"}
          </Button>
        </div>
      </section>
    </form>
  );
}

export function RemoveActButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeActAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este ato da carga?"
      consequence="Ele sai da quinzena e dos arquivos, mas fica guardado, com quem excluiu, quando e por quê."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/** The fechamento done in the CENSEC: positive with the acts, or negative. */
export function ClosingForm({
  quinzena,
  central,
  acts,
  today,
}: {
  quinzena: string;
  central: Central;
  acts: number;
  today: string;
}) {
  const [state, action, pending] = useActionState(closingAction, IDLE);
  const id = useId();
  return (
    <form
      action={action}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="quinzena" value={quinzena} />
      <input type="hidden" name="central" value={central} />
      <input type="hidden" name="acts" value={acts} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-sent`}>Fechado em</Label>
        <Input
          id={`${id}-sent`}
          name="sentOn"
          type="date"
          defaultValue={today}
          required
          className="w-44"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor={`${id}-protocol`}>
          Protocolo ou referência da carga
        </Label>
        <Input
          id={`${id}-protocol`}
          name="protocol"
          maxLength={120}
          placeholder="Ex.: C044334"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending
          ? "Registrando..."
          : acts === 0
            ? "Registrar fechamento negativo"
            : "Registrar fechamento"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function RemoveClosingButton({
  id,
  quinzena,
}: {
  id: string;
  quinzena: string;
}) {
  const [state, action, pending] = useActionState(removeClosingAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir o registro deste fechamento?"
      consequence="O registro fica guardado, com quem excluiu, quando e por quê. No CENSEC, o estorno é feito lá."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="quinzena" value={quinzena} />
    </ConfirmAction>
  );
}
