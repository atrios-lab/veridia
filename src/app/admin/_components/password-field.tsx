"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { Field, FieldLabel } from "../_ui/field.tsx";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../_ui/input-group.tsx";

export function PasswordField({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        {/* 16px on a phone (the Input's `text-base md:text-sm`): below that,
            Safari on iOS zooms the page in on focus and leaves it zoomed
            after the keyboard closes. */}
        <InputGroupInput
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
