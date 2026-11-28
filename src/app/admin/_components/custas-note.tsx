"use client";

import { createContext, useContext, useId, useState } from "react";
import { buttonVariants } from "../_ui/button.tsx";
import { Textarea } from "../_ui/textarea.tsx";
import { SignOrPrint, signHref } from "./sign-or-print.tsx";

interface CustasState {
  /** The note chosen for this act; null when it was not inserted. */
  note: string | null;
}

const CustasContext = createContext<CustasState>({ note: null });

/** Adds the chosen note to a PDF link (`custas=`). */
export function withCustas(href: string, note: string | null): string {
  if (!note) return href;
  return `${href}${href.includes("?") ? "&" : "?"}custas=${encodeURIComponent(note)}`;
}

/**
 * The custas note as a button (decision of 28/11/2026): nothing is printed
 * until the staff member clicks "Inserir nota de custas"; then the text
 * comes ready and may be edited for this act. With `name`, the text goes
 * with the form; otherwise it goes with the links inside the provider.
 */
function CustasNoteControl({
  defaultText,
  on,
  text,
  setOn,
  setText,
  name,
}: {
  defaultText: string;
  on: boolean;
  text: string;
  setOn: (v: boolean) => void;
  setText: (v: string) => void;
  name?: string;
}) {
  const id = useId();
  if (!on) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonVariants({ size: "sm", variant: "outline" })}
          onClick={() => setOn(true)}
        >
          Inserir nota de custas
        </button>
        <span className="text-xs text-muted-foreground">
          Só para ato pago (certidão, traslado, registro, averbação). Sem
          clicar, o documento sai sem a nota.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
      <label htmlFor={`${id}-custas`} className="text-sm font-medium">
        Nota de custas deste ato
      </label>
      <Textarea
        id={`${id}-custas`}
        name={name}
        value={text}
        maxLength={3000}
        rows={4}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Sai no pé do documento como está escrita. Edite se quiser; vale só para
        este documento.
      </p>
      <span className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonVariants({ size: "sm", variant: "outline" })}
          onClick={() => setText(defaultText)}
        >
          Voltar ao texto padrão
        </button>
        <button
          type="button"
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          onClick={() => setOn(false)}
        >
          Tirar a nota de custas
        </button>
      </span>
    </div>
  );
}

/** The button for the PDF links below it (`CustasSignOrPrint`). */
export function CustasNoteProvider({
  defaultText,
  children,
}: {
  defaultText: string;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  const [text, setText] = useState(defaultText);
  const note = on && text.trim() ? text.trim() : null;
  return (
    <CustasContext.Provider value={{ note }}>
      <div className="flex flex-col gap-3">
        <CustasNoteControl
          defaultText={defaultText}
          on={on}
          text={text}
          setOn={setOn}
          setText={setText}
        />
        {children}
      </div>
    </CustasContext.Provider>
  );
}

/** The button inside a form: the text goes in the field `custas`. */
export function CustasNoteField({ defaultText }: { defaultText: string }) {
  const [on, setOn] = useState(false);
  const [text, setText] = useState(defaultText);
  return (
    <CustasNoteControl
      defaultText={defaultText}
      on={on}
      text={text}
      setOn={setOn}
      setText={setText}
      name="custas"
    />
  );
}

/** "Assinar digitalmente" and "Imprimir", with the note when inserted. */
export function CustasSignOrPrint(props: {
  pdfHref: string;
  title: string;
  size?: "sm" | "md";
}) {
  const { note } = useContext(CustasContext);
  return <SignOrPrint {...props} pdfHref={withCustas(props.pdfHref, note)} />;
}

/** A plain link to the PDF, with the note when inserted. */
export function CustasLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { note } = useContext(CustasContext);
  return (
    <a
      href={withCustas(href, note)}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

/** A link to the assinador for the PDF, with the note when inserted. */
export function CustasSignLink({
  pdfHref,
  title,
  className,
  children,
}: {
  pdfHref: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { note } = useContext(CustasContext);
  return (
    <a href={signHref(withCustas(pdfHref, note), title)} className={className}>
      {children}
    </a>
  );
}
