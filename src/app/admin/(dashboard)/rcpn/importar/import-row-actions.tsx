"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  editImportAction,
  hideImportAction,
  type ImportMetaState,
  purgeImportFileAction,
  restoreImportAction,
} from "../actions.ts";

const idle: ImportMetaState = { status: "idle" };

function useToast(state: ImportMetaState) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);
}

/**
 * What the office does with a file it sent (decision of 22/11/2026): open
 * it, give it a name and a note, delete the file and keep the data, take
 * the line off the list (the registros stay in the index) or bring it back.
 */
export function ImportRowActions({
  id,
  open,
  hasFile,
  hidden,
  label,
  note,
}: {
  id: string;
  /** Still to be checked and published. */
  open: boolean;
  hasFile: boolean;
  hidden: boolean;
  label: string;
  note: string;
}) {
  const [editing, setEditing] = useState(false);
  const [edit, editAction, editPending] = useActionState(
    editImportAction,
    idle,
  );
  const [hide, hideAction, hidePending] = useActionState(
    hideImportAction,
    idle,
  );
  const [restore, restoreAction, restorePending] = useActionState(
    restoreImportAction,
    idle,
  );
  const [purge, purgeAction, purgePending] = useActionState(
    purgeImportFileAction,
    idle,
  );
  useToast(edit);
  useToast(hide);
  useToast(restore);
  useToast(purge);
  useEffect(() => {
    if (edit.status === "saved") setEditing(false);
  }, [edit]);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        <Link
          href={`/admin/rcpn/importar/${id}`}
          className={buttonVariants({
            variant: open ? "default" : "outline",
            size: "sm",
          })}
        >
          {open ? "Conferir e publicar" : "Ver"}
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing((v) => !v)}
        >
          Editar
        </Button>
        {hasFile && (
          <ConfirmAction
            action={purgeAction}
            pending={purgePending}
            error={purge.status === "error" ? purge.message : null}
            trigger="Apagar o arquivo"
            triggerClassName={buttonVariants({
              variant: "outline",
              size: "sm",
            })}
            question="Apagar o arquivo enviado e ficar só com os dados?"
            consequence="O arquivo sai do armazenamento e deixa de ocupar espaço. Os dados já lidos continuam: dá para conferir e publicar normalmente. Fica registrado na auditoria."
            confirmLabel="Apagar o arquivo"
            pendingLabel="Apagando..."
          >
            <input type="hidden" name="id" value={id} />
          </ConfirmAction>
        )}
        {hidden ? (
          <form action={restoreAction}>
            <input type="hidden" name="id" value={id} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={restorePending}
            >
              Restaurar na lista
            </Button>
          </form>
        ) : (
          !open && (
            <ConfirmAction
              action={hideAction}
              pending={hidePending}
              error={hide.status === "error" ? hide.message : null}
              trigger="Apagar da lista"
              triggerClassName={buttonVariants({
                variant: "ghost",
                size: "sm",
              })}
              question="Tirar este arquivo da lista?"
              consequence="Só a linha sai da lista. Os registros publicados continuam no índice e nas pesquisas. Dá para restaurar em Mostrar os tirados da lista."
              confirmLabel="Tirar da lista"
              pendingLabel="Tirando..."
            >
              <input type="hidden" name="id" value={id} />
            </ConfirmAction>
          )
        )}
      </div>
      {editing && (
        <form
          action={editAction}
          className="flex w-full max-w-md flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-left"
        >
          <input type="hidden" name="id" value={id} />
          <Label htmlFor={`${id}-label`} className="text-xs">
            Nome para identificar
          </Label>
          <Input
            id={`${id}-label`}
            name="label"
            defaultValue={label}
            maxLength={200}
            placeholder="Ex.: Carga de novembro de 2026"
          />
          <Label htmlFor={`${id}-note`} className="text-xs">
            Observação
          </Label>
          <Input
            id={`${id}-note`}
            name="note"
            defaultValue={note}
            maxLength={2000}
            placeholder="Ex.: livros A-40 a A-45"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={editPending}>
              {editPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
