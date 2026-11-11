"use client";

import { useEffect, useRef, useState } from "react";

type MicState = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

/**
 * Voice notes, and the microphone's permission spelled out (decision of
 * 11/11/2026): the browser asks once; when it was refused, the screen says
 * how to give it back instead of failing in silence.
 */
export function useRecorder(onDone: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [mic, setMic] = useState<MicState>("unknown");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMic("unsupported");
      return;
    }
    // Not every browser answers this (Safari did not for a long time):
    // "unknown" then, and the first recording asks.
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((status) => {
        setMic(status.state as MicState);
        status.onchange = () => setMic(status.state as MicState);
      })
      .catch(() => setMic("unknown"));
  }, []);

  /** Asks the browser for the microphone without recording anything. */
  const allow = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setMic("granted");
      return true;
    } catch {
      setMic("denied");
      return false;
    }
  };

  const start = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMic("granted");
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const media = new MediaRecorder(stream, type ? { mimeType: type } : {});
      chunks.current = [];
      media.ondataavailable = (event) => chunks.current.push(event.data);
      media.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        const mime = (media.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunks.current, { type: mime });
        if (blob.size > 0) {
          const ext = mime.includes("mp4")
            ? "m4a"
            : mime.includes("ogg")
              ? "ogg"
              : "webm";
          onDone(
            new File([blob], `audio-${Date.now()}.${ext}`, { type: mime }),
          );
        }
      };
      media.start();
      recorder.current = media;
      setRecording(true);
    } catch {
      setMic("denied");
    }
  };
  const stop = () => {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  };
  return { recording, mic, allow, start, stop };
}

/** When the browser holds the microphone back: how to give it back. */
export function MicHelp({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-1.5 rounded-[10px] border border-admin-warning-soft-border bg-admin-warning-bg px-3 py-2 text-[12px] leading-snug text-admin-warning-text"
    >
      <p className="font-semibold">
        O microfone está bloqueado neste navegador.
      </p>
      <ul className="mt-1 list-disc pl-4">
        <li>
          No computador (Chrome ou Edge): clique no cadeado ao lado do endereço
          do site, em Microfone escolha Permitir e recarregue a página.
        </li>
        <li>
          No iPhone: Ajustes › Safari › Microfone › Permitir (ou toque em
          &quot;aA&quot; na barra de endereço › Configurações do Site).
        </li>
        <li>
          No Android: toque no cadeado ao lado do endereço › Permissões ›
          Microfone.
        </li>
      </ul>
      <button
        type="button"
        onClick={onRetry}
        className="btn btn-admin-secondary btn-sm mt-1.5"
      >
        Tentar liberar de novo
      </button>
    </div>
  );
}
