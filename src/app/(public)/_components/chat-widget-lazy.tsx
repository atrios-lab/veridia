"use client";

import dynamic from "next/dynamic";

// The widget behind a dynamic import, so its code ships only to a page that
// actually renders it. Imported straight into the layout, Next sends every
// client component the layout imports with every public page, rendered or
// not: the widget, zod (through the tenant schema the chat hours read) and
// the chat's own modules came to some 100 KiB of JavaScript on a first
// visit, where the chat never shows because it waits for the cookie notice.
// It has to be a client file: a server component's dynamic import is not
// split into its own chunk.
export const ChatWidget = dynamic(() =>
  import("./chat-widget.tsx").then((mod) => mod.ChatWidget),
);
