"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  ROUTING_PRIORITY_LABELS,
  ROUTING_PURPOSE_LABELS,
  type RoutingPriority,
  type RoutingPurpose,
} from "@/core/routing/routing.ts";
import { Button } from "../../../../_ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../_ui/dialog.tsx";
import {
  type RoutingActionState,
  receiveAction,
  returnAction,
  routeAction,
  setCitizenLineAction,
  takeAction,
  withdrawRoutingAction,
} from "../routing-actions.ts";

export interface RoutingPerson {
  id: string;
  name: string;
  initials: string;
  sectorIds: string[];
  available: boolean;
  /** May sign and conclude, by the office's choice. */
  mayConclude: boolean;
}

export interface RoutingService {
  id: string;
  name: string;
  group: string;
}

export interface RoutingCurrent {
  id: string;
  holderName: string | null;
  holderInitials: string;
  sectorLabel: string | null;
  sectorId: string | null;
  toUserId: string | null;
  purpose: RoutingPurpose;
  priority: RoutingPriority;
  actId: string | null;
  serviceName: string | null;
  dueLabel: string | null;
  dueInput: string;
  overdue: boolean;
  note: string;
  pending: boolean;
  receivedLabel: string | null;
  canReceive: boolean;
  canChange: boolean;
  canReturn: boolean;
  mine: boolean;
}

export interface RoutingHistoryEntry {
  key: string;
  text: string;
  atLabel: string;
  note?: string;
  struck?: boolean;
  tone?: "edit" | "warn";
}

const PRIORITY_CHIP: Record<RoutingPriority, string> = {
  normal: "border bg-muted text-muted-foreground",
  attention: "border border-warning/40 bg-warning-soft text-warning-text",
  urgent: "border border-destructive/40 bg-destructive-soft text-destructive",
};

function useFeedback(state: RoutingActionState, onSuccess?: () => void) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess?.();
    }
    if (state.status === "error") toast.error(state.message);
  }, [state, onSuccess]);
}

