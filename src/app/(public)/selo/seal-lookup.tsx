"use client";

import { useActionState, useEffect, useState } from "react";
import type { Seal, SealSection } from "@/core/seal/parse.ts";
import { Icon } from "../_components/icon.tsx";
import { lookupSeal, type SealLookupState } from "./actions.ts";

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

/** What the TJ prints under every answer, in our own words. */
function ConferenceNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-brand-tint px-3.5 py-3">
      <Icon
        name="info"
        className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-soft"
        strokeWidth={1.9}
      />
      <p className="text-[12px] leading-relaxed text-brand-primary">
        Informações do Tribunal de Justiça para simples conferência. Não
        substituem o documento original. Em caso de dúvida, procure a serventia
        que praticou o ato.
      </p>
    </div>
  );
}

/** The TJ's own lookup: the answer to every way this page can fail. */
function OfficialLink({ href, block }: { href: string; block?: boolean }) {
  if (block) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="btn btn-secondary btn-lg mt-3"
      >
        <Icon name="external" className="h-3.5 w-3.5" />
        Consultar no site do TJ
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1.5 font-semibold text-brand-primary underline"
    >
      consulta oficial do Tribunal de Justiça
      <Icon name="arrowUpRight" className="h-3 w-3" />
    </a>
  );
}

