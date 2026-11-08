import { Icon } from "./icon.tsx";

// Formats every browser draws. HEIC is accepted on upload (it is what an
// iPhone hands over) but only Safari renders it, so it gets the link.
const INLINE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * The file an office attached to a publication, shown with it: the image
 * itself when it is one, a link that opens the PDF otherwise. Without this
 * the home showed only the type, the date and the title, and the document
 * the office took the trouble to attach never reached the citizen.
 */
export function PublicationAttachment({
  id,
  title,
  mimeType,
  compact = false,
}: {
  id: string;
  title: string;
  mimeType: string | null;
  compact?: boolean;
}) {
  const href = `/publicacoes/${id}/arquivo`;
  if (mimeType && INLINE_IMAGE_TYPES.includes(mimeType)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="mt-3 block overflow-hidden rounded-xl border border-brand-border"
      >
        {/* biome-ignore lint/performance/noImgElement: served by our own
            route, which checks the publication is live on every request;
            next/image would cache the bytes past the exit date. */}
        <img
          src={href}
          alt={`Imagem anexada: ${title}`}
          loading="lazy"
          className={`w-full bg-brand-tint object-contain ${compact ? "max-h-56" : "max-h-[28rem]"}`}
        />
      </a>
    );
  }
  const isPdf = !mimeType || mimeType === "application/pdf";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="btn btn-ghost btn-sm mt-3 px-0"
    >
      <Icon name="file" className="h-4 w-4 text-brand-accent" />
      {isPdf ? "Abrir o documento (PDF)" : "Abrir a imagem anexada"}
    </a>
  );
}
