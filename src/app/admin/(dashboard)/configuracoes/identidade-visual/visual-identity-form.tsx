"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MANDATORY_SECTIONS,
  optionalSections,
  SECTION_LABELS,
} from "@/core/tenant/gating.ts";
import type { Section, Tenant, Theme } from "@/core/tenant/schema.ts";
import { THEMES } from "@/core/tenant/schema.ts";
import { SERIF } from "@/lib/fonts.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { saveVisualIdentity, type VisualIdentityState } from "./actions.ts";
import { VisualIdentityPreview } from "./preview.tsx";

// Same five styles as globals.css. Written here, not derived from the
// stylesheet, because a card needs prose (what the style feels like), and
// prose does not belong in a token file.
const THEME_META: Record<Theme, { label: string; description: string }> = {
  "verde-dourado": {
    label: "Verde & Dourado",
    description: "Tradicional e sóbrio",
  },
  "marinho-bronze": {
    label: "Marinho & Bronze",
    description: "Clássico, tom mais formal",
  },
  "vinho-perola": {
    label: "Vinho & Pérola",
    description: "Acolhedor e elegante",
  },
  "grafite-cobre": {
    label: "Grafite & Cobre",
    description: "Moderno e direto",
  },
  "oliva-terracota": {
    label: "Oliva & Terracota",
    description: "Leve, tom interiorano",
  },
};

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

