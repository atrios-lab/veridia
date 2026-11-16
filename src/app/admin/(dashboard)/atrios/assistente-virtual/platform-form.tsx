"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  NOTE_REVIEW_MODES,
  type NoteReviewMode,
  type PlatformScope,
} from "@/core/qualificacao/revisao-base.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { type PlatformState, setAiPlatformAction } from "./actions.ts";

export interface OfficeRow {
  slug: string;
  name: string;
  aiAllowed: boolean;
  noteReview: NoteReviewMode;
  /** The Tabelião's own switch. */
  officeEnabled: boolean;
  changedLabel?: string;
  reason?: string;
}

const IDLE: PlatformState = { status: "idle" };

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * One form for every office (decision of 16/11/2026): to whom (this
 * portal's office, all, or a selection found by name in a folded list) and
 * what (the AI, the notes' review, or both). Only the options that apply to
 * the choice show.
 */
export function PlatformForm({
  offices,
  current,
}: {
  offices: OfficeRow[];
  /** The office of the portal this account is on, when it is one. */
  current?: { slug: string; name: string };
}) {
  const [state, action, pending] = useActionState(setAiPlatformAction, IDLE);
  const [scope, setScope] = useState<PlatformScope>(
    current ? "esta" : "escolher",
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(!current);
  const [query, setQuery] = useState("");
  const [changeAi, setChangeAi] = useState(true);
  const [changeNotes, setChangeNotes] = useState(false);
  const [ai, setAi] = useState<"liberada" | "suspensa">("suspensa");
  const [notes, setNotes] = useState<NoteReviewMode>("base");

  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? offices.filter((o) => fold(o.name).includes(q)) : offices;
  }, [offices, query]);

  const targets =
    scope === "todas"
      ? offices
      : scope === "esta"
        ? offices.filter((o) => o.slug === current?.slug)
        : offices.filter((o) => chosen.includes(o.slug));

  const toggle = (slug: string) =>
    setChosen((list) =>
      list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug],
    );
  /** "Alterar só esta" on a row of the list below. */
  const pickOnly = (slug: string) => {
    setScope("escolher");
    setChosen([slug]);
    setListOpen(true);
    document
      .getElementById("aplicar")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const summary = [
    changeAi
      ? `Assistente Virtual ${ai === "liberada" ? "liberado" : "suspenso"}`
      : "",
    changeNotes ? `análise das notas: ${NOTE_REVIEW_MODES[notes].label}` : "",
  ]
    .filter(Boolean)
    .join(" e ");

  return (
    <>
      <form
        id="aplicar"
        action={action}
        className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-xs"
      >
        {/* 1. To whom. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-foreground">
            1. Aplicar a
          </legend>
          {current && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="escopo"
                value="esta"
                checked={scope === "esta"}
                onChange={() => setScope("esta")}
              />
              Só esta serventia ({current.name})
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="escopo"
              value="todas"
              checked={scope === "todas"}
              onChange={() => setScope("todas")}
            />
            Todas as serventias ({offices.length})
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="escopo"
              value="escolher"
              checked={scope === "escolher"}
              onChange={() => {
                setScope("escolher");
                setListOpen(true);
              }}
            />
            Escolher serventias
            {chosen.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({chosen.length} marcada{chosen.length === 1 ? "" : "s"})
              </span>
            )}
          </label>
          {scope === "escolher" && (
            <div className="ml-6 rounded-lg border">
              <button
                type="button"
                onClick={() => setListOpen((o) => !o)}
                aria-expanded={listOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm"
              >
                <span>
                  {chosen.length
                    ? `${chosen.length} serventia${chosen.length === 1 ? "" : "s"} marcada${chosen.length === 1 ? "" : "s"}`
                    : "Nenhuma serventia marcada"}
                </span>
                <AdminIcon
                  name="chevronDown"
                  className={`size-4 text-muted-foreground transition-transform ${listOpen ? "rotate-180" : ""}`}
                />
              </button>
              {listOpen && (
                <div className="flex flex-col gap-2 border-t p-3">
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar pelo nome da serventia"
                    aria-label="Buscar serventia pelo nome"
                  />
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() =>
                        setChosen((list) => [
                          ...new Set([...list, ...filtered.map((o) => o.slug)]),
                        ])
                      }
                    >
                      Marcar {query ? "as encontradas" : "todas"}
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setChosen([])}
                    >
                      Desmarcar todas
                    </button>
                  </div>
                  <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                    {filtered.map((o) => (
                      <li key={o.slug}>
                        <label className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={chosen.includes(o.slug)}
                            onChange={() => toggle(o.slug)}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {o.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {o.aiAllowed ? "liberado" : "suspenso"}
                          </span>
                        </label>
                      </li>
                    ))}
                    {filtered.length === 0 && (
                      <li className="px-1 py-1 text-sm text-muted-foreground">
                        Nenhuma serventia com esse nome.
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {chosen.map((slug) => (
                <input key={slug} type="hidden" name="serventia" value={slug} />
              ))}
            </div>
          )}
        </fieldset>

        {/* 2. What. */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-foreground">
            2. O que alterar
          </legend>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="alterarIa"
              value="1"
              checked={changeAi}
              onChange={(e) => setChangeAi(e.target.checked)}
            />
            Assistente Virtual em geral
          </label>
          {changeAi && (
            <div className="ml-6 flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="ia"
                  value="liberada"
                  checked={ai === "liberada"}
                  onChange={() => setAi("liberada")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Liberar</span>
                  <span className="block text-xs text-muted-foreground">
                    A serventia usa o Assistente Virtual onde o Tabelião deixou
                    ligado.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="ia"
                  value="suspensa"
                  checked={ai === "suspensa"}
                  onChange={() => setAi("suspensa")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Suspender</span>
                  <span className="block text-xs text-muted-foreground">
                    Nenhuma chamada ao Assistente Virtual e nenhum crédito gasto
                    (qualificação, DPO, base jurídica, tirar dúvida, análise das
                    notas). A serventia vê só que o Assistente Virtual está
                    indisponível no momento.
                  </span>
                </span>
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="alterarNotas"
              value="1"
              checked={changeNotes}
              onChange={(e) => setChangeNotes(e.target.checked)}
            />
            Análise das notas anexadas às exigências
          </label>
          {changeNotes && (
            <div className="ml-6 flex flex-col gap-2">
              {(Object.keys(NOTE_REVIEW_MODES) as NoteReviewMode[]).map(
                (mode) => (
                  <label key={mode} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="analise"
                      value={mode}
                      checked={notes === mode}
                      onChange={() => setNotes(mode)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">
                        {NOTE_REVIEW_MODES[mode].label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {NOTE_REVIEW_MODES[mode].description}
                      </span>
                    </span>
                  </label>
                ),
              )}
              {changeAi && ai === "suspensa" && notes === "ia" && (
                <p className="text-xs text-warning-text">
                  Com o Assistente Virtual suspenso, a opção &quot;Com o
                  Assistente Virtual&quot; funciona como &quot;Só pela base
                  jurídica&quot;: nada é cobrado.
                </p>
              )}
            </div>
          )}
        </fieldset>

        {/* 3. Why, and go. */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <label
            htmlFor="motivo-ia"
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Motivo (fica na auditoria da plataforma)
            <Input
              id="motivo-ia"
              name="motivo"
              maxLength={300}
              placeholder="Ex.: teto de gasto do mês atingido"
              className="font-normal"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            {targets.length === 0 || !summary
              ? "Escolha a quem aplicar e o que alterar."
              : `Vai aplicar ${summary} a ${
                  targets.length === 1
                    ? (targets[0]?.name ?? "1 serventia")
                    : `${targets.length} serventias`
                }.`}
          </p>
          <div>
            <Button
              type="submit"
              disabled={pending || targets.length === 0 || !summary}
            >
              {pending ? "Aplicando…" : "Aplicar"}
            </Button>
          </div>
        </div>
      </form>

      <OfficeStatus offices={offices} onPickOnly={pickOnly} />
    </>
  );
}

/** How every office stands now, searchable, folded until opened. */
function OfficeStatus({
  offices,
  onPickOnly,
}: {
  offices: OfficeRow[];
  onPickOnly: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const suspended = offices.filter((o) => !o.aiAllowed).length;
  const shown = offices.filter((o) =>
    fold(o.name).includes(fold(query.trim())),
  );
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <span className="flex flex-col">
          <span className="text-base font-semibold text-foreground">
            Situação das serventias
          </span>
          <span className="text-xs text-muted-foreground">
            {offices.length} serventias · {suspended} com o Assistente Virtual
            suspenso
          </span>
        </span>
        <AdminIcon
          name="chevronDown"
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t px-5 py-4">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pelo nome da serventia"
            aria-label="Buscar na situação das serventias"
          />
          <ul className="flex flex-col divide-y">
            {shown.map((o) => (
              <li
                key={o.slug}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 font-medium text-foreground">
                  {o.name}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.aiAllowed ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text"}`}
                >
                  Assistente Virtual {o.aiAllowed ? "liberado" : "suspenso"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {NOTE_REVIEW_MODES[o.noteReview].label} · botão do Tabelião:{" "}
                  {o.officeEnabled ? "ligado" : "desligado"}
                </span>
                <button
                  type="button"
                  onClick={() => onPickOnly(o.slug)}
                  className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Alterar só esta
                </button>
                {(o.changedLabel || o.reason) && (
                  <span className="basis-full text-xs text-muted-foreground">
                    {o.changedLabel}
                    {o.reason ? ` · ${o.reason}` : ""}
                  </span>
                )}
              </li>
            ))}
            {shown.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">
                Nenhuma serventia com esse nome.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
