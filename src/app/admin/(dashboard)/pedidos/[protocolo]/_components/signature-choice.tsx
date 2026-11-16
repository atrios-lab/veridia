"use client";

import { useState } from "react";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import { Button } from "../../../../_ui/button.tsx";

/** The same check the server makes (lib/signature/pades.ts hasSignature). */
async function carriesSignature(file: File): Promise<boolean> {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return false;
  }
  const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
  return /\/ByteRange\s*\[/.test(text);
}

export type SignatureCheck =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "signed"; name: string }
  | { kind: "unsigned"; name: string; pdf: boolean };

/**
 * What the clerk decided for a file going to the citizen (decision of
 * 11/11/2026, extended to the exigência on 16/11/2026): "" when it already
 * carries a digital signature, "digital" to sign it here first (held back
 * until then), "fisica" for a paper signed by hand and scanned, "sem" to send
 * it unsigned all the same. The server reads it from the field "assinatura".
 */
export type SignatureDecision = "" | "digital" | "fisica" | "sem";

/** Every file for the citizen is checked before it goes. */
export function useSignatureCheck() {
  const [check, setCheck] = useState<SignatureCheck>({ kind: "idle" });
  const inspect = async (file: File) => {
    setCheck({ kind: "checking" });
    const signed = await carriesSignature(file).catch(() => false);
    setCheck(
      signed
        ? { kind: "signed", name: file.name }
        : {
            kind: "unsigned",
            name: file.name,
            pdf: file.type === "application/pdf" || /\.pdf$/i.test(file.name),
          },
    );
  };
  const reset = () => setCheck({ kind: "idle" });
  return { check, inspect, reset };
}

/**
 * The question asked once a file is picked: its name, and, when it carries no
 * digital signature, how it goes: signed digitally here first, as a paper
 * signed by hand and scanned (confirmed), or unsigned all the same.
 */
export function SignatureChoice({
  check,
  field,
  suggestions,
  defaultName,
  onSend,
  onCancel,
}: {
  check: SignatureCheck;
  /** The file field: the typed name goes as `${field}Name`. */
  field: string;
  suggestions: readonly string[];
  /** What the file is called when no name is typed. */
  defaultName: string;
  onSend: (decision: SignatureDecision) => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const nameField = (
    <DocumentNameField
      field={field}
      tone="admin"
      suggestions={[...suggestions]}
      placeholder={defaultName}
      hint={`Como o cidadão vai ver o arquivo. Sem nome, sai como "${defaultName}".`}
    />
  );

  if (check.kind === "checking") {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Conferindo a assinatura digital do documento...
      </p>
    );
  }
  if (check.kind === "signed") {
    return (
      <div className="mt-3 rounded-lg border border-success/30 bg-success-soft p-4 text-sm text-success-text">
        <p className="font-semibold">
          ✓ &quot;{check.name}&quot; tem assinatura digital.
        </p>
        <div className="mt-2 mb-1 text-foreground">{nameField}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onSend("")}>
            Enviar ao cliente
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }
  if (check.kind !== "unsigned") return null;
  return (
    <div
      role="alertdialog"
      aria-label="Documento sem assinatura digital"
      className="mt-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning-text"
    >
      <p className="font-semibold">
        ⚠ O documento anexado não contém assinatura digital.
      </p>
      <p className="mt-0.5">&quot;{check.name}&quot;</p>
      <div className="mt-2 mb-1 text-foreground">{nameField}</div>
      <p className="mt-2 font-semibold">Como este documento vai ao cliente?</p>
      {check.pdf && (
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => onSend("digital")}
            className="mt-1.5"
          >
            Assinar digitalmente antes de enviar
          </Button>
          <p className="mt-1 text-xs">
            O documento fica retido aqui: o cidadão só o vê depois de assinado
            (certificado A1 da plataforma ou A3 no token).
          </p>
        </>
      )}
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="checkbox-admin mt-0.5"
        />
        Confirmo que é um documento desmaterializado, apenas com assinatura
        física, que foi digitalizado.
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!confirmed}
          onClick={() => onSend("fisica")}
        >
          Enviar como assinado fisicamente
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSend("sem")}
        >
          Enviar sem assinatura
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onCancel}
          className="text-warning-text"
        >
          Cancelar
        </Button>
      </div>
      <p className="mt-2 text-xs">A escolha fica registrada na auditoria.</p>
    </div>
  );
}
