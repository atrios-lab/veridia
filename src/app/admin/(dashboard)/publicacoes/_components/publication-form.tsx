"use client";

import { useActionState, useState } from "react";
import { defaultExpiry } from "@/core/publications/expiry.ts";
import {
  PUBLICATION_KIND_LABELS,
  PUBLICATION_KINDS,
  type PublicationKind,
} from "@/core/publications/publication.ts";
import type { NoticeSector } from "@/core/tenant/gating.ts";
import { NOTICE_SECTOR_META, noticeSectors } from "@/core/tenant/gating.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { PublicationRow } from "@/lib/publications.ts";
import { type SaveState, savePublication } from "../actions.ts";
import { PublicationPreview } from "./preview.tsx";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
      {message}
    </p>
  );
}

/**
 * `today()` on the client reads the visitor's own clock, not the office's.
 * That is fine here: it only pre-fills a suggestion the operator can always
 * change, but it is why this never becomes a validity check: the server,
 * which uses the office's wall calendar, is the one place that could refuse
 * a date, and it does not.
 */
function clientToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PublicationForm({
  tenant,
  editing,
}: {
  tenant: Tenant;
  editing?: PublicationRow;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    savePublication,
    { status: "idle" },
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  const [kind, setKind] = useState<PublicationKind>(
    (editing?.kind as PublicationKind) ?? "marriageBanns",
  );
  const [sector, setSector] = useState<NoticeSector | "">(
    (editing?.sector as NoticeSector | null) ?? "",
  );
  // Only an edital asks: banns are always proclamas and a notice never has
  // one: the schema writes both regardless of what the form posts.
  const sectorOptions = noticeSectors(tenant);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [publishAt, setPublishAt] = useState(editing?.publishAt ?? "");
  const [expireAt, setExpireAt] = useState(editing?.expireAt ?? "");
  // Only true once the operator has typed an entry date and the suggestion
  // has not been hand-edited away: matches "aviso e edital não têm
  // sugestão" and "o operador pode alterá-la" from the spec.
  const [expirySuggested, setExpirySuggested] = useState(false);
  // Only the chosen file's name: the input is visually hidden, so without
  // this the operator has no sign that the pick registered.
  const [file, setFile] = useState<string | null>(null);

  function handleKindChange(next: PublicationKind) {
    setKind(next);
    if (publishAt) {
      const suggestion = defaultExpiry(next, publishAt);
      if (suggestion) {
        setExpireAt(suggestion);
        setExpirySuggested(true);
      } else if (expirySuggested) {
        setExpireAt("");
        setExpirySuggested(false);
      }
    }
  }

  function handlePublishAtChange(value: string) {
    setPublishAt(value);
    if (!value) return;
    const suggestion = defaultExpiry(kind, value);
    if (suggestion && (!expireAt || expirySuggested)) {
      setExpireAt(suggestion);
      setExpirySuggested(true);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_360px]">
      <form
        action={formAction}
        className="rounded-[14px] border border-admin-border bg-admin-card p-6.5"
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <h3 className="font-serif text-[17px] font-semibold text-admin-primary">
          {editing ? "Editar publicação" : "Nova publicação"}
        </h3>

        <div className="mt-4 flex gap-2">
          {PUBLICATION_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKindChange(k)}
              className={
                k === kind
                  ? "rounded-[9px] border-[1.5px] border-admin-primary-soft bg-admin-input-bg px-4 py-2 text-[12.5px] font-bold text-admin-primary"
                  : "rounded-[9px] border border-admin-border px-4 py-2 text-[12.5px] font-semibold text-admin-muted"
              }
            >
              {PUBLICATION_KIND_LABELS[k]}
            </button>
          ))}
          <input type="hidden" name="kind" value={kind} />
        </div>

        {kind === "publicNotice" && (
          <div className="mt-3.5">
            <label className={LABEL_CLASS} htmlFor="sector">
              Setor
            </label>
            <select
              id="sector"
              name="sector"
              value={sector}
              onChange={(event) =>
                setSector(event.target.value as NoticeSector | "")
              }
              className={fieldErrors.sector ? ERROR_FIELD_CLASS : FIELD_CLASS}
            >
              <option value="">Escolha o setor…</option>
              {sectorOptions.map((option) => (
                <option key={option} value={option}>
                  {NOTICE_SECTOR_META[option].name} ·{" "}
                  {NOTICE_SECTOR_META[option].noticeType}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.sector} />
            <p className="mt-1.5 text-[11px] text-admin-faint">
              O edital aparece em /editais dentro do setor escolhido. Proclamas
              não perguntam: têm setor próprio.
            </p>
          </div>
        )}

        <div className="mt-3.5">
          <label className={LABEL_CLASS} htmlFor="title">
            Título
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Edital de proclamas nº 113/2026, nomes dos nubentes"
            className={fieldErrors.title ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          <FieldError message={fieldErrors.title} />
        </div>

        <div className="mt-3.5">
          <label className={LABEL_CLASS} htmlFor="body">
            Texto
          </label>
          <textarea
            id="body"
            name="body"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Conteúdo publicado no site, como o cidadão lê"
            className={fieldErrors.body ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          <FieldError message={fieldErrors.body} />
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="publishAt">
              Entra no site em
            </label>
            <input
              id="publishAt"
              name="publishAt"
              type="date"
              min={clientToday()}
              value={publishAt}
              onChange={(event) => handlePublishAtChange(event.target.value)}
              className={
                fieldErrors.publishAt ? ERROR_FIELD_CLASS : FIELD_CLASS
              }
            />
            <FieldError message={fieldErrors.publishAt} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="expireAt">
              Sai do site em
            </label>
            <input
              id="expireAt"
              name="expireAt"
              type="date"
              min={publishAt || clientToday()}
              value={expireAt}
              onChange={(event) => {
                setExpireAt(event.target.value);
                setExpirySuggested(false);
              }}
              className={fieldErrors.expireAt ? ERROR_FIELD_CLASS : FIELD_CLASS}
            />
            <FieldError message={fieldErrors.expireAt} />
            {expirySuggested && (
              <p className="mt-1.5 text-[11px] text-admin-faint">
                Preenchido: 15 dias (prazo do edital)
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11.5px] text-admin-muted">
          Para proclamas, a saída é preenchida com 15 dias (prazo do edital).
          Você pode ajustar.
        </p>

        <div className="mt-3.5">
          <span className={LABEL_CLASS}>Documento do edital (opcional)</span>
          {editing?.attachmentPath && !file && (
            <p className="mb-1.5 text-[11.5px] text-admin-muted">
              Já anexado. Escolher outro substitui o atual.
            </p>
          )}
          <label
            className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-admin-input-border px-4 py-3 text-center text-[12.5px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${pending ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {file ??
              (editing?.attachmentPath
                ? "Trocar o documento"
                : "Anexar o documento (PDF ou imagem)")}
            <input
              type="file"
              name="arquivo"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              className="sr-only"
              disabled={pending}
              onChange={(event) =>
                setFile(event.target.files?.[0]?.name ?? null)
              }
            />
          </label>
          <p className="mt-1.5 text-[11px] text-admin-faint">
            O texto acima continua sendo o que o cidadão lê na página. O arquivo
            é o documento assinado, oferecido para download ao lado dele.
          </p>
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
          >
            {state.message}
          </p>
        )}

        <div className="mt-5.5 flex flex-wrap items-center gap-3.5">
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending}
            className="btn btn-admin-primary btn-lg"
          >
            {pending ? "Salvando…" : "Publicar"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="btn btn-admin-secondary btn-lg"
          >
            {pending ? "Salvando…" : "Salvar rascunho"}
          </button>
          {state.status === "success" && (
            <span className="text-[12.5px] font-semibold text-admin-success-text">
              Salvo.
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-2.5 xl:sticky xl:top-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
          Como aparece no site
        </span>
        <PublicationPreview
          theme={tenant.theme}
          sealLight={tenant.logos.seal.light}
          officeName={tenant.name}
          kind={kind}
          sector={kind === "publicNotice" ? sector : undefined}
          title={title}
          body={body}
        />
        <p className="text-xs leading-relaxed text-admin-faint">
          A seção "Proclamas e avisos" só aparece no site quando há publicação
          vigente. Sem nenhuma, ela some da home.
        </p>
      </div>
    </div>
  );
}
