"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { NUDGE_SOUND } from "@/core/chat/alerts.ts";
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
import {
  isAudioLocked,
  playSound,
  unlockAudio,
} from "../../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../../_components/shake.ts";
import { AdminIcon } from "../../_components/icon.tsx";
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
  requestLunch,
  returnFromLunch,
  type SerializedContact,
  type SerializedMessage,
  saveProfile,
  sendFile,
  sendNudge,
  sendText,
} from "./actions.ts";
import { MicHelp, useRecorder } from "./recorder.tsx";

const POLL_MS = 3000;

export interface Me {
  userId: string;
  name: string;
  photo: boolean;
  status: Status;
  personalMessage: string;
  color: MessengerColor;
  sound: boolean;
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

const EMOJIS = [
  "😊",
  "😂",
  "😉",
  "😍",
  "😎",
  "😢",
  "😮",
  "👍",
  "👏",
  "🙏",
  "☕",
  "📄",
];

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
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [lunchOpen, setLunchOpen] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const [locked, setLocked] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastIso = useRef<string | null>(null);
  const messagesRef = useRef<SerializedMessage[]>([]);
  messagesRef.current = messages;
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const soundOn = useRef(me.sound);
  soundOn.current = me.sound;

  const partner = contacts.find((c) => c.userId === active?.withUserId);
  // A deleted message leaves the conversation for both people; the record
  // stays for the holder's oversight, without telling anyone.
  const [cleared, setCleared] = useState<string | null>(null);
  // Cleared by either person: what came before it leaves this screen too.
  const shown = messages.filter(
    (m) =>
      !m.deleted && (!cleared || new Date(m.createdAt) > new Date(cleared)),
  );

  const ring = useCallback((nudge: boolean) => {
    if (nudge) {
      shakeElement(windowRef.current);
      vibrate();
    }
    if (!soundOn.current) return;
    if (!playSound(nudge ? NUDGE_SOUND : "mensageiro", 80)) setLocked(true);
  }, []);

  const poll = useCallback(async () => {
    const result = await pollMessenger(active?.id ?? null, lastIso.current);
    if (!result.ok) return;
    const { contacts: next, messages: fresh, now, clearedAt } = result.data;
    setCleared(clearedAt);
    setContacts(next);
    // Another conversation's news rings through the panel's watcher
    // (messenger-watch.tsx), insisting until it is read; here only the
    // list's badges follow.
    const first = lastIso.current === null;
    // The server's clock, so edits and deletions since then come next time.
    lastIso.current = now;
    if (fresh.length) {
      const known = new Set(messagesRef.current.map((m) => m.id));
      const added = fresh.filter((m) => !known.has(m.id));
      // An edited or deleted message comes again: it takes its old place.
      setMessages((current) => {
        const changed = new Map(fresh.map((m) => [m.id, m]));
        const have = new Set(current.map((m) => m.id));
        return [
          ...current.map((m) => changed.get(m.id) ?? m),
          ...fresh.filter((m) => !have.has(m.id)),
        ];
      });
      if (!first) {
        const theirs = added.filter(
          (m) => m.senderId !== me.userId && !m.deleted,
        );
        if (theirs.some((m) => m.kind === "chamar")) ring(true);
        else if (theirs.length) ring(false);
      }
    }
  }, [active?.id, me.userId, ring]);

  // A new conversation starts from its history.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the conversation changes
  useEffect(() => {
    setMessages([]);
    setEditing(null);
    setDeleting(null);
    setClearing(false);
    lastIso.current = null;
    void poll();
  }, [active?.id]);

