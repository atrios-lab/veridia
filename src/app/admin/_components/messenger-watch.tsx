"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NUDGE_SOUND } from "@/core/chat/alerts.ts";
import { playSound, unlockAudio } from "../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../_components/shake.ts";
import { pollInbox } from "../(dashboard)/mensagens/actions.ts";
import { CHAT_SHAKE_TARGET_ID } from "./chat-alerts.tsx";

const POLL_MS = 5000;
const POPUP_MS = 7000;

interface Popup {
  id: string;
  senderId: string;
  senderName: string;
  preview: string;
  nudge: boolean;
}

/**
 * The internal messenger on every panel screen: a tone, a little window in
 * the corner ("Fulano diz: ...") as the desktop messengers popped them, and
 * the whole panel shaking when someone calls for attention. The messenger
 * screen itself rings for its own conversation, so this stays quiet there.
 */
export function MessengerWatch({ sound }: { sound: boolean }) {
  const pathname = usePathname();
  const [popups, setPopups] = useState<Popup[]>([]);
  const since = useRef(new Date().toISOString());
  const onMessenger = pathname.startsWith("/admin/mensagens");
  const quiet = useRef(onMessenger);
  quiet.current = onMessenger;

  useEffect(() => {
    const unlock = () => void unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const tick = async () => {
      const result = await pollInbox(since.current).catch(() => null);
      if (!result?.ok) return;
      since.current = result.data.now;
      if (quiet.current || result.data.incoming.length === 0) return;
      const fresh = result.data.incoming.map((i) => ({
        id: i.id,
        senderId: i.senderId,
        senderName: i.senderName,
        preview: i.preview,
        nudge: i.kind === "chamar",
      }));
      const nudge = fresh.some((p) => p.nudge);
      if (nudge) {
        shakeElement(document.getElementById(CHAT_SHAKE_TARGET_ID));
        vibrate();
      }
      if (sound) playSound(nudge ? NUDGE_SOUND : "mensageiro", 80);
      setPopups((current) => [...current, ...fresh].slice(-3));
      for (const popup of fresh) {
        setTimeout(
          () =>
            setPopups((current) => current.filter((p) => p.id !== popup.id)),
          POPUP_MS,
        );
      }
    };
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(timer);
  }, [sound]);

  if (popups.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[290px] flex-col gap-2">
      {popups.map((popup) => (
        <Link
          key={popup.id}
          href={`/admin/mensagens?com=${popup.senderId}`}
          className="pointer-events-auto overflow-hidden rounded-[12px] border border-admin-border bg-admin-card shadow-xl"
        >
          <span className="block bg-gradient-to-r from-msg-verde-from to-msg-verde-to px-3 py-1 text-[11.5px] font-semibold text-white">
            Mensagens da serventia
          </span>
          <span className="block px-3 py-2.5 text-[12.5px] text-admin-text">
            <strong className="text-admin-primary">{popup.senderName}</strong>{" "}
            {popup.nudge ? (
              <span className="font-semibold text-msg-busy">
                chamou a sua atenção!
              </span>
            ) : (
              <>
                diz:
                <span className="mt-0.5 block truncate text-admin-muted">
                  {popup.preview}
                </span>
              </>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
