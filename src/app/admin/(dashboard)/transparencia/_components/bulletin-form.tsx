"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  BALANCE_LABEL,
  type BulletinDraft,
  bulletinPeriodKey,
  bulletinView,
  EMPTY_BULLETIN_DRAFT,
  formatMoneyBRL,
  formatMonthYear,
  fundFieldName,
  MONTHS_PT,
  parseCount,
  parseMoneyBRL,
} from "@/core/transparency/bulletin.ts";
import {
  FUNDS_BY_STATE,
  type SupportedState,
} from "@/core/transparency/rubrics.ts";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import {
  LocalSignerPicker,
  useLocalSigner,
} from "../../utilitarios/assinador/a3.tsx";
import {
  type Mode,
  ModeChoice,
  signThroughToken,
} from "../../utilitarios/assinador/sign-forms.tsx";
import {
  type ActionState,
  finishBulletinA3,
  prepareBulletinA3,
  publishBulletinAction,
  readBulletinReport,
  type SaveState,
  saveBulletinOptionAction,
} from "../actions.ts";
import { BulletinPreview } from "./bulletin-preview.tsx";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-foreground";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-destructive">{message}</p>
  );
}

function MoneyField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label} (R$)
        {hint && (
          <span className="font-normal text-muted-foreground"> {hint}</span>
        )}
      </label>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      <FieldError message={error} />
    </div>
  );
}

/** What the form and preview need about the office, as one prop. */
export interface BulletinOffice {
  name: string;
  subtitle: string;
  legalFooter: string;
  city: string;
  state: SupportedState;
  publishPrivateFigures: boolean;
}

/**
 * The office-wide choice to publish gross revenue, expenses and the balance.
 * Saved on its own, the moment it is flipped: it is a setting, not part of a
 * month's bulletin, and it changes every month already on the site.
 */
