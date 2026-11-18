"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  LEVEL_LABEL_MAX,
  MAX_LEVELS,
  NAME_MAX,
  PORTARIA_PUBLIC_WARNING,
  SMALL_TEXT_MAX,
  type TeamLevel,
} from "@/core/team/team.ts";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import {
  importSignersAction,
  removeFileAction,
  saveLevelsAction,
  savePersonAction,
  type TeamState,
} from "./actions.ts";

const PATH = "/admin/configuracoes/equipe";
const IDLE: TeamState = { status: "idle" };

function useToast(state: TeamState, onSaved?: () => void) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new state reports
  useEffect(() => {
    if (state.status === "saved") {
      toast.success(state.message);
      onSaved?.();
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);
}

/** What the form needs of a person already registered. */
export interface PersonView {
  id: string;
  name: string;
  levelId: string;
  profession: string;
  registration: string;
  portariaDate: string;
  showOnSite: boolean;
  imageConsent: boolean;
  canSign: boolean;
  hasPhoto: boolean;
  hasPortaria: boolean;
  portariaName: string;
  hasWord: boolean;
  wordName: string;
}

const fileUrl = (id: string, kind: "photo" | "portaria" | "word") =>
  `${PATH}/arquivo/${id}/${kind}`;

/** Registers a person, or changes one: data, files and what the site shows. */
export function PersonForm({
  levels,
  person,
}: {
  levels: TeamLevel[];
  person?: PersonView;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(savePersonAction, IDLE);
  useToast(state, () => router.push(PATH));
  const uid = useId();
  const [showOnSite, setShowOnSite] = useState(person?.showOnSite ?? false);
  const [portariaChosen, setPortariaChosen] = useState(false);
  const id = (name: string) => `${uid}-${name}`;
  return (
    <>
      <form
        action={action}
        encType="multipart/form-data"
        className="flex flex-col gap-4"
      >
        {person && <input type="hidden" name="id" value={person.id} />}
        <div className="grid gap-3 md:grid-cols-2">
          <label
            htmlFor={id("name")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Nome
            <Input
              id={id("name")}
              name="name"
              required
              maxLength={NAME_MAX}
              defaultValue={person?.name ?? ""}
              className="font-normal"
            />
          </label>
          <label
            htmlFor={id("level")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Cargo (nível da hierarquia)
            <NativeSelect
              id={id("level")}
              name="levelId"
              defaultValue={person?.levelId ?? levels[0]?.id}
              className="font-normal"
            >
              {levels.map((level) => (
                <NativeSelectOption key={level.id} value={level.id}>
                  {level.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label
            htmlFor={id("profession")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Profissão
            <Input
              id={id("profession")}
              name="profession"
              maxLength={SMALL_TEXT_MAX}
              placeholder="Ex.: Bacharela em Direito"
              defaultValue={person?.profession ?? ""}
              className="font-normal"
            />
          </label>
          <label
            htmlFor={id("registration")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Portaria / Matrícula
            <Input
              id={id("registration")}
              name="registration"
              maxLength={SMALL_TEXT_MAX}
              placeholder="Ex.: Portaria nº 006/2024"
              defaultValue={person?.registration ?? ""}
              className="font-normal"
            />
          </label>
          <label
            htmlFor={id("date")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Data da portaria
            <Input
              id={id("date")}
              name="portariaDate"
              type="date"
              defaultValue={person?.portariaDate ?? ""}
              className="font-normal md:w-48"
            />
          </label>
        </div>

        <fieldset className="grid gap-4 rounded-xl border p-4 md:grid-cols-3">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Arquivos
          </legend>
          <div className="flex flex-col gap-2">
            <label
              htmlFor={id("photo")}
              className="text-sm font-medium text-foreground"
            >
              Foto
            </label>
            {person?.hasPhoto && (
              <div className="flex items-center gap-3">
                {/* biome-ignore lint/performance/noImgElement: a private panel route, not an optimizable asset */}
                <img
                  src={`${fileUrl(person.id, "photo")}?v=${person.id}`}
                  alt={`Foto de ${person.name}`}
                  width={56}
                  height={56}
                  className="size-14 rounded-full border object-cover"
                />
                <button
                  type="submit"
                  form={`${uid}-rm-photo`}
                  className="text-xs font-medium text-destructive underline underline-offset-4"
                >
                  Tirar a foto
                </button>
              </div>
            )}
            <input
              id={id("photo")}
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG ou WebP, quadrada, até 2 MB.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={id("portaria")}
              className="text-sm font-medium text-foreground"
            >
              Portaria de nomeação (PDF)
            </label>
            {person?.hasPortaria && (
              <p className="text-xs">
                <a
                  href={fileUrl(person.id, "portaria")}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {person.portariaName || "Portaria anexada"}
                </a>{" "}
                <button
                  type="submit"
                  form={`${uid}-rm-portaria`}
                  className="font-medium text-destructive underline underline-offset-4"
                >
                  Tirar
                </button>
              </p>
            )}
            <input
              id={id("portaria")}
              name="portaria"
              type="file"
              accept="application/pdf"
              className="text-xs"
              onChange={(e) =>
                setPortariaChosen(Boolean(e.target.files?.length))
              }
            />
            <p className="text-xs text-warning-text">
              {PORTARIA_PUBLIC_WARNING}
            </p>
            {(portariaChosen || person?.hasPortaria) && (
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  name="portariaPublic"
                  value="1"
                  required={portariaChosen}
                  className="mt-0.5"
                />
                <span>Confirmo que a portaria pode ser pública.</span>
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={id("word")}
              className="text-sm font-medium text-foreground"
            >
              Word da portaria (uso interno)
            </label>
            {person?.hasWord && (
              <p className="text-xs">
                <a
                  href={fileUrl(person.id, "word")}
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {person.wordName || "Baixar o Word"}
                </a>{" "}
                <button
                  type="submit"
                  form={`${uid}-rm-word`}
                  className="font-medium text-destructive underline underline-offset-4"
                >
                  Tirar
                </button>
              </p>
            )}
            <input
              id={id("word")}
              name="word"
              type="file"
              accept=".docx,.doc,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Fica só aqui no painel. Nunca vai para o site.
            </p>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-sm font-semibold text-foreground">
            O que aparece e o que pode
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="showOnSite"
              value="1"
              defaultChecked={person?.showOnSite ?? false}
              onChange={(e) => setShowOnSite(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Mostrar no site</span>
              <span className="block text-xs text-muted-foreground">
                Desligado: a pessoa fica só no painel. Ligado, o visitante vê o
                nome, o cargo e a profissão.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="imageConsent"
              value="1"
              defaultChecked={person?.imageConsent ?? false}
              className="mt-1"
            />
            <span>
              <span className="font-medium">
                Tenho a autorização de imagem desta pessoa
              </span>
              <span className="block text-xs text-muted-foreground">
                Sem ela, a foto não aparece no site, mesmo enviada
                {showOnSite
                  ? ""
                  : " (e a pessoa nem aparece enquanto não for marcada)"}
                .
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="canSign"
              value="1"
              defaultChecked={person?.canSign ?? false}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Pode assinar documentos</span>
              <span className="block text-xs text-muted-foreground">
                Entra em "Quem assina" (guias, ISS e declarações), com este
                nome, cargo e Portaria/Matrícula.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : person ? "Salvar" : "Cadastrar pessoa"}
          </Button>
          <a href={PATH} className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </a>
        </div>
      </form>
      {/* The "Tirar" buttons above belong to these, by their form attribute: a
        form cannot sit inside another, and a server action's button loses its
        own name, so the kind of file travels in a hidden field here. */}
      {person &&
        (["photo", "portaria", "word"] as const).map((kind) => (
          <form key={kind} id={`${uid}-rm-${kind}`} action={removeFileAction}>
            <input type="hidden" name="id" value={person.id} />
            <input type="hidden" name="kind" value={kind} />
          </form>
        ))}
    </>
  );
}

/** The levels: rename, reorder, add. One with people cannot be taken out. */
export function LevelsEditor({
  levels,
  inUse,
}: {
  levels: TeamLevel[];
  /** The ids of the levels that have people, even archived ones. */
  inUse: string[];
}) {
  const [state, action, pending] = useActionState(saveLevelsAction, IDLE);
  useToast(state);
  const uid = useId();
  const [list, setList] = useState<TeamLevel[]>(levels);
  const move = (index: number, by: -1 | 1) =>
    setList((current) => {
      const to = index + by;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[index], next[to]] = [
        next[to] as TeamLevel,
        next[index] as TeamLevel,
      ];
      return next;
    });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="levels" value={JSON.stringify(list)} />
      <ol className="flex flex-col gap-2">
        {list.map((level, index) => (
          <li key={level.id || `novo-${index}`} className="flex gap-2">
            <Input
              aria-label={`Nome do nível ${index + 1}`}
              id={`${uid}-${index}`}
              value={level.label}
              maxLength={LEVEL_LABEL_MAX}
              onChange={(e) =>
                setList((current) =>
                  current.map((l, i) =>
                    i === index ? { ...l, label: e.target.value } : l,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Subir"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Descer"
              disabled={index === list.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(level.id) && inUse.includes(level.id)}
              title={
                level.id && inUse.includes(level.id)
                  ? "Tem pessoas: mude-as de nível antes de tirar"
                  : "Tirar este nível"
              }
              onClick={() =>
                setList((current) => current.filter((_, i) => i !== index))
              }
            >
              Tirar
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={list.length >= MAX_LEVELS}
          onClick={() =>
            setList((current) => [...current, { id: "", label: "" }])
          }
        >
          + Novo nível
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar níveis"}
        </Button>
      </div>
    </form>
  );
}

/** Brings the old "Quem assina" list into the team, in the same order. */
export function ImportSigners({ count }: { count: number }) {
  const [state, action, pending] = useActionState(importSignersAction, IDLE);
  useToast(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Hoje "Quem assina" tem {count} {count === 1 ? "pessoa" : "pessoas"}.
        Traga-as para a equipe, na mesma ordem, marcadas como "Pode assinar".
        Depois disso, a lista de quem assina passa a vir daqui. Elas ficam só no
        painel até você marcar "Mostrar no site".
      </p>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Trazendo…" : "Trazer quem assina para a equipe"}
        </Button>
      </div>
    </form>
  );
}