/** A file's local preview, falling back to what is already published. */
function useObjectUrl(file: File | null, published: string | undefined) {
  const [url, setUrl] = useState(published);
  useEffect(() => {
    if (!file) {
      setUrl(published);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, published]);
  return url;
}

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = THEME_META[theme];
  return (
    <label
      className={`relative flex cursor-pointer items-center gap-3.5 rounded-[11px] border px-4 py-3 ${
        selected
          ? "border-admin-primary-soft bg-admin-card-surface"
          : "border-admin-border bg-admin-card"
      }`}
    >
      <input
        type="radio"
        name="theme"
        value={theme}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span data-theme={theme} className="flex gap-1">
        <span className="h-6 w-6 rounded-md bg-brand-primary" />
        <span className="h-6 w-6 rounded-md bg-brand-accent" />
        <span className="h-6 w-6 rounded-md border border-brand-border bg-brand-surface" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          data-theme={theme}
          className={`${SERIF[theme].variable} block font-serif text-[15px] font-semibold text-brand-primary`}
        >
          {meta.label}
        </span>
        <span className="block text-[11.5px] text-admin-muted">
          {meta.description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full ${
          selected
            ? "bg-admin-primary-soft"
            : "border-[1.5px] border-admin-input-border"
        }`}
      >
        {selected && (
          <AdminIcon
            name="check"
            className="h-3 w-3 text-white"
            strokeWidth={3}
          />
        )}
      </span>
    </label>
  );
}

function ImageField({
  label,
  hint,
  name,
  previewSrc,
  previewBg,
  onChange,
}: {
  label: string;
  hint: string;
  name: string;
  previewSrc: string | undefined;
  previewBg: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`flex h-[68px] w-[68px] flex-none items-center justify-center overflow-hidden rounded-[10px] ${previewBg}`}
      >
        {previewSrc && (
          // biome-ignore lint/performance/noImgElement: local unpublished file previewed via a blob: object URL, which next/image cannot optimize.
          <img
            src={previewSrc}
            alt=""
            className="h-full w-full object-contain p-2"
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-admin-primary">{label}</p>
        <p className="mt-0.5 text-[12px] text-admin-muted">{hint}</p>
        <label className="relative mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-admin-input-border px-3 py-1.5 text-[12px] font-bold text-admin-muted hover:border-admin-primary-soft hover:text-admin-primary">
          <AdminIcon name="upload" className="h-3.5 w-3.5" />
          Trocar imagem
          <input
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  );
}

export function VisualIdentityForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, saving] = useActionState<
    VisualIdentityState,
    FormData
  >(saveVisualIdentity, { status: "idle" });
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  const [theme, setTheme] = useState<Theme>(tenant.theme);
  const [eyebrow, setEyebrow] = useState(tenant.home.eyebrow);
  const [title, setTitle] = useState(tenant.home.title);
  const [disabledSections, setDisabledSections] = useState<Set<Section>>(
    () => new Set(tenant.disabledSections),
  );
  const [sealLightFile, setSealLightFile] = useState<File | null>(null);
  const [sealDarkFile, setSealDarkFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  // Bumped on discard to remount the form: it clears the file inputs,
  // which cannot be reset any other way (the browser refuses `value=` on a
  // file input for the same reason it refused it to us here).
  const [formKey, setFormKey] = useState(0);

  const sealLightPreview = useObjectUrl(sealLightFile, tenant.logos.seal.light);
  const sealDarkPreview = useObjectUrl(sealDarkFile, tenant.logos.seal.dark);
  const heroPreview = useObjectUrl(heroFile, tenant.heroImage);

  const optional = useMemo(() => optionalSections(tenant), [tenant]);

  useEffect(() => {
    if (state.status === "saved") toast.success("Publicado.");
  }, [state]);

  function toggleSection(section: Section) {
    setDisabledSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function handleDiscard() {
    setTheme(tenant.theme);
    setEyebrow(tenant.home.eyebrow);
    setTitle(tenant.home.title);
    setDisabledSections(new Set(tenant.disabledSections));
    setSealLightFile(null);
    setSealDarkFile(null);
    setHeroFile(null);
    setFormKey((k) => k + 1);
  }

  const enabledPreviewSections = optional
    .filter((s) => !disabledSections.has(s))
    .map((s) => SECTION_LABELS[s]);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_400px]">
      <form
        key={formKey}
        action={formAction}
        className="flex min-w-0 flex-col gap-4.5"
      >
        <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Estilo do site
          </h2>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            Escolha o jeito do seu site. Cada estilo combina cores e letra
            própria: veja o resultado na prévia ao lado.
          </p>
          <div
            className="mt-4 flex flex-col gap-2.5"
            role="radiogroup"
            aria-label="Estilo do site"
          >
            {THEMES.map((t) => (
              <ThemeCard
                key={t}
                theme={t}
                selected={theme === t}
                onSelect={() => setTheme(t)}
              />
            ))}
          </div>
          {fieldErrors.theme && (
            <p className="mt-2 text-xs font-semibold text-admin-error-text">
              {fieldErrors.theme}
            </p>
          )}
        </div>

        <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Logotipo
          </h2>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            A marca quadrada, em PNG com fundo transparente, até 1 MB. Aparece
            no cabeçalho e rodapé do site, no ícone da aba, nos e-mails e nos
            documentos.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <ImageField
              label="Para fundo claro"
              hint="Cabeçalho do site, ícone da aba, e-mails e documentos."
              name="sealLight"
              previewSrc={sealLightPreview}
              previewBg="bg-admin-card-surface"
              onChange={setSealLightFile}
            />
            <ImageField
              label="Para fundo escuro"
              hint="Rodapé do site, sidebar e tela de entrada do painel."
              name="sealDark"
              previewSrc={sealDarkPreview}
              previewBg="bg-admin-primary"
              onChange={setSealDarkFile}
            />
          </div>
        </div>

        <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Página inicial
          </h2>
          <div className="mt-4">
            <ImageField
              label="Imagem do hero"
              hint="Primeira coisa que o cidadão vê. Horizontal, mínimo 1600 px de largura, até 4 MB."
              name="heroImage"
              previewSrc={heroPreview}
              previewBg="bg-admin-card-surface"
              onChange={setHeroFile}
            />
          </div>
          <div className="mt-4 flex flex-col gap-3.5">
            <div>
              <label className={LABEL_CLASS} htmlFor="eyebrow">
                Frase de destaque (acima do título)
              </label>
              <input
                id="eyebrow"
                name="eyebrow"
                value={eyebrow}
                onChange={(event) => setEyebrow(event.target.value)}
                className={
                  fieldErrors.eyebrow ? ERROR_FIELD_CLASS : FIELD_CLASS
                }
              />
              {fieldErrors.eyebrow && (
                <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
                  {fieldErrors.eyebrow}
                </p>
              )}
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="title">
                Título de boas-vindas
              </label>
              <input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={fieldErrors.title ? ERROR_FIELD_CLASS : FIELD_CLASS}
              />
              {fieldErrors.title && (
                <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
                  {fieldErrors.title}
                </p>
              )}
            </div>
          </div>

          <h3 className="mt-5.5 mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
            Seções do site
          </h3>
          <div className="flex flex-col gap-1.5">
            {optional.map((section) => {
              const enabled = !disabledSections.has(section);
              return (
                <label
                  key={section}
                  className="relative flex cursor-pointer items-center gap-3 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5"
                >
                  <span className="flex-1 text-[13px] font-bold text-admin-primary">
                    {SECTION_LABELS[section]}
                  </span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleSection(section)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`relative h-[21px] w-9 flex-none rounded-full ${
                      enabled
                        ? "bg-admin-primary-soft"
                        : "bg-admin-input-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        enabled ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </label>
              );
            })}
            {MANDATORY_SECTIONS.map((section) => (
              <div
                key={section}
                className="flex items-center gap-3 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5 opacity-70"
              >
                <span className="flex-1 text-[13px] font-bold text-admin-primary">
                  {SECTION_LABELS[section]}
                </span>
                <AdminIcon
                  name="lock"
                  className="h-3.5 w-3.5 flex-none text-admin-accent"
                />
              </div>
            ))}
            {/* Every disabled section, resubmitted as hidden inputs: this
                is what the action reads, not the checkboxes above, which
                only drive local state. */}
            {[...disabledSections].map((section) => (
              <input
                key={section}
                type="hidden"
                name="disabledSections"
                value={section}
                readOnly
              />
            ))}
          </div>
          <p className="mt-2.5 text-xs text-admin-muted">
            O que você desligar some do site na hora que publicar. As seções com
            cadeado são obrigatórias por lei e ficam sempre no ar.
          </p>
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
          >
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3.5">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-admin-primary btn-lg"
          >
            {saving ? "Salvando…" : "Salvar e publicar"}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving}
            className="btn btn-admin-secondary btn-lg"
          >
            Descartar mudanças
          </button>
          <span className="text-[12.5px] text-admin-faint">
            As mudanças só valem depois de "Salvar e publicar".
          </span>
        </div>
      </form>

      <div className="flex flex-col gap-2.5 xl:sticky xl:top-5">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
          Veja como fica no celular
        </span>
        <VisualIdentityPreview
          theme={theme}
          eyebrow={eyebrow}
          title={title}
          heroSrc={heroPreview}
          sealLight={sealLightPreview ?? tenant.logos.seal.light}
          sealDark={sealDarkPreview ?? tenant.logos.seal.dark}
          officeName={tenant.name}
          sections={enabledPreviewSections}
        />
        <p className="text-xs leading-relaxed text-admin-faint">
          A prévia segue o estilo, os textos, a imagem e as seções escolhidos ao
          lado, antes de publicar.
        </p>
      </div>
    </div>
  );
}