  useEffect(() => {
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    setLocked(isAudioLocked());
    const unlock = () =>
      void unlockAudio().then((ok) => ok && setLocked(false));
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when messages arrive
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

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

  const send = async () => {
    if (!active || !text.trim() || busy) return;
    setBusy(true);
    const result = await sendText(active.id, text);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setText("");
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
    }
  };

  const online = contacts.filter((c) => c.presence !== "offline");
  const offline = contacts.filter((c) => c.presence === "offline");

  const contactRow = (contact: SerializedContact) => (
    <li key={contact.userId}>
      <button
        type="button"
        onClick={() => void open(contact)}
        aria-current={
          active?.withUserId === contact.userId ? "true" : undefined
        }
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-card",
          active?.withUserId === contact.userId && "bg-card shadow-xs",
        )}
      >
        <Avatar
          userId={contact.userId}
          name={contact.name}
          photo={contact.photo}
          presence={contact.presence}
          size={36}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {contact.name}
          </span>
          <span className="block truncate text-xs italic text-muted-foreground">
            {contact.personalMessage || STATUS_LABELS[contact.presence]}
          </span>
        </span>
        {contact.unread > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-msg-busy px-1.5 text-xs font-semibold text-white">
            {contact.unread}
          </span>
        )}
      </button>
    </li>
  );

  let lastDay = "";

  return (
    <div
      ref={windowRef}
      className="flex h-[calc(100dvh-150px)] min-h-[460px] flex-col overflow-hidden rounded-xl border border-border bg-msg-pane shadow-lg md:h-[calc(100dvh-170px)]"
    >
      {/* The window's title bar, in the colour the person picked. */}
      <div
        className={`flex items-center gap-2 bg-gradient-to-r px-4 py-2 text-white ${TITLE_BAR[me.color]}`}
      >
        <AdminIcon name="chat" className="h-4 w-4" />
        <span className="flex-1 text-sm font-semibold tracking-wide">
          Mensagens internas
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
          onClick={() => setSettings((v) => !v)}
          aria-expanded={settings}
          className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold hover:bg-white/25"
        >
          ⚙ Personalizar: foto, status e almoço
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
          className={`${active ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-[290px] md:shrink-0`}
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
                  size={52}
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

          {settings && (
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox-admin"
                  checked={me.sound}
                  onChange={(event) =>
                    void saveMe({ sound: event.target.checked })
                  }
                />
                Som ao receber mensagens e chamados
              </label>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <p className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">
              Disponíveis ({online.length})
            </p>
            <ul>{online.map(contactRow)}</ul>
            <p className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">
              Offline ({offline.length})
            </p>
            <ul>{offline.map(contactRow)}</ul>
            {contacts.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Ninguém mais tem conta nesta serventia ainda.
              </p>
            )}
          </div>
        </aside>

        {/* The conversation. */}
        <section
          className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-card`}
        >
          {active && partner ? (
            <>
              <header className="flex items-center gap-3 border-b border-border bg-msg-pane px-3 py-2.5">
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
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {partner.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({STATUS_LABELS[partner.presence]})
                    </span>
                  </p>
                  {partner.personalMessage && (
                    <p className="truncate text-xs italic text-muted-foreground">
                      {partner.personalMessage}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setClearing((v) => !v)}
                  aria-expanded={clearing}
                  className="inline-flex min-h-9 flex-none items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground hover:border-primary"
                  title="Limpar toda a conversa"
                >
                  <AdminIcon name="trash" className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Limpar conversa</span>
                  <span className="sm:hidden">Limpar</span>
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
                className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
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
                        <p className="my-2 text-center text-xs font-semibold text-muted-foreground">
                          {day}
                        </p>
                      )}
                      {message.kind === "chamar" ? (
                        <p className="my-2 text-center text-xs font-semibold italic text-msg-busy">
                          *** {mine ? "Você" : message.senderName} chamou a
                          atenção{mine ? "" : " de você"}! ***
                        </p>
                      ) : (
                        <div
                          className={`group my-1.5 rounded-lg px-3 py-1.5 ${mine ? "bg-msg-mine" : ""}`}
                        >
                          <div className="flex flex-wrap items-start gap-x-2">
                            <p className="min-w-0 flex-1 text-xs">
                              <span
                                className={`font-semibold ${mine ? "text-foreground" : "text-msg-azul-from"}`}
                              >
                                {mine ? "Você" : message.senderName} diz:
                              </span>{" "}
                              <span className="text-muted-foreground">
                                ({formatTime(message.createdAt)})
                              </span>
                            </p>
                            {mine &&
                              !message.deleted &&
                              editing?.id !== message.id && (
                                <span className="flex gap-1 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                                  {message.kind === "texto" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleting(null);
                                        setEditing({
                                          id: message.id,
                                          body: message.body ?? "",
                                        });
                                      }}
                                      className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground hover:border-primary"
                                    >
                                      Editar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditing(null);
                                      setDeleting(message.id);
                                    }}
                                    className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold text-destructive hover:border-destructive/40"
                                  >
                                    Apagar
                                  </button>
                                </span>
                              )}
                          </div>
                          <div className="pl-3">
                            {editing?.id === message.id ? (
                              <div className="mt-1">
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
                            {deleting === message.id && (
                              <div className="mt-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-2 text-xs text-warning-text">
                                <p className="font-semibold">
                                  Apagar esta mensagem para os dois?
                                </p>
                                <p className="mt-0.5">
                                  Ela some da conversa para você e para{" "}
                                  {partner.name}.
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border bg-msg-pane px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmojis((v) => !v)}
                      aria-expanded={emojis}
                      className="rounded-md px-2 py-1 text-base hover:bg-card"
                      title="Emoticons"
                    >
                      😊
                    </button>
                    {emojis && (
                      <div className="absolute bottom-full left-0 z-10 mb-1 grid w-[200px] grid-cols-6 gap-1 rounded-lg border border-border bg-card p-2 shadow-lg">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setText((t) => t + emoji);
                              setEmojis(false);
                            }}
                            className="rounded-md p-1 text-lg hover:bg-muted"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <label
                    className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-card"
                    title="Enviar arquivo ou PDF (até 4 MB)"
                  >
                    📎 Arquivo
                    <input
                      type="file"
                      className="sr-only"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      recorder.recording
                        ? recorder.stop()
                        : void recorder.start()
                    }
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${recorder.recording ? "animate-pulse bg-msg-busy text-white" : "text-primary hover:bg-card"}`}
                  >
                    {recorder.recording ? "⏹ Parar e enviar" : "🎤 Áudio"}
                  </button>
                  {(recorder.mic === "prompt" || recorder.mic === "unknown") &&
                    !recorder.recording && (
                      <button
                        type="button"
                        onClick={() => void recorder.allow()}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground underline hover:bg-card"
                        title="O navegador pergunta uma vez se este site pode usar o microfone"
                      >
                        Liberar microfone
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => void nudge()}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-msg-busy hover:bg-card"
                    title="Faz a janela da outra pessoa tremer, com som"
                  >
                    🔔 Chamar atenção
                  </button>
                </div>
                {recorder.mic === "denied" && (
                  <MicHelp onRetry={() => void recorder.allow()} />
                )}
                {recorder.mic === "unsupported" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Este navegador não grava áudio. Use o Chrome, o Edge ou o
                    Safari atualizado.
                  </p>
                )}
                <div className="mt-1.5 flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    maxLength={LONG_TEXT_MAX}
                    aria-label="Mensagem"
                    placeholder="Escreva e tecle Enter para enviar"
                    className="min-w-0 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={busy || !text.trim()}
                    className={cn(buttonVariants(), "shrink-0")}
                  >
                    Enviar
                  </button>
                </div>
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
