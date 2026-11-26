import { Download, FileImage, Sparkles } from "lucide-react";
import Link from "next/link";
import type { RiFile } from "@/lib/ri-files.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { stamp } from "../_lib.ts";
import { readFileAction, setFileDeletedAction } from "../actions.ts";
import { ActionButton, ConfirmButton } from "./client.tsx";
import { Panel } from "./page.tsx";
import { UploadForm } from "./upload-form.tsx";

const KIND_LABELS: Record<string, string> = {
  ficha: "Ficha ou imagem",
  titulo: "Título",
  documento: "Documento",
};

const size = (n: number) =>
  n > 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

/** The documents of a matrícula: attach, read, download, TIFF, apagar. */
export function FilesPanel({
  propertyId,
  files,
  canEdit,
  direct,
  folder,
  book,
}: {
  propertyId: string;
  book?: 2 | 3;
  files: RiFile[];
  canEdit: boolean;
  direct: boolean;
  folder: string;
}) {
  const live = files.filter((f) => !f.deletedAt);
  const gone = files.filter((f) => f.deletedAt);
  return (
    <Panel
      title="Documentos e imagens"
      description="A ficha digitalizada, o título e qualquer documento do ato. O Assistente Virtual lê o arquivo e propõe os dados; você confere antes de entrar."
    >
      {canEdit && (
        <div className="mb-4 rounded-lg border bg-background p-3">
          <UploadForm
            propertyId={propertyId}
            direct={direct}
            folder={folder}
            book={book === 3 ? 3 : undefined}
            markdownDefault={book === 3}
          />
        </div>
      )}
      {live.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum documento anexado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {live.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-2 rounded-lg border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABELS[f.kind] ?? f.kind} · {size(f.size)} ·{" "}
                  {stamp(f.createdAt)}
                  {f.reading ? " · lido" : ""}
                  {f.path ? "" : " · só o texto (o arquivo foi descartado)"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <a
                  href={`/admin/ri/arquivo/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  <Download className="size-4" />{" "}
                  {f.path ? "Abrir" : "Abrir o texto (.md)"}
                </a>
                {f.mime.startsWith("image/") && (
                  <a
                    href={`/admin/ri/arquivo/${f.id}?formato=tiff`}
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                    })}
                  >
                    <FileImage className="size-4" /> TIFF preto e branco
                  </a>
                )}
                {canEdit &&
                  (f.reading ? (
                    <Link
                      href={`/admin/ri/leitura/${f.id}`}
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      <Sparkles className="size-4" /> Ver a leitura
                    </Link>
                  ) : (
                    <ActionButton
                      action={readFileAction}
                      fields={{ id: f.id }}
                      label="Ler com o Assistente Virtual"
                      pendingLabel="Lendo…"
                    />
                  ))}
                {canEdit && (
                  <ConfirmButton
                    action={setFileDeletedAction}
                    fields={{ id: f.id, op: "delete" }}
                    trigger="Apagar"
                    question="Tirar este documento da lista?"
                    consequence="Ele some da lista da matrícula. O arquivo continua guardado e dá para restaurar."
                    confirmLabel="Apagar"
                    pendingLabel="Apagando…"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {gone.length > 0 && canEdit && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {gone.length} apagado(s), guardado(s)
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {gone.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>{f.name}</span>
                <ConfirmButton
                  action={setFileDeletedAction}
                  fields={{ id: f.id, op: "restore" }}
                  trigger="Restaurar"
                  question="Restaurar este documento?"
                  consequence="Ele volta para a lista da matrícula."
                  confirmLabel="Restaurar"
                  pendingLabel="Restaurando…"
                  destructive={false}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
