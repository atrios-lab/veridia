"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { QUICK_REACTIONS } from "@/core/messages/emoji.ts";
import {
  QUICK_REPLIES,
  RECEIPT_LABELS,
  type Receipt,
  receiptOf,
  type SoundPrefs,
} from "@/core/messages/live.ts";
import {
  COLOR_LABELS,
  COLORS,
  initialsOf,
  isAudio,
  isAway,
  isImage,
  type Lunch,
  lunchLabel,
  type MessengerColor,
  type Presence,
  STATUS_LABELS,
  STATUSES,
  type Status,
} from "@/core/messages/rules.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { isAudioLocked, unlockAudio } from "../../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../../_components/shake.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import {
  isLive,
  pingTyping,
  setOpenConversation,
  stopTyping,
  subscribeMessenger,
  type TypingNow,
} from "../../_components/messenger-live.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";
import { Input } from "../../_ui/input.tsx";
import { NativeSelect, NativeSelectOption } from "../../_ui/native-select.tsx";
import {
  clearConversation,
  deleteMessage,
  editMessage,
  openConversation,
  pollMessenger,
  reactToMessage,
  requestLunch,
  returnFromLunch,
  type SerializedContact,
  type SerializedMessage,
  saveProfile,
  sendFile,
  sendNudge,
  sendText,
} from "./actions.ts";
import { EmojiPicker, rememberEmoji } from "./emoji-picker.tsx";
import { MicHelp, useRecorder } from "./recorder.tsx";
import { SoundSettings } from "./sound-settings.tsx";

/** Without the live connection, the screen asks this often, as before. */
const POLL_MS = 3000;
/** With it, only now and then, as a safety net. */
const SAFETY_POLL_MS = 20_000;

export interface Me {
  userId: string;
  name: string;
  photo: boolean;
  status: Status;
  personalMessage: string;
  color: MessengerColor;
  sound: boolean;
  soundPrefs: SoundPrefs;
  lunch: Lunch | null;
  lunchPending: Lunch | null;
  /** Inside the lunch window, not back yet: the chat is locked. */
  atLunch: boolean;
}

const TITLE_BAR: Record<MessengerColor, string> = {
  verde: "from-msg-verde-from to-msg-verde-to",
  azul: "from-msg-azul-from to-msg-azul-to",
  vinho: "from-msg-vinho-from to-msg-vinho-to",
  grafite: "from-msg-grafite-from to-msg-grafite-to",
  dourado: "from-msg-dourado-from to-msg-dourado-to",
};

const DOT: Record<Presence, string> = {
  disponivel: "bg-msg-online",
  "em-atendimento": "bg-msg-busy",
  "em-reuniao": "bg-msg-busy",
  ocupado: "bg-msg-busy",
  ausente: "bg-msg-away",
  almoco: "bg-msg-away",
  offline: "bg-msg-offline",
};

function Avatar({
  userId,
  name,
  photo,
  presence,
  size = 40,
  version = 0,
}: {
  userId: string;
  name: string;
  photo: boolean;
  presence?: Presence;
  size?: number;
  version?: number;
}) {
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {photo ? (
        // biome-ignore lint/performance/noImgElement: a private route, not an optimizable asset
        <img
          src={`/admin/mensagens/foto/${userId}?v=${version}`}
          alt=""
          className="h-full w-full rounded-lg border-2 border-card object-cover shadow"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-lg border-2 border-card bg-primary text-sm font-semibold text-primary-foreground shadow">
          {initialsOf(name)}
        </span>
      )}
      {presence && (
        <span
          role="img"
          aria-label={STATUS_LABELS[presence]}
          className={`absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-card ${DOT[presence]}`}
        />
      )}
    </span>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: OFFICE_TIME_ZONE,
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: OFFICE_TIME_ZONE,
  });
}

function MessageBody({ message }: { message: SerializedMessage }) {
  const href = `/admin/mensagens/arquivo/${message.id}`;
  if (
    message.kind === "audio" ||
    (message.mimeType && isAudio(message.mimeType))
  ) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: a voice note between colleagues has no caption track
      <audio controls preload="none" src={href} className="mt-1 max-w-full" />
    );
  }
  if (message.kind === "arquivo") {
    const image = message.mimeType && isImage(message.mimeType);
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="mt-1 inline-flex max-w-full flex-col gap-1 rounded-lg border border-border bg-card p-2 text-xs hover:border-primary"
      >
        {image && (
          // biome-ignore lint/performance/noImgElement: a private route, not an optimizable asset
          <img
            src={href}
            alt={message.fileName ?? ""}
            className="max-h-48 max-w-full rounded-md object-contain"
          />
        )}
        <span className="flex items-center gap-1.5 font-medium text-primary [overflow-wrap:anywhere]">
          <AdminIcon name="file" className="h-4 w-4 shrink-0" />
          {message.fileName}
          {message.sizeBytes ? (
            <span className="font-normal text-muted-foreground">
              ({Math.max(1, Math.round(message.sizeBytes / 1024))} KB)
            </span>
          ) : null}
        </span>
      </a>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">
      {message.body}
    </p>
  );
}

/**
 * The daily lunch window, up to an hour (decision of 11/11/2026): asked
 * for here, decided by the Tabelião/Registrador, written to the audit, and
 * not open to a new change while one waits.
 */