function BulletinOption({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveBulletinOptionAction,
    { status: "idle" },
  );
  // The switch moves on the click, not when the page comes back: the save
  // re-renders the whole tab, and a switch that sits still for that long
  // reads as a click that did not take. A failed save drops the optimistic
  // value and the switch returns to what the server holds.
  const [shown, setShown] = useOptimistic(enabled);

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form
      action={(formData) => {
        setShown(!enabled);
        formAction(formData);
      }}
      className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5"
    >
      <div>
        <p
          id="bulletin-option-label"
          className="text-sm font-semibold text-foreground"
        >
          Publicar também arrecadação, despesas e saldo
        </p>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          A norma exige só os valores recolhidos aos fundos. Arrecadação,
          despesas e saldo são da serventia e saem no site só se esta opção
          estiver ligada. Desligar tira esses números de todos os boletins, os
          já publicados também.
        </p>
      </div>
      <input
        type="hidden"
        name="publishBulletinPrivateFigures"
        value={enabled ? "false" : "true"}
      />
      <button
        type="submit"
        role="switch"
        aria-checked={shown}
        aria-labelledby="bulletin-option-label"
        disabled={pending}
        className={`relative mt-0.5 h-5.5 w-10 flex-none rounded-full transition-colors ${
          shown ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background shadow-xs transition-all ${
            shown ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </form>
  );
}

export function BulletinForm({
  office,
  currentMonth,
  currentYear,
  saved,
  declared = {},
  certificates = [],
  canSign = false,
  fromBook,
}: {
  office: BulletinOffice;
  currentMonth: number;
  currentYear: number;
  /** Every published month, as the form shows it, keyed "YYYY-MM". */
  saved: Record<string, BulletinDraft>;
  /**
   * What a Declaração de ISS left for a month not published yet, keyed
   * "YYYY-MM" (decision of 11/11/2026): the ISS, and everything read from
   * the system's productivity report. The form opens with it filled in.
   */
  declared?: Record<string, Partial<BulletinDraft>>;
  /** The A1 certificates this person may sign with. */
  certificates?: { id: string; label: string; holderName: string }[];
  /** May sign digitally (Assinador permission). */
  canSign?: boolean;
  /**
   * The month the Livro Diário Auxiliar sent (decision of 11/11/2026): the
   * form opens on it, filled in, and asks for the check before publishing.
   */
  fromBook?: { period: string; draft: Partial<BulletinDraft>; note: string };
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    publishBulletinAction,
    { status: "idle" },
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const funds = FUNDS_BY_STATE[office.state];

  const [month, setMonth] = useState(
    fromBook ? Number(fromBook.period.slice(5, 7)) : currentMonth,
  );
  const [year, setYear] = useState(
    fromBook ? Number(fromBook.period.slice(0, 4)) : currentYear,
  );
  const period = bulletinPeriodKey(year, month);

  // Each month keeps its own figures. What the operator has typed for a
  // month and not yet published lives in `edits`, so switching to another
  // month and back loses nothing; a month with no edits shows what is
  // published for it, ready to correct; a month with neither opens blank,
  // never with the figures of the month picked before it.
  const [edits, setEdits] = useState<Record<string, BulletinDraft>>(() =>
    fromBook
      ? {
          [fromBook.period]: {
            ...(saved[fromBook.period] ?? EMPTY_BULLETIN_DRAFT),
            ...fromBook.draft,
            legacy: false,
          },
        }
      : {},
  );
  const router = useRouter();
  // Read from the system's report: checked before it goes out (decision of
  // 11/11/2026).
  const [readFromReport, setReadFromReport] = useState(Boolean(fromBook));
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  // Signed before publishing, with A1 (here) or A3 (the token).
  const [signing, setSigning] = useState(false);
  const [signMode, setSignMode] = useState<Mode | null>(null);
  const local = useLocalSigner(signing && signMode === "a3");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const published = saved[period];
  const fromDeclaration = declared[period];
  const draft =
    edits[period] ??
    published ??
    (fromDeclaration
      ? { ...EMPTY_BULLETIN_DRAFT, ...fromDeclaration }
      : EMPTY_BULLETIN_DRAFT);
  const {
    actsCount: acts,
    funds: fundValues,
    iss,
    grossRevenue: gross,
    expenses,
    status,
  } = draft;

  function edit(change: Partial<BulletinDraft>) {
    setEdits((current) => ({
      ...current,
      [period]: { ...(current[period] ?? draft), ...change },
    }));
  }

  /** The system's report read into the month it covers. */
  async function readReport(files: FileList | null) {
    if (!files?.length) return;
    const sent = new FormData();
    for (const file of Array.from(files)) sent.append("relatorio", file);
    setReading(true);
    setReadNote(null);
    const result = await readBulletinReport(sent);
    setReading(false);
    if (result.status === "error") {
      setReadNote(result.message);
      return;
    }
    const f = result.figures;
    const [y, m] = f.competence
      ? f.competence.split("-").map(Number)
      : [year, month];
    const money = (cents: number | undefined) =>
      cents === undefined ? "" : formatMoneyBRL(cents);
    const key = bulletinPeriodKey(y, m);
    setYear(y);
    setMonth(m);
    setEdits((current) => {
      const base = current[key] ?? saved[key] ?? EMPTY_BULLETIN_DRAFT;
      const fundValues: Record<string, string> = { ...base.funds };
      for (const fund of funds) {
        const cents = f.funds?.[fund.key as keyof NonNullable<typeof f.funds>];
        if (cents !== undefined) fundValues[fund.key] = money(cents);
      }
      return {
        ...current,
        [key]: {
          ...base,
          actsCount:
            f.actsCount === undefined ? base.actsCount : String(f.actsCount),
          funds: fundValues,
          iss: f.issCents === undefined ? base.iss : money(f.issCents),
          grossRevenue:
            f.grossRevenueCents === undefined
              ? base.grossRevenue
              : money(f.grossRevenueCents),
          expenses:
            f.expensesCents === undefined
              ? base.expenses
              : money(f.expensesCents),
          legacy: false,
        },
      };
    });
    setReadFromReport(true);
    setReadNote(
      "Lido do relatório. Confira os valores e marque a conferência antes de publicar.",
    );
  }

  /** A3: the token signs the bulletin's PDF, then it is published signed. */
  async function publishWithToken(form: HTMLFormElement) {
    const token = local.certificate;
    if (!token) {
      setTokenError("Escolha o certificado A3.");
      return;
    }
    setTokenError("");
    setTokenBusy(true);
    const data = new FormData(form);
    const fields: Record<string, string> = {};
    for (const [k, v] of data.entries()) fields[k] = String(v);
    const prepareData = new FormData();
    for (const [k, v] of Object.entries(fields)) prepareData.set(k, v);
    prepareData.set("holder", token.certificado);
    prepareData.set("chain", JSON.stringify(token.cadeia));
    const outcome = await signThroughToken(
      token,
      () => prepareBulletinA3(prepareData),
      finishBulletinA3,
      fields,
    );
    setTokenBusy(false);
    if (outcome.status === "error") {
      setTokenError(outcome.message);
      return;
    }
    toast.success("Boletim assinado e publicado no site.");
    setEdits(({ [period]: _published, ...rest }) => rest);
    setReadFromReport(false);
    router.refresh();
  }

  // The period the last submit published, so its edits can be dropped once
  // the page comes back with the month as stored. A ref, not state: the
  // effect has to run once per finished publish, not again on the next click.
  const submitted = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== "success") return;
    toast.success("Boletim publicado no site.");
    setReadFromReport(false);
    const done = submitted.current;
    if (done) setEdits(({ [done]: _published, ...rest }) => rest);
  }, [state]);

  // The preview never shows a blank: anything unparseable reads as zero, so
  // the operator always sees a coherent boletim taking shape as they type.
  // That zero lives only here; the action parses the typed strings again and
  // refuses a blank.
  const view = useMemo(() => {
    const fundAmountsCents: Record<string, number> = {};
    for (const fund of funds) {
      fundAmountsCents[fund.key] =
        parseMoneyBRL(fundValues[fund.key] ?? "") ?? 0;
    }
    return bulletinView(
      office.state,
      {
        actsCount: parseCount(acts) ?? 0,
        fundAmountsCents,
        issCents: parseMoneyBRL(iss) ?? 0,
        grossRevenueCents: parseMoneyBRL(gross) ?? 0,
        expensesCents: parseMoneyBRL(expenses) ?? 0,
      },
      office.publishPrivateFigures,
    );
  }, [
    acts,
    fundValues,
    iss,
    gross,
    expenses,
    funds,
    office.state,
    office.publishPrivateFigures,
  ]);
  const privateFigures = view.privateFigures;

  return (
    <div className="space-y-5">
      <BulletinOption enabled={office.publishPrivateFigures} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Submitted by hand, not through `action`: a form action resets
            the form once it settles, and the operator has to keep seeing the
            month they just published, still editable. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (signing && signMode === "a3") {
              void publishWithToken(event.currentTarget);
              return;
            }
            const formData = new FormData(event.currentTarget);
            submitted.current = period;
            startTransition(() => formAction(formData));
          }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <h3 className="text-lg font-semibold text-foreground">
            {published
              ? `Boletim de ${formatMonthYear(month, year)}`
              : "Novo boletim"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {published
              ? "Este mês já está no site. Corrija o que precisar e publique de novo: o boletim publicado é substituído."
              : "Digite os valores do mês como aparecem nas guias de recolhimento."}{" "}
            {office.publishPrivateFigures
              ? "Os totais e o saldo são calculados automaticamente."
              : "Os totais são calculados automaticamente."}
          </p>
          {published?.legacy && (
            <p className="mt-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs font-medium text-warning-text">
              Este mês foi publicado no formato antigo, com os tributos num
              valor só. Informe cada fundo e o ISS conforme as guias para
              publicar de novo.
            </p>
          )}

          <div className="mt-3 rounded-lg border border-dashed border-primary bg-background px-3.5 py-2.5">
            <label htmlFor="b-relatorio" className={LABEL_CLASS}>
              Preencher pelo relatório do sistema (PDF de produtividade)
            </label>
            <input
              id="b-relatorio"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              form="b-relatorio-sozinho"
              onChange={(event) => void readReport(event.target.files)}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
            />
            <p
              className="mt-1 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {reading
                ? "Lendo o relatório..."
                : (readNote ??
                  (fromBook && period === fromBook.period
                    ? fromBook.note
                    : "O sistema lê os números e preenche o mês. Tudo continua editável."))}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="b-month" className={LABEL_CLASS}>
                Mês
              </label>
              <NativeSelect
                id="b-month"
                name="month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                aria-invalid={fieldErrors.month ? true : undefined}
                className="w-full"
              >
                {MONTHS_PT.map((label, i) => (
                  <NativeSelectOption key={label} value={i + 1}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError message={fieldErrors.month} />
            </div>
            <div>
              <label htmlFor="b-year" className={LABEL_CLASS}>
                Ano
              </label>
              <Input
                id="b-year"
                name="year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-invalid={fieldErrors.year ? true : undefined}
              />
              <FieldError message={fieldErrors.year} />
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="b-acts" className={LABEL_CLASS}>
                Atos praticados
              </label>
              <Input
                id="b-acts"
                name="actsCount"
                inputMode="numeric"
                value={acts}
                onChange={(e) => edit({ actsCount: e.target.value })}
                aria-invalid={fieldErrors.actsCount ? true : undefined}
              />
              <FieldError message={fieldErrors.actsCount} />
            </div>
            {office.publishPrivateFigures && (
              <MoneyField
                id="b-gross"
                name="grossRevenue"
                label="Arrecadação do mês"
                value={gross}
                onChange={(value) => edit({ grossRevenue: value })}
                error={fieldErrors.grossRevenue}
              />
            )}
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-muted-foreground">
              Recolhido aos fundos
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {funds.map((fund) => (
                <MoneyField
                  key={fund.key}
                  id={`b-${fundFieldName(fund.key)}`}
                  name={fundFieldName(fund.key)}
                  label={fund.label}
                  value={fundValues[fund.key] ?? ""}
                  onChange={(value) =>
                    edit({ funds: { ...fundValues, [fund.key]: value } })
                  }
                  error={fieldErrors[fundFieldName(fund.key)]}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <MoneyField
              id="b-iss"
              name="iss"
              label="ISS"
              hint={`tributo municipal (${office.city})`}
              value={iss}
              onChange={(value) => edit({ iss: value })}
              error={fieldErrors.iss}
            />
            {office.publishPrivateFigures && (
              <MoneyField
                id="b-expenses"
                name="expenses"
                label="Despesas"
                value={expenses}
                onChange={(value) => edit({ expenses: value })}
                error={fieldErrors.expenses}
              />
            )}
          </div>

          {/* Calculated, never an input: the saldo is the one figure the
              office is promised it will not have to type or reconcile. */}
          {privateFigures && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-success-soft px-4 py-3">
              <span className="text-xs font-medium text-success-text">
                {BALANCE_LABEL}, calculado
              </span>
              <span className="text-lg font-semibold text-success-text tabular-nums">
                R$ {formatMoneyBRL(privateFigures.balanceCents)}
              </span>
            </div>
          )}

          <div className="mt-4">
            <span className={LABEL_CLASS}>Situação</span>
            <div className="flex w-fit gap-1 rounded-lg border border-input bg-background p-1">
              {(["preliminary", "consolidated"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => edit({ status: s })}
                  aria-pressed={status === s}
                  className={
                    status === s
                      ? "rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
                      : "rounded-md px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  {s === "preliminary" ? "Preliminar" : "Consolidado"}
                </button>
              ))}
            </div>
            <input type="hidden" name="bulletinStatus" value={status} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Preliminar sai no site com a etiqueta "Dados preliminares".
            </p>
          </div>

          {readFromReport && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-3 text-xs text-warning-text">
              <input type="hidden" name="lido" value="1" />
              <p className="font-medium">
                Conferência: estes números foram lidos do relatório pelo
                sistema.
              </p>
              <label className="mt-1.5 flex items-start gap-2 font-medium">
                <input
                  type="checkbox"
                  name="conferido"
                  required
                  className="checkbox-admin mt-0.5"
                />
                Conferi os valores com o relatório e estão corretos. (Fica na
                auditoria com o meu nome.)
              </label>
            </div>
          )}

          {canSign && (
            <div className="mt-4 rounded-lg bg-muted/50 px-3.5 py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={signing}
                  onChange={(event) => setSigning(event.target.checked)}
                  className="checkbox-admin"
                />
                Assinar digitalmente antes de publicar
              </label>
              {signing && (
                // Two columns, as the sign choice (it spans both) expects:
                // with one, the A1 fields fell into a zero-width column.
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  <ModeChoice
                    mode={signMode}
                    onChange={setSignMode}
                    hasA1={certificates.length > 0}
                    prefix="boletim"
                  />
                  {signMode === "a1" && (
                    <div className="grid grid-cols-1 gap-2.5 md:col-span-2 md:grid-cols-2">
                      <input type="hidden" name="assinar" value="a1" />
                      <label htmlFor="b-certificate" className={LABEL_CLASS}>
                        Certificado
                        <NativeSelect
                          id="b-certificate"
                          name="certificateId"
                          required
                          className="mt-1.5 w-full font-normal"
                        >
                          {certificates.map((c) => (
                            <NativeSelectOption key={c.id} value={c.id}>
                              {c.label} · {c.holderName}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </label>
                      <label htmlFor="b-password" className={LABEL_CLASS}>
                        Senha do certificado
                        <Input
                          id="b-password"
                          name="password"
                          type="password"
                          autoComplete="off"
                          required
                          className="mt-1.5 font-normal"
                        />
                      </label>
                    </div>
                  )}
                  {signMode === "a3" && (
                    <LocalSignerPicker signer={local} prefix="boletim" />
                  )}
                  {tokenError && (
                    <p
                      role="alert"
                      className="text-xs font-medium text-destructive md:col-span-2"
                    >
                      {tokenError}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground md:col-span-2">
                    O boletim sobe no site já assinado, com o QR de verificação.
                    Se você corrigir algo depois, é só editar e publicar de novo
                    (e assinar de novo).
                  </p>
                </div>
              )}
            </div>
          )}

          {state.status === "error" && !Object.keys(fieldErrors).length && (
            <p
              role="alert"
              className="mt-3 text-xs font-medium text-destructive"
            >
              {state.message}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={pending || tokenBusy || (signing && !signMode)}
            className="mt-4 w-full"
          >
            {pending || tokenBusy
              ? signing
                ? "Assinando e publicando…"
                : "Publicando…"
              : signing
                ? "Assinar e publicar no site"
                : published
                  ? "Publicar correção no site"
                  : "Publicar no site"}
          </Button>
        </form>

        <div>
          <p className="mb-2.5 text-xs font-medium text-muted-foreground">
            Pré-visualização do PDF · como sai no site
          </p>
          <BulletinPreview
            officeName={office.name}
            officeSubtitle={office.subtitle}
            legalFooter={office.legalFooter}
            city={office.city}
            month={month}
            year={year}
            view={view}
            status={status}
          />
        </div>
      </div>
    </div>
  );
}
