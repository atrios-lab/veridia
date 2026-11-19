import { db } from "@/db/index.ts";
import { messengerSignalWith, touchPresenceWith } from "@/lib/messages.ts";
import { messengerAccess } from "../access.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The stream closes itself well before this, and the browser reconnects.
export const maxDuration = 60;

/** How often the server looks for news while the connection is open. */
const LOOK_MS = 900;
/** One connection lives this long; the browser opens the next by itself. */
const LIFETIME_MS = 50_000;
/** Seen in the panel: keeps the person online while only listening. */
const PRESENCE_MS = 30_000;
/** A comment now and then, so no proxy closes a quiet connection. */
const HEARTBEAT_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The internal messenger's live connection (decision of 19/11/2026): the
 * panel opens it once and the server says at once when something changed
 * (a message, an edit, a reaction, the other side reading), and who is
 * typing. The screen then fetches what changed. Unlike asking every few
 * seconds, this also reaches a tab out of sight, which the browser would
 * otherwise slow down to one look a minute.
 *
 * Server-Sent Events, not a WebSocket: one direction is all it needs, it
 * goes through every proxy as a plain response, and the browser reconnects
 * by itself. If it cannot connect, the screens keep asking as before.
 */
export async function GET(request: Request): Promise<Response> {
  const access = await messengerAccess();
  if (!access || access.off) {
    return new Response("Sem permissão.", { status: 403 });
  }
  const userId = access.session.user.id;
  const tenantSlug = access.tenant.slug;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      request.signal.addEventListener("abort", () => {
        open = false;
      });
      const write = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          open = false;
        }
      };
      const send = (event: string, data: unknown) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      // Reconnect quickly after the planned close.
      write("retry: 1000\n\n");
      const started = Date.now();
      let version: string | null = null;
      let typing = "";
      let lastPresence = 0;
      let lastBeat = Date.now();
      while (open && Date.now() - started < LIFETIME_MS) {
        const now = new Date();
        try {
          if (!access.platform && now.getTime() - lastPresence > PRESENCE_MS) {
            lastPresence = now.getTime();
            await touchPresenceWith(db, tenantSlug, userId, now);
          }
          const signal = await messengerSignalWith(db, userId, now);
          if (version === null) send("ready", {});
          else if (signal.version !== version) send("change", {});
          version = signal.version;
          const typingKey = JSON.stringify(signal.typing);
          if (typingKey !== typing) {
            typing = typingKey;
            send("typing", signal.typing);
          }
        } catch (error) {
          // A failed look is a late one: the next catches up.
          console.error("mensagens.eventos", error);
        }
        if (Date.now() - lastBeat > HEARTBEAT_MS) {
          lastBeat = Date.now();
          write(": ainda aqui\n\n");
        }
        await sleep(LOOK_MS);
      }
      open = false;
      try {
        controller.close();
      } catch {
        // Already closed by the browser leaving.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
