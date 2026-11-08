import { AdminIcon } from "../../../_components/icon.tsx";

/**
 * The course's support PDF, under the player of every lesson: where the
 * person is when they want the text of what they just watched. The link is
 * the panel's own address (see `[curso]/apostila/route.ts`), never the
 * store's.
 */
export function CourseMaterial({ courseSlug }: { courseSlug: string }) {
  const href = `/admin/ajuda/${encodeURIComponent(courseSlug)}/apostila`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="group flex items-center gap-3.5 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4 transition-colors duration-120 hover:border-admin-input-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-focus-ring"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-admin-primary text-white"
      >
        <AdminIcon name="file" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-admin-primary group-hover:underline">
          Apostila do curso
        </span>
        <span className="block text-[12.5px] text-admin-muted">
          PDF com o texto de apoio de todas as aulas. Abre numa nova aba.
        </span>
      </span>
      <span className="btn btn-admin-secondary btn-sm flex-none">
        Abrir apostila
      </span>
    </a>
  );
}
