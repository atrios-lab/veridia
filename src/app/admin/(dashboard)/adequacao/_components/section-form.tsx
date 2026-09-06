"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { unknownLabel } from "@/core/compliance/answers.ts";
import {
  detectPendencies,
  type Pendency,
  pendenciesByField,
} from "@/core/compliance/pendencies.ts";
import {
  type Answers,
  type FieldContext,
  type FieldDef,
  findSection,
  isVisible,
  type ListItem,
  optionsOf,
  SECTIONS,
  UNKNOWN,
  type Value,
} from "@/core/compliance/sections.ts";
import { formatCpf } from "@/core/request/form.ts";
import { formatCnpj } from "@/core/tenant/pix.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { completeSectionAction, saveAnswerAction } from "../actions.ts";

const INPUT =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft disabled:opacity-60";
/**
 * Masks applied while the office types, keyed by field name across every
 * section: the same identifiers `parseAnswer`'s `validateText` already
 * special-cases for CPF/CNPJ validation (see core/compliance/answers.ts).
 * "document" is the encarregado's CPF or CNPJ (Seção 5), formatted as CPF
 * while it could still be one and as CNPJ once a twelfth digit arrives.
 */
const FIELD_MASKS: Record<string, (value: string) => string> = {
  cpf: formatCpf,
  cnpj: formatCnpj,
  document: (value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits);
  },
};
const LABEL = "flex items-center gap-2 text-xs font-bold text-admin-primary";
// Big enough for a thumb: the office answers this from a phone between
// customers. Native radio and checkbox inside, so keyboard and screen reader
// get the control for free; the card is only the target.
const CARD =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13px] font-semibold text-admin-text has-checked:border-admin-primary-soft has-checked:bg-admin-surface";

type SaveStatus = "idle" | "saving" | "saved";

/**
 * One section, one screen. Every field saves itself when the office leaves
 * it (blur for text, change for a choice); there is no Salvar button. The
 * definitions come from `SECTIONS`, imported here directly rather than passed
 * as props: they carry functions, and a server component cannot hand a
 * function to a client one.
 */
