"use client";

import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ATTACHMENT_ACCEPT,
  useAttachmentPrepare,
} from "@/app/(public)/_lib/attachments.tsx";
import {
  ATTACHMENT_RETENTION_DAYS,
  attachmentAvailableUntil,
} from "@/core/publications/attachment-retention.ts";
import { defaultExpiry } from "@/core/publications/expiry.ts";
import { noticeSchedule } from "@/core/publications/notice-schedule.ts";
import {
  MARRIAGE_BANNS_NOTICE_TYPE,
  NOTICE_TYPES,
  type NoticeTypeKey,
  noticeTypeOf,
  noticeTypesOf,
} from "@/core/publications/notice-types.ts";
import {
  PUBLICATION_KIND_LABELS,
  PUBLICATION_KINDS,
  type PublicationKind,
} from "@/core/publications/publication.ts";
import {
  formatDate,
  officeHolidays,
  toIsoDate,
} from "@/core/scheduling/calendar.ts";
import type { NoticeSector } from "@/core/tenant/gating.ts";
import { NOTICE_SECTOR_META, noticeSectors } from "@/core/tenant/gating.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
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
 * The office's day, read from the operator's own clock: a plain UTC slice
 * would put this a day ahead of the office between 9pm and midnight UTC
 * (6pm to 9pm in Rio Grande do Norte), the same trap `toIsoDate`'s own
 * comment names. That gap used to fall inside this field's `min`, which
 * refuses a same-day publication with no visible error during those three
 * hours: the server's own liveness check (`isLive`, in the office's day)
 * would have called that same publication scheduled, not live.
 */
