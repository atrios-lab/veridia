import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  type CohortState,
  normalizeCohortCode,
} from "@/core/cohorts/cohort.ts";
import { isCoursesTenant } from "@/core/tenant/courses-tenant.ts";
import { cohortByCode } from "@/lib/cohorts.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { JoinForm } from "./join-form.tsx";

// A link is a private invitation, not a page for search engines.
export const metadata: Metadata = {
  title: "Inscrição no curso",
  robots: { index: false, follow: false },
};

type Params = Promise<{ codigo: string }>;

const UNAVAILABLE: Record<
  Exclude<CohortState, "open"> | "not-found",
  { title: string; body: string }
> = {
  "not-found": {
    title: "Este link não existe",
    body: "Confira se o endereço foi copiado inteiro, ou peça o link de novo a quem enviou.",
  },
  closed: {
    title: "Este link não aceita mais inscrições",
    body: "Se você já tem conta, entre normalmente. Para entrar na turma, peça um link novo a quem enviou.",
  },
  expired: {
    title: "Este link não aceita mais inscrições",
    body: "O prazo de inscrição acabou. Se você já tem conta, entre normalmente.",
  },
  full: {
    title: "As vagas desta turma acabaram",
    body: "Se você já tem conta, entre normalmente. Para mais vagas, fale com quem enviou o link.",
  },
};

/**
 * Where a cohort link lands: the course, the office it is for and the
 * sign-up form. Only on the courses office's host; on any client office's
 * domain the address does not exist.
 */
export default async function CohortPage({ params }: { params: Params }) {
  const tenant = await getTenant();
  if (!isCoursesTenant(tenant)) notFound();

  const { codigo } = await params;
  const code = normalizeCohortCode(decodeURIComponent(codigo));
  const link = code ? await cohortByCode(code) : undefined;
  const courseHref = link
    ? `/admin/ajuda/${encodeURIComponent(link.courseSlug)}`
    : "/admin/ajuda";

  // Already signed in here: straight to the course.
  const session = await getSession();
  if (session) redirect(courseHref);

  const loginHref = `/admin/login?next=${encodeURIComponent(courseHref)}`;
  const unavailable =
    link?.state === "open" ? null : UNAVAILABLE[link?.state ?? "not-found"];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <div className="md:grid md:grid-cols-[360px_1fr] md:items-start md:gap-10">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
            Curso gratuito
          </span>
          <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
            {link ? link.courseTitle : "Inscrição no curso"}
          </h1>
          {link && (
            <p className="mt-2 text-[14px] font-semibold text-brand-primary">
              Turma do {link.cohort.officeName}
            </p>
          )}
          <p className="mt-3 text-[13.5px] leading-relaxed text-brand-muted">
            Crie a sua conta para assistir às aulas, fazer a avaliação e emitir
            o certificado. Cada pessoa da equipe usa a própria conta, e o
            progresso fica salvo para você continuar em outro dia.
          </p>
          <p className="mt-4 text-[13px] text-brand-muted">
            Já tem conta?{" "}
            <Link
              href={loginHref}
              className="font-semibold text-brand-primary underline"
            >
              Entrar
            </Link>
          </p>
        </div>

        <div className="mt-6 min-w-0 rounded-2xl border border-brand-border bg-brand-card p-5 md:mt-0 md:p-7">
          {unavailable || !link ? (
            <div>
              <h2 className="font-serif text-xl font-semibold text-brand-primary">
                {unavailable?.title}
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-brand-muted">
                {unavailable?.body}
              </p>
            </div>
          ) : (
            <JoinForm code={link.cohort.code} loginHref={loginHref} />
          )}
        </div>
      </div>
    </div>
  );
}
