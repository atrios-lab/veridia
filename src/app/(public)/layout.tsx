import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import {
  enabledSections,
  isSectionEnabled,
  SECTION_ROUTES,
  sectionNavLinks,
} from "@/core/tenant/gating.ts";
import { isChatEnabled } from "@/lib/chat.ts";
import { SERIF } from "@/lib/fonts.ts";
import { getTenant } from "@/lib/tenant.ts";
import { ChatWidget } from "./_components/chat-widget.tsx";
import { CookieNotice } from "./_components/cookie-notice.tsx";
import { Icon } from "./_components/icon.tsx";
import { COOKIE_NOTICE_COOKIE } from "./_lib/cookie-notice.ts";

// The redesign's header: home, the two tasks, notices and contact, with the
// lookup as the highlighted button. The full gated list lives in the footer,
// which is where a nine item menu belongs.
const HEADER_SECTIONS = [
  "pedidos",
  "agendamento",
  "editais",
  "centrais-contato",
] as const;

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getTenant();
  const sections = enabledSections(tenant);
  const headerSections = HEADER_SECTIONS.filter((s) =>
    isSectionEnabled(tenant, s),
  );
  // Server-side gate on the office's switch: an office with chat off never
  // ships the component to the client at all. The client then polls its own
  // state to react within seconds if the switch flips mid-session (see
  // chat-widget.tsx): this only covers page load.
  const chatEnabled = await isChatEnabled(tenant.slug);
  const cookieStore = await cookies();
  const cookieNoticeAcknowledged = cookieStore.has(COOKIE_NOTICE_COOKIE);

  return (
    <div
      data-theme={tenant.theme}
      className={`${SERIF[tenant.theme].variable} flex min-h-screen flex-col bg-brand-surface text-brand-text`}
    >
      <header className="border-b border-brand-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-10 md:py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* The seals ship as 1480px squares: served raw they would be a
                40 KB download for a 40px mark. */}
            <Image
              src={tenant.logos.seal.light}
              alt=""
              width={40}
              height={40}
              priority
              className="h-9 w-9 shrink-0 object-contain md:h-10 md:w-10"
            />
            <span className="block">
              <span className="block font-serif text-[15px] font-semibold text-brand-primary md:text-[17px]">
                {tenant.name}
              </span>
              <span className="block text-[9px] uppercase tracking-[0.08em] text-brand-muted md:text-[10px]">
                {tenant.subtitle}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/"
              className="text-sm font-medium text-brand-primary hover:text-brand-primary-soft"
            >
              Início
            </Link>
            {headerSections.flatMap((section) =>
              sectionNavLinks(section).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-brand-primary hover:text-brand-primary-soft"
                >
                  {link.label}
                </Link>
              )),
            )}
            {isSectionEnabled(tenant, "consulta-protocolo") && (
              <Link
                href={SECTION_ROUTES["consulta-protocolo"]}
                className="btn btn-primary btn-md"
              >
                Consultar protocolo
              </Link>
            )}
          </nav>

          {/* Native disclosure: a menu that opens without a line of JavaScript
              keeps working while the page is still hydrating. */}
          <details className="relative md:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-lg p-1.5 text-brand-primary [&::-webkit-details-marker]:hidden">
              <Icon name="menu" className="h-6 w-6" />
              <span className="sr-only">Abrir menu</span>
            </summary>
            <nav className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-brand-border bg-brand-card p-2 shadow-lg">
              {sections.flatMap((section) =>
                sectionNavLinks(section).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-brand-primary hover:bg-brand-tint"
                  >
                    {link.label}
                  </Link>
                )),
              )}
            </nav>
          </details>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-brand-primary text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:px-10">
          <div className="flex items-center gap-3">
            <Image
              src={tenant.logos.dark}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="font-serif text-sm font-semibold">
              {tenant.name}
            </span>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {sections.flatMap((section) =>
              sectionNavLinks(section).map((link) => (
                <Link
                  key={link.href}
                  data-section={section}
                  href={link.href}
                  className="text-xs text-brand-on-dark-body hover:text-white"
                >
                  {link.label}
                </Link>
              )),
            )}
          </nav>

          <div className="flex flex-col gap-1 text-[11px] text-brand-on-dark-muted">
            <span>
              {tenant.openingHours} · {tenant.contacts.phone} ·{" "}
              {tenant.contacts.email}
            </span>
            <span>CNS {tenant.cns}</span>
            <span>{tenant.legalFooter}</span>
            <Link href="/privacidade" className="hover:text-white">
              Política de privacidade
            </Link>
          </div>
        </div>
      </footer>

      {/* The chat waits for the cookie notice: both live in the bottom-right
          corner, and the chat sets its own cookie: it only shows up once the
          citizen has seen the notice. */}
      {chatEnabled && cookieNoticeAcknowledged && (
        <ChatWidget tenant={tenant} />
      )}
      {!cookieNoticeAcknowledged && <CookieNotice />}
    </div>
  );
}
