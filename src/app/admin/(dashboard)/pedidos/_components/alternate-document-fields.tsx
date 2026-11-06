"use client";

import {
  ALTERNATE_DOCUMENT_LABELS,
  ALTERNATE_DOCUMENT_TYPES,
  type AlternateDocumentType,
} from "@/core/request/kinds.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1.5 block text-xs font-bold text-admin-primary";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
      {message}
    </p>
  );
}

/**
 * The counter's way out for a citizen with no CPF, shared by the filing and by
 * the correction. Sits right under the CPF field that it switches off.
 */
export function AlternateDocumentFields({
  checked,
  onCheckedChange,
  defaultType,
  defaultNumber,
  typeError,
  numberError,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  defaultType?: AlternateDocumentType;
  defaultNumber?: string;
  typeError?: string;
  numberError?: string;
}) {
  return (
    <>
      <label className="mt-2 flex items-center gap-2">
        <input
          type="checkbox"
          name="noCpf"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-admin-primary-soft"
        />
        <span className="text-[12px] text-admin-text">
          Cidadão não possui CPF
        </span>
      </label>
      {checked && (
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div>
            <label className={LABEL} htmlFor="alternateDocumentType">
              Documento
            </label>
            <select
              id="alternateDocumentType"
              name="alternateDocumentType"
              defaultValue={defaultType ?? ""}
              className={FIELD}
            >
              <option value="" disabled>
                Escolha
              </option>
              {ALTERNATE_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ALTERNATE_DOCUMENT_LABELS[type]}
                </option>
              ))}
            </select>
            <FieldError message={typeError} />
          </div>
          <div>
            <label className={LABEL} htmlFor="alternateDocumentNumber">
              Número
            </label>
            <input
              id="alternateDocumentNumber"
              name="alternateDocumentNumber"
              defaultValue={defaultNumber}
              className={FIELD}
            />
            <FieldError message={numberError} />
          </div>
        </div>
      )}
    </>
  );
}
