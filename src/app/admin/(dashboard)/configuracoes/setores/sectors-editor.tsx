"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import {
  changeSectorAction,
  type SettingsState,
  saveCitizenLineAction,
} from "./actions.ts";

export interface SectorRow {
  id: string;
  label: string;
  origin: "attribution" | "internal" | "custom";
  hidden: boolean;
  /** How many people are in it. */
  people: number;
}

export interface PersonRow {
  id: string;
  name: string;
  roleLabel: string;
  sectorIds: string[];
}

const ORIGIN_LABELS: Record<SectorRow["origin"], string> = {
  attribution: "Atribuição",
  internal: "Já vem pronto",
  custom: "Criado pela serventia",
};

function useToast(state: SettingsState) {
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);
}

function SectorLine({ sector }: { sector: SectorRow }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    changeSectorAction,
    { status: "idle" },
  );
  useToast(state);
  useEffect(() => {
    if (state.status === "success") setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-2.5">
        <form action={action} className="flex flex-1 flex-wrap gap-2">
          <input type="hidden" name="op" value="rename" />
          <input type="hidden" name="id" value={sector.id} />
          <Input
            name="label"
            defaultValue={sector.label}
            aria-label={`Novo nome do setor ${sector.label}`}
            maxLength={60}
            className="min-w-48 flex-1"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar nome"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <span
        className={`font-medium ${sector.hidden ? "text-muted-foreground line-through" : "text-foreground"}`}
      >
        {sector.label}
      </span>
      <Badge className="bg-muted text-muted-foreground">
        {ORIGIN_LABELS[sector.origin]}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {sector.people === 0
          ? "ninguém ainda: a fila avisa toda a equipe"
          : `${sector.people} pessoa${sector.people === 1 ? "" : "s"}`}
      </span>
      <span className="flex-1" />
      {sector.hidden ? (
        <form action={action}>
          <input type="hidden" name="op" value="restore" />
          <input type="hidden" name="id" value={sector.id} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Trazer de volta
          </Button>
        </form>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Renomear
          </Button>
          <ConfirmAction
            action={action}
            pending={pending}
            error={state.status === "error" ? state.message : null}
            trigger="Apagar"
            question={`Apagar o setor ${sector.label}?`}
            consequence="Ele sai das escolhas de direcionamento. Os pedidos que já passaram por ele continuam mostrando o nome, e dá para trazer de volta."
            confirmLabel="Apagar o setor"
            pendingLabel="Apagando…"
            justify={false}
          >
            <input type="hidden" name="op" value="hide" />
            <input type="hidden" name="id" value={sector.id} />
          </ConfirmAction>
        </>
      )}
    </li>
  );
}

export function SectorsEditor({ sectors }: { sectors: SectorRow[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    changeSectorAction,
    { status: "idle" },
  );
  useToast(state);
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (state.status === "success") setLabel("");
  }, [state]);
  const active = sectors.filter((s) => !s.hidden);
  const hidden = sectors.filter((s) => s.hidden);
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Setores</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Para onde os pedidos são direcionados dentro do cartório. As atribuições
        da serventia, o Balcão, o Caixa e o Gabinete do Tabelião já vêm prontos.
        Renomeie, apague ou crie os seus.
      </p>
      <ul className="mt-3 divide-y">
        {active.map((sector) => (
          <SectorLine key={sector.id} sector={sector} />
        ))}
      </ul>
      <form action={action} className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="op" value="create" />
        <Input
          name="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome do setor novo (ex.: Conferência)"
          aria-label="Nome do setor novo"
          maxLength={60}
          className="min-w-56 flex-1"
        />
        <Button type="submit" disabled={pending || label.trim().length < 2}>
          {pending ? "Criando…" : "Criar setor"}
        </Button>
      </form>
      {hidden.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Setores apagados ({hidden.length})
          </summary>
          <ul className="mt-2 divide-y">
            {hidden.map((sector) => (
              <SectorLine key={sector.id} sector={sector} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function PersonLine({
  person,
  sectors,
}: {
  person: PersonRow;
  sectors: SectorRow[];
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    changeSectorAction,
    { status: "idle" },
  );
  useToast(state);
  const [chosen, setChosen] = useState(person.sectorIds);
  const dirty =
    [...chosen].sort().join() !== [...person.sectorIds].sort().join();
  return (
    <li className="py-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="op" value="members" />
        <input type="hidden" name="userId" value={person.id} />
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-foreground">{person.name}</span>
          <span className="text-xs text-muted-foreground">
            {person.roleLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sectors.map((sector) => {
            const on = chosen.includes(sector.id);
            return (
              <label
                key={sector.id}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                <input
                  type="checkbox"
                  name="sectorIds"
                  value={sector.id}
                  checked={on}
                  onChange={(e) =>
                    setChosen((list) =>
                      e.target.checked
                        ? [...list, sector.id]
                        : list.filter((id) => id !== sector.id),
                    )
                  }
                  className="sr-only"
                />
                {sector.label}
              </label>
            );
          })}
          {dirty && (
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </div>
      </form>
    </li>
  );
}

export function MembersEditor({
  people,
  sectors,
}: {
  people: PersonRow[];
  sectors: SectorRow[];
}) {
  const active = sectors.filter((s) => !s.hidden);
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Quem está em cada setor
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Clique nos setores de cada pessoa. Quem é do setor recebe o alerta
        quando um pedido vai para a fila dele. Enquanto você não escolher, vale
        o setor que a pessoa atende no chat.
      </p>
      <ul className="mt-2 divide-y">
        {people.map((person) => (
          <PersonLine key={person.id} person={person} sectors={active} />
        ))}
      </ul>
    </section>
  );
}

export function CitizenLineSwitch({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveCitizenLineAction,
    { status: "idle" },
  );
  useToast(state);
  return (
    <section className="rounded-xl border bg-card p-6">
      <form action={action} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          O que o cidadão vê
        </h2>
        <p className="text-sm text-muted-foreground">
          Ligado: na consulta do protocolo, abaixo do andamento, aparece uma
          linha automática como "Com o setor de Registro Civil · aguardando
          assinatura". Nunca o nome do funcionário. Desligado: o cidadão vê só o
          andamento, como antes. Também dá para desligar num pedido só.
        </p>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="enabled"
            checked={on}
            disabled={pending}
            onChange={(e) => setOn(e.target.checked)}
            className="size-5 accent-primary"
          />
          {on ? "Ligado: mostrar o setor e a fase" : "Desligado"}
        </label>
        {on !== enabled && (
          <Button type="submit" className="self-start" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        )}
      </form>
    </section>
  );
}