function SectionBlock({ section }: { section: SealSection }) {
  const empty = section.fields.length === 0 && section.notes.length === 0;

  return (
    <div className="border-t border-brand-border pt-3 first:border-t-0 first:pt-0">
      {section.title && (
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          {section.title}
        </span>
      )}
      {empty ? (
        <p className="mt-1 text-[12.5px] text-brand-faint">Nada informado.</p>
      ) : (
        <dl
          className={
            section.title
              ? "mt-2 flex flex-col gap-1.5"
              : "flex flex-col gap-1.5"
          }
        >
          {section.fields.map((field) => (
            <div
              key={`${field.label}-${field.value}`}
              className="flex flex-wrap gap-x-2 gap-y-0.5"
            >
              <dt className="text-[12.5px] text-brand-muted">{field.label}:</dt>
              <dd className="text-[12.5px] font-semibold text-brand-text">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {section.notes.map((note) => (
        <p key={note} className="mt-1.5 text-[11.5px] text-brand-faint">
          {note}
        </p>
      ))}
    </div>
  );
}

function SealCard({ seal }: { seal: Seal }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-border pb-3">
        <Icon name="seal" className="h-4.5 w-4.5 shrink-0 text-brand-accent" />
        <span className="flex-1 break-all text-[14.5px] font-bold tracking-wide text-brand-primary">
          {seal.code}
        </span>
        {seal.note && (
          <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-bold text-brand-primary-soft">
            {seal.note}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {seal.sections.map((section, index) => (
          <SectionBlock
            key={section.title ?? `abertura-${index}`}
            section={section}
          />
        ))}
      </div>
    </div>
  );
}

function Unavailable({ officialUrl }: { officialUrl: string }) {
  return (
    <div className="rounded-2xl border border-brand-alert bg-brand-card p-4">
      <div className="flex items-center gap-2.5">
        <Icon name="alert" className="h-4.5 w-4.5 shrink-0 text-brand-alert" />
        <h2 className="font-serif text-[16px] font-semibold text-brand-primary">
          O sistema do TJ não respondeu
        </h2>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-brand-text-soft">
        A consulta é feita no sistema do Tribunal de Justiça, e ele não
        respondeu agora. Você pode tentar de novo em instantes ou consultar
        direto no site do TJ.
      </p>
      <OfficialLink href={officialUrl} block />
    </div>
  );
}

export function SealLookup({
  tenantName,
  officialUrl,
}: {
  tenantName: string;
  officialUrl: string;
}) {
  const [state, formAction, pending] = useActionState<
    SealLookupState,
    FormData
  >(lookupSeal, { status: "idle" });

  // React resets the form after an action, so the seal code is held here:
  // retyping a 23-character code because the captcha was misread is how
  // someone gives up on a page that was one keystroke from working.
  const [codes, setCodes] = useState("");
  // Bumping this refetches the image, and each fetch opens a new session on
  // the TJ. A session answers one submission, so every result earns a new
  // captcha: the citizen never faces an image that can no longer be right.
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [captchaBroken, setCaptchaBroken] = useState(false);

  useEffect(() => {
    if (state.status !== "idle") setCaptchaNonce((n) => n + 1);
  }, [state]);

  return (
    <div className="md:grid md:grid-cols-[1fr_460px] md:items-start md:gap-10">
      <div className="flex flex-col gap-4 md:gap-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
            {tenantName}
          </span>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
            Consultar selo digital
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-brand-muted md:max-w-[42ch]">
            Confira no sistema do Tribunal de Justiça se um ato é autêntico. O
            código do selo está impresso no documento, começando por "RN".
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="codigo"
              className="mb-1.5 block text-[13px] font-semibold text-brand-primary"
            >
              Código do selo digital
            </label>
            {/* The placeholder shows the shape of a code, never a real one:
                a working seal printed here would hand every visitor the name
                and CPF behind somebody else's act. */}
            <input
              id="codigo"
              name="codigo"
              required
              value={codes}
              onChange={(event) => setCodes(event.target.value)}
              placeholder="Ex.: RN2026…"
              className={inputClass}
            />
            <p className="mt-1.5 text-[11.5px] text-brand-faint">
              Para conferir mais de um selo, separe os códigos por ponto e
              vírgula.
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-brand-primary">
              Texto da imagem
            </span>
            {captchaBroken ? (
              <p className="rounded-xl border border-brand-alert px-3.5 py-3 text-[12.5px] text-brand-text-soft">
                Não foi possível carregar a imagem do TJ.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setCaptchaBroken(false);
                    setCaptchaNonce((n) => n + 1);
                  }}
                  className="font-semibold underline"
                >
                  Tentar de novo
                </button>
                .
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Served by our own route, which opens the TJ session this
                    image belongs to and returns it in a cookie. */}
                {/** biome-ignore lint/performance/noImgElement: the captcha is a per-session image from the TJ, never a static asset to optimise. */}
                <img
                  src={`/selo/captcha?n=${captchaNonce}`}
                  alt="Código de verificação exibido pelo Tribunal de Justiça"
                  width={145}
                  height={45}
                  className="rounded-lg border border-brand-border bg-white"
                  onError={() => setCaptchaBroken(true)}
                />
                <button
                  type="button"
                  onClick={() => setCaptchaNonce((n) => n + 1)}
                  className="btn btn-ghost btn-sm"
                >
                  <Icon name="arrowRight" className="h-3.5 w-3.5" />
                  Gerar novo código
                </button>
              </div>
            )}
            <input
              name="captcha"
              required
              autoComplete="off"
              placeholder="Digite o que está na imagem"
              className={`${inputClass} mt-2.5`}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-lg self-start"
          >
            {pending ? "Consultando..." : "Consultar selo"}
          </button>

          {state.status === "error" && (
            <p
              role="alert"
              className="text-[12.5px] font-semibold text-brand-alert"
            >
              {state.message}
            </p>
          )}
        </form>

        <p className="text-[12px] leading-relaxed text-brand-muted">
          Esta página consulta o sistema do TJ e mostra a resposta aqui. Se
          preferir, use a <OfficialLink href={officialUrl} />.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3.5 md:mt-0">
        {state.status === "seals" && (
          <>
            {state.seals.map((seal) => (
              <SealCard key={seal.code} seal={seal} />
            ))}
            <ConferenceNotice />
          </>
        )}

        {state.status === "message" && (
          <div className="rounded-2xl border-[1.5px] border-brand-accent-line bg-brand-accent-soft p-4">
            <div className="flex items-start gap-2.5">
              <Icon
                name="info"
                className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-accent-ink"
              />
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-accent-ink">
                  Resposta do TJ
                </div>
                {/* The TJ's own words: it knows why it refused, we don't. */}
                <p className="mt-1 text-[13px] leading-relaxed text-brand-primary">
                  {state.message}
                </p>
                <p className="mt-2 text-[11.5px] text-brand-text-soft">
                  Confira o código, gere um novo código de imagem e tente de
                  novo.
                </p>
              </div>
            </div>
          </div>
        )}

        {state.status === "unavailable" && (
          <Unavailable officialUrl={officialUrl} />
        )}
      </div>
    </div>
  );
}