export function SectionForm({
  sectionId,
  answers: initial,
}: {
  sectionId: string;
  /** Effective answers of every section: conditions read across sections. */
  answers: Answers;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [, startTransition] = useTransition();

  const section = findSection(sectionId);
  if (!section) return null;
  const index = SECTIONS.indexOf(section);
  const previous = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];

  const own = answers[sectionId] ?? {};
  const ctx: FieldContext = { answers };
  const warnings = pendenciesByField(sectionId, detectPendencies(answers));

  function save(name: string, value: Value) {
    setAnswers((current) => ({
      ...current,
      [sectionId]: { ...(current[sectionId] ?? {}), [name]: value },
    }));
    setStatus("saving");
    startTransition(async () => {
      const result = await saveAnswerAction(sectionId, name, value);
      if (result.status === "saved") {
        setStatus("saved");
      } else {
        setStatus("idle");
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
            Seção {section.number} de {SECTIONS.length}
          </span>
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-admin-readonly-bg"
            role="progressbar"
            aria-valuenow={section.number}
            aria-valuemin={0}
            aria-valuemax={SECTIONS.length}
            aria-label={`Seção ${section.number} de ${SECTIONS.length}`}
          >
            <span
              className="block h-full rounded-full bg-admin-primary-soft"
              style={{ width: `${(section.number / SECTIONS.length) * 100}%` }}
            />
          </div>
        </div>
        <output
          className={`text-[12px] font-semibold ${
            status === "saved" ? "text-admin-success-text" : "text-admin-muted"
          }`}
        >
          {status === "saving"
            ? "Salvando…"
            : status === "saved"
              ? "Salvo"
              : "Salva sozinho ao sair do campo"}
        </output>
      </div>

      <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          {section.question}
        </h2>
        {section.intro && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-admin-muted">
            {section.intro}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-5">
          {section.fields
            .filter((f) => isVisible(f, ctx))
            .map((field) => (
              <Field
                key={field.name}
                field={field}
                value={own[field.name]}
                ctx={ctx}
                warnings={warnings[field.name] ?? []}
                onSave={(value) => save(field.name, value)}
              />
            ))}
        </div>

        <form
          action={completeSectionAction}
          className="mt-6 flex flex-col gap-3 border-t border-admin-border pt-4.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <input type="hidden" name="sectionId" value={sectionId} />
          {previous ? (
            <Link
              href={`/admin/adequacao/${previous.id}`}
              // Same size as the primary "next" button on the other end of
              // this row, same as the confirm/cancel pair in ConfirmAction:
              // the hierarchy is the fill, not the size.
              className="btn btn-admin-secondary btn-md"
            >
              ‹ Seção {previous.number} · {previous.title}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/admin/adequacao"
              className="btn btn-admin-secondary btn-md"
            >
              Voltar à lista
            </Link>
            <button type="submit" className="btn btn-admin-primary btn-md">
              {next
                ? `Seção ${next.number} · ${next.title} ›`
                : "Revisar e enviar ›"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  ctx,
  warnings,
  onSave,
}: {
  field: FieldDef;
  value: Value | undefined;
  ctx: FieldContext;
  warnings: Pendency[];
  onSave: (value: Value) => void;
}) {
  const id = `${field.name}`;
  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>
        <label htmlFor={field.type === "list" ? undefined : id}>
          {field.label}
          {field.required && (
            <span className="ml-1 text-admin-accent" aria-hidden="true">
              *
            </span>
          )}
          {!field.required && (
            <span className="ml-2 text-[11px] font-semibold text-admin-faint">
              opcional
            </span>
          )}
        </label>
        {field.help && <Help text={field.help} />}
      </span>
      <Control id={id} field={field} value={value} ctx={ctx} onSave={onSave} />
      {warnings.map((w) => (
        <Notice key={w.code} pendency={w} />
      ))}
    </div>
  );
}

/**
 * The "?" beside a label: a small floating tip that shows on hover, like a
 * tooltip, with no click needed. Pure CSS, via `:hover`/`:focus-within` on
 * the wrapper: no script, and `focus-within` is what a keyboard user (Tab to
 * the button) and a phone (a tap focuses the button, same as any other
 * control) get instead of a mouse hover. `pointer-events-none` on the tip
 * keeps it out of the hit-test: reading it is all it is for, and it must
 * never eat the click meant for the field below.
 */
function Help({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-grid h-[18px] w-[18px] cursor-pointer place-items-center rounded-full border-[1.5px] border-admin-input-border text-[11px] font-bold text-admin-faint transition-colors hover:border-admin-primary-soft hover:bg-admin-primary-soft hover:text-white focus-visible:border-admin-primary-soft focus-visible:bg-admin-primary-soft focus-visible:text-white"
        aria-label="Ajuda"
      >
        ?
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[min(60ch,78vw)] -translate-x-1/2 rounded-lg bg-admin-primary px-3 py-2 text-[12px] font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}

function Notice({ pendency }: { pendency: Pendency }) {
  const tone =
    pendency.severity === "critical"
      ? "bg-admin-error-bg text-admin-error-text"
      : pendency.severity === "warning"
        ? "bg-admin-warning-bg text-admin-warning-text"
        : "bg-admin-surface text-admin-text";
  // An <output>, so the warning is announced when it appears under the answer
  // that raised it, the same way the "Salvo" indicator is.
  return (
    <output
      className={`flex items-start gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px] leading-relaxed ${tone}`}
    >
      <AdminIcon name="alert" className="mt-0.5 h-4 w-4 flex-none" />
      <span>
        <strong className="block font-bold">{pendency.title}</strong>
        {pendency.detail}
      </span>
    </output>
  );
}

function Control({
  id,
  field,
  value,
  ctx,
  onSave,
}: {
  id: string;
  field: FieldDef;
  value: Value | undefined;
  ctx: FieldContext;
  onSave: (value: Value) => void;
}) {
  switch (field.type) {
    case "choice":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {optionsOf(field, ctx).map((option) => (
            <label key={option.value} className={CARD}>
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={value === option.value}
                onChange={() => onSave(option.value)}
                className="h-4 w-4 flex-none accent-admin-primary-soft"
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    case "multi": {
      const chosen = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {optionsOf(field, ctx).map((option) => (
            <label key={option.value} className={CARD}>
              <input
                type="checkbox"
                name={id}
                value={option.value}
                checked={chosen.includes(option.value)}
                onChange={(event) =>
                  onSave(
                    event.target.checked
                      ? [...chosen, option.value]
                      : chosen.filter((v) => v !== option.value),
                  )
                }
                className="h-4 w-4 flex-none accent-admin-primary-soft"
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }
    case "list":
      return (
        <ListEditor
          field={field}
          items={Array.isArray(value) ? (value as ListItem[]) : []}
          ctx={ctx}
          onSave={onSave}
        />
      );
    default:
      return (
        <TextControl id={id} field={field} value={value} onSave={onSave} />
      );
  }
}

/**
 * Text and its kin, saved on blur. "Não sei" is a checkbox beside the field
 * that stores the sentinel and empties the box: an unknown is an answer the
 * Átrios has to chase, never a blank that looks like "nothing to say".
 */
function TextControl({
  id,
  field,
  value,
  onSave,
}: {
  id: string;
  field: FieldDef;
  value: Value | undefined;
  onSave: (value: Value) => void;
}) {
  const stored = typeof value === "string" ? value : "";
  const unknown = stored === UNKNOWN;
  const [draft, setDraft] = useState(unknown ? "" : stored);

  const commit = () => {
    if (draft.trim() !== stored) onSave(draft.trim());
  };
  const inputType =
    field.type === "money"
      ? "number"
      : field.type === "textarea"
        ? "text"
        : field.type;

  return (
    <div className="flex flex-col gap-2">
      {field.type === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          value={draft}
          placeholder={field.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className={INPUT}
        />
      ) : (
        <input
          id={id}
          type={inputType}
          value={draft}
          placeholder={field.placeholder}
          disabled={unknown}
          step={field.type === "money" ? "0.01" : undefined}
          min={
            field.type === "money" || field.type === "number" ? 0 : undefined
          }
          inputMode={
            field.type === "money" || field.type === "number"
              ? "decimal"
              : field.name in FIELD_MASKS
                ? "numeric"
                : undefined
          }
          onChange={(e) => {
            const mask = FIELD_MASKS[field.name];
            setDraft(mask ? mask(e.target.value) : e.target.value);
          }}
          onBlur={commit}
          className={INPUT}
        />
      )}
      {field.unknown && (
        <label className="flex items-center gap-2 text-[12px] text-admin-muted">
          <input
            type="checkbox"
            checked={unknown}
            onChange={(e) => {
              if (e.target.checked) {
                setDraft("");
                onSave(UNKNOWN);
              } else {
                onSave("");
              }
            }}
            className="h-4 w-4 accent-admin-primary-soft"
          />
          {unknownLabel(field)}
        </label>
      )}
    </div>
  );
}

/**
 * A repeatable block: the team, the inventory, the certificates, the
 * suppliers. The whole list is one answer, saved as one value, so an item's
 * fields commit the list when they blur or change.
 */
function ListEditor({
  field,
  items,
  ctx,
  onSave,
}: {
  field: FieldDef;
  items: ListItem[];
  ctx: FieldContext;
  onSave: (value: Value) => void;
}) {
  const [draft, setDraft] = useState<ListItem[]>(items);
  // What the server last received, so a blur that changed nothing saves
  // nothing: a phone user tabbing through a filled item would otherwise
  // rewrite the whole list at every field.
  const committed = useRef(JSON.stringify(items));
  const label = field.itemLabel ?? "item";

  function commit(nextItems: ListItem[]) {
    const serialized = JSON.stringify(nextItems);
    if (serialized === committed.current) return;
    committed.current = serialized;
    onSave(nextItems);
  }
  function update(
    index: number,
    name: string,
    value: string | string[],
    save: boolean,
  ) {
    const nextItems = draft.map((item, i) =>
      i === index ? { ...item, [name]: value } : item,
    );
    setDraft(nextItems);
    if (save) commit(nextItems);
  }
  function remove(index: number) {
    const nextItems = draft.filter((_, i) => i !== index);
    setDraft(nextItems);
    commit(nextItems);
  }
  function add() {
    setDraft([...draft, {}]);
  }

  return (
    <div className="flex flex-col gap-3">
      {draft.length === 0 && (
        <p className="rounded-[10px] border border-dashed border-admin-input-border px-3.5 py-3 text-[12.5px] text-admin-faint">
          Nenhum {label} ainda. Use o botão abaixo para incluir.
        </p>
      )}
      {draft.map((item, index) => (
        <fieldset
          // biome-ignore lint/suspicious/noArrayIndexKey: items have no id; order is the identity the office sees.
          key={index}
          className="flex flex-col gap-3 rounded-[10px] border border-admin-border bg-admin-input-bg p-3.5"
        >
          <legend className="sr-only">
            {label} {index + 1}
          </legend>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
              {label} {index + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              className="btn btn-admin-ghost btn-sm"
            >
              Remover
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(field.items ?? [])
              .filter((sub) => isVisible(sub, { ...ctx, item }))
              .map((sub) => (
                <ItemField
                  key={sub.name}
                  sub={sub}
                  item={item}
                  ctx={{ ...ctx, item }}
                  onChange={(value, commit) =>
                    update(index, sub.name, value, commit)
                  }
                />
              ))}
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={add}
        className="btn btn-admin-secondary btn-md self-start"
      >
        Incluir {label}
      </button>
    </div>
  );
}

function ItemField({
  sub,
  item,
  ctx,
  onChange,
}: {
  sub: FieldDef;
  item: ListItem;
  ctx: FieldContext;
  onChange: (value: string | string[], commit: boolean) => void;
}) {
  const value = item[sub.name];
  const text = typeof value === "string" ? value : "";
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {sub.label}
        {sub.required && (
          <span className="text-admin-accent" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {sub.type === "choice" ? (
        <select
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value, true)}
          className={INPUT}
        >
          <option value="">Escolha</option>
          {optionsOf(sub, ctx).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={
            sub.type === "money"
              ? "number"
              : sub.type === "date"
                ? "date"
                : "text"
          }
          step={sub.type === "money" ? "0.01" : undefined}
          value={text}
          placeholder={sub.placeholder}
          onChange={(e) => onChange(e.target.value, false)}
          onBlur={() => onChange(text, true)}
          className={INPUT}
        />
      )}
    </div>
  );
}
