"use client";

import {
  ALTERNATE_DOCUMENT_LABELS,
  ALTERNATE_DOCUMENT_TYPES,
  type AlternateDocumentType,
} from "@/core/request/kinds.ts";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-destructive">{message}</p>
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
          className="checkbox-admin"
        />
        <span className="text-sm text-foreground">Cidadão não possui CPF</span>
      </label>
      {checked && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <Label className="mb-2" htmlFor="alternateDocumentType">
              Documento
            </Label>
            <NativeSelect
              id="alternateDocumentType"
              name="alternateDocumentType"
              defaultValue={defaultType ?? ""}
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Escolha
              </NativeSelectOption>
              {ALTERNATE_DOCUMENT_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {ALTERNATE_DOCUMENT_LABELS[type]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError message={typeError} />
          </div>
          <div>
            <Label className="mb-2" htmlFor="alternateDocumentNumber">
              Número
            </Label>
            <Input
              id="alternateDocumentNumber"
              name="alternateDocumentNumber"
              defaultValue={defaultNumber}
            />
            <FieldError message={numberError} />
          </div>
        </div>
      )}
    </>
  );
}
