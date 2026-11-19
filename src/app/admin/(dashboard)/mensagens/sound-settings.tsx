"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SOUNDS, type SoundId, soundGroups } from "@/core/chat/alerts.ts";
import {
  OFFICE_SOUND,
  QUIET_OPTIONS,
  quietUntilFrom,
  type SoundPrefs,
} from "@/core/messages/live.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { playSound, unlockAudio } from "../../../_components/chat-sound.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";
import { saveSoundPrefs } from "./actions.ts";

/** The tones a "Chamar atenção" may use: the loud ones and the bells. */
const NUDGE_CHOICES: SoundId[] = [
  "chamar-atencao",
  "sino-balcao",
  "telefone",
  "sonar",
  "alerta",
  "campainha",
  "ding-dong",
];

function Tone({
  id,
  label,
  selected,
  volume,
  onChoose,
  isNew,
}: {
  id: SoundId | null;
  label: string;
  selected: boolean;
  volume: number;
  onChoose: () => void;
  isNew?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-xs transition-colors",
        selected
          ? "border-primary bg-primary-soft font-semibold text-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50",
      )}
    >
      {id ? (
        <button
          type="button"
          onClick={() =>
            void unlockAudio().then(() => playSound(id, Math.max(volume, 30)))
          }
          aria-label={`Ouvir ${label}`}
          title="Ouvir"
          className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-full border border-border bg-background text-xs text-primary hover:border-primary"
        >
          ▶
        </button>
      ) : (
        <span className="size-6 flex-none" aria-hidden="true" />
      )}
      <button
        type="button"
        aria-pressed={selected}
        onClick={onChoose}
        className="min-w-0 flex-1 cursor-pointer truncate py-1 text-left"
      >
        {label}
      </button>
      {isNew && (
        <span
          role="img"
          aria-label="Som novo"
          title="Som novo"
          className="size-2 flex-none rounded-full bg-success"
        />
      )}
    </div>
  );
}

/** Added on 19/11/2026: marked "novo" in the list for a while. */
const NEW_TONES = new Set<SoundId>([
  "gota",
  "xilofone",
  "cristal",
  "marimba",
  "clique",
  "harpa",
  "ding-dong",
  "sino-balcao",
]);

function quietLabel(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: OFFICE_TIME_ZONE,
  });
}

/**
 * "Sons do chat" (decision of 19/11/2026): each person picks the tone of a
 * new message and of "Chamar atenção", hears it before choosing, sets the
 * volume, when it rings, and "não perturbe". Saved at each change.
 */
export function SoundSettings({
  initial,
  enabled,
  onEnabled,
  onSaved,
}: {
  initial: SoundPrefs;
  /** The person's master switch for the messenger's sounds. */
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  onSaved: () => void;
}) {
  const [prefs, setPrefs] = useState(initial);
  const save = async (patch: Partial<SoundPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const result = await saveSoundPrefs(next);
    if (!result.ok) toast.error(result.message);
    else onSaved();
  };
  const quiet =
    prefs.quietUntil && Date.parse(prefs.quietUntil) > Date.now()
      ? prefs.quietUntil
      : null;

  return (
    <div className="space-y-3 border-b border-border bg-card p-3 text-xs">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full bg-success" aria-hidden="true" />=
        som novo. Toque ▶ para ouvir antes de escolher.
      </p>
      <label className="flex items-center justify-between gap-2 font-semibold text-foreground">
        Som das mensagens
        <input
          type="checkbox"
          className="checkbox-admin"
          checked={enabled}
          onChange={(event) => onEnabled(event.target.checked)}
        />
      </label>
      <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-60">
        <div>
          <legend className="mb-1.5 font-semibold text-foreground">
            Mensagem nova
          </legend>
          <div className="grid grid-cols-1 gap-1">
            <Tone
              id={null}
              label="O som da serventia"
              selected={prefs.messageSound === OFFICE_SOUND}
              volume={prefs.volume}
              onChoose={() => void save({ messageSound: OFFICE_SOUND })}
            />
            <Tone
              id={null}
              label="Sem som (só o aviso na tela)"
              selected={prefs.messageSound === "none"}
              volume={prefs.volume}
              onChoose={() => void save({ messageSound: "none" })}
            />
          </div>
          {soundGroups()
            .filter((g) => g.group !== "Urgentes")
            .map((group) => (
              <div key={group.group} className="mt-2">
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.group}
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {group.ids.map((id) => (
                    <Tone
                      key={id}
                      id={id}
                      label={SOUNDS[id].label}
                      isNew={NEW_TONES.has(id)}
                      selected={prefs.messageSound === id}
                      volume={prefs.volume}
                      onChoose={() => void save({ messageSound: id })}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
        <div>
          <p className="mb-1.5 font-semibold text-foreground">
            "Chamar atenção"
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {NUDGE_CHOICES.map((id) => (
              <Tone
                key={id}
                id={id}
                label={SOUNDS[id].label}
                isNew={NEW_TONES.has(id)}
                selected={prefs.nudgeSound === id}
                volume={prefs.volume}
                onChoose={() => void save({ nudgeSound: id })}
              />
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 flex justify-between font-semibold text-foreground">
            Volume <span className="tabular-nums">{prefs.volume}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={prefs.volume}
            onChange={(event) =>
              setPrefs({ ...prefs, volume: Number(event.target.value) })
            }
            onPointerUp={() => void save({ volume: prefs.volume })}
            onKeyUp={() => void save({ volume: prefs.volume })}
            className="w-full accent-primary"
          />
        </label>
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground">Quando tocar</p>
          {(
            [
              ["inChat", "Também com a conversa aberta na tela"],
              ["inBackground", "Também com o painel em outra aba"],
              ["repeatUntilRead", "Repetir a cada 10 segundos até eu ler"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="checkbox-admin"
                checked={prefs[key]}
                onChange={(event) => void save({ [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Não perturbe</p>
          {quiet ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-warning-text">
              <span className="flex-1 font-medium">
                🔕 Sem som até {quietLabel(quiet)}
              </span>
              <button
                type="button"
                onClick={() => void save({ quietUntil: null })}
                className={buttonVariants({ variant: "outline", size: "xs" })}
              >
                Voltar o som
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {QUIET_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() =>
                    void save({
                      quietUntil: quietUntilFrom(
                        minutes,
                        new Date(),
                      ).toISOString(),
                    })
                  }
                  className={buttonVariants({ variant: "outline", size: "xs" })}
                >
                  {minutes === 60 ? "1 hora" : `${minutes} min`}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  void save({
                    quietUntil: quietUntilFrom(
                      "amanha",
                      new Date(),
                    ).toISOString(),
                  })
                }
                className={buttonVariants({ variant: "outline", size: "xs" })}
              >
                Até amanhã
              </button>
            </div>
          )}
        </div>
        <p className="text-muted-foreground">
          Os sons são criados pelo próprio painel; nenhum é copiado de outro
          programa.
        </p>
      </fieldset>
    </div>
  );
}
