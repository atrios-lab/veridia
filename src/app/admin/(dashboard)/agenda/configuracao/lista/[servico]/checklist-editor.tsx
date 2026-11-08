"use client";

import Link from "next/link";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ATTACHMENT_ACCEPT,
  useAttachmentPrepare,
} from "@/app/(public)/_lib/attachments.tsx";
import { AdminIcon } from "../../../../../_components/icon.tsx";
import { type ActionState, saveServiceChecklist } from "../../../actions.ts";

const inputClass =
  "rounded-lg border border-admin-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-accent";
const cardClass =
  "rounded-[14px] border border-admin-border bg-admin-card px-5 py-4";

/**
 * The list as editable lines (fix the wording, remove any item, the base
 * ones included, add new ones) and the office's own sheet, PDF or photo.
 * One save sends both; the file goes straight to the store in the deploy,
 * like a publication's.
 */
export function ChecklistEditor({
  serviceId,
  group,
  items: initialItems,
  defaults,
  edited,
  file,
}: {
  serviceId: string;
  group: string;
  items: string[];
  defaults: string[];
  /** Whether the office already changed the catalogue's list. */
  edited: boolean;
  file?: { href: string; sizeBytes: number; mimeType: string };
}) {
  const [items, setItems] = useState<string[]>(initialItems);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [dropFile, setDropFile] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveServiceChecklist,
    { status: "idle" },
  );
  const { prepare, uploading, error: uploadError } = useAttachmentPrepare();
  const busy = pending || uploading;
  const formRef = useRef<HTMLFormElement>(null);

  // The server's answer is the new truth: a restore brings the defaults
  // back, and the file input is empty again after any save.
  const lastState = useRef(state);
  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.status !== "success") return;
    toast.success(state.message ?? "Lista salva.");
    setPicked(null);
    setDropFile(false);
    formRef.current?.reset();
  }, [state]);
  useEffect(() => setItems(initialItems), [initialItems]);

  function add() {
    const item = draft.trim();
    if (!item) return;
    if (!items.includes(item)) setItems([...items, item]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    void prepare(
      new FormData(event.currentTarget, submitter),
      "arquivo",
      1,
    ).then((data) => {
      if (data) startTransition(() => formAction(data));
    });
  }

  const changed = JSON.stringify(items) !== JSON.stringify(initialItems);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid items-start gap-4.5 lg:grid-cols-[1fr_340px]"
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {dropFile && <input type="hidden" name="dropFile" value="1" />}

      <div className="flex flex-col gap-4.5">
        <section className={cardClass}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
              Lista do que levar
            </h2>
            <span className="text-[12px] text-admin-muted">
              {group} · {edited ? "lista do cartório" : "lista padrão"}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            É o que o cidadão vê ao escolher o serviço, na confirmação, no
            e-mail e no comprovante em PDF. Corrija o texto, tire o que não se
            aplica (inclusive os itens de todos os serviços) e acrescente o que
            o cartório pede.
          </p>

          <ol className="mt-3 flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={`${index}-${item}`} className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-right text-[12px] tabular-nums text-admin-faint">
                  {index + 1}.
                </span>
                <textarea
                  aria-label={`Item ${index + 1}`}
                  rows={item.length > 90 ? 2 : 1}
                  defaultValue={item}
                  onBlur={(event) => {
                    const text = event.currentTarget.value.trim();
                    setItems(
                      text
                        ? items.map((old, i) => (i === index ? text : old))
                        : items.filter((_, i) => i !== index),
                    );
                  }}
                  className={`${inputClass} min-w-0 flex-1 resize-y`}
                />
                <button
                  type="button"
                  aria-label={`Excluir: ${item}`}
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  className="mt-2 text-admin-faint hover:text-admin-alert"
                >
                  <AdminIcon name="x" className="h-4 w-4" />
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-[12.5px] text-admin-muted">
                Nenhum item. Acrescente ao menos um, ou anexe a lista do
                cartório ao lado.
              </li>
            )}
          </ol>

          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder="Novo item, ex.: Certidão negativa de débitos municipais"
              aria-label="Novo item"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={add}
              className="rounded-lg border border-admin-border px-3.5 py-2 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
            >
              Acrescentar
            </button>
          </div>

          {(edited || changed) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-admin-muted">
              {changed && (
                <button
                  type="button"
                  onClick={() => setItems(initialItems)}
                  className="font-semibold underline"
                >
                  Desfazer alterações
                </button>
              )}
              {edited && (
                <button
                  type="submit"
                  name="restoreItems"
                  value="1"
                  disabled={busy}
                  className="font-semibold text-admin-accent underline"
                >
                  Voltar à lista padrão ({defaults.length} itens)
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4.5 lg:sticky lg:top-4">
        <section className={cardClass}>
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            Lista própria do cartório
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Se o cartório já tem um checklist, anexe o PDF (ou uma foto da
            folha). O cidadão recebe o link junto com a lista acima, na
            confirmação, no e-mail e no comprovante.
          </p>

          {file && !dropFile && (
            <p className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-admin-input-bg px-3 py-2 text-[12.5px]">
              <a
                href={file.href}
                target="_blank"
                rel="noopener"
                className="font-semibold text-admin-primary underline"
              >
                Ver o arquivo anexado
              </a>
              <button
                type="button"
                onClick={() => setDropFile(true)}
                className="text-admin-alert hover:underline"
              >
                Tirar
              </button>
            </p>
          )}
          {dropFile && (
            <p className="mt-3 text-[12.5px] text-admin-alert">
              O arquivo sai do site ao salvar.{" "}
              <button
                type="button"
                onClick={() => setDropFile(false)}
                className="font-semibold underline"
              >
                Manter
              </button>
            </p>
          )}

          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-admin-border px-3 py-3 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg">
            <AdminIcon name="file" className="h-4 w-4" />
            {picked ?? (file ? "Trocar o arquivo" : "Anexar PDF ou imagem")}
            <input
              type="file"
              name="arquivo"
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(event) =>
                setPicked(event.target.files?.[0]?.name ?? null)
              }
            />
          </label>
        </section>

        {(uploadError || state.status === "error") && (
          <p
            role="alert"
            className="rounded-lg border border-admin-alert px-3.5 py-2.5 text-[13px] font-semibold text-admin-alert"
          >
            {uploadError ??
              (state.status === "error" ? state.message : undefined)}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={busy}
            className="btn btn-admin-primary btn-md"
          >
            {uploading
              ? "Enviando arquivo..."
              : pending
                ? "Salvando..."
                : "Salvar lista"}
          </button>
          <Link
            href="/admin/agenda/configuracao"
            className="btn btn-admin-secondary btn-md"
          >
            Voltar à configuração
          </Link>
        </div>
      </aside>
    </form>
  );
}
