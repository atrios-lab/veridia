"use client";

import {
  useActionState,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  ACTS,
  ATTRIBUTIONS,
  type Attribution,
  emptyRequirement,
  type QualificationData,
  REQUIREMENT_STATUS,
  type Requirement,
  type RequirementStatus,
  reexamView,
} from "@/core/qualificacao/qualificacao.ts";
import { MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  createAction,
  issueAction,
  markAction,
  markLibraryAction,
  proposeAction,
  type QualificationState,
  reexamAction,
  removeNoteAction,
  renumberNoteAction,
  saveAction,
  saveDeadlinesAction,
  saveLibraryAction,
  saveRequirementToLibraryAction,
  sendNoteToRequestAction,
} from "./actions.ts";

const IDLE: QualificationState = { status: "idle" };

/** What the editor needs of a library item. */
export interface LibraryChoice {
  id: string;
  acts: string[];
  title: string;
  description: string;
  howToComply: string;
  basis: string;
}

function ErrorLine({ state }: { state: QualificationState }) {
  return state.status === "error" ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {state.message}
    </p>
  ) : null;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ------------------------------------------------------------ presentation

function PresentationFields({
  data,
  set,
}: {
  data: QualificationData;
  set: (next: QualificationData) => void;
}) {
  const id = useId();
  const acts = ACTS[data.attribution];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-attr`}>Atribuição</Label>
        <NativeSelect
          id={`${id}-attr`}
          value={data.attribution}
          onChange={(e) =>
            set({
              ...data,
              attribution: e.target.value as Attribution,
              act: "",
            })
          }
        >
          {Object.entries(ATTRIBUTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-act`}>Ato pedido</Label>
        <NativeSelect
          id={`${id}-act`}
          value={data.act}
          onChange={(e) => set({ ...data, act: e.target.value })}
        >
          <option value="">Escolha</option>
          {Object.entries(acts).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {data.act === "outro" && (
        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-other`}>Qual ato</Label>
          <Input
            id={`${id}-other`}
            value={data.actOther}
            maxLength={200}
            onChange={(e) => set({ ...data, actOther: e.target.value })}
          />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Apresentante</Label>
        <Input
          id={`${id}-name`}
          value={data.presenter.name}
          maxLength={300}
          onChange={(e) =>
            set({
              ...data,
              presenter: { ...data.presenter, name: e.target.value },
            })
          }
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-doc`}>
          Documento do apresentante (opcional)
        </Label>
        <Input
          id={`${id}-doc`}
          value={data.presenter.document}
          maxLength={200}
          placeholder="CPF ou RG"
          onChange={(e) =>
            set({
              ...data,
              presenter: { ...data.presenter, document: e.target.value },
            })
          }
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-contact`}>Contato (opcional)</Label>
        <Input
          id={`${id}-contact`}
          value={data.presenter.contact}
          maxLength={300}
          placeholder="E-mail ou telefone"
          onChange={(e) =>
            set({
              ...data,
              presenter: { ...data.presenter, contact: e.target.value },
            })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-protocol`}>Protocolo</Label>
          <Input
            id={`${id}-protocol`}
            value={data.protocol}
            maxLength={60}
            placeholder="REQ-2026-000001"
            onChange={(e) => set({ ...data, protocol: e.target.value })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-date`}>Apresentado em</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={data.receivedOn}
            onChange={(e) => set({ ...data, receivedOn: e.target.value })}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-title`}>Título apresentado</Label>
        <Textarea
          id={`${id}-title`}
          rows={2}
          maxLength={2000}
          value={data.document}
          placeholder="Ex.: escritura pública de divórcio, livro e folhas, serventia que lavrou"
          onChange={(e) => set({ ...data, document: e.target.value })}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-object`}>Objeto (o que se pede, opcional)</Label>
        <Textarea
          id={`${id}-object`}
          rows={2}
          value={data.object}
          placeholder="Ex.: averbação do divórcio à margem do assento de casamento"
          onChange={(e) => set({ ...data, object: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Opens a qualificação: the presentation only; the exigências come next. */
export function NewQualificationForm({
  initial,
}: {
  initial: QualificationData;
}) {
  const [data, setData] = useState(initial);
  const [state, action, pending] = useActionState(createAction, IDLE);
  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-xl border border-primary/25 bg-primary/5 p-6"
    >
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      <PresentationFields data={data} set={setData} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Abrindo..." : "Abrir a qualificação"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

/** The presentation, the fundamentos and the observações, corrected. */
export function PresentationForm({
  id,
  initial,
  issued,
}: {
  id: string;
  initial: QualificationData;
  issued: boolean;
}) {
  const [data, setData] = useState(initial);
  const [state, action, pending] = useActionState(saveAction, IDLE);
  const fid = useId();
  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-xs"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="voltar" value="ficha" />
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      <PresentationFields data={data} set={setData} />
      <TextBlocks data={data} set={setData} />
      {issued && (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-why`}>
            Justificativa (já há nota emitida; vai para a auditoria)
          </Label>
          <Input
            id={`${fid}-why`}
            name="justificativa"
            required
            minLength={MIN_JUSTIFICATION}
          />
        </div>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