/** The status menu's entry that opens the lunch window instead. */
const LUNCH_OPTION = "almoco-horario";

function LunchField({
  lunch,
  pending,
  onAsked,
}: {
  lunch: Lunch | null;
  pending: Lunch | null;
  onAsked: (lunch: Lunch) => void;
}) {
  const [start, setStart] = useState(lunch?.start ?? "12:00");
  const [minutes, setMinutes] = useState(lunch?.minutes ?? 60);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const fieldId = useId();
  const ask = async () => {
    setBusy(true);
    const result = await requestLunch(start, minutes);
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Pedido enviado ao Tabelião/Registrador.");
    onAsked({ start, minutes });
  };
  return (
    <fieldset>
      <legend className="mb-1 font-semibold text-foreground">
        Horário de almoço
      </legend>
      <p className="text-xs text-foreground">
        {lunch
          ? `Aprovado: ${lunchLabel(lunch)}. Nesse horário você aparece como "Horário de almoço"; depois, volta a aparecer disponível sozinho.`
          : "Nenhum horário aprovado ainda."}
      </p>
      {pending ? (
        <p className="mt-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-warning-text">
          Pedido {lunchLabel(pending)} aguardando o Tabelião/Registrador. Até a
          decisão, não dá para mudar de novo.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-end gap-2">
          <label
            htmlFor={`${fieldId}-inicio`}
            className="text-xs font-medium text-muted-foreground"
          >
            Início
            <Input
              id={`${fieldId}-inicio`}
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="mt-0.5 h-8 w-auto bg-background text-foreground"
            />
          </label>
          <label
            htmlFor={`${fieldId}-duracao`}
            className="text-xs font-medium text-muted-foreground"
          >
            Duração
            <NativeSelect
              id={`${fieldId}-duracao`}
              size="sm"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="mt-0.5 bg-background text-foreground"
            >
              {[15, 30, 45, 60].map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {m === 60 ? "1 hora (máximo)" : `${m} minutos`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          {confirming ? null : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {lunch ? "Pedir mudança" : "Pedir este horário"}
            </button>
          )}
        </div>
      )}
      {confirming && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-2 text-xs text-warning-text">
          <p className="font-semibold">
            ⚠ Este pedido vai para a auditoria e para o Tabelião/Registrador
            aprovar ou não. Até a decisão, você não poderá modificar o horário
            novamente.
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void ask()}
              className={buttonVariants({ size: "sm" })}
            >
              {busy ? "Enviando..." : "Confirmar o pedido"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}

/** "14:05" today, "ontem", the weekday this week, or the date. */
function listTime(iso: string): string {
  const day = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: OFFICE_TIME_ZONE });
  const then = new Date(iso);
  const now = new Date();
  if (day(then) === day(now)) return formatTime(iso);
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (day(then) === day(yesterday)) return "ontem";
  if (now.getTime() - then.getTime() < 6 * 86_400_000) {
    return then
      .toLocaleDateString("pt-BR", {
        weekday: "short",
        timeZone: OFFICE_TIME_ZONE,
      })
      .replace(".", "");
  }
  return then.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: OFFICE_TIME_ZONE,
  });
}

/** ✓ sent, ✓✓ delivered, ✓✓ in blue when read, a clock while sending. */
function Ticks({ receipt }: { receipt: Receipt }) {
  return (
    <span
      role="img"
      aria-label={RECEIPT_LABELS[receipt]}
      title={RECEIPT_LABELS[receipt]}
      className={cn(
        "ml-1 inline-block font-semibold tracking-tighter",
        receipt === "lida" ? "text-info" : "text-muted-foreground",
      )}
    >
      {receipt === "pendente" ? "🕓" : receipt === "enviada" ? "✓" : "✓✓"}
    </span>
  );
}

/** A message on screen: what came from the server, or one still sending. */
type ShownMessage = SerializedMessage & { pending?: boolean };

/** The three dots that say "digitando…", as on the phone. */
function TypingDots({ name }: { name: string }) {
  return (
    <div className="my-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex gap-1 rounded-xl rounded-bl-sm bg-card px-3 py-2.5 shadow-xs">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      {name} está digitando…
    </div>
  );
}

