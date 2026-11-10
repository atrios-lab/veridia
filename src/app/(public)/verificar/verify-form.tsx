"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../_components/icon.tsx";

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm uppercase tracking-[0.12em] text-brand-text outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-brand-faint focus:border-brand-accent";

/** SHA-256 in the browser: the file itself never leaves the person's device. */
async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function VerifyForm({ notFound }: { notFound: "code" | "file" | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form
        className="rounded-2xl border border-brand-border bg-brand-surface p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const clean = code.replace(/[^0-9a-z]/gi, "").toUpperCase();
          if (clean) router.push(`/verificar/${clean}`);
        }}
      >
        <h2 className="font-serif text-lg font-semibold text-brand-primary">
          Pelo código
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          O código está ao lado do QR Code, na margem de cada página, e no
          manifesto de assinaturas.
        </p>
        <label
          htmlFor="codigo"
          className="mt-4 block text-sm font-semibold text-brand-primary"
        >
          Código de verificação
        </label>
        <input
          id="codigo"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Ex.: AB12-CD34-EF56"
          autoComplete="off"
          className={`${inputClass} mt-1.5`}
          aria-describedby={notFound === "code" ? "codigo-erro" : undefined}
        />
        {notFound === "code" && (
          <p
            id="codigo-erro"
            role="alert"
            className="mt-2 text-sm font-semibold text-brand-alert"
          >
            Nenhum documento assinado por esta serventia tem este código.
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg mt-4">
          <Icon name="search" className="h-4 w-4" />
          Verificar
        </button>
      </form>

      <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
        <h2 className="font-serif text-lg font-semibold text-brand-primary">
          Pelo arquivo PDF
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          Escolha o PDF que você recebeu. O site confere se ele é idêntico ao
          documento assinado. O arquivo não sai do seu aparelho: só a impressão
          digital dele (SHA-256) é comparada.
        </p>
        <label
          htmlFor="arquivo"
          className="btn btn-secondary btn-lg mt-4 cursor-pointer"
        >
          <Icon name="file" className="h-4 w-4" />
          {busy ? "Conferindo..." : "Escolher PDF"}
        </label>
        <input
          id="arquivo"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            router.push(`/verificar?arquivo=${await sha256Hex(file)}`);
          }}
        />
        {notFound === "file" && (
          <p
            role="alert"
            className="mt-3 text-sm font-semibold text-brand-alert"
          >
            Este arquivo não confere com nenhum documento assinado por esta
            serventia. Ele pode ter sido alterado, ou foi assinado em outro
            lugar: confira também em validar.iti.gov.br.
          </p>
        )}
      </div>
    </div>
  );
}
