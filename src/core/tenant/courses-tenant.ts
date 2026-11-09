// The office where course cohorts land (see tenants/vale-do-silicio.ts).
// The one place that knows its slug: routes ask `isCoursesTenant`, so the
// cohort sign-up can never answer on a client office's domain.

export const COURSES_TENANT_SLUG = "atrios-cursos";

export function isCoursesTenant(tenant: { slug: string }): boolean {
  return tenant.slug === COURSES_TENANT_SLUG;
}

/** The address a cohort link is printed with, whatever host the platform
 * account happens to be signed in on. */
export const COURSES_TENANT_ORIGIN = "https://curso.atrioss.com";

/**
 * The origin to print on a cohort link: the courses host as seen from the
 * current request's environment. In development the platform account works
 * on `*.localhost`, and a link pointing at production from there would be
 * useless to test; anywhere else it is always the production address.
 */
export function coursesOrigin(currentOrigin: string): string {
  try {
    const url = new URL(currentOrigin);
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
      return `${url.protocol}//curso.localhost${url.port ? `:${url.port}` : ""}`;
    }
  } catch {
    // An unparsable origin falls through to the production address.
  }
  return COURSES_TENANT_ORIGIN;
}
