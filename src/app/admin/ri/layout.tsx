import { ArrowLeft, Search } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { cnsDigits } from "@/core/ri/cnm.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackgroundPicker } from "../_components/background-picker.tsx";
import {
  BACKGROUND_COOKIE,
  DARK,
  parseBackground,
  THEME_COOKIE,
} from "../_components/theme.ts";
import { ThemeToggle } from "../_components/theme-toggle.tsx";
import { riNavBadges } from "./_components/nav-badges.ts";
import { ProtocolReminder } from "./_components/protocol-reminder.tsx";
import { RiMobileNav, RiSideNav } from "./_components/ri-nav.tsx";

export const metadata = { title: "Registro de Imóveis" };

/**
 * The Registro de Imóveis as a system of its own (decision of 25/11/2026):
 * it opens in its own tab, with its own bar and menu, the panel's colours
 * and components. Whoever is not signed in, or is outside the panel's
 * hours, goes through the panel's own door (/admin), which knows what to
 * show them.
 */
export default async function RiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "admin.access", session.user.permissions)
  ) {
    redirect("/admin");
  }
  const tenant = await getTenant();
  if (
    !tenant.attributions.includes("RI") ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    redirect("/admin/atribuicoes");
  }
  const cns = cnsDigits(tenant.cns) ?? tenant.cns;
  const jar = await cookies();
  const background = parseBackground(jar.get(BACKGROUND_COOKIE)?.value);
  const badges = await riNavBadges(tenant.slug);
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-3 md:px-5">
        <RiMobileNav badges={badges} />
        <Link href="/admin/ri" className="flex min-w-0 items-center gap-2.5">
          {/* biome-ignore lint/performance/noImgElement: the office's seal, any size */}
          <img
            src={tenant.logos.seal.light}
            alt=""
            className="size-8 flex-none object-contain"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-foreground">
              Registro de Imóveis
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {tenant.name} · CNS {cns}
            </span>
          </span>
        </Link>
        <form
          action="/admin/ri/matriculas"
          className="ml-auto hidden w-full max-w-md items-center gap-2 rounded-md border bg-background px-2.5 md:flex"
        >
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <input
            name="q"
            aria-label="Buscar no Registro de Imóveis"
            placeholder="Matrícula, CNM, nome, CPF, CCIR, denominação…"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
        <div className="ml-auto flex flex-none items-center gap-1 md:ml-0">
          <ThemeToggle initialDark={jar.get(THEME_COOKIE)?.value === DARK} />
          <BackgroundPicker
            initialTint={background.tint}
            initialIntensity={background.intensity}
          />
        </div>
        <span className="hidden truncate text-xs text-muted-foreground lg:block">
          {session.user.name}
        </span>
        <Link
          href="/admin"
          className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm font-medium shadow-xs hover:bg-muted"
        >
          <ArrowLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">Voltar ao painel</span>
          <span className="sm:hidden">Painel</span>
        </Link>
      </header>
      <div className="flex flex-1">
        <RiSideNav badges={badges} />
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-8 empty:hidden">
            <ProtocolReminder />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
