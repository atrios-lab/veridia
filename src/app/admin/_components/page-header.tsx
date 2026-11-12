import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { can } from "@/core/auth/roles.ts";
import { courseHref, PANEL_COURSE_SLUG } from "@/core/tutorials/catalog.ts";
import { tutorialForRoute } from "@/core/tutorials/progress.ts";
import { getSession } from "@/lib/session.ts";
import { listPanelTutorials } from "@/lib/tutorials.ts";
import { buttonVariants } from "../_ui/button.tsx";
import { BackLink } from "./back-link.tsx";
import { AdminIcon } from "./icon.tsx";
import { screenHelpFor } from "./screen-help.ts";
import { ScreenHelpButton } from "./screen-help-button.tsx";

/**
 * A screen's title, in the screen's own content: the heading, an optional
 * line under it and, to the right, whatever the screen's primary action is.
 *
 * It used to be the bar across the top of the panel, with the date and the
 * chat pill; those moved to the top bar the layout renders once for every
 * screen (see top-bar.tsx), and what was left, the title, belongs to the
 * page. Same name and same two props as before, so the screens that call
 * `<AdminPageHeader title="…" />` before their `<main>` went on working
 * without an edit; `description` and `actions` are the two things the queue
 * needed on top.
 *
 * "Como usar esta tela" is the one thing here no screen asks for: the
 * header reads the route the middleware forwarded and looks it up in the
 * published tutorials itself, so a video published for a screen reaches
 * that screen with no edit to it. One indexed read per screen render, for
 * that; every caller is a server component, so nothing changes for them.
 */
export async function AdminPageHeader({
  title,
  back,
  description,
  actions,
  maxWidth,
}: {
  title: string;
  /** A subordinate screen's way home, rendered as a "Voltar" button over the title. */
  back?: { href: string; label: string };
  /** One sentence under the title, for a screen that needs introducing. */
  description?: string;
  /** The screen's primary action, e.g. the queue's "Lançar pedido". */
  actions?: ReactNode;
  /**
   * The width of the screen's content, in px, when it is limited: the
   * header then ends where the content's box ends, so the actions sit over
   * it and not at the far edge of a wide screen (decision of 12/11/2026).
   */
  maxWidth?: number;
}) {
  const pathname = (await headers()).get("x-pathname");
  // The "!" and the "Configurar" of this screen (decision of 11/11/2026).
  const help = screenHelpFor(pathname);
  const session = help?.configure ? await getSession() : null;
  const canConfigure = Boolean(
    help?.configure &&
      session &&
      can(
        session.user.role ?? "",
        help.configure.permission,
        session.user.permissions,
      ),
  );
  // Not on the settings screen itself.
  const showConfigure =
    canConfigure &&
    help?.configure &&
    pathname !== help.configure.href &&
    !pathname?.startsWith(`${help.configure.href}/`);
  const tutorial =
    // The tutorials screens teaching themselves would be one link too many.
    pathname && !pathname.startsWith("/admin/ajuda")
      ? tutorialForRoute(await listPanelTutorials(), pathname)
      : undefined;

  return (
    <div
      className="flex flex-none flex-wrap items-end gap-4 px-4 pt-6 md:px-8 md:pt-8"
      style={maxWidth ? { maxWidth } : undefined}
    >
      <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
        {back && <BackLink href={back.href} label={back.label} />}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl leading-tight font-semibold text-foreground">
            {title}
          </h1>
          {help && (
            <span className="self-center">
              <ScreenHelpButton help={help} canConfigure={canConfigure} />
            </span>
          )}
          {tutorial && (
            <Link
              href={courseHref(PANEL_COURSE_SLUG, tutorial.id)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <AdminIcon name="play" className="h-4 w-4 flex-none" />
              Como usar esta tela
            </Link>
          )}
        </div>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(showConfigure || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {showConfigure && help?.configure && (
            <Link
              href={help.configure.href}
              className={buttonVariants({ variant: "outline" })}
              title={`Configurar: ${help.configure.label}`}
            >
              <AdminIcon name="settings" className="h-4 w-4" />
              Configurar
            </Link>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
