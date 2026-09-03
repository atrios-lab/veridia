"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The navigation list, on the client, so the page a visitor is on can be
 * marked.
 *
 * Client for one reason: the current route has to follow the navigation, and
 * the public layout that renders this is shared by every page. The App Router
 * reuses it on a client navigation instead of re-rendering it, so a path read
 * from the request would stay the one from the first load and the mark would
 * freeze on the page the visit started at, pointing confidently at the wrong
 * place, which is worse than not marking at all. Same reason the panel's
 * sidebar-nav.tsx is a client component.
 *
 * Which links exist is still decided on the server: what arrives here is the
 * list already filtered by the tenant's enabled sections.
 */
export function NavLinks({
  links,
  className,
  currentClassName,
  descriptions = false,
}: {
  links: readonly {
    label: string;
    href: string;
    section?: string;
    description?: string;
  }[];
  /** Applied to every link. */
  className: string;
  /** Added to the one the visitor is on, on top of `className`. */
  currentClassName: string;
  /** Show each link's description under its label, where there is room. */
  descriptions?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        // Exact, never a prefix: every route starts with "/", so a prefix
        // test would light up "Início" on every page of the site. It is also
        // what makes a page the menu does not list (say /privacidade) mark
        // nothing at all, with no special case for it.
        const current = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-section={link.section}
            aria-current={current ? "page" : undefined}
            className={current ? `${className} ${currentClassName}` : className}
          >
            {descriptions && link.description ? (
              <>
                <span className="block">{link.label}</span>
                <span className="block text-xs font-normal text-brand-muted">
                  {link.description}
                </span>
              </>
            ) : (
              link.label
            )}
          </Link>
        );
      })}
    </>
  );
}
