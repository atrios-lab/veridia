"use client";

import { useState } from "react";
import { Icon } from "../_components/icon.tsx";

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied or unavailable: the e-mail stays selectable text
      // right next to the button, so it is never the only way to get it.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="btn btn-secondary btn-md flex-none"
    >
      <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}