function Chip({
  on,
  children,
  onClick,
  className = "",
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
        on
          ? "border-primary bg-primary text-primary-foreground"
          : `bg-background hover:bg-muted ${className}`
      }`}
    >
      {children}
    </button>
  );
}

/** The "Direcionar" window: who, which sector, what for, and how urgent. */
function RouteDialog({
  open,
  onClose,
  requestId,
  protocolNumber,
  people,
  sectors,
  services,
  restricted,
  editing,
  citizenPreview,
  presetPurpose,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string;
  protocolNumber: string;
  people: RoutingPerson[];
  sectors: { id: string; label: string }[];
  services: RoutingService[];
  restricted: boolean;
  editing: RoutingCurrent | null;
  citizenPreview: boolean;
  presetPurpose?: RoutingPurpose;
}) {
  const [state, action, pending] = useActionState<RoutingActionState, FormData>(
    routeAction,
    { status: "idle" },
  );
  const [sectorId, setSectorId] = useState(
    editing?.sectorId ?? sectors[0]?.id ?? "",
  );
  const [toUserId, setToUserId] = useState(editing?.toUserId ?? "");
  const [purpose, setPurpose] = useState<RoutingPurpose>(
    editing?.purpose ?? presetPurpose ?? "execute",
  );
  const [priority, setPriority] = useState<RoutingPriority>(
    editing?.priority ?? "normal",
  );
  useFeedback(state, onClose);

  // The people of the sector first; for a signature, only who may conclude.
  const candidates = useMemo(
    () =>
      people
        .filter((p) => !(restricted && purpose === "sign" && !p.mayConclude))
        .sort(
          (a, b) =>
            Number(b.sectorIds.includes(sectorId)) -
              Number(a.sectorIds.includes(sectorId)) ||
            a.name.localeCompare(b.name, "pt-BR"),
        ),
    [people, restricted, purpose, sectorId],
  );
  const sectorLabel = sectors.find((s) => s.id === sectorId)?.label ?? "";
  const phase =
    purpose === "sign"
      ? "aguardando assinatura"
      : purpose === "review"
        ? "em conferência"
        : "em execução";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Alterar o direcionamento" : "Direcionar"}{" "}
            {protocolNumber}
          </DialogTitle>
          <DialogDescription>
            Só o cartório vê. Não muda a mesa nem o andamento.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="requestId" value={requestId} />
          {editing && (
            <input type="hidden" name="routingId" value={editing.id} />
          )}
          <input type="hidden" name="sectorId" value={sectorId} />
          <input type="hidden" name="purpose" value={purpose} />
          <input type="hidden" name="priority" value={priority} />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-foreground">
              Setor
            </legend>
            <div className="flex flex-wrap gap-2">
              {sectors.map((s) => (
                <Chip
                  key={s.id}
                  on={sectorId === s.id}
                  onClick={() => setSectorId(s.id)}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-foreground">
              Para quê
            </legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ROUTING_PURPOSE_LABELS) as RoutingPurpose[]).map(
                (p) => (
                  <Chip
                    key={p}
                    on={purpose === p}
                    onClick={() => setPurpose(p)}
                  >
                    {ROUTING_PURPOSE_LABELS[p]}
                  </Chip>
                ),
              )}
            </div>
            {purpose === "execute" && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">
                  Serviço (das atribuições da serventia)
                </span>
                <select
                  name="actId"
                  defaultValue={editing?.actId ?? ""}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">O ato deste pedido</option>
                  {[...new Set(services.map((s) => s.group))].map((group) => (
                    <optgroup key={group} label={group}>
                      {services
                        .filter((s) => s.group === group)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-foreground">
              Para quem{" "}
              <span className="font-normal text-muted-foreground">
                (ou deixe a fila do setor: o primeiro que receber fica com ele)
              </span>
            </span>
            <select
              name="toUserId"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Qualquer pessoa do setor {sectorLabel}</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sectorIds.includes(sectorId) ? ` · ${sectorLabel}` : ""}
                  {p.available ? " · disponível" : " · ausente"}
                </option>
              ))}
            </select>
            {restricted && purpose === "sign" && (
              <span className="text-xs text-muted-foreground">
                Para assinatura, só aparece quem o Tabelião autorizou a assinar
                e concluir.
              </span>
            )}
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-foreground">
              Prioridade
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(ROUTING_PRIORITY_LABELS) as RoutingPriority[]).map(
                (p) => (
                  <Chip
                    key={p}
                    on={priority === p}
                    onClick={() => setPriority(p)}
                  >
                    {ROUTING_PRIORITY_LABELS[p]}
                  </Chip>
                ),
              )}
              <label className="ml-1 flex items-center gap-2 text-sm text-muted-foreground">
                Prazo
                <input
                  type="datetime-local"
                  name="dueAt"
                  defaultValue={editing?.dueInput ?? ""}
                  className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                />
              </label>
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-foreground">
              Recado para quem recebe{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              name="note"
              defaultValue={editing?.note ?? ""}
              maxLength={1000}
              rows={2}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>

          {citizenPreview && sectorLabel && (
            <p className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              O cidadão verá: "Com o setor de {sectorLabel} · {phase}"
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !sectorId}>
              {pending
                ? "Salvando…"
                : editing
                  ? "Salvar a alteração"
                  : "Direcionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Direcionamento", on the pedido's side column (change
 * direcionamento-interno-de-pedidos): with whom it is, what for, the
 * buttons, and the history of every move.
 */
export function RoutingCard({
  requestId,
  protocolNumber,
  open,
  current,
  history,
  people,
  sectors,
  services,
  restricted,
  citizenLine,
}: {
  requestId: string;
  protocolNumber: string;
  /** Closed pedidos are not routed any more: the history stays. */
  open: boolean;
  current: RoutingCurrent | null;
  history: RoutingHistoryEntry[];
  people: RoutingPerson[];
  sectors: { id: string; label: string }[];
  services: RoutingService[];
  restricted: boolean;
  citizenLine: { office: boolean; request: boolean; preview: string | null };
}) {
  const [dialog, setDialog] = useState<null | {
    editing: RoutingCurrent | null;
    purpose?: RoutingPurpose;
  }>(null);
  const [confirmTake, setConfirmTake] = useState(false);
  const [pending, start] = useTransition();

  const run = (work: () => Promise<RoutingActionState>) =>
    start(async () => {
      const result = await work();
      if (result.status === "success") toast.success(result.message);
      if (result.status === "error") toast.error(result.message);
      setConfirmTake(false);
    });

  const take = () => {
    if (current && !current.mine && current.holderName) {
      setConfirmTake(true);
      return;
    }
    run(() => takeAction(requestId));
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <h4 className="text-base font-semibold text-foreground">
        Direcionamento
      </h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Só o cartório vê. Não muda a mesa nem o andamento do cidadão.
      </p>

      {current ? (
        <div
          className={`mt-3 rounded-lg border-2 p-3 ${current.overdue ? "border-destructive" : "border-primary"} bg-muted/40`}
        >
          <span className="text-xs text-muted-foreground">
            {current.pending
              ? "Direcionado, ainda não recebido"
              : "Com quem está agora"}
          </span>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {current.holderInitials}
            </span>
            <span className="min-w-0 text-sm leading-snug">
              <strong className="font-semibold text-foreground">
                {current.holderName ??
                  `Fila do setor ${current.sectorLabel ?? ""}`}
              </strong>
              {current.holderName && current.sectorLabel
                ? ` · ${current.sectorLabel}`
                : ""}
              <span className="block text-xs text-muted-foreground">
                Para{" "}
                <strong className="font-medium text-foreground">
                  {ROUTING_PURPOSE_LABELS[current.purpose].toLocaleLowerCase(
                    "pt-BR",
                  )}
                </strong>
                {current.serviceName ? ` · ${current.serviceName}` : ""}
                {current.receivedLabel
                  ? ` · recebeu ${current.receivedLabel}`
                  : ""}
              </span>
            </span>
          </div>
          {(current.priority !== "normal" || current.dueLabel) && (
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_CHIP[current.priority]}`}
            >
              {current.priority !== "normal" &&
                `${current.priority === "urgent" ? "Urgente" : "⚠ Atenção"}`}
              {current.priority !== "normal" && current.dueLabel ? " · " : ""}
              {current.dueLabel &&
                `${current.overdue ? "venceu " : "até "}${current.dueLabel}`}
            </span>
          )}
          {current.note && (
            <p className="mt-2 text-xs text-foreground">"{current.note}"</p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Ninguém pegou este pedido ainda.
        </p>
      )}

      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {current?.canReceive && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => receiveAction(current.id))}
            >
              Recebi
            </Button>
          )}
          <Button
            size="sm"
            variant={current?.canReceive ? "outline" : "default"}
            disabled={pending}
            onClick={() => setDialog({ editing: null })}
          >
            Direcionar
          </Button>
          {!(current?.mine && !current.pending) && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={take}
            >
              Pegar para mim
            </Button>
          )}
          {current?.canReturn && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => returnAction(requestId))}
            >
              Devolver
            </Button>
          )}
          {current?.canChange && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setDialog({ editing: current })}
              >
                Alterar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => withdrawRoutingAction(current.id))}
                className="text-destructive"
              >
                Desfazer
              </Button>
            </>
          )}
        </div>
      )}

      {confirmTake && current && (
        <div className="mt-3 rounded-lg border bg-muted/50 p-3 text-sm">
          <p className="text-foreground">
            Está com <strong>{current.holderName}</strong>
            {current.receivedLabel ? ` desde ${current.receivedLabel}` : ""},
            para{" "}
            {ROUTING_PURPOSE_LABELS[current.purpose].toLocaleLowerCase("pt-BR")}
            . Pegar mesmo assim?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Não precisa esperar liberar: a pessoa é avisada na hora e o
            histórico registra que você pegou.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => takeAction(requestId))}
            >
              Pegar agora
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmTake(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {citizenLine.office && open && (
        <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={citizenLine.request}
            disabled={pending}
            onChange={(e) =>
              run(() => setCitizenLineAction(requestId, e.target.checked))
            }
            className="mt-0.5 size-3.5 accent-primary"
          />
          <span>
            Mostrar ao cidadão o setor e a fase
            {citizenLine.request && citizenLine.preview
              ? `: "${citizenLine.preview}"`
              : citizenLine.request
                ? " (aparece quando o pedido estiver com um setor)"
                : " (desligado: ele vê só o andamento)"}
          </span>
        </label>
      )}

      {history.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold text-foreground">
            Histórico do direcionamento
          </p>
          <ol className="mt-2 flex flex-col gap-2 border-l-2 pl-3">
            {history.map((entry) => (
              <li key={entry.key} className="relative text-xs leading-snug">
                <span
                  className={`absolute top-1 -left-4.5 size-2 rounded-full ${
                    entry.tone === "edit"
                      ? "bg-warning"
                      : entry.tone === "warn"
                        ? "bg-destructive"
                        : "bg-primary"
                  }`}
                />
                <span
                  className={
                    entry.struck
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }
                >
                  {entry.text}
                </span>
                <span className="block text-muted-foreground tabular-nums">
                  {entry.atLabel}
                </span>
                {entry.note && (
                  <span className="block text-muted-foreground">
                    "{entry.note}"
                  </span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {dialog && (
        <RouteDialog
          open
          onClose={() => setDialog(null)}
          requestId={requestId}
          protocolNumber={protocolNumber}
          people={people}
          sectors={sectors}
          services={services}
          restricted={restricted}
          editing={dialog.editing}
          presetPurpose={dialog.purpose}
          citizenPreview={citizenLine.office && citizenLine.request}
        />
      )}
    </div>
  );
}

/** "Direcionar para assinatura", where the conclusion buttons are locked. */
export function RouteForSignatureHint({ names }: { names: string }) {
  return (
    <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-text">
      Só {names} assinam e concluem os pedidos nesta serventia. Use{" "}
      <strong>Direcionar</strong>, na lateral, e escolha{" "}
      <strong>Assinatura</strong>.
    </p>
  );
}
