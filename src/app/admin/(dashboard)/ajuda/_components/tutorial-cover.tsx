/**
 * A tutorial's cover, 16:9: the image the platform uploaded, or, without
 * one, a cover drawn from the title in the office's own colour. Drawn
 * rather than left blank so a video published before anyone made its
 * cover still holds its place on the shelf, the same size as the rest.
 *
 * No hooks and no "use client": the shelf renders it on the server and the
 * management list, a client component, renders the same thing as a
 * thumbnail. `children` lands on top of either, for the duration and the
 * watched tick.
 */
export function TutorialCover({
  title,
  posterUrl,
  size = "card",
  children,
}: {
  title: string;
  posterUrl: string | null;
  /** "thumb" shrinks the drawn title for the management list. */
  size?: "card" | "thumb";
  children?: React.ReactNode;
}) {
  return (
    <span className="relative block aspect-video w-full overflow-hidden bg-admin-primary">
      {posterUrl ? (
        // A plain <img>: the cover comes from the Blob store, already sized
        // by whoever made it, and next/image would need the store host in
        // its config for no gain on a handful of thumbnails.
        // biome-ignore lint/performance/noImgElement: see above.
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={
            size === "thumb"
              ? "absolute inset-0 flex flex-col justify-end gap-1 p-2"
              : "absolute inset-0 flex flex-col justify-end gap-2.5 p-4"
          }
        >
          <span
            className={
              size === "thumb"
                ? "block h-[2px] w-4 rounded-full bg-admin-accent"
                : "block h-[3px] w-8 rounded-full bg-admin-accent"
            }
          />
          <span
            className={
              size === "thumb"
                ? "line-clamp-3 font-serif text-[9px] leading-[1.15] font-semibold text-white"
                : "line-clamp-3 max-w-[85%] font-serif text-[21px] leading-[1.1] font-semibold text-white"
            }
          >
            {title}
          </span>
        </span>
      )}
      {children}
    </span>
  );
}
