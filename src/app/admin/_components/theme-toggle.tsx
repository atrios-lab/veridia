"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "../_ui/button.tsx";
import { DARK, THEME_COOKIE } from "./theme.ts";

/**
 * The sun and moon button in the top bar: one click switches the panel
 * between the light and the dark theme. The moon shows while the panel is
 * light (it leads to the dark), the sun while it is dark. The class on
 * <html> changes at once, and the cookie makes the next page load arrive
 * already in the same theme (see the root layout).
 */
export function ThemeToggle({ initialDark }: { initialDark: boolean }) {
  const [dark, setDark] = useState(initialDark);
  const label = dark ? "Usar o tema claro" : "Usar o tema escuro";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        // biome-ignore lint/suspicious/noDocumentCookie: a one-word UI preference the server layout reads back; the Cookie Store API is not in every browser the offices use.
        document.cookie = `${THEME_COOKIE}=${next ? DARK : "claro"}; path=/admin; max-age=31536000; samesite=lax`;
        setDark(next);
      }}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