export function Messenger({
  me: initialMe,
  initialContacts,
  initialConversation,
  oversight,
}: {
  me: Me;
  initialContacts: SerializedContact[];
  initialConversation: { id: string; withUserId: string } | null;
  oversight: boolean;
}) {
  const router = useRouter();
  const [me, setMe] = useState(initialMe);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [contacts, setContacts] = useState(initialContacts);
  const [active, setActive] = useState(initialConversation);
  const [messages, setMessages] = useState<ShownMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"personalizar" | "sons" | null>(null);
  const [lunchOpen, setLunchOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState<ShownMessage | null>(null);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [fullPickerFor, setFullPickerFor] = useState<string | null>(null);
  const [typing, setTyping] = useState<TypingNow[]>([]);
  const [receipts, setReceipts] = useState<{
    readAt: string | null;
    seenAt: string | null;
  }>({ readAt: null, seenAt: null });
  const windowRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastIso = useRef<string | null>(null);
  const messagesRef = useRef<ShownMessage[]>([]);
  messagesRef.current = messages;
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const partner = contacts.find((c) => c.userId === active?.withUserId);
  const [cleared, setCleared] = useState<string | null>(null);
  // Cleared by either person: what came before it leaves this screen too.
  const shown = messages.filter(
    (m) =>
      !m.deleted && (!cleared || new Date(m.createdAt) > new Date(cleared)),
  );
  const typingIn = (conversationId: string | null, userId: string) =>
    conversationId !== null &&
    typing.some(
      (t) => t.conversationId === conversationId && t.userId === userId,
    );
  const partnerTyping = partner
    ? typingIn(active?.id ?? null, partner.userId)
    : false;

  // The sound of a message is the panel watcher's (messenger-watch.tsx),
  // under the person's rules; here a call for attention also shakes the
  // window it was sent to.
  const nudged = useCallback(() => {
    shakeElement(windowRef.current);
    vibrate();
  }, []);

  const poll = useCallback(async () => {
    const conversationId = active?.id ?? null;
    const result = await pollMessenger(conversationId, lastIso.current);
    if (!result.ok) return;
    const {
      contacts: next,
      messages: fresh,
      now,
      clearedAt,
      receipts: seen,
    } = result.data;
    setCleared(clearedAt);
    setContacts(next);
    setReceipts(seen);
    const first = lastIso.current === null;
    // The server's clock, so edits and deletions since then come next time.
    lastIso.current = now;
    if (fresh.length) {
      const known = new Set(messagesRef.current.map((m) => m.id));
      const added = fresh.filter((m) => !known.has(m.id));
      // An edited or deleted message (or a new reaction) comes again: it
      // takes its old place. A sent one replaces its "sending" copy.
      setMessages((current) => {
        const changed = new Map(fresh.map((m) => [m.id, m]));
        const have = new Set(current.map((m) => m.id));
        return [
          ...current.map((m) => changed.get(m.id) ?? m),
          ...fresh.filter((m) => !have.has(m.id)),
        ];
      });
      if (
        !first &&
        added.some((m) => m.senderId !== me.userId && m.kind === "chamar")
      ) {
        nudged();
      }
    }
  }, [active?.id, me.userId, nudged]);

  // A new conversation starts from its history.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the conversation changes
  useEffect(() => {
    setMessages([]);
    setEditing(null);
    setDeleting(null);
    setClearing(false);
    setReplyTo(null);
    setReactingTo(null);
    setReceipts({ readAt: null, seenAt: null });
    lastIso.current = null;
    setOpenConversation(active?.id ?? null);
    void poll();
  }, [active?.id]);

  useEffect(() => () => setOpenConversation(null), []);

  // Live: the server says when something changed, and who is typing
  // (decision of 19/11/2026); the timer below is only the safety net.
  const pollRef = useRef(poll);
  pollRef.current = poll;
  useEffect(() => {
    let lastLook = Date.now();
    const look = () => {
      lastLook = Date.now();
      void pollRef.current();
    };
    const off = subscribeMessenger({
      onChange: look,
      onReady: look,
      onTyping: setTyping,
    });
    const timer = setInterval(() => {
      if (!isLive() || Date.now() - lastLook > SAFETY_POLL_MS) look();
    }, POLL_MS);
    return () => {
      off();
      clearInterval(timer);
    };
  }, []);

  // The quick reactions close on a click elsewhere or on Escape, as a menu
  // does; a click on one of them reacts first.
  useEffect(() => {
    if (!reactingTo) return;
    const away = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-reactions]")) setReactingTo(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReactingTo(null);
    };
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", away);
      document.addEventListener("keydown", onKey);
    });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", onKey);
    };
  }, [reactingTo]);

  useEffect(() => {
    setLocked(isAudioLocked());
    const unlock = () =>
      void unlockAudio().then((ok) => ok && setLocked(false));
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when messages arrive or someone types
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [shown.length, partnerTyping]);

  const open = async (contact: SerializedContact) => {
    if (contact.conversationId) {
      setActive({ id: contact.conversationId, withUserId: contact.userId });
    } else {
      const result = await openConversation(contact.userId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setActive({ id: result.data, withUserId: contact.userId });
    }
    router.replace(`/admin/mensagens?com=${contact.userId}`, { scroll: false });
  };

  /**
   * Sends at once on screen, with a clock instead of the ticks, and swaps
   * in the stored message when the server answers (decision of 19/11/2026).
   */
  const send = async (body = text) => {
    if (!active || !body.trim() || busy) return;
    const quoted = replyTo;
    const temp: ShownMessage = {
      id: `enviando-${Date.now()}`,
      senderId: me.userId,
      senderName: me.name,
      kind: "texto",
      body: body.trim(),
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      originalBody: null,
      replyTo: quoted
        ? {
            id: quoted.id,
            senderName:
              quoted.senderId === me.userId ? "Você" : quoted.senderName,
            preview: (quoted.body ?? quoted.fileName ?? "").slice(0, 120),
          }
        : null,
      reactions: [],
      pending: true,
    };
    setMessages((current) => [...current, temp]);
    setText("");
    setReplyTo(null);
    stopTyping();
    const result = await sendText(active.id, body, quoted?.id ?? null);
    if (!result.ok) {
      setMessages((current) => current.filter((m) => m.id !== temp.id));
      setText(body);
      toast.error(result.message);
      return;
    }
    // The stored id takes the copy's place; the next look fills the rest.
    setMessages((current) =>
      current.some((m) => m.id === result.data)
        ? current.filter((m) => m.id !== temp.id)
        : current.map((m) =>
            m.id === temp.id ? { ...m, id: result.data, pending: false } : m,
          ),
    );
    void poll();
  };

  const upload = async (file: File, audio = false) => {
    if (!active) return;
    const data = new FormData();
    data.set("conversationId", active.id);
    data.set("file", file);
    if (audio) data.set("audio", "1");
    setBusy(true);
    const result = await sendFile(data);
    setBusy(false);
    if (!result.ok) toast.error(result.message);
    else void poll();
  };

  const react = async (message: ShownMessage, emoji: string) => {
    setReactingTo(null);
    setFullPickerFor(null);
    if (message.pending) return;
    rememberEmoji(emoji);
    // On screen at once; the server's answer confirms it.
    setMessages((current) =>
      current.map((m) => {
        if (m.id !== message.id) return m;
        const mineBefore = m.reactions.find((r) => r.mine);
        const takeBack = mineBefore?.emoji === emoji;
        const reactions = m.reactions
          .map((r) =>
            r.mine
              ? {
                  ...r,
                  count: r.count - 1,
                  mine: false,
                  names: r.names.filter((n) => n !== "Você"),
                }
              : r,
          )
          .filter((r) => r.count > 0);
        if (!takeBack) {
          const same = reactions.find((r) => r.emoji === emoji);
          if (same) {
            same.count += 1;
            same.mine = true;
            same.names = [...same.names, "Você"];
          } else {
            reactions.push({ emoji, count: 1, mine: true, names: ["Você"] });
          }
        }
        return { ...m, reactions };
      }),
    );
    const result = await reactToMessage(message.id, emoji);
    if (!result.ok) toast.error(result.message);
    void poll();
  };

  const saveEdit = async () => {
    if (!editing || !editing.body.trim() || busy) return;
    setBusy(true);
    const result = await editMessage(editing.id, editing.body);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setEditing(null);
    void poll();
  };

  const remove = async (messageId: string) => {
    setBusy(true);
    const result = await deleteMessage(messageId);
    setBusy(false);
    setDeleting(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Mensagem apagada.");
    void poll();
  };

  const clearAll = async () => {
    if (!active) return;
    setBusy(true);
    const result = await clearConversation(active.id);
    setBusy(false);
    setClearing(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setMessages([]);
    setEditing(null);
    lastIso.current = null;
    toast.success("Conversa limpa.");
    void poll();
  };

  const recorder = useRecorder((file) => void upload(file, true));

  const nudge = async () => {
    if (!active) return;
    const result = await sendNudge(active.id);
    if (!result.ok) toast.error(result.message);
    else {
      shakeElement(windowRef.current);
      void poll();
    }
  };

  const comeBack = async () => {
    const result = await returnFromLunch();
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setMe({ ...me, atLunch: false, status: "disponivel" });
    toast.success("Bem-vindo de volta. O chat está liberado.");
    router.refresh();
  };

  const saveMe = async (patch: Partial<Me>, photo?: File) => {
    const next = { ...me, ...patch };
    setMe(next);
    const data = new FormData();
    data.set("status", next.status);
    data.set("personalMessage", next.personalMessage);
    data.set("color", next.color);
    data.set("soundField", "1");
    if (next.sound) data.set("sound", "on");
    if (photo) data.set("photo", photo);
    const result = await saveProfile(data);
    if (!result.ok) toast.error(result.message);
    else if (photo) {
      setMe({ ...next, photo: true });
      setPhotoVersion((v) => v + 1);
      toast.success("Foto atualizada.");
    } else if (patch.sound !== undefined) router.refresh();
  };

  const insert = (piece: string) => {
    const box = inputRef.current;
    if (!box) {
      setText((t) => t + piece);
      return;
    }
    const start = box.selectionStart ?? text.length;
    const end = box.selectionEnd ?? text.length;
    const next = text.slice(0, start) + piece + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      box.focus();
      box.setSelectionRange(start + piece.length, start + piece.length);
    });
  };

  const term = search.trim().toLocaleLowerCase("pt-BR");
  const matches = (c: SerializedContact) =>
    !term ||
    c.name.toLocaleLowerCase("pt-BR").includes(term) ||
    (c.last?.preview ?? "").toLocaleLowerCase("pt-BR").includes(term);
  // Conversations with something in them, the newest first, as on the
  // phone; then the rest of the team, the ones online first.
  const recent = contacts
    .filter((c) => c.last && matches(c))
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
  const team = contacts
    .filter((c) => !c.last && matches(c))
    .sort(
      (a, b) =>
        Number(b.presence !== "offline") - Number(a.presence !== "offline") ||
        a.name.localeCompare(b.name, "pt-BR"),
    );

  const contactRow = (contact: SerializedContact) => {
    const isTyping = typingIn(contact.conversationId, contact.userId);
    const current = active?.withUserId === contact.userId;
    return (
      <li key={contact.userId}>
        <button
          type="button"
          onClick={() => void open(contact)}
          aria-current={current ? "true" : undefined}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-card",
            current && "bg-card shadow-xs",
          )}
        >
          <Avatar
            userId={contact.userId}
            name={contact.name}
            photo={contact.photo}
            presence={contact.presence}
            size={40}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {contact.name}
              </span>
              {contact.last && (
                <span
                  className={cn(
                    "flex-none text-xs",
                    contact.unread > 0
                      ? "font-semibold text-success-text"
                      : "text-muted-foreground",
                  )}
                >
                  {listTime(contact.last.at)}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  isTyping
                    ? "font-medium text-success-text italic"
                    : contact.unread > 0
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {isTyping
                  ? "digitando…"
                  : contact.last
                    ? `${contact.last.mine ? "Você: " : ""}${contact.last.preview}`
                    : contact.personalMessage ||
                      STATUS_LABELS[contact.presence]}
              </span>
              {contact.unread > 0 && (
                <span className="inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-success px-1.5 text-xs font-semibold text-success-foreground">
                  {contact.unread}
                </span>
              )}
            </span>
          </span>
        </button>
      </li>
    );
  };

  let lastDay = "";

  return (
    <div
      ref={windowRef}
      className="flex h-[calc(100dvh-150px)] min-h-[460px] flex-col overflow-hidden rounded-xl border border-border bg-msg-pane shadow-lg md:h-[calc(100dvh-170px)]"
    >
      {/* The window's bar, in the colour the person picked. The page's own
          title already says "Mensagens internas"; the bar holds the tools. */}
      <div
        className={`flex flex-wrap items-center gap-2 bg-gradient-to-r px-4 py-1.5 text-white ${TITLE_BAR[me.color]}`}
      >
        <span className="flex-1 text-xs font-medium opacity-90">
          {isAway(me.status) || me.status !== "disponivel"
            ? `Você está: ${STATUS_LABELS[me.status]}`
            : "Você está disponível"}
        </span>
        {oversight && (
          <Link
            href="/admin/mensagens/supervisao"
            className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold hover:bg-white/25"
          >
            Equipe e conversas
          </Link>
        )}
        <button
          type="button"
          onClick={() => setPanel((p) => (p === "sons" ? null : "sons"))}
          aria-expanded={panel === "sons"}
          className="cursor-pointer rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold hover:bg-white/25"
        >
          {me.sound ? "🔔" : "🔕"} Sons
        </button>
        <button
          type="button"
          onClick={() =>
            setPanel((p) => (p === "personalizar" ? null : "personalizar"))
          }
          aria-expanded={panel === "personalizar"}
          className="cursor-pointer rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold hover:bg-white/25"
        >
          ⚙ Personalizar
        </button>
      </div>
      {me.atLunch && (
        <div className="flex flex-wrap items-center gap-3 bg-warning-soft px-4 py-2.5 text-sm text-warning-text">
          <span className="flex-1 font-semibold">
            🍽 Horário de almoço
            {me.lunch ? ` (${lunchLabel(me.lunch)})` : ""}: o chat fica
            bloqueado até você voltar.
          </span>
          <button
            type="button"
            onClick={() => void comeBack()}
            className={buttonVariants({ size: "sm" })}
          >
            Voltei do almoço
          </button>
        </div>
      )}
      {locked && me.sound && (
        <button
          type="button"
          onClick={() =>
            void unlockAudio().then((ok) => ok && setLocked(false))
          }
          className="bg-warning-soft px-4 py-1.5 text-left text-xs font-semibold text-warning-text"
        >
          Clique aqui para ativar o som das mensagens.
        </button>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Contacts. On a phone, only when no conversation is open. */}
        <aside
          className={`${active ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-[320px] md:shrink-0`}
        >
          <div className="border-b border-border bg-card/70 p-3">
            <div className="flex items-center gap-2.5">
              {/* The person's own photo, one tap away: optional. */}
              <label
                className="group relative cursor-pointer"
                title={me.photo ? "Trocar minha foto" : "Colocar minha foto"}
              >
                <Avatar
                  userId={me.userId}
                  name={me.name}
                  photo={me.photo}
                  presence={me.status}
                  size={48}
                  version={photoVersion}
                />
                <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/55 py-0.5 text-center text-xs font-semibold text-white">
                  {me.photo ? "Trocar" : "+ Foto"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label={
                    me.photo ? "Trocar minha foto" : "Colocar minha foto"
                  }
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void saveMe({}, file);
                    event.target.value = "";
                  }}
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {me.name}
                </p>
                <NativeSelect
                  size="sm"
                  aria-label="Meu status"
                  value={me.status}
                  onChange={(event) => {
                    // "Horário de almoço" is not a status one switches on
                    // at will: it opens the daily window, which the
                    // Tabelião/Registrador approves and the clock applies.
                    if (event.target.value === LUNCH_OPTION) {
                      setLunchOpen(true);
                      return;
                    }
                    void saveMe({ status: event.target.value as Status });
                  }}
                  className="mt-0.5 w-full bg-card text-foreground"
                >
                  {STATUSES.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </NativeSelectOption>
                  ))}
                  <NativeSelectOption value={LUNCH_OPTION}>
                    {me.lunch
                      ? `Horário de almoço (${lunchLabel(me.lunch)})`
                      : "Horário de almoço: escolher horário"}
                  </NativeSelectOption>
                </NativeSelect>
                {isAway(me.status) && (
                  <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                    Volta a Disponível sozinho em 60 minutos.
                  </p>
                )}
              </div>
            </div>
            <input
              aria-label="Minha mensagem pessoal"
              defaultValue={me.personalMessage}
              maxLength={140}
              placeholder="Escreva uma mensagem pessoal"
              onBlur={(event) =>
                event.target.value !== me.personalMessage &&
                void saveMe({ personalMessage: event.target.value })
              }
              className="mt-2 w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs italic text-muted-foreground hover:border-input focus:border-input focus:bg-card"
            />
            {lunchOpen && (
              <div className="mt-2 rounded-lg border border-border bg-card p-2.5 text-xs">
                <LunchField
                  lunch={me.lunch}
                  pending={me.lunchPending}
                  onAsked={(lunchPending) => setMe({ ...me, lunchPending })}
                />
                <button
                  type="button"
                  onClick={() => setLunchOpen(false)}
                  className="mt-2 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>

          {panel === "sons" && (
            <SoundSettings
              initial={me.soundPrefs}
              enabled={me.sound}
              onEnabled={(sound) => void saveMe({ sound })}
              onSaved={() => router.refresh()}
            />
          )}

          {panel === "personalizar" && (
            <div className="space-y-3 border-b border-border bg-card p-3 text-xs">
              <div>
                <span className="mb-1 block font-semibold text-foreground">
                  Minha foto (opcional)
                </span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-input px-3 py-2.5 hover:border-primary hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
                  <Avatar
                    userId={me.userId}
                    name={me.name}
                    photo={me.photo}
                    size={40}
                    version={photoVersion}
                  />
                  <span className={buttonVariants({ size: "sm" })}>
                    {me.photo ? "Trocar foto" : "Escolher foto"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    JPG, PNG ou WEBP, até 2 MB
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void saveMe({}, file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              {!lunchOpen && (
                <LunchField
                  lunch={me.lunch}
                  pending={me.lunchPending}
                  onAsked={(lunchPending) => setMe({ ...me, lunchPending })}
                />
              )}
              <fieldset>
                <legend className="mb-1 font-semibold text-foreground">
                  Cor da janela
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={COLOR_LABELS[color]}
                      aria-label={COLOR_LABELS[color]}
                      aria-pressed={me.color === color}
                      onClick={() => void saveMe({ color })}
                      className={`h-7 w-7 rounded-full bg-gradient-to-br ${TITLE_BAR[color]} ${me.color === color ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <div className="border-b border-border px-3 py-2">
            <label className="relative block">
              <AdminIcon
                name="search"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar pessoa ou conversa"
                aria-label="Buscar pessoa ou conversa"
                className="h-9 w-full rounded-full border border-input bg-card pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {recent.length > 0 && (
              <>
                <p className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">
                  Conversas
                </p>
                <ul>{recent.map(contactRow)}</ul>
              </>
            )}
            {team.length > 0 && (
              <>
                <p className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                  Equipe ({team.filter((c) => c.presence !== "offline").length}{" "}
                  online)
                </p>
                <ul>{team.map(contactRow)}</ul>
              </>
            )}
            {contacts.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Ninguém mais tem conta nesta serventia ainda.
              </p>
            )}
            {contacts.length > 0 && !recent.length && !team.length && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Ninguém encontrado com "{search}".
              </p>
            )}
          </div>
        </aside>

        {/* The conversation. */}
        <section
          className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-msg-pane`}
        >
          {active && partner ? (
            <>
              <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="inline-flex min-h-10 flex-none items-center gap-1 rounded-full border border-border bg-card py-1 pr-3 pl-2 text-sm font-semibold text-foreground shadow-sm md:hidden"
                  aria-label="Voltar aos contatos"
                >
                  <AdminIcon
                    name="arrowLeft"
                    className="h-4 w-4"
                    strokeWidth={2.2}
                  />
                  Contatos
                </button>
                <Avatar
                  userId={partner.userId}
                  name={partner.name}
                  photo={partner.photo}
                  presence={partner.presence}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {partner.name}
                  </p>
                  <p
                    className={cn(
                      "truncate text-xs",
                      partnerTyping
                        ? "font-medium text-success-text italic"
                        : "text-muted-foreground",
                    )}
                  >
                    {partnerTyping
                      ? "digitando…"
                      : [
                          STATUS_LABELS[partner.presence],
                          partner.personalMessage,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void nudge()}
                  className="inline-flex min-h-9 flex-none cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-msg-busy hover:border-msg-busy"
                  title="Faz a janela da outra pessoa tremer, com som"
                >
                  🔔 <span className="hidden sm:inline">Chamar atenção</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClearing((v) => !v)}
                  aria-expanded={clearing}
                  className="inline-flex min-h-9 flex-none cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground hover:border-primary"
                  title="Limpar toda a conversa"
                >
                  <AdminIcon name="trash" className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Limpar conversa</span>
                </button>
              </header>
              {clearing && (
                <div className="border-b border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-text">
                  <p className="font-semibold">
                    Limpar toda a conversa com {partner.name}?
                  </p>
                  <p className="mt-0.5">
                    As mensagens somem da conversa para você e para{" "}
                    {partner.name}.
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void clearAll()}
                      className={buttonVariants({
                        variant: "destructive-solid",
                        size: "sm",
                      })}
                    >
                      {busy ? "Limpando..." : "Sim, limpar a conversa"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClearing(false)}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-6"
              >
                {shown.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Comece a conversa.
                  </p>
                )}
                {shown.map((message) => {
                  const day = formatDay(message.createdAt);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  const mine = message.senderId === me.userId;
                  return (
                    <div key={message.id}>
                      {showDay && (
                        <p className="my-3 text-center">
                          <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
                            {day}
                          </span>
                        </p>
                      )}
                      {message.kind === "chamar" ? (
                        <p className="my-2 text-center text-xs font-semibold text-msg-busy italic">
                          🔔 {mine ? "Você" : message.senderName} chamou a
                          atenção{mine ? "" : " de você"}!
                        </p>
                      ) : (
                        <div
                          className={cn(
                            "group relative my-1 flex",
                            mine ? "justify-end" : "justify-start",
                            message.reactions.length > 0 && "mb-4",
                          )}
                        >
                          <div
                            className={cn(
                              "relative max-w-[min(78%,560px)] rounded-xl px-3 pt-1.5 pb-1 shadow-xs",
                              mine
                                ? "rounded-br-sm bg-msg-mine"
                                : "rounded-bl-sm bg-card",
                              message.pending && "opacity-80",
                            )}
                          >
                            {message.replyTo && (
                              <div className="mb-1 rounded-md border-l-4 border-primary bg-foreground/5 px-2 py-1 text-xs">
                                <p className="font-semibold text-primary">
                                  {message.replyTo.senderName}
                                </p>
                                <p className="truncate text-muted-foreground">
                                  {message.replyTo.preview}
                                </p>
                              </div>
                            )}
                            {editing?.id === message.id ? (
                              <div className="mt-1 min-w-60">
                                <textarea
                                  aria-label="Editar mensagem"
                                  value={editing.body}
                                  maxLength={LONG_TEXT_MAX}
                                  rows={2}
                                  onChange={(event) =>
                                    setEditing({
                                      id: message.id,
                                      body: event.target.value,
                                    })
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" &&
                                      !event.shiftKey
                                    ) {
                                      event.preventDefault();
                                      void saveEdit();
                                    }
                                    if (event.key === "Escape")
                                      setEditing(null);
                                  }}
                                  className="w-full resize-none rounded-md border border-input bg-card px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                />
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={busy || !editing.body.trim()}
                                    onClick={() => void saveEdit()}
                                    className={buttonVariants({ size: "sm" })}
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditing(null)}
                                    className={buttonVariants({
                                      variant: "outline",
                                      size: "sm",
                                    })}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <MessageBody message={message} />
                            )}
                            <p className="mt-0.5 flex items-center justify-end text-xs text-muted-foreground">
                              {formatTime(message.createdAt)}
                              {mine && (
                                <Ticks receipt={receiptOf(message, receipts)} />
                              )}
                            </p>
                            {message.reactions.length > 0 && (
                              <div
                                className={cn(
                                  "absolute -bottom-3.5 flex gap-0.5",
                                  mine ? "right-2" : "left-2",
                                )}
                              >
                                {message.reactions.map((r) => (
                                  <button
                                    key={r.emoji}
                                    type="button"
                                    title={r.names.join(", ")}
                                    onClick={() => void react(message, r.emoji)}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-0.5 rounded-full border bg-card px-1.5 text-xs leading-5 shadow-xs",
                                      r.mine
                                        ? "border-primary"
                                        : "border-border",
                                    )}
                                  >
                                    {r.emoji}
                                    {r.count > 1 && (
                                      <span className="text-muted-foreground tabular-nums">
                                        {r.count}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Answer, react, and the author's edit and delete:
                              on hover, or always on a touch screen. */}
                          {!message.pending &&
                            !message.deleted &&
                            editing?.id !== message.id && (
                              <div
                                className={cn(
                                  "flex flex-none items-center gap-0.5 self-center px-1 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
                                  mine ? "order-first" : "",
                                  reactingTo === message.id && "md:opacity-100",
                                )}
                              >
                                <button
                                  type="button"
                                  data-reactions
                                  onClick={() =>
                                    setReactingTo((v) =>
                                      v === message.id ? null : message.id,
                                    )
                                  }
                                  aria-label="Reagir"
                                  title="Reagir"
                                  className="flex size-7 cursor-pointer items-center justify-center rounded-full text-sm hover:bg-card"
                                >
                                  🙂
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyTo(message);
                                    inputRef.current?.focus();
                                  }}
                                  aria-label="Responder"
                                  title="Responder"
                                  className="flex size-7 cursor-pointer items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-card"
                                >
                                  ↩
                                </button>
                                {mine && message.kind === "texto" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleting(null);
                                      setEditing({
                                        id: message.id,
                                        body: message.body ?? "",
                                      });
                                    }}
                                    aria-label="Editar"
                                    title="Editar"
                                    className="flex size-7 cursor-pointer items-center justify-center rounded-full text-xs text-muted-foreground hover:bg-card"
                                  >
                                    ✎
                                  </button>
                                )}
                                {mine && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditing(null);
                                      setDeleting(message.id);
                                    }}
                                    aria-label="Apagar"
                                    title="Apagar"
                                    className="flex size-7 cursor-pointer items-center justify-center rounded-full text-destructive hover:bg-card"
                                  >
                                    <AdminIcon
                                      name="trash"
                                      className="size-3.5"
                                    />
                                  </button>
                                )}
                              </div>
                            )}
                          {reactingTo === message.id && (
                            <div
                              data-reactions
                              className={cn(
                                "absolute -top-11 z-20 flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-lg",
                                mine ? "right-0" : "left-0",
                              )}
                            >
                              {QUICK_REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => void react(message, emoji)}
                                  className={cn(
                                    "flex size-8 cursor-pointer items-center justify-center rounded-full text-xl transition-transform hover:scale-125",
                                    message.reactions.some(
                                      (r) => r.mine && r.emoji === emoji,
                                    ) && "bg-primary-soft",
                                  )}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  setReactingTo(null);
                                  setFullPickerFor(message.id);
                                }}
                                aria-label="Mais emojis"
                                title="Mais emojis"
                                className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-muted text-lg text-muted-foreground"
                              >
                                +
                              </button>
                            </div>
                          )}
                          {fullPickerFor === message.id && (
                            <EmojiPicker
                              className={cn(
                                "absolute top-full mt-1",
                                mine ? "right-0" : "left-0",
                              )}
                              onPick={(emoji) => void react(message, emoji)}
                              onClose={() => setFullPickerFor(null)}
                            />
                          )}
                        </div>
                      )}
                      {deleting === message.id && (
                        <div className="my-1.5 ml-auto max-w-sm rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-2 text-xs text-warning-text">
                          <p className="font-semibold">
                            Apagar esta mensagem para os dois?
                          </p>
                          <p className="mt-0.5">
                            Ela some da conversa para você e para {partner.name}
                            .
                          </p>
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void remove(message.id)}
                              className={buttonVariants({
                                variant: "destructive-solid",
                                size: "sm",
                              })}
                            >
                              {busy ? "Apagando..." : "Sim, apagar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(null)}
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                              })}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {partnerTyping && <TypingDots name={partner.name} />}
              </div>

              <div className="border-t border-border bg-card px-3 py-2">
                {replyTo && (
                  <div className="mb-2 flex items-start gap-2 rounded-md border-l-4 border-primary bg-msg-pane px-2.5 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-primary">
                        Respondendo a{" "}
                        {replyTo.senderId === me.userId
                          ? "você mesmo"
                          : replyTo.senderName}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {replyTo.body ?? replyTo.fileName ?? ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      aria-label="Cancelar a resposta"
                      className="cursor-pointer rounded-md px-1.5 text-base leading-none text-muted-foreground hover:bg-card"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {QUICK_REPLIES.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => insert(text.trim() ? ` ${reply}` : reply)}
                      className="cursor-pointer rounded-full border border-border bg-msg-pane px-2.5 py-0.5 text-xs text-foreground hover:border-primary"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
                {recorder.mic === "denied" && (
                  <MicHelp onRetry={() => void recorder.allow()} />
                )}
                {recorder.mic === "unsupported" && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    Este navegador não grava áudio. Use o Chrome, o Edge ou o
                    Safari atualizado.
                  </p>
                )}
                <div className="flex items-end gap-1.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmojiOpen((v) => !v)}
                      aria-expanded={emojiOpen}
                      aria-label="Emojis"
                      title="Emojis"
                      className="flex size-10 cursor-pointer items-center justify-center rounded-full text-xl hover:bg-muted"
                    >
                      🙂
                    </button>
                    {emojiOpen && (
                      <EmojiPicker
                        className="absolute bottom-full left-0 mb-2"
                        onPick={(emoji) => insert(emoji)}
                        onClose={() => setEmojiOpen(false)}
                      />
                    )}
                  </div>
                  <label
                    className="flex size-10 cursor-pointer items-center justify-center rounded-full text-lg hover:bg-muted"
                    title="Enviar arquivo ou PDF (até 4 MB)"
                  >
                    📎
                    <input
                      type="file"
                      className="sr-only"
                      aria-label="Enviar arquivo"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      if (event.target.value.trim()) pingTyping(active.id);
                      else stopTyping();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                      if (event.key === "Escape") setReplyTo(null);
                    }}
                    rows={1}
                    maxLength={LONG_TEXT_MAX}
                    aria-label="Mensagem"
                    placeholder="Escreva uma mensagem (Enter envia, Shift+Enter pula linha)"
                    className="field-sizing-content max-h-36 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-input bg-msg-pane px-3.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  {text.trim() ? (
                    <button
                      type="button"
                      onClick={() => void send()}
                      className={cn(
                        buttonVariants(),
                        "h-10 shrink-0 rounded-full",
                      )}
                    >
                      Enviar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        recorder.recording
                          ? recorder.stop()
                          : void recorder.start()
                      }
                      aria-label={
                        recorder.recording
                          ? "Parar e enviar o áudio"
                          : "Gravar áudio"
                      }
                      title={
                        recorder.recording
                          ? "Parar e enviar o áudio"
                          : "Gravar áudio"
                      }
                      className={cn(
                        "flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold",
                        recorder.recording
                          ? "animate-pulse bg-msg-busy text-white"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {recorder.recording ? "⏹ Parar e enviar" : "🎤"}
                    </button>
                  )}
                </div>
                {(recorder.mic === "prompt" || recorder.mic === "unknown") &&
                  !recorder.recording && (
                    <button
                      type="button"
                      onClick={() => void recorder.allow()}
                      className="mt-1 text-xs font-medium text-muted-foreground underline hover:text-foreground"
                      title="O navegador pergunta uma vez se este site pode usar o microfone"
                    >
                      Liberar microfone para áudio
                    </button>
                  )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <AdminIcon
                name="chat"
                className="h-10 w-10 text-muted-foreground"
              />
              <p>Escolha alguém na lista para conversar.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
