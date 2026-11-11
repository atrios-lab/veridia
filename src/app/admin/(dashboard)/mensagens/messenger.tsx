"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { NUDGE_SOUND } from "@/core/chat/alerts.ts";
import {
  COLOR_LABELS,
  COLORS,
  initialsOf,
  isAudio,
  isImage,
  type Lunch,
  lunchLabel,
  type MessengerColor,
  OVERSIGHT_NOTICE,
  type Presence,
  STATUS_LABELS,
  STATUSES,
  type Status,
} from "@/core/messages/rules.ts";
import {
  isAudioLocked,
  playSound,
  unlockAudio,
} from "../../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../../_components/shake.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import {
  clearConversation,
  deleteMessage,
  editMessage,
  openConversation,
  pollMessenger,
  requestLunch,
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
          className="h-full w-full rounded-[10px] border-2 border-white object-cover shadow"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-[10px] border-2 border-white bg-admin-primary text-[13px] font-bold text-white shadow">
          {initialsOf(name)}
        </span>
      )}
      {presence && (
        <span
          role="img"
          aria-label={STATUS_LABELS[presence]}
          className={`absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-white ${DOT[presence]}`}
        />
      )}
    </span>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
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
        className="mt-1 inline-flex max-w-full flex-col gap-1 rounded-[10px] border border-admin-border bg-admin-card p-2 text-[12.5px] hover:border-admin-primary"
      >
        {image && (
          // biome-ignore lint/performance/noImgElement: a private route, not an optimizable asset
          <img
            src={href}
            alt={message.fileName ?? ""}
            className="max-h-48 max-w-full rounded-[6px] object-contain"
          />
        )}
        <span className="flex items-center gap-1.5 font-semibold text-admin-primary [overflow-wrap:anywhere]">
          <AdminIcon name="file" className="h-4 w-4 shrink-0" />
          {message.fileName}
          {message.sizeBytes ? (
            <span className="font-normal text-admin-muted">
              ({Math.max(1, Math.round(message.sizeBytes / 1024))} KB)
            </span>
          ) : null}
        </span>
      </a>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-[13.5px] text-admin-text [overflow-wrap:anywhere]">
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
      <legend className="mb-1 font-bold text-admin-primary">
        Horário de almoço
      </legend>
      <p className="text-[12px] text-admin-text">
        {lunch
          ? `Aprovado: ${lunchLabel(lunch)}. Nesse horário você aparece como "Horário de almoço"; depois, volta a aparecer disponível sozinho.`
          : "Nenhum horário aprovado ainda."}
      </p>
      {pending ? (
        <p className="mt-1.5 rounded-[8px] bg-admin-warning-bg px-2.5 py-1.5 text-[12px] font-semibold text-admin-warning-text">
          Pedido {lunchLabel(pending)} aguardando o Tabelião/Registrador. Até a
          decisão, não dá para mudar de novo.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-end gap-2">
          <label className="text-[11.5px] font-semibold text-admin-muted">
            Início
            <input
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="mt-0.5 block rounded-[8px] border border-admin-input-border bg-admin-input-bg px-2 py-1 text-[12.5px]"
            />
          </label>
          <label className="text-[11.5px] font-semibold text-admin-muted">
            Duração
            <select
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="mt-0.5 block rounded-[8px] border border-admin-input-border bg-admin-input-bg px-2 py-1 text-[12.5px]"
            >
              {[15, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m === 60 ? "1 hora (máximo)" : `${m} minutos`}
                </option>
              ))}
            </select>
          </label>
          {confirming ? null : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn btn-admin-secondary btn-sm"
            >
              {lunch ? "Pedir mudança" : "Pedir este horário"}
            </button>
          )}
        </div>
      )}
      {confirming && (
        <div className="mt-2 rounded-[8px] border border-admin-warning-soft-border bg-admin-warning-bg px-2.5 py-2 text-[12px] text-admin-warning-text">
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
              className="btn btn-admin-primary btn-sm"
            >
              {busy ? "Enviando..." : "Confirmar o pedido"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn btn-admin-secondary btn-sm"
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
    const { contacts: next, messages: fresh, now } = result.data;
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
    toast.success("Conversa limpa para você.");
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
        className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-white ${active?.withUserId === contact.userId ? "bg-white shadow-sm" : ""}`}
      >
        <Avatar
          userId={contact.userId}
          name={contact.name}
          photo={contact.photo}
          presence={contact.presence}
          size={36}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-admin-text">
            {contact.name}
          </span>
          <span className="block truncate text-[11.5px] italic text-admin-muted">
            {contact.personalMessage || STATUS_LABELS[contact.presence]}
          </span>
        </span>
        {contact.unread > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-msg-busy px-1.5 text-[11px] font-bold text-white">
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
      className="flex h-[calc(100dvh-150px)] min-h-[460px] flex-col overflow-hidden rounded-[14px] border border-admin-border bg-msg-pane shadow-lg md:h-[calc(100dvh-170px)]"
    >
      {/* The window's title bar, in the colour the person picked. */}
      <div
        className={`flex items-center gap-2 bg-gradient-to-r px-4 py-2 text-white ${TITLE_BAR[me.color]}`}
      >
        <AdminIcon name="chat" className="h-4 w-4" />
        <span className="flex-1 text-[13px] font-semibold tracking-wide">
          Mensagens internas
        </span>
        {oversight && (
          <Link
            href="/admin/mensagens/supervisao"
            className="rounded-md bg-white/15 px-2 py-0.5 text-[11.5px] font-semibold hover:bg-white/25"
          >
            Equipe e conversas
          </Link>
        )}
        <button
          type="button"
          onClick={() => setSettings((v) => !v)}
          aria-expanded={settings}
          className="rounded-md bg-white/15 px-2 py-0.5 text-[11.5px] font-semibold hover:bg-white/25"
        >
          ⚙ Personalizar: foto, status e almoço
        </button>
      </div>
      {locked && me.sound && (
        <button
          type="button"
          onClick={() =>
            void unlockAudio().then((ok) => ok && setLocked(false))
          }
          className="bg-admin-warning-bg px-4 py-1.5 text-left text-[12px] font-semibold text-admin-warning-text"
        >
          Clique aqui para ativar o som das mensagens.
        </button>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Contacts. On a phone, only when no conversation is open. */}
        <aside
          className={`${active ? "hidden md:flex" : "flex"} w-full flex-col border-r border-admin-border md:w-[290px] md:shrink-0`}
        >
          <div className="border-b border-admin-border bg-white/70 p-3">
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
                <span className="absolute inset-x-0 bottom-0 rounded-b-[10px] bg-black/55 py-0.5 text-center text-[9.5px] font-semibold text-white">
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
                <p className="truncate text-[14px] font-bold text-admin-primary">
                  {me.name}
                </p>
                <select
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
                  className="mt-0.5 w-full rounded-[6px] border border-admin-input-border bg-admin-card px-1.5 py-0.5 text-[12px] text-admin-text"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                  <option value={LUNCH_OPTION}>
                    {me.lunch
                      ? `Horário de almoço (${lunchLabel(me.lunch)})`
                      : "Horário de almoço: escolher horário"}
                  </option>
                </select>
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
              className="mt-2 w-full rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-[12px] italic text-admin-muted hover:border-admin-input-border focus:border-admin-input-border focus:bg-admin-card"
            />
            {lunchOpen && (
              <div className="mt-2 rounded-[10px] border border-admin-border bg-admin-card p-2.5 text-[12.5px]">
                <LunchField
                  lunch={me.lunch}
                  pending={me.lunchPending}
                  onAsked={(lunchPending) => setMe({ ...me, lunchPending })}
                />
                <button
                  type="button"
                  onClick={() => setLunchOpen(false)}
                  className="mt-2 text-[12px] font-semibold text-admin-muted underline hover:text-admin-primary"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>

          {settings && (
            <div className="space-y-3 border-b border-admin-border bg-admin-card p-3 text-[12.5px]">
              <div>
                <span className="mb-1 block font-bold text-admin-primary">
                  Minha foto (opcional)
                </span>
                <label className="flex cursor-pointer items-center gap-3 rounded-[12px] border-2 border-dashed border-admin-input-border px-3 py-2.5 hover:border-admin-primary hover:bg-admin-input-bg focus-within:ring-2 focus-within:ring-admin-accent">
                  <Avatar
                    userId={me.userId}
                    name={me.name}
                    photo={me.photo}
                    size={40}
                    version={photoVersion}
                  />
                  <span className="btn btn-admin-primary btn-sm">
                    {me.photo ? "Trocar foto" : "Escolher foto"}
                  </span>
                  <span className="text-[11px] text-admin-muted">
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
                <legend className="mb-1 font-bold text-admin-primary">
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
                      className={`h-7 w-7 rounded-full bg-gradient-to-br ${TITLE_BAR[color]} ${me.color === color ? "ring-2 ring-admin-primary ring-offset-2" : ""}`}
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
            <p className="px-2 pt-1 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-admin-muted">
              Disponíveis ({online.length})
            </p>
            <ul>{online.map(contactRow)}</ul>
            <p className="px-2 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-admin-muted">
              Offline ({offline.length})
            </p>
            <ul>{offline.map(contactRow)}</ul>
            {contacts.length === 0 && (
              <p className="px-2 py-3 text-[12.5px] text-admin-muted">
                Ninguém mais tem conta nesta serventia ainda.
              </p>
            )}
          </div>
          <p className="border-t border-admin-border bg-white/60 px-3 py-2 text-[11px] leading-snug text-admin-muted">
            {OVERSIGHT_NOTICE}
          </p>
        </aside>

        {/* The conversation. */}
        <section
          className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-white`}
        >
          {active && partner ? (
            <>
              <header className="flex items-center gap-3 border-b border-admin-border bg-msg-pane px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="inline-flex min-h-10 flex-none items-center gap-1 rounded-full border border-admin-border bg-white py-1 pr-3 pl-2 text-[13px] font-semibold text-admin-primary shadow-sm md:hidden"
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
                  <p className="truncate text-[14px] font-bold text-admin-primary">
                    {partner.name}{" "}
                    <span className="text-[12px] font-normal text-admin-muted">
                      ({STATUS_LABELS[partner.presence]})
                    </span>
                  </p>
                  {partner.personalMessage && (
                    <p className="truncate text-[12px] italic text-admin-muted">
                      {partner.personalMessage}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setClearing((v) => !v)}
                  aria-expanded={clearing}
                  className="inline-flex min-h-9 flex-none items-center gap-1.5 rounded-full border border-admin-border bg-white px-3 text-[12px] font-semibold text-admin-primary hover:border-admin-primary"
                  title="Limpar toda a conversa para você"
                >
                  <AdminIcon name="trash" className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Limpar conversa</span>
                  <span className="sm:hidden">Limpar</span>
                </button>
              </header>
              {clearing && (
                <div className="border-b border-admin-warning-soft-border bg-admin-warning-bg px-3 py-2 text-[12px] text-admin-warning-text">
                  <p className="font-semibold">
                    Limpar toda a conversa com {partner.name}?
                  </p>
                  <p className="mt-0.5">
                    As mensagens somem só da sua tela. {partner.name} continua
                    com o histórico, e o Tabelião/Registrador também. O ato fica
                    registrado na auditoria.
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void clearAll()}
                      className="btn btn-admin-primary btn-sm"
                    >
                      {busy ? "Limpando..." : "Sim, limpar para mim"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClearing(false)}
                      className="btn btn-admin-secondary btn-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              <p className="flex items-center gap-1.5 border-b border-admin-border bg-admin-warning-bg px-3 py-1.5 text-[11.5px] font-semibold text-admin-warning-text">
                <AdminIcon name="eye" className="h-3.5 w-3.5 shrink-0" />
                {OVERSIGHT_NOTICE}
              </p>

              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
              >
                {messages.length === 0 && (
                  <p className="py-6 text-center text-[12.5px] text-admin-muted">
                    Comece a conversa.
                  </p>
                )}
                {messages.map((message) => {
                  const day = formatDay(message.createdAt);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  const mine = message.senderId === me.userId;
                  return (
                    <div key={message.id}>
                      {showDay && (
                        <p className="my-2 text-center text-[11px] font-semibold text-admin-muted">
                          {day}
                        </p>
                      )}
                      {message.kind === "chamar" ? (
                        <p className="my-2 text-center text-[12.5px] font-semibold italic text-msg-busy">
                          *** {mine ? "Você" : message.senderName} chamou a
                          atenção{mine ? "" : " de você"}! ***
                        </p>
                      ) : (
                        <div
                          className={`group my-1.5 rounded-[10px] px-3 py-1.5 ${mine ? "bg-msg-mine" : ""}`}
                        >
                          <div className="flex flex-wrap items-start gap-x-2">
                            <p className="min-w-0 flex-1 text-[12px]">
                              <span
                                className={`font-bold ${mine ? "text-admin-primary" : "text-msg-azul-from"}`}
                              >
                                {mine ? "Você" : message.senderName} diz:
                              </span>{" "}
                              <span className="text-admin-faint">
                                ({formatTime(message.createdAt)})
                              </span>
                              {message.editedAt && !message.deleted && (
                                <span className="ml-1 text-[11px] italic text-admin-muted">
                                  (editada)
                                </span>
                              )}
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
                                      className="rounded-full border border-admin-border bg-white px-2 py-0.5 text-[11px] font-semibold text-admin-primary hover:border-admin-primary"
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
                                    className="rounded-full border border-admin-border bg-white px-2 py-0.5 text-[11px] font-semibold text-admin-error-text hover:border-admin-error-border"
                                  >
                                    Apagar
                                  </button>
                                </span>
                              )}
                          </div>
                          <div className="pl-3">
                            {message.deleted ? (
                              <p className="text-[12.5px] italic text-admin-muted">
                                🚫 Mensagem apagada
                              </p>
                            ) : editing?.id === message.id ? (
                              <div className="mt-1">
                                <textarea
                                  aria-label="Editar mensagem"
                                  value={editing.body}
                                  maxLength={4000}
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
                                  className="w-full resize-none rounded-[8px] border border-admin-input-border bg-white px-2 py-1 text-[13.5px]"
                                />
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={busy || !editing.body.trim()}
                                    onClick={() => void saveEdit()}
                                    className="btn btn-admin-primary btn-sm"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditing(null)}
                                    className="btn btn-admin-secondary btn-sm"
                                  >
                                    Cancelar
                                  </button>
                                  <span className="text-[11px] text-admin-muted">
                                    Aparece como &quot;editada&quot;. O texto
                                    original fica guardado para o
                                    Tabelião/Registrador.
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <MessageBody message={message} />
                            )}
                            {deleting === message.id && (
                              <div className="mt-1.5 rounded-[8px] border border-admin-warning-soft-border bg-admin-warning-bg px-2.5 py-2 text-[12px] text-admin-warning-text">
                                <p className="font-semibold">
                                  Apagar esta mensagem para os dois?
                                </p>
                                <p className="mt-0.5">
                                  No lugar dela aparece &quot;Mensagem
                                  apagada&quot;. O conteúdo continua guardado
                                  para o Tabelião/Registrador, e o ato vai para
                                  a auditoria.
                                </p>
                                <div className="mt-1.5 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void remove(message.id)}
                                    className="btn btn-admin-primary btn-sm"
                                  >
                                    {busy ? "Apagando..." : "Sim, apagar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleting(null)}
                                    className="btn btn-admin-secondary btn-sm"
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

              <div className="border-t border-admin-border bg-msg-pane px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmojis((v) => !v)}
                      aria-expanded={emojis}
                      className="rounded-md px-2 py-1 text-[16px] hover:bg-white"
                      title="Emoticons"
                    >
                      😊
                    </button>
                    {emojis && (
                      <div className="absolute bottom-full left-0 z-10 mb-1 grid w-[200px] grid-cols-6 gap-1 rounded-[10px] border border-admin-border bg-admin-card p-2 shadow-lg">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setText((t) => t + emoji);
                              setEmojis(false);
                            }}
                            className="rounded-md p-1 text-[18px] hover:bg-admin-input-bg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <label
                    className="cursor-pointer rounded-md px-2 py-1 text-[12.5px] font-semibold text-admin-primary hover:bg-white"
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
                    className={`rounded-md px-2 py-1 text-[12.5px] font-semibold ${recorder.recording ? "animate-pulse bg-msg-busy text-white" : "text-admin-primary hover:bg-white"}`}
                  >
                    {recorder.recording ? "⏹ Parar e enviar" : "🎤 Áudio"}
                  </button>
                  {(recorder.mic === "prompt" || recorder.mic === "unknown") &&
                    !recorder.recording && (
                      <button
                        type="button"
                        onClick={() => void recorder.allow()}
                        className="rounded-md px-2 py-1 text-[12px] font-semibold text-admin-muted underline hover:bg-white"
                        title="O navegador pergunta uma vez se este site pode usar o microfone"
                      >
                        Liberar microfone
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => void nudge()}
                    className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-msg-busy hover:bg-white"
                    title="Faz a janela da outra pessoa tremer, com som"
                  >
                    🔔 Chamar atenção
                  </button>
                </div>
                {recorder.mic === "denied" && (
                  <MicHelp onRetry={() => void recorder.allow()} />
                )}
                {recorder.mic === "unsupported" && (
                  <p className="mt-1 text-[11.5px] text-admin-muted">
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
                    maxLength={4000}
                    aria-label="Mensagem"
                    placeholder="Escreva e tecle Enter para enviar"
                    className="min-w-0 flex-1 resize-none rounded-[10px] border border-admin-input-border bg-admin-card px-3 py-2 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={busy || !text.trim()}
                    className="btn btn-admin-primary btn-md shrink-0"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-[13px] text-admin-muted">
              <AdminIcon
                name="chat"
                className="h-10 w-10 text-admin-primary-soft"
              />
              <p>Escolha alguém na lista para conversar.</p>
              <p className="max-w-sm text-[11.5px]">{OVERSIGHT_NOTICE}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
