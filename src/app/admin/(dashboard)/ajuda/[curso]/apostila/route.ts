import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getPublishedCourseBySlug } from "@/lib/courses.ts";
import { getSession } from "@/lib/session.ts";

/**
 * A course's support PDF, at an address of the panel's own
 * (`/admin/ajuda/<curso>/apostila`) and with a file name that says what it
 * is, instead of the store's `…blob.vercel-storage.com/treinamento/<uuid>.pdf`.
 * The bytes are streamed through: the store URL never reaches the page.
 *
 * Panel users only, like the course itself. Opens in the browser's own PDF
 * viewer (`inline`); saving it keeps the readable name.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ curso: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Não encontrado.", { status: 404 });
  const { curso } = await params;
  const course = await getPublishedCourseBySlug(curso);
  if (!course?.materialUrl) {
    return new Response("Não encontrado.", { status: 404 });
  }

  const headers = {
    "content-type": "application/pdf",
    "content-disposition": `inline; filename="apostila-${course.slug}.pdf"`,
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
  };

  // Development keeps the file under public/uploads; a deploy, in the store.
  if (course.materialUrl.startsWith("/uploads/")) {
    const base = resolve("./public");
    const path = resolve(join(base, course.materialUrl));
    if (!path.startsWith(`${base}/`)) {
      return new Response("Não encontrado.", { status: 404 });
    }
    return new Response(new Uint8Array(await readFile(path)), { headers });
  }

  const upstream = await fetch(course.materialUrl);
  if (!upstream.ok || !upstream.body) {
    console.error("apostila.upstream", upstream.status, course.slug);
    return new Response("Não foi possível abrir a apostila agora.", {
      status: 502,
    });
  }
  return new Response(upstream.body, { headers });
}
