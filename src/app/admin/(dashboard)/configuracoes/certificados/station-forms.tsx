"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RELEASE_HOURS,
  STATION_MODES,
  type StationMode,
} from "@/core/signature/station.ts";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { DOWNLOAD_HREF } from "../../utilitarios/assinador/a3.tsx";
import {
  createStationAction,
  releaseStationCertificateAction,
  revokeStationAction,
  type StationState,
  setStationPolicyAction,
} from "./station-actions.ts";

const LOCAL = "http://127.0.0.1:47820";
const IDLE: StationState = { status: "idle" };

function useToast(state: StationState) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);
}

/** "1.1.0" or newer: the version that can be a station. */
function canBeStation(version: string): boolean {
  const [major = 0, minor = 0] = version.split(".").map(Number);
  return major > 1 || (major === 1 && minor >= 1);
}

/**
 * Makes the computer this screen is open on a signing station (decision of
 * 16/11/2026): the platform creates the station and hands its key straight
 * to the Assinador Veridia running here, which asks the person to agree.
 */
export function PairStation() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"" | "ausente" | "antigo" | string>(
    "",
  );

  const pair = async () => {
    setProblem("");
    setBusy(true);
    try {
      let version = "";
      try {
        const response = await fetch(`${LOCAL}/v1/status`);
        version = ((await response.json()) as { versao?: string }).versao ?? "";
      } catch {
        setProblem("ausente");
        return;
      }
      if (!canBeStation(version)) {
        setProblem("antigo");
        return;
      }
      const created = await createStationAction(name);
      if (created.status === "error") {
        setProblem(created.message);
        return;
      }
      const response = await fetch(`${LOCAL}/v1/estacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plataforma: window.location.origin,
          chave: created.key,
          nome: name.trim(),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          erro?: string;
        };
        setProblem(
          body.erro ||
            "O Assinador Veridia não aceitou. Responda Sim na janela dele.",
        );
        return;
      }
      toast.success(
        "Este computador é uma estação de assinatura. Agora escolha o que compartilhar.",
      );
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4">
      <h3 className="text-base font-semibold text-foreground">
        Tornar este computador uma estação de assinatura
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Abra esta tela no computador onde o token ou cartão A3 fica plugado, com
        o Assinador Veridia instalado. Ele passa a assinar para as pessoas que
        você autorizar, de qualquer computador do cartório. O computador precisa
        ficar ligado, com o token conectado.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label
          htmlFor="nome-estacao"
          className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium"
        >
          Nome do computador
          <Input
            id="nome-estacao"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Ex.: Sala do Tabelião"
            className="font-normal"
          />
        </label>
        <Button
          type="button"
          disabled={busy || name.trim().length < 2}
          onClick={() => void pair()}
        >
          {busy ? "Ligando…" : "Ligar como estação"}
        </Button>
      </div>
      {problem === "ausente" && (
        <p className="text-sm text-warning-text">
          O Assinador Veridia não está aberto neste computador.{" "}
          <a
            href={DOWNLOAD_HREF}
            download
            className="font-medium underline underline-offset-4"
          >
            Baixe e instale
          </a>
          , abra-o e tente de novo.
        </p>
      )}
      {problem === "antigo" && (
        <p className="text-sm text-warning-text">
          O Assinador Veridia deste computador é de uma versão antiga.{" "}
          <a
            href={DOWNLOAD_HREF}
            download
            className="font-medium underline underline-offset-4"
          >
            Baixe a versão nova
          </a>
          , instale por cima e tente de novo.
        </p>
      )}
      {problem && problem !== "ausente" && problem !== "antigo" && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

/** Whether, how and with whom one certificate of the station is shared. */
export function CertificatePolicyForm({
  stationId,
  certificateKey,
  people,
  shared,
  mode,
  signerIds,
}: {
  stationId: string;
  certificateKey: string;
  people: { id: string; name: string }[];
  shared: boolean;
  mode: StationMode;
  signerIds: string[];
}) {
  const [state, action, pending] = useActionState(setStationPolicyAction, IDLE);
  useToast(state);
  const [on, setOn] = useState(shared);
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="stationId" value={stationId} />
      <input type="hidden" name="certificateKey" value={certificateKey} />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="compartilhar"
          value="1"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
        Compartilhar este certificado com o cartório
      </label>
      {on && (
        <>
          <fieldset className="ml-6 flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-foreground">
              Como o titular autoriza o uso
            </legend>
            {(Object.keys(STATION_MODES) as StationMode[]).map((value) => (
              <label key={value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="modo"
                  value={value}
                  defaultChecked={mode === value}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">
                    {STATION_MODES[value].label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {STATION_MODES[value].description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="ml-6 flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium text-foreground">
              Quem pode assinar com ele
            </legend>
            {people.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="signers"
                  value={person.id}
                  defaultChecked={signerIds.includes(person.id)}
                />
                {person.name}
              </label>
            ))}
          </fieldset>
        </>
      )}
      {/* Off keeps the choices, for when it is shared again. */}
      {!on && <input type="hidden" name="modo" value={mode} />}
      {!on &&
        signerIds.map((id) => (
          <input key={id} type="hidden" name="signers" value={id} />
        ))}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar compartilhamento"}
        </Button>
      </div>
    </form>
  );
}

/** Releases the use for some hours, or ends the release. */
export function ReleaseForm({
  stationId,
  certificateKey,
  releasedUntil,
}: {
  stationId: string;
  certificateKey: string;
  /** "18:30", while released. */
  releasedUntil: string | null;
}) {
  const [state, action, pending] = useActionState(
    releaseStationCertificateAction,
    IDLE,
  );
  useToast(state);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
      <span className="basis-full text-foreground">
        {releasedUntil ? (
          <>
            <strong>Liberado até {releasedUntil}.</strong> Quem está autorizado
            assina pela estação sem precisar de confirmação.
          </>
        ) : (
          "Não liberado agora: ninguém assina com ele pela estação."
        )}
      </span>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="stationId" value={stationId} />
        <input type="hidden" name="certificateKey" value={certificateKey} />
        <NativeSelect
          name="horas"
          defaultValue="4"
          aria-label="Liberar por quanto tempo"
        >
          {RELEASE_HOURS.map((h) => (
            <NativeSelectOption key={h} value={String(h)}>
              Liberar por {h} h
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" disabled={pending}>
          {releasedUntil ? "Renovar liberação" : "Liberar"}
        </Button>
      </form>
      {releasedUntil && (
        <form action={action}>
          <input type="hidden" name="stationId" value={stationId} />
          <input type="hidden" name="certificateKey" value={certificateKey} />
          <input type="hidden" name="horas" value="0" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Encerrar agora
          </Button>
        </form>
      )}
    </div>
  );
}

/** Switches the station off: it stops signing for the office. */
export function RevokeStation({ stationId }: { stationId: string }) {
  const [state, action, pending] = useActionState(revokeStationAction, IDLE);
  const [confirming, setConfirming] = useState(false);
  useToast(state);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Desligar estação
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="stationId" value={stationId} />
      <span>
        Desligar? Ninguém mais assina pelos certificados deste computador. O
        histórico fica guardado.
      </span>
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        Sim, desligar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setConfirming(false)}
      >
        Voltar
      </Button>
    </form>
  );
}