function clientToday(): string {
  return toIsoDate(new Date(), OFFICE_TIME_ZONE);
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
  // In the deploy the file goes from the browser to the Blob store before
  // the save, and the save carries only a reference to it: see
  // `useAttachmentPrepare`. In development it stays in the body.
  const { prepare, uploading, error: uploadError } = useAttachmentPrepare();
  const busy = pending || uploading;
  const formRef = useRef<HTMLFormElement>(null);

  const [kind, setKind] = useState<PublicationKind>(
    (editing?.kind as PublicationKind) ?? "marriageBanns",
  );
  const [sector, setSector] = useState<NoticeSector | "">(
    (editing?.sector as NoticeSector | null) ?? "",
  );
  // Only an edital asks: banns are always proclamas and a notice never has
  // one: the schema writes both regardless of what the form posts.
  const sectorOptions = noticeSectors(tenant);
  const [noticeType, setNoticeType] = useState<NoticeTypeKey | "">(
    (noticeTypeOf(editing?.noticeType) &&
      (editing?.noticeType as NoticeTypeKey)) ||
      "",
  );
  // The rule the dates follow: banns have exactly one, a notice none, an
  // edital whichever type the operator picked (the schema writes the same).
  const effectiveType: NoticeTypeKey | undefined =
    kind === "marriageBanns"
      ? MARRIAGE_BANNS_NOTICE_TYPE
      : kind === "publicNotice" && noticeType
        ? noticeType
        : undefined;
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

  // Re-suggests the exit date whenever the rule or the first publication
  // changes, unless the operator already typed one of their own.
  function suggestExpiry(type: NoticeTypeKey | undefined, from: string) {
    if (!from) return;
    const suggestion = defaultExpiry(type, from, officeHolidays(tenant));
    if (suggestion && (!expireAt || expirySuggested)) {
      setExpireAt(suggestion);
      setExpirySuggested(true);
    } else if (!suggestion && expirySuggested) {
      setExpireAt("");
      setExpirySuggested(false);
    }
  }

  function typeFor(nextKind: PublicationKind, nextType: NoticeTypeKey | "") {
    if (nextKind === "marriageBanns") return MARRIAGE_BANNS_NOTICE_TYPE;
    if (nextKind === "publicNotice" && nextType) return nextType;
    return undefined;
  }

  function handleKindChange(next: PublicationKind) {
    setKind(next);
    suggestExpiry(typeFor(next, noticeType), publishAt);
  }

  function handleSectorChange(next: NoticeSector | "") {
    setSector(next);
    // A type belongs to one sector: keep it only if it still fits.
    const keep =
      next && noticeType && NOTICE_TYPES[noticeType].sector === next
        ? noticeType
        : "";
    setNoticeType(keep);
    suggestExpiry(typeFor(kind, keep), publishAt);
  }

  function handleNoticeTypeChange(next: NoticeTypeKey | "") {
    setNoticeType(next);
    suggestExpiry(typeFor(kind, next), publishAt);
  }

  function handlePublishAtChange(value: string) {
    setPublishAt(value);
    suggestExpiry(effectiveType, value);
  }

  const rule = effectiveType ? NOTICE_TYPES[effectiveType] : undefined;
  const schedule =
    rule && publishAt
      ? noticeSchedule(rule, publishAt, officeHolidays(tenant))
      : null;
  const todayIso = clientToday();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // The submitter carries `intent` (publish or draft): FormData only
    // includes the clicked button when told which one it was.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    void prepare(new FormData(form, submitter), "arquivo", 1).then((data) => {
      if (data) startTransition(() => formAction(data));
    });
  }

  // After a save, the file input is empty again: forget the picked name so
  // the screen never claims a file that a second click would not send. A
  // new publication also clears the whole form, so a second click on
  // "Publicar" cannot create the same publication twice.
  useEffect(() => {
    if (state.status !== "success") return;
    setFile(null);
    formRef.current?.reset();
    if (editing) return;
    setKind("marriageBanns");
    setSector("");
    setNoticeType("");
    setTitle("");
    setBody("");
    setPublishAt("");
    setExpireAt("");
    setExpirySuggested(false);
  }, [state, editing]);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_360px]">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
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
                handleSectorChange(event.target.value as NoticeSector | "")
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

        {kind === "publicNotice" && sector && (
          <div className="mt-3.5">
            <label className={LABEL_CLASS} htmlFor="noticeType">
              Tipo de edital
            </label>
            <select
              id="noticeType"
              name="noticeType"
              value={noticeType}
              onChange={(event) =>
                handleNoticeTypeChange(event.target.value as NoticeTypeKey | "")
              }
              className={
                fieldErrors.noticeType ? ERROR_FIELD_CLASS : FIELD_CLASS
              }
            >
              <option value="">Outro (sem prazo calculado)</option>
              {noticeTypesOf(sector).map((key) => (
                <option key={key} value={key}>
                  {NOTICE_TYPES[key].label}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.noticeType} />
          </div>
        )}

        {rule && (
          <div className="mt-3.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-3 text-[12px] leading-relaxed text-admin-text">
            <p>
              <strong className="text-admin-primary">{rule.legalBasis}.</strong>{" "}
              {rule.summary}
            </p>
            {schedule && (
              <ul className="mt-2 flex flex-col gap-0.5">
                {schedule.runs.map((run) => (
                  <li key={run.number}>
                    {rule.runs > 1 ? `${run.number}ª publicação` : "Publicação"}
                    : {formatDate(run.date)}
                    {run.number > 1 && run.date <= todayIso
                      ? " (já republicada no site)"
                      : ""}
                  </li>
                ))}
                <li className="font-bold">
                  {rule.termLabel} até {formatDate(schedule.termEndsOn)}
                  {rule.counting === "business" ? " (dias úteis)" : ""}
                </li>
              </ul>
            )}
            {schedule && schedule.termEndsOn < todayIso && (
              <p className="mt-2 font-semibold text-admin-warning-text">
                Esse prazo já terminou. Ao publicar com essas datas, a
                publicação fica registrada direto em Arquivadas.
              </p>
            )}
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
              {rule && rule.runs > 1
                ? "Data da 1ª publicação"
                : "Data da publicação"}
            </label>
            {/* No `min`: an edital published on paper a month ago is entered
                with that date, and its runs and term are counted from it. */}
            <input
              id="publishAt"
              name="publishAt"
              type="date"
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
              min={publishAt || undefined}
              value={expireAt}
              onChange={(event) => {
                setExpireAt(event.target.value);
                setExpirySuggested(false);
              }}
              className={fieldErrors.expireAt ? ERROR_FIELD_CLASS : FIELD_CLASS}
            />
            <FieldError message={fieldErrors.expireAt} />
            {expirySuggested && rule && (
              <p className="mt-1.5 text-[11px] text-admin-faint">
                Preenchido: fim do prazo legal, depois de todas as publicações
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11.5px] text-admin-muted">
          A data da publicação pode ser passada, para registrar um edital já
          publicado: o site o mostra na etapa em que estiver hoje e republica
          sozinho quando a lei pede uma nova publicação. A saída é preenchida
          com o fim do prazo legal; você pode ajustar.
        </p>

        <div className="mt-3.5">
          <span className={LABEL_CLASS}>Documento ou imagem (opcional)</span>
          {editing?.attachmentPath && !file && (
            <p className="mb-1.5 text-[11.5px] text-admin-muted">
              Já anexado
              {editing.attachmentUploadedAt
                ? `, disponível até ${formatDate(
                    attachmentAvailableUntil(
                      toIsoDate(
                        new Date(editing.attachmentUploadedAt),
                        OFFICE_TIME_ZONE,
                      ),
                    ),
                  )}`
                : ""}
              . Escolher outro substitui o atual e começa um novo prazo.
            </p>
          )}
          {editing?.attachmentPurgedAt && !editing.attachmentPath && !file && (
            <p className="mb-1.5 text-[11.5px] text-admin-muted">
              O arquivo desta publicação já foi apagado pela regra de{" "}
              {ATTACHMENT_RETENTION_DAYS} dias. Você pode anexar outro.
            </p>
          )}
          <label
            className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-admin-input-border px-4 py-3 text-center text-[12.5px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${busy ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {file ??
              (editing?.attachmentPath
                ? "Trocar o documento"
                : "Anexar documento (PDF) ou imagem")}
            <input
              type="file"
              name="arquivo"
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(event) =>
                setFile(event.target.files?.[0]?.name ?? null)
              }
            />
          </label>
          <p className="mt-1.5 text-[11px] text-admin-faint">
            Aparece junto da publicação na página inicial e em /editais: a
            imagem é mostrada no próprio cartão, o PDF abre em nova aba.
          </p>
          {/* The 30-day rule, said before the save, in every state (draft,
              scheduled, live): the office must know to keep its own copy. */}
          <p className="mt-2 rounded-[9px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-3 py-2 text-[11.5px] leading-relaxed text-admin-warning-text">
            <strong>
              O arquivo fica disponível por {ATTACHMENT_RETENTION_DAYS} dias
            </strong>
            , contados do envio, no site e no painel. Depois disso ele é apagado
            automaticamente e ficam só as informações escritas (tipo, título,
            texto, datas e quem fez o quê). Se a publicação ainda estiver no
            site nesse dia, o arquivo fica até ela sair. Baixe e guarde uma
            cópia na nuvem do cartório. É a mesma regra dos documentos dos
            pedidos, em respeito à LGPD, que pede eliminar dados pessoais
            cumprida a finalidade.
          </p>
        </div>

        {uploadError && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
          >
            {uploadError}
          </p>
        )}

        {!uploadError && state.status === "error" && (
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
            disabled={busy}
            className="btn btn-admin-primary btn-lg"
          >
            {uploading
              ? "Enviando arquivo…"
              : pending
                ? "Salvando…"
                : "Publicar"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={busy}
            className="btn btn-admin-secondary btn-lg"
          >
            {uploading
              ? "Enviando arquivo…"
              : pending
                ? "Salvando…"
                : "Salvar rascunho"}
          </button>
          {state.status === "success" && (
            <span className="text-[12.5px] font-semibold text-admin-success-text">
              {state.fileUntil
                ? `Salvo. O arquivo fica disponível até ${formatDate(state.fileUntil)}: baixe e guarde uma cópia na nuvem do cartório.`
                : "Salvo."}
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
          noticeType={effectiveType ?? null}
          publishAt={publishAt || null}
          today={todayIso}
          holidays={officeHolidays(tenant)}
          title={title}
          body={body}
        />
        <p className="text-xs leading-relaxed text-admin-faint">
          A seção de publicações da página inicial leva o nome do que está no ar
          (proclamas, avisos, editais) e some quando não há nenhuma vigente.
        </p>
      </div>
    </div>
  );
}
