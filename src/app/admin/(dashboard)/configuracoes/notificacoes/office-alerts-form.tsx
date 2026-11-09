"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ALERT_CHANNEL_LABELS,
  ALERT_CHANNELS,
  type AlertChannel,
  type ChannelAlert,
  defaultOfficeAlerts,
  type OfficeAlerts,
} from "@/core/alerts/office.ts";
import { SOUNDS, type SoundChoice, soundGroups } from "@/core/chat/alerts.ts";
import { playSound, unlockAudio } from "../../../../_components/chat-sound.ts";
import { readAlertPrefs } from "../../../_components/chat-alert-prefs.ts";
import { type OfficeAlertsState, saveOfficeAlerts } from "./actions.ts";

const SELECT_CLASS =
  "rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft disabled:opacity-60";

/** What each channel announces, under its name. */
const CHANNEL_HINTS: Record<AlertChannel, string> = {
  chat: "Conversa nova na fila, mensagem nova numa conversa sua, transferência para você.",
  agenda: "Agendamento novo feito pelo site.",
  guias: "Pedido de guia novo e documento ou resposta enviados pelo cidadão.",
  pedidos: "Pedido de serviço novo feito pelo site.",
  lgpd: "Requerimento novo do titular de dados (LGPD).",
  ouvidoria: "Manifestação nova na ouvidoria.",
};

type Permission = NotificationPermission | "unsupported";

function currentPermission(): Permission {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission;
}

async function hear(sound: SoundChoice) {
  if (sound === "none") return;
  await unlockAudio();
  playSound(sound, readAlertPrefs().volume);
}

/**
 * "Notificações": for each part of the site that brings news, how the
 * panel calls the attendants. The office's choice, saved for everyone; the
 * browser's permission and the chat's volume stay per computer.
 */
export function OfficeAlertsForm({ initial }: { initial: OfficeAlerts }) {
  const [alerts, setAlerts] = useState<OfficeAlerts>(initial);
  const [permission, setPermission] = useState<Permission>("default");
  const [state, action, pending] = useActionState<OfficeAlertsState, FormData>(
    saveOfficeAlerts,
    { status: "idle" },
  );

  useEffect(() => setPermission(currentPermission()), []);
  useEffect(() => {
    if (state.status === "saved") {
      toast.success("Notificações salvas. Já valem em todo o painel.");
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  function update(channel: AlertChannel, patch: Partial<ChannelAlert>) {
    setAlerts((current) => ({
      ...current,
      [channel]: { ...current[channel], ...patch },
    }));
  }

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  return (
    <form
      // Not `action={action}`: React resets a form after its action, and the
      // selects and boxes here are controlled, so the reset would show the
      // first values while the state (and what was saved) holds the new ones.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="alerts" value={JSON.stringify(alerts)} />

      <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          Notificações do painel
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
          Escolha, para cada parte do site, se o painel avisa ou fica em
          silêncio, e como avisa: o aviso na tela, a notificação do navegador, o
          som e a tela tremendo (no celular, vibrando). Vale para todos os
          atendentes da serventia. O volume e a repetição do chat continuam
          sendo de cada computador, em Atendimento online.
        </p>
        <div className="mt-3 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-3 text-[12.5px]">
          <span className="font-bold text-admin-primary">
            Notificações do navegador neste computador:{" "}
          </span>
          {permission === "granted" && (
            <span className="text-admin-success-text">autorizadas.</span>
          )}
          {permission === "default" && (
            <>
              <span className="text-admin-muted">ainda não autorizadas. </span>
              <button
                type="button"
                onClick={() => void askPermission()}
                className="btn btn-admin-primary btn-sm ml-1"
              >
                Permitir neste navegador
              </button>
            </>
          )}
          {permission === "denied" && (
            <span className="text-admin-text">
              bloqueadas. Para liberar: clique no cadeado ao lado do endereço do
              site, abra "Notificações", escolha "Permitir" e recarregue.
            </span>
          )}
          {permission === "unsupported" && (
            <span className="text-admin-muted">
              este navegador não oferece. O som e o aviso na tela continuam.
            </span>
          )}
        </div>
      </section>

      {ALERT_CHANNELS.map((channel) => (
        <ChannelCard
          key={channel}
          channel={channel}
          value={alerts[channel]}
          onChange={(patch) => update(channel, patch)}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando..." : "Salvar notificações"}
        </button>
        <button
          type="button"
          onClick={() => setAlerts(defaultOfficeAlerts())}
          className="btn btn-admin-secondary btn-md"
        >
          Voltar ao padrão
        </button>
      </div>
    </form>
  );
}

function ChannelCard({
  channel,
  value,
  onChange,
}: {
  channel: AlertChannel;
  value: ChannelAlert;
  onChange: (patch: Partial<ChannelAlert>) => void;
}) {
  const id = `alerta-${channel}`;
  const off = !value.enabled;
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id={`${id}-titulo`}
            className="font-serif text-[16px] font-semibold text-admin-primary"
          >
            {ALERT_CHANNEL_LABELS[channel]}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-admin-muted">
            {CHANNEL_HINTS[channel]}
          </p>
        </div>
        <fieldset
          aria-label={`Avisos de ${ALERT_CHANNEL_LABELS[channel]}`}
          className="flex gap-1 rounded-[10px] border border-admin-border bg-admin-input-bg p-1"
        >
          {[
            { enabled: true, label: "Notificar" },
            { enabled: false, label: "Silenciar" },
          ].map((option) => {
            const selected = value.enabled === option.enabled;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ enabled: option.enabled })}
                className={
                  selected
                    ? "rounded-lg bg-admin-primary px-3 py-1.5 text-[12.5px] font-bold text-white"
                    : "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-admin-muted hover:text-admin-primary"
                }
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      <div
        className={`mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px] text-admin-text ${off ? "opacity-60" : ""}`}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox-admin"
            checked={value.popup}
            disabled={off}
            onChange={(event) => onChange({ popup: event.target.checked })}
          />
          Aparecer o aviso na tela
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox-admin"
            checked={value.notify}
            disabled={off}
            onChange={(event) => onChange({ notify: event.target.checked })}
          />
          Notificação do navegador
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox-admin"
            checked={value.shake}
            disabled={off}
            onChange={(event) => onChange({ shake: event.target.checked })}
          />
          Tremer a tela e vibrar
        </label>
        <span className="flex min-w-0 max-w-full items-center gap-2">
          <label htmlFor={`${id}-som`} className="font-semibold">
            Som
          </label>
          <select
            id={`${id}-som`}
            value={value.sound}
            disabled={off}
            onChange={(event) => {
              const sound = event.target.value as SoundChoice;
              onChange({ sound });
              void hear(sound);
            }}
            className={`${SELECT_CLASS} min-w-0 flex-1`}
          >
            {soundGroups().map(({ group, ids }) => (
              <optgroup key={group} label={group}>
                {ids.map((soundId) => (
                  <option key={soundId} value={soundId}>
                    {SOUNDS[soundId].label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="none">Sem som</option>
          </select>
          <button
            type="button"
            disabled={off || value.sound === "none"}
            onClick={() => void hear(value.sound)}
            className="btn btn-admin-secondary btn-sm"
          >
            Ouvir
          </button>
        </span>
      </div>
    </section>
  );
}
