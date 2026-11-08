"use client";

import { useEffect, useState } from "react";
import {
  type AlertPrefs,
  REPEAT_OPTIONS,
  SOUNDS,
  soundGroups,
} from "@/core/chat/alerts.ts";
import { playSound, unlockAudio } from "../../../../_components/chat-sound.ts";
import {
  readAlertPrefs,
  saveAlertPrefs,
} from "../../../_components/chat-alert-prefs.ts";

const SELECT_CLASS =
  "rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

type Permission = NotificationPermission | "unsupported";

function currentPermission(): Permission {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission;
}

/**
 * "Avisos do atendimento": how this computer calls the attendant. Saved in
 * the browser (see chat-alert-prefs.ts), applied at once by the watcher on
 * every panel screen.
 *
 * The browser's notification permission can only be asked from a click,
 * which is why it is a button and not something the page does on load; and
 * once someone has blocked it, only the browser's own site settings can
 * undo it, so that state shows the way there instead of a button that
 * would do nothing.
 */
export function AlertSettings() {
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [permission, setPermission] = useState<Permission>("default");

  useEffect(() => {
    setPrefs(readAlertPrefs());
    setPermission(currentPermission());
  }, []);

  if (!prefs) return null;

  function update(patch: Partial<AlertPrefs>) {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    // Outside the state update: saving notifies the watcher, and a
    // component must not set another's state while this one renders.
    saveAlertPrefs(next);
  }

  async function test(sound = prefs?.sound, volume = prefs?.volume) {
    if (!sound || sound === "none" || volume === undefined) return;
    await unlockAudio();
    playSound(sound, volume);
  }

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      update({ notify: true });
      new Notification("Notificações ativadas", {
        body: "Você será avisado de novas conversas no atendimento.",
      });
    }
  }

  return (
    <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
        Avisos do atendimento
      </h2>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        Como este computador avisa de uma conversa nova, de uma mensagem nova
        numa conversa sua ou de uma transferência para você, em qualquer tela do
        painel. Fica salvo neste navegador.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr_auto]">
        <div>
          <label htmlFor="aviso-som" className={LABEL_CLASS}>
            Som
          </label>
          <select
            id="aviso-som"
            value={prefs.sound}
            onChange={(event) => {
              const sound = event.target.value as AlertPrefs["sound"];
              update({ sound });
              void test(sound, prefs.volume);
            }}
            className={SELECT_CLASS}
          >
            {soundGroups().map(({ group, ids }) => (
              <optgroup key={group} label={group}>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {SOUNDS[id].label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="none">Sem som</option>
          </select>
        </div>

        <div>
          <label htmlFor="aviso-volume" className={LABEL_CLASS}>
            Volume: {prefs.volume}%
          </label>
          <input
            id="aviso-volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={prefs.volume}
            disabled={prefs.sound === "none"}
            onChange={(event) => update({ volume: Number(event.target.value) })}
            onPointerUp={() => void test()}
            onKeyUp={() => void test()}
            className="mt-2 w-full accent-admin-primary"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void test()}
            disabled={prefs.sound === "none"}
            className="btn btn-admin-secondary btn-md"
          >
            Testar
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px] text-admin-text">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox-admin"
            checked={prefs.repeat}
            onChange={(event) => update({ repeat: event.target.checked })}
          />
          Repetir até alguém atender, a cada
        </label>
        <select
          aria-label="Intervalo da repetição"
          value={prefs.repeatSeconds}
          disabled={!prefs.repeat}
          onChange={(event) =>
            update({ repeatSeconds: Number(event.target.value) })
          }
          className={SELECT_CLASS}
        >
          {REPEAT_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} segundos
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox-admin"
            checked={prefs.flash}
            onChange={(event) => update({ flash: event.target.checked })}
          />
          Aviso piscando na tela
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox-admin"
            checked={prefs.shake}
            onChange={(event) => update({ shake: event.target.checked })}
          />
          Tremer a tela e piscar "Chat" a cada aviso novo
        </label>
      </div>

      <div className="mt-4 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-3 text-[12.5px]">
        <span className="font-bold text-admin-primary">
          Notificações do navegador:{" "}
        </span>
        {permission === "granted" && (
          <>
            <span className="text-admin-success-text">ativadas.</span>{" "}
            <label className="ml-1 inline-flex items-center gap-1.5 text-admin-text">
              <input
                type="checkbox"
                className="checkbox-admin"
                checked={prefs.notify}
                onChange={(event) => update({ notify: event.target.checked })}
              />
              Mostrar neste computador
            </label>
          </>
        )}
        {permission === "default" && (
          <>
            <span className="text-admin-muted">ainda não autorizadas. </span>
            <button
              type="button"
              onClick={() => void askPermission()}
              className="btn btn-admin-primary btn-sm ml-1"
            >
              Ativar notificações
            </button>
          </>
        )}
        {permission === "denied" && (
          <span className="text-admin-text">
            bloqueadas neste navegador. Para liberar no Chrome: clique no
            cadeado (ou no ícone de ajustes) ao lado do endereço do site, abra
            "Notificações" e escolha "Permitir". Depois recarregue a página.
          </span>
        )}
        {permission === "unsupported" && (
          <span className="text-admin-muted">
            este navegador não oferece notificações. O som e o aviso na tela
            continuam funcionando.
          </span>
        )}
      </div>
    </section>
  );
}