/** The general fundamentos (one paragraph each) and the observações. */
function TextBlocks({
  data,
  set,
}: {
  data: QualificationData;
  set: (next: QualificationData) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-fund`}>
          Fundamentos gerais da nota (um parágrafo por linha em branco)
        </Label>
        <Textarea
          id={`${id}-fund`}
          rows={6}
          value={data.fundamentals.join("\n\n")}
          onChange={(e) =>
            set({
              ...data,
              fundamentals: e.target.value.split(/\n\s*\n/),
            })
          }
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-obs`}>Observações (opcional)</Label>
        <Textarea
          id={`${id}-obs`}
          rows={3}
          value={data.observations}
          onChange={(e) => set({ ...data, observations: e.target.value })}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------ the round

function RequirementCard({
  r,
  index,
  roundN,
  onChange,
  onRemove,
  attribution,
  act,
}: {
  r: Requirement;
  index: number;
  roundN: number;
  onChange: (next: Requirement) => void;
  onRemove?: () => void;
  /** Where "Guardar na biblioteca" files the exigência. */
  attribution: string;
  act: string;
}) {
  const id = useId();
  const [saving, startSaving] = useTransition();
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const complete = Boolean(
    r.title.trim() && r.howToComply.trim() && r.basis.trim(),
  );
  const saveToLibrary = () =>
    startSaving(async () => {
      const result = await saveRequirementToLibraryAction({
        attribution,
        act,
        title: r.title,
        description: r.description,
        howToComply: r.howToComply,
        basis: r.basis,
      });
      if (result.status === "saved") {
        setSavedToLibrary(true);
        toast.success(result.message);
      } else if (result.status === "error") {
        toast.error(result.message);
      }
    });
  const carried = r.round < roundN;
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {index + 1}. {r.title || "Exigência nova"}
        </p>
        <span className="text-xs text-muted-foreground">
          {r.fromAi && (
            <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-foreground">
              {carried
                ? "Situação sugerida pelo Assistente Virtual"
                : "Proposta pelo Assistente Virtual"}
            </span>
          )}
          {carried
            ? `Da ${r.round}ª qualificação`
            : roundN > 1
              ? "Nova neste reexame"
              : r.libraryId
                ? "Da biblioteca"
                : "Redigida"}
        </span>
      </div>
      {carried && (
        <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-status`}>Situação</Label>
            <NativeSelect
              id={`${id}-status`}
              value={r.status}
              onChange={(e) =>
                onChange({ ...r, status: e.target.value as RequirementStatus })
              }
            >
              {Object.entries(REQUIREMENT_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-note`}>O que se viu no reexame</Label>
            <Input
              id={`${id}-note`}
              value={r.note}
              onChange={(e) => onChange({ ...r, note: e.target.value })}
            />
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-title`}>Título</Label>
          <Input
            id={`${id}-title`}
            value={r.title}
            maxLength={300}
            disabled={carried}
            onChange={(e) => onChange({ ...r, title: e.target.value })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-ref`}>Refere-se a (agrupa na nota)</Label>
          <Input
            id={`${id}-ref`}
            value={r.reference}
            maxLength={200}
            disabled={carried}
            placeholder="Ex.: Escritura, Requerente, Certidão de casamento"
            onChange={(e) => onChange({ ...r, reference: e.target.value })}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-desc`}>O que falta ou está errado</Label>
        <Textarea
          id={`${id}-desc`}
          rows={3}
          value={r.description}
          disabled={carried}
          onChange={(e) => onChange({ ...r, description: e.target.value })}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-how`}>Como cumprir</Label>
        <Textarea
          id={`${id}-how`}
          rows={2}
          value={r.howToComply}
          disabled={carried}
          onChange={(e) => onChange({ ...r, howToComply: e.target.value })}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-basis`}>Fundamento</Label>
        <Input
          id={`${id}-basis`}
          value={r.basis}
          maxLength={1000}
          disabled={carried}
          onChange={(e) => onChange({ ...r, basis: e.target.value })}
        />
      </div>
      {r.fromAi && r.excerpt && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground text-justify hyphens-auto">
          Trecho do título que motivou: “{r.excerpt}”
        </p>
      )}
      {r.fromAi && (
        <label className="flex items-start gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={r.reviewed}
            onChange={(e) => onChange({ ...r, reviewed: e.target.checked })}
          />
          <span className="text-justify hyphens-auto">
            Conferi esta exigência proposta pelo Assistente Virtual: o fato, o
            fundamento e a redação estão certos.
          </span>
        </label>
      )}
      {!carried && roundN > 1 && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={r.fromNewDocument}
            onChange={(e) =>
              onChange({ ...r, fromNewDocument: e.target.checked })
            }
          />
          <span className="text-justify hyphens-auto">
            Decorre de documento apresentado só agora, na reapresentação.
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!r.libraryId && !savedToLibrary && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!complete || saving}
            onClick={saveToLibrary}
            title={
              complete
                ? "Vira modelo para as próximas qualificações deste ato"
                : "Preencha título, como cumprir e fundamento para guardar"
            }
          >
            {saving ? "Guardando..." : "Guardar na biblioteca"}
          </Button>
        )}
        {(r.libraryId || savedToLibrary) && (
          <span className="text-xs text-muted-foreground">
            {savedToLibrary ? "Guardada na biblioteca." : "Veio da biblioteca."}
          </span>
        )}
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Tirar esta exigência
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * The open round: the exigências from the library or written, the
 * situation of those that came back, the fundamentos and observações.
 */
export function RoundEditor({
  id,
  initial,
  library,
}: {
  id: string;
  initial: QualificationData;
  library: LibraryChoice[];
}) {
  const [data, setData] = useState(initial);
  const [pick, setPick] = useState("");
  const [onlyAct, setOnlyAct] = useState(true);
  const [state, action, pending] = useActionState(saveAction, IDLE);
  const fid = useId();
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  const index = data.rounds.length - 1;
  const round = data.rounds[index];
  if (!round) return null;
  const setRequirements = (requirements: Requirement[]) =>
    setData({
      ...data,
      rounds: data.rounds.map((r, i) =>
        i === index ? { ...r, requirements } : r,
      ),
    });
  const choices = library.filter(
    (l) =>
      !round.requirements.some((r) => r.libraryId === l.id) &&
      (!onlyAct || l.acts.length === 0 || l.acts.includes(data.act)),
  );
  const add = (from?: LibraryChoice) => {
    const base = emptyRequirement(newId(), round.n);
    setRequirements([
      ...round.requirements,
      from
        ? {
            ...base,
            libraryId: from.id,
            title: from.title,
            description: from.description,
            howToComply: from.howToComply,
            basis: from.basis,
          }
        : base,
    ]);
  };
  const view = round.n > 1 ? reexamView(data) : null;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {round.n > 1
              ? `Reexame (${round.n}ª qualificação)`
              : "Exigências desta qualificação"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            Formule todas as exigências de uma só vez, cada uma com o que falta,
            como cumprir e o fundamento. Sem exigência pendente, emita a
            qualificação positiva.
          </p>
        </div>
        {round.aiNote && (
          <p className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground text-justify hyphens-auto">
            <strong className="font-medium">
              Resumo do Assistente Virtual:{" "}
            </strong>
            {round.aiNote}
          </p>
        )}
        {round.requirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma exigência ainda.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {round.requirements.map((r, i) => (
              <RequirementCard
                key={r.id}
                r={r}
                index={i}
                roundN={round.n}
                attribution={data.attribution}
                act={data.act}
                onChange={(next) =>
                  setRequirements(
                    round.requirements.map((x) => (x.id === r.id ? next : x)),
                  )
                }
                onRemove={
                  r.round === round.n
                    ? () =>
                        setRequirements(
                          round.requirements.filter((x) => x.id !== r.id),
                        )
                    : undefined
                }
              />
            ))}
          </ol>
        )}
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
          <Label htmlFor={`${fid}-lib`}>Acrescentar da biblioteca</Label>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              id={`${fid}-lib`}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="min-w-0 flex-1"
            >
              <option value="">Escolha a exigência</option>
              {choices.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              disabled={!pick}
              onClick={() => {
                const chosen = library.find((l) => l.id === pick);
                if (chosen) add(chosen);
                setPick("");
              }}
            >
              Acrescentar
            </Button>
            <Button type="button" variant="outline" onClick={() => add()}>
              Escrever exigência nova
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyAct}
              onChange={(e) => setOnlyAct(e.target.checked)}
            />
            Mostrar só as do ato pedido
          </label>
        </div>
        {view?.warnings.length ? (
          <ul
            aria-live="polite"
            className="flex list-disc flex-col gap-1 rounded-lg border border-warning/30 bg-warning-soft py-3 pr-4 pl-8 text-sm text-foreground"
          >
            {view.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="rounded-xl border bg-card p-6 shadow-xs">
        <TextBlocks data={data} set={setData} />
      </section>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar as exigências"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

// ------------------------------------------------------------ issue, reexam

export function IssueForm({
  id,
  kind,
  today,
  problems,
  signer,
}: {
  id: string;
  kind: "devolutiva" | "positiva";
  today: string;
  /** Why it cannot go out yet; empty when it can. */
  problems: string[];
  signer: { name: string; role: string };
}) {
  const [state, action, pending] = useActionState(issueAction, IDLE);
  const fid = useId();
  const label =
    kind === "devolutiva"
      ? "Emitir a nota devolutiva"
      : "Emitir a qualificação positiva";
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={kind} />
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-date`}>Data</Label>
          <Input
            id={`${fid}-date`}
            name="data"
            type="date"
            defaultValue={today}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-who`}>Quem assina</Label>
          <Input
            id={`${fid}-who`}
            name="assinante"
            defaultValue={signer.name}
            placeholder="Vazio: o titular"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-role`}>Cargo</Label>
          <Input
            id={`${fid}-role`}
            name="cargo"
            defaultValue={signer.role}
            placeholder="Escrevente, substituto..."
          />
        </div>
      </div>
      {problems.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div>
        <Button
          type="submit"
          variant={kind === "devolutiva" ? "default" : "outline"}
          disabled={pending || problems.length > 0}
        >
          {pending ? "Emitindo..." : label}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function ReexamForm({ id, today }: { id: string; today: string }) {
  const [state, action, pending] = useActionState(reexamAction, IDLE);
  const fid = useId();
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-5"
    >
      <input type="hidden" name="id" value={id} />
      <h2 className="text-base font-semibold text-foreground">
        O título voltou? Registre a reapresentação
      </h2>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-date`}>Data</Label>
          <Input
            id={`${fid}-date`}
            name="data"
            type="date"
            defaultValue={today}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-docs`}>O que veio junto</Label>
          <Input
            id={`${fid}-docs`}
            name="documentos"
            placeholder="Ex.: certidão de casamento atualizada e procuração"
          />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Abrindo o reexame..." : "Abrir o reexame"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

// ------------------------------------------------------------ notes, marks

export function RemoveNoteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeNoteAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta nota?"
      consequence="Ela fica guardada com o número, que não é usado de novo, e a rodada volta a ficar aberta para corrigir e emitir outra."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function RenumberNoteButton({
  id,
  qualificationId,
  sequence,
}: {
  id: string;
  qualificationId: string;
  sequence: number;
}) {
  const [state, action, pending] = useActionState(renumberNoteAction, IDLE);
  const base = useId();
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Modificar numeração"
      triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
      question="Qual número esta nota deve ter?"
      consequence="Só aceita um número do ano que nenhuma outra nota do mesmo tipo use. A mudança vai para a auditoria."
      confirmLabel="Mudar número"
      pendingLabel="Mudando..."
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="qualificacao" value={qualificationId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-sequence`}>Novo número</Label>
        <Input
          id={`${base}-sequence`}
          name="sequence"
          inputMode="numeric"
          defaultValue={String(sequence)}
          required
        />
      </div>
    </ConfirmAction>
  );
}

export function MarkQualificationButton({
  id,
  restore = false,
}: {
  id: string;
  restore?: boolean;
}) {
  const [state, action, pending] = useActionState(markAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger={restore ? "Estornar a exclusão" : "Excluir a qualificação"}
      triggerClassName={
        restore ? buttonVariants({ variant: "outline", size: "sm" }) : undefined
      }
      question={
        restore
          ? "Trazer esta qualificação de volta?"
          : "Excluir esta qualificação?"
      }
      consequence={
        restore
          ? "Ela volta para a lista, com as notas que já tinha."
          : "Ela sai da lista, mas fica guardada com as notas, com quem excluiu, quando e por quê, e pode ser estornada."
      }
      confirmLabel={restore ? "Estornar" : "Excluir"}
      pendingLabel={restore ? "Estornando..." : "Excluindo..."}
    >
      <input type="hidden" name="id" value={id} />
      {restore && <input type="hidden" name="estornar" value="1" />}
    </ConfirmAction>
  );
}

// ------------------------------------------------------------ library

export function LibraryItemForm({
  item,
}: {
  item?: LibraryChoice & { attribution: Attribution };
}) {
  const [attribution, setAttribution] = useState<Attribution>(
    item?.attribution ?? "rcpn",
  );
  const [state, action, pending] = useActionState(saveLibraryAction, IDLE);
  const id = useId();
  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-attr`}>Atribuição</Label>
          <NativeSelect
            id={`${id}-attr`}
            name="atribuicao"
            value={attribution}
            onChange={(e) => setAttribution(e.target.value as Attribution)}
          >
            {Object.entries(ATTRIBUTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-title`}>Título</Label>
          <Input
            id={`${id}-title`}
            name="titulo"
            maxLength={300}
            required
            defaultValue={item?.title}
          />
        </div>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-foreground">
          Atos (nenhum marcado: serve a todos da atribuição)
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
          {Object.entries(ACTS[attribution]).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="atos"
                value={value}
                defaultChecked={item?.acts.includes(value) ?? false}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-desc`}>O que falta ou está errado</Label>
        <Textarea
          id={`${id}-desc`}
          name="descricao"
          rows={3}
          required
          defaultValue={item?.description}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-how`}>Como cumprir</Label>
        <Textarea
          id={`${id}-how`}
          name="cumprimento"
          rows={2}
          required
          defaultValue={item?.howToComply}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-basis`}>Fundamento</Label>
        <Input
          id={`${id}-basis`}
          name="fundamento"
          maxLength={1000}
          required
          defaultValue={item?.basis}
        />
      </div>
      {item && (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-why`}>
            Justificativa (vai para a auditoria)
          </Label>
          <Input
            id={`${id}-why`}
            name="justificativa"
            required
            minLength={MIN_JUSTIFICATION}
          />
        </div>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Salvando..."
            : item
              ? "Salvar a alteração"
              : "Criar a exigência"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function MarkLibraryButton({
  id,
  attribution,
  restore = false,
}: {
  id: string;
  attribution: Attribution;
  restore?: boolean;
}) {
  const [state, action, pending] = useActionState(markLibraryAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger={restore ? "Estornar" : "Excluir"}
      triggerClassName={
        restore ? buttonVariants({ variant: "outline", size: "sm" }) : undefined
      }
      question={
        restore
          ? "Trazer esta exigência de volta?"
          : "Excluir esta exigência da biblioteca?"
      }
      consequence={
        restore
          ? "Ela volta a aparecer na biblioteca."
          : "Ela deixa de aparecer na biblioteca, mas fica guardada; as notas já emitidas não mudam."
      }
      confirmLabel={restore ? "Estornar" : "Excluir"}
      pendingLabel={restore ? "Estornando..." : "Excluindo..."}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="atribuicao" value={attribution} />
      {restore && <input type="hidden" name="estornar" value="1" />}
    </ConfirmAction>
  );
}

// ------------------------------------------------------------ deadlines

export function DeadlinesForm({
  rows,
}: {
  rows: {
    attribution: Attribution;
    lawDays: number | null;
    lawBasis: string;
    mode: "lei" | "sem" | "proprio";
    days: number | null;
  }[];
}) {
  const [state, action, pending] = useActionState(saveDeadlinesAction, IDLE);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  const [modes, setModes] = useState(
    Object.fromEntries(rows.map((r) => [r.attribution, r.mode])),
  );
  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs"
    >
      <ul className="flex flex-col divide-y">
        {rows.map((r) => (
          <li key={r.attribution} className="flex flex-col gap-2 py-3">
            <p className="text-sm font-semibold text-foreground">
              {ATTRIBUTIONS[r.attribution]}
            </p>
            <p className="text-xs text-muted-foreground text-justify hyphens-auto">
              Sugestão: {r.lawDays ? `${r.lawDays} dias úteis` : "sem prazo"}.{" "}
              {r.lawBasis}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {(
                [
                  ["lei", "Usar a sugestão"],
                  ["proprio", "Prazo da serventia"],
                  ["sem", "Sem prazo"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`modo-${r.attribution}`}
                    value={value}
                    checked={modes[r.attribution] === value}
                    onChange={() =>
                      setModes({ ...modes, [r.attribution]: value })
                    }
                  />
                  {label}
                </label>
              ))}
              {modes[r.attribution] === "proprio" && (
                <span className="flex items-center gap-2">
                  <Input
                    name={`dias-${r.attribution}`}
                    inputMode="numeric"
                    defaultValue={r.days ? String(r.days) : ""}
                    className="w-20"
                    aria-label={`Dias úteis: ${ATTRIBUTIONS[r.attribution]}`}
                  />
                  dias úteis
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar os prazos"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

/**
 * The AI's proposal, asked with a button (no question is typed): the
 * título's files go to the AI and are dropped; what comes back is a draft.
 */
export function AiProposeForm({
  id,
  blocked,
  protocol = "",
  clientDocuments = [],
}: {
  id: string;
  /** Why the AI cannot run now, or null. */
  blocked: string | null;
  /** The pedido this qualification came from, if any. */
  protocol?: string;
  /** What the client attached to that pedido: read without a new upload. */
  clientDocuments?: string[];
}) {
  const [state, action, pending] = useActionState(proposeAction, IDLE);
  const fid = useId();
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-5"
    >
      <input type="hidden" name="id" value={id} />
      <h2 className="text-base font-semibold text-foreground">
        Proposta do Assistente Virtual (opcional)
      </h2>
      <p className="text-sm text-muted-foreground text-justify hyphens-auto">
        O Assistente Virtual lê os documentos que o cliente anexou no pedido e
        os que você anexar aqui, consulta a biblioteca e a base jurídica da
        serventia, confere só nos sites oficiais e propõe as exigências como
        rascunho. Nada sai sem você conferir cada uma. Os arquivos anexados aqui
        não ficam guardados.
      </p>
      {clientDocuments.length > 0 ? (
        <div className="rounded-lg border bg-card px-3.5 py-2.5 text-sm">
          <span className="font-medium text-foreground">
            Documentos do cliente no pedido {protocol} (lidos automaticamente)
          </span>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
            {clientDocuments.map((name, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: names can repeat; the list is fixed
              <li key={`${name}-${i}`} className="[overflow-wrap:anywhere]">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : protocol.trim() ? (
        <p className="text-xs text-muted-foreground">
          O pedido {protocol} não tem documentos do cliente disponíveis: anexe o
          título abaixo.
        </p>
      ) : null}
      {blocked ? (
        <p className="text-sm text-muted-foreground">{blocked}</p>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${fid}-files`}>
              {clientDocuments.length > 0
                ? "Outro documento (opcional)"
                : "Título e documentos"}
            </Label>
            <Input
              id={`${fid}-files`}
              name="titulo"
              type="file"
              multiple
              accept=".pdf,.docx,.odt,.rtf,.txt,.zip,.jpg,.jpeg,.png,.gif,.webp"
            />
            <p className="text-xs text-muted-foreground">
              PDF (inclusive digitalizado), Word, fotos ou ZIP. Até 30 MB no
              total.
            </p>
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending
                ? "O Assistente Virtual está lendo os documentos..."
                : "Pedir a proposta ao Assistente Virtual"}
            </Button>
          </div>
        </>
      )}
      <ErrorLine state={state} />
    </form>
  );
}

