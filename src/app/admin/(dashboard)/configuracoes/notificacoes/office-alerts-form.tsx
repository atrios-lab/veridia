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
import { Button } from "../../../_ui/button.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { type OfficeAlertsState, saveOfficeAlerts } from "./actions.ts";

/** What each channel announces, under its name. */
const CHANNEL_HINTS: Record<AlertChannel, string> = {
  chat: "Conversa nova na fila, mensagem nova numa conversa sua, transferência para você.",
  agenda: "Agendamento novo feito pelo site.",
  guias: "Pedido de guia novo e documento ou resposta enviados pelo cidadão.",
  pedidos: "Pedido de serviço novo feito pelo site.",
  lgpd: "Requerimento novo do titular de dados (LGPD).",
  ouvidoria: "Manifestação nova na ouvidoria.",
  mensagens:
    "Mensagem ou chamado de um colega. O som se repete até a pessoa abrir a conversa.",
  auditoria:
    "Notificação de auditoria para a pessoa responder e, para o Tabelião/Registrador, ato urgente a verificar.",
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

      <section className="rounded-xl border bg-card px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">
          Notificações do painel
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Escolha, para cada parte do site, se o painel avisa ou fica em
          silêncio, e como avisa: o aviso na tela, a notificação do navegador, o
          som e a tela tremendo (no celular, vibrando). Vale para todos os
          atendentes da serventia. O volume e a repetição do chat continuam
          sendo de cada computador, em Atendimento online.
        </p>
        <div className="mt-3 rounded-lg border bg-muted/50 px-3.5 py-3 text-xs">
          <span className="font-medium text-foreground">
            Notificações do navegador neste computador:{" "}
          </span>
          {permission === "granted" && (
            <span className="text-success-text">autorizadas.</span>
          )}
          {permission === "default" && (
            <>
              <span className="text-muted-foreground">
                ainda não autorizadas.{" "}
              </span>
              <Button
                type="button"
                onClick={() => void askPermission()}
                size="sm"
                className="ml-1"
              >
                Permitir neste navegador
              </Button>
            </>
          )}
          {permission === "denied" && (
            <span className="text-foreground">
              bloqueadas. Para liberar: clique no cadeado ao lado do endereço do
              site, abra "Notificações", escolha "Permitir" e recarregue.
            </span>
          )}
          {permission === "unsupported" && (
            <span className="text-muted-foreground">
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
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar notificações"}
        </Button>
        <Button
          type="button"
          onClick={() => setAlerts(defaultOfficeAlerts())}
          variant="outline"
        >
          Voltar ao padrão
        </Button>
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
      className="rounded-xl border bg-card px-5 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id={`${id}-titulo`}
            className="text-base font-semibold text-foreground"
          >
            {ALERT_CHANNEL_LABELS[channel]}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {CHANNEL_HINTS[channel]}
          </p>
        </div>
        <fieldset
          aria-label={`Avisos de ${ALERT_CHANNEL_LABELS[channel]}`}
          className="flex gap-1 rounded-lg border bg-muted/50 p-1"
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
                    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                }
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      <div
        className={`mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-foreground ${off ? "opacity-60" : ""}`}
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
          <label htmlFor={`${id}-som`} className="font-medium">
            Som
          </label>
          <NativeSelect
            id={`${id}-som`}
            value={value.sound}
            disabled={off}
            onChange={(event) => {
              const sound = event.target.value as SoundChoice;
              onChange({ sound });
              void hear(sound);
            }}
            className="min-w-0 flex-1"
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
          </NativeSelect>
          <Button
            type="button"
            disabled={off || value.sound === "none"}
            onClick={() => void hear(value.sound)}
            variant="outline"
            size="sm"
          >
            Ouvir
          </Button>
        </span>
      </div>
    </section>
  );
}
