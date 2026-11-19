"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  BODY_MAX,
  CORREICAO_NOTE,
  MAX_PHOTOS,
  NEWS_CATEGORIES,
  NEWS_PDF_PUBLIC_WARNING,
  SUMMARY_MAX,
  TITLE_MAX,
} from "@/core/news/news.ts";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  type NewsState,
  removeNewsFileAction,
  saveNewsAction,
} from "./actions.ts";

const PATH = "/admin/configuracoes/noticias";
const IDLE: NewsState = { status: "idle" };

/** The file chooser: a dashed box with a solid button, so it reads as "click here". */
const FILE_PICK =
  "block w-full cursor-pointer rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 p-2.5 text-sm text-muted-foreground transition-colors outline-none hover:border-primary hover:bg-primary/10 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90";

/** What the form needs of a post already registered. */
export interface PostView {
  id: string;
  title: string;
  category: string;
  eventDate: string;
  summary: string;
  body: string;
  published: boolean;
  imageConsent: boolean;
  photos: { id: string; name: string }[];
  pdf: { id: string; name: string } | null;
}

const fileUrl = (id: string) => `${PATH}/arquivo/${id}`;

/** Creates a post, or changes one: text, photos, PDF and what the site shows. */
export function NewsForm({ post }: { post?: PostView }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveNewsAction, IDLE);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new state reports
  useEffect(() => {
    if (state.status === "saved") {
      toast.success(state.message);
      router.push(PATH);
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [category, setCategory] = useState(post?.category ?? "evento-social");
  const [summaryLength, setSummaryLength] = useState(post?.summary.length ?? 0);
  const [pdfChosen, setPdfChosen] = useState(false);
  const [photosChosen, setPhotosChosen] = useState(0);
  const room = MAX_PHOTOS - (post?.photos.length ?? 0);
  return (
    <>
      <form
        action={action}
        encType="multipart/form-data"
        className="flex flex-col gap-4"
      >
        {post && <input type="hidden" name="id" value={post.id} />}
        <div className="grid gap-3 md:grid-cols-[1fr_16rem_11rem]">
          <label
            htmlFor={id("title")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Título
            <Input
              id={id("title")}
              name="title"
              required
              maxLength={TITLE_MAX}
              defaultValue={post?.title ?? ""}
              className="font-normal"
            />
          </label>
          <label
            htmlFor={id("category")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Tipo
            <NativeSelect
              id={id("category")}
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="font-normal"
            >
              {NEWS_CATEGORIES.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label
            htmlFor={id("date")}
            className="flex flex-col gap-1 text-sm font-medium"
          >
            Data do evento
            <Input
              id={id("date")}
              name="eventDate"
              type="date"
              defaultValue={post?.eventDate ?? ""}
              className="font-normal"
            />
          </label>
        </div>
        {category === "correicao" && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-text">
            {CORREICAO_NOTE}
          </p>
        )}
        <label
          htmlFor={id("summary")}
          className="flex flex-col gap-1 text-sm font-medium"
        >
          Resumo (aparece no cartão da lista)
          <Textarea
            id={id("summary")}
            name="summary"
            required
            rows={2}
            maxLength={SUMMARY_MAX}
            defaultValue={post?.summary ?? ""}
            onChange={(e) => setSummaryLength(e.target.value.length)}
            className="font-normal"
          />
          <span className="text-xs font-normal text-muted-foreground">
            {summaryLength}/{SUMMARY_MAX}
          </span>
        </label>
        <label
          htmlFor={id("body")}
          className="flex flex-col gap-1 text-sm font-medium"
        >
          Texto completo (opcional)
          <Textarea
            id={id("body")}
            name="body"
            rows={6}
            maxLength={BODY_MAX}
            defaultValue={post?.body ?? ""}
            className="font-normal"
          />
        </label>

        <fieldset className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Arquivos
          </legend>
          <div className="flex flex-col gap-2">
            <label
              htmlFor={id("photos")}
              className="text-sm font-medium text-foreground"
            >
              Fotos (até {MAX_PHOTOS})
            </label>
            {post && post.photos.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {post.photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="flex flex-col items-center gap-1"
                  >
                    {/* biome-ignore lint/performance/noImgElement: a private panel route, not an optimizable asset */}
                    <img
                      src={fileUrl(photo.id)}
                      alt={photo.name}
                      width={72}
                      height={72}
                      className="size-18 rounded-md border object-cover"
                    />
                    <button
                      type="submit"
                      form={`${uid}-rm-${photo.id}`}
                      className="text-xs font-medium text-destructive underline underline-offset-4"
                    >
                      Tirar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              id={id("photos")}
              name="photos"
              type="file"
              multiple
              disabled={room <= 0}
              accept="image/png,image/jpeg,image/webp"
              className={FILE_PICK}
              onChange={(e) => setPhotosChosen(e.target.files?.length ?? 0)}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG ou WebP, até 3 MB cada. Cabem mais {Math.max(room, 0)}.
              {photosChosen > room ? " Você escolheu fotos demais." : ""}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={id("pdf")}
              className="text-sm font-medium text-foreground"
            >
              Anexo em PDF (cartaz, resultado, programação)
            </label>
            {post?.pdf && (
              <p className="text-xs">
                <a
                  href={fileUrl(post.pdf.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {post.pdf.name}
                </a>{" "}
                <button
                  type="submit"
                  form={`${uid}-rm-${post.pdf.id}`}
                  className="font-medium text-destructive underline underline-offset-4"
                >
                  Tirar
                </button>
              </p>
            )}
            <input
              id={id("pdf")}
              name="pdf"
              type="file"
              accept="application/pdf"
              className={FILE_PICK}
              onChange={(e) => setPdfChosen(Boolean(e.target.files?.length))}
            />
            <p className="text-xs text-warning-text">
              {NEWS_PDF_PUBLIC_WARNING}
            </p>
            {pdfChosen && (
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  name="pdfPublic"
                  value="1"
                  required
                  className="mt-0.5"
                />
                <span>Confirmo que o PDF pode ser público.</span>
              </label>
            )}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-sm font-semibold text-foreground">
            O que aparece
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="published"
              value="1"
              defaultChecked={post?.published ?? false}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Mostrar no site</span>
              <span className="block text-xs text-muted-foreground">
                Desligado, a notícia fica só aqui no painel, como rascunho.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="imageConsent"
              value="1"
              defaultChecked={post?.imageConsent ?? false}
              className="mt-1"
            />
            <span>
              <span className="font-medium">
                Tenho a autorização de imagem das pessoas que aparecem nas fotos
              </span>
              <span className="block text-xs text-muted-foreground">
                Sem ela, as fotos não aparecem no site, mesmo enviadas. Guarde
                as autorizações (LGPD).
              </span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : post ? "Salvar" : "Criar notícia"}
          </Button>
          <a href={PATH} className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </a>
        </div>
      </form>
      {/* The "Tirar" buttons above belong to these, by their form attribute: a
        form cannot sit inside another. */}
      {post &&
        [...post.photos, ...(post.pdf ? [post.pdf] : [])].map((file) => (
          <form
            key={file.id}
            id={`${uid}-rm-${file.id}`}
            action={removeNewsFileAction}
          >
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="fileId" value={file.id} />
          </form>
        ))}
    </>
  );
}