/**
 * The nota devolutiva to the client through the pedido (decision of
 * 15/11/2026: "que ofereça todas as opções"): the exigência as text, the
 * way the office writes it today, with the note's PDF and/or another file
 * attached if wanted. Printing and editing stay with the buttons above.
 */
export function SendNoteForm({
  noteId,
  protocol,
  initialText,
  requestHref,
  certificates = [],
  signHref,
}: {
  noteId: string;
  protocol: string;
  /** The exigências of the note, ready to send and editable. */
  initialText: string;
  requestHref: string;
  /** The person's A1 certificates, to sign the note's PDF here. */
  certificates?: { id: string; label: string }[];
  /** The assinador with this note (A1 or A3 token), to sign there. */
  signHref: string;
}) {
  const [state, action, pending] = useActionState(
    sendNoteToRequestAction,
    IDLE,
  );
  const [text, setText] = useState(initialText);
  const [pdfMode, setPdfMode] = useState("sem-assinatura");
  const fid = useId();
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  return (
    <details className="rounded-lg border bg-muted/30 px-3.5 py-2.5">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Enviar ao cliente pelo pedido {protocol}
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="noteId" value={noteId} />
        <p className="text-xs text-muted-foreground text-justify hyphens-auto">
          Escolha como a nota chega ao cliente: como texto na exigência do
          pedido (como se escreve hoje), com a nota em PDF anexada, com outro
          arquivo (por exemplo, a nota já assinada), ou tudo junto. Para
          imprimir ou editar, use os botões de PDF e Word acima.
        </p>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-text`}>
            Texto da exigência (o cliente lê na consulta do pedido)
          </Label>
          <Textarea
            id={`${fid}-text`}
            name="text"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="field-sizing-fixed bg-background"
          />
        </div>
        <fieldset className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5">
          <legend className="px-1 text-sm font-medium text-foreground">
            A nota em PDF
          </legend>
          {[
            ["sem-assinatura", "Anexar o PDF sem assinatura digital"],
            ["a1", "Assinar digitalmente com o meu certificado A1 e anexar"],
            [
              "pessoalmente",
              "Imprimir, assinar à mão e entregar ao cliente pessoalmente",
            ],
            [
              "nenhum",
              "Não anexar o PDF (só o texto e, se quiser, um arquivo)",
            ],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <input
                type="radio"
                name="pdfModo"
                value={value}
                checked={pdfMode === value}
                onChange={() => setPdfMode(value)}
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          ))}
          {pdfMode === "a1" &&
            (certificates.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={`${fid}-cert`}>Certificado</Label>
                  <NativeSelect id={`${fid}-cert`} name="certificateId">
                    {certificates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={`${fid}-pass`}>Senha do certificado</Label>
                  <Input
                    id={`${fid}-pass`}
                    name="password"
                    type="password"
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-justify hyphens-auto">
                Você não tem certificado A1 liberado na plataforma. Assine no{" "}
                <a
                  href={signHref}
                  className="font-medium text-primary underline"
                >
                  assinador
                </a>{" "}
                (A1 ou A3 no token), baixe o PDF assinado e anexe abaixo, em
                "Anexar outro arquivo", marcando "Não anexar o PDF".
              </p>
            ))}
          {pdfMode === "pessoalmente" && (
            <p className="text-xs text-muted-foreground text-justify hyphens-auto">
              Use "Imprimir para assinar à mão" ou "Word" acima. A exigência
              fica registrada no pedido com a observação de que a nota foi
              entregue pessoalmente. Se preferir, digitalize a nota assinada e
              anexe abaixo.
            </p>
          )}
        </fieldset>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${fid}-file`}>Anexar outro arquivo (opcional)</Label>
          <Input
            id={`${fid}-file`}
            name="arquivo"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          />
          <p className="text-xs text-muted-foreground">
            Por exemplo, a nota digitalizada depois de assinada à mão, ou
            assinada no assinador com certificado A3.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending || !text.trim()}>
            {pending
              ? pdfMode === "a1"
                ? "Assinando e registrando..."
                : "Registrando..."
              : "Registrar a exigência no pedido"}
          </Button>
          <a
            href={requestHref}
            className={buttonVariants({ variant: "outline" })}
          >
            Abrir o pedido
          </a>
        </div>
        <ErrorLine state={state} />
      </form>
    </details>
  );
}
