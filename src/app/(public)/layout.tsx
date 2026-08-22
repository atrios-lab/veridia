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
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { ChatWidget } from "./_components/chat-widget.tsx";
import { CookieNotice } from "./_components/cookie-notice.tsx";
import { Icon } from "./_components/icon.tsx";
import { BlobUploadProvider } from "./_lib/attachments.tsx";
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
                40 KB download for a 48px mark. */}
            <Image
              src={tenant.logos.seal.light}
              alt=""
              width={48}
              height={48}
              priority
              className="h-11 w-11 shrink-0 object-contain md:h-12 md:w-12"
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
            {/* data-section: no rodapé enxuto "Início" não tem link próprio,
                então é este aqui que prova ao e2e de gating que a seção rendeu. */}
            <Link
              href="/"
              data-section="inicio"
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

      {/* Whether the citizen's attachments go straight to the store is a
          server-side fact (see src/lib/uploads.ts) that every upload on the
          public site has to know. */}
      <main className="flex-1">
        <BlobUploadProvider
          enabled={blobUploadEnabled()}
          tenantSlug={tenant.slug}
        >
          {children}
        </BlobUploadProvider>
      </main>

      <footer className="bg-brand-primary text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="flex flex-col gap-4 sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-3">
                <Image
                  src={tenant.logos.seal.dark}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 object-contain"
                />
                <span className="block">
                  <span className="block font-serif text-base font-semibold">
                    {tenant.name}
                  </span>
                  <span className="block text-xs text-brand-on-dark-body">
                    {tenant.subtitle}
                  </span>
                </span>
              </div>

              <p className="max-w-sm text-sm leading-relaxed text-brand-on-dark-body">
                Serventia dotada de fé pública. Presença digital em conformidade
                com a Lei Geral de Proteção de Dados e o Provimento 213 do CNJ.
              </p>
            </div>

            {/* Colunas por tarefa, não pela ordem de navegação: o e2e de
                gating compara os data-section como conjunto (ver
                tenants.spec.ts), e "Início" fica coberto pelo link do header.
                Uma seção nova precisa entrar em uma das listas abaixo, senão
                o e2e acusa a ausência. */}
            {(
              [
                {
                  title: "Serviços",
                  hrefs: [
                    "/solicitar",
                    "/agendar",
                    "/protocolo",
                    "/editais",
                    "/selo",
                    "/centrais",
                  ],
                },
                {
                  title: "Cidadão",
                  hrefs: ["/lgpd", "/ouvidoria", "/transparencia", "/contato"],
                },
              ] as const
            ).map(({ title, hrefs }) => (
              // No toque os links ficam mais afastados: apertar a lista é um
              // ganho de altura na tela grande, não no dedo.
              <nav key={title} className="flex flex-col gap-3 md:gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-on-dark-accent">
                  {title}
                </span>
                {sections
                  .flatMap((section) =>
                    sectionNavLinks(section).map((link) => ({
                      ...link,
                      section,
                    })),
                  )
                  .filter((link) =>
                    (hrefs as readonly string[]).includes(link.href),
                  )
                  .map((link) => (
                    <Link
                      key={link.href}
                      data-section={link.section}
                      href={link.href}
                      className="text-sm text-brand-on-dark-body hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                {title === "Cidadão" && (
                  <Link
                    href="/privacidade"
                    className="text-sm text-brand-on-dark-body hover:text-white"
                  >
                    Política de privacidade
                  </Link>
                )}
              </nav>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-white/15 pt-5 text-xs text-brand-on-dark-muted md:flex-row md:items-center md:justify-between">
            <span>
              {tenant.name} · {tenant.subtitle}. Todos os direitos reservados.
            </span>
            <span className="flex items-center gap-2">
              {/* Duas paths e fill currentColor: inline, a marca acompanha a
                  cor do crédito sem virar um segundo request. */}
              <svg
                viewBox="0 0 400 400"
                className="h-[18px] w-[18px]"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
                aria-hidden="true"
              >
                <path d="M39.04 128.87c-1.23,77.99 -0.52,163.71 -0.22,240.81 11.39,-3.28 84.14,-35.7 89.52,-40.65l-0.01 -155.23c2.75,-2.73 11.89,-8.51 15.41,-10.74l32.07 -21.05c4.81,-3.37 11.76,-7.08 16.56,-11.1 0.97,-27.3 0.07,-71.63 0.14,-101.19l-153.47 99.15z" />
                <path d="M207.59 131.2c4.74,2.03 11.39,7.13 16.07,10.19l48.52 31.16 -0.58 157.71c10.39,3.14 70.09,34.07 89.51,40.04l0.55 -241.76 -76.79 -49.37c-17.31,-11.87 -39.72,-24.95 -57.79,-37.18 -4.81,-3.26 -15.12,-10.65 -19.67,-12.29l0.18 101.5z" />
              </svg>
              Desenvolvido por Átrios
            </span>
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
