import Link from "next/link";
import { isWithinChatHours, nextChatOpening } from "@/core/chat/hours.ts";
import { longWeekday, toIsoDate } from "@/core/scheduling/calendar.ts";
import { isChatEnabled } from "@/lib/chat.ts";
import { Icon } from "../_components/icon.tsx";
import { requireSection } from "../_lib/section.ts";
import { CopyEmailButton } from "./copy-email-button.tsx";
import { OpenChatButton } from "./open-chat-button.tsx";

export const metadata = { title: "Contato" };

const TIME_ZONE = "America/Sao_Paulo";

const digits = (value: string) => value.replace(/\D/g, "");

function statusBadge(open: boolean, label: string) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
        open
          ? "bg-brand-tint text-brand-primary-soft"
          : "border border-brand-border bg-brand-surface text-brand-muted"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

export default async function ContactPage() {
  const tenant = await requireSection("centrais-contato");
  const chatEnabled = await isChatEnabled(tenant.slug);

  const now = new Date();
  const open = isWithinChatHours(tenant, now);
  let statusLabel: string;
  if (open) {
    statusLabel = `Aberto agora · fecha às ${tenant.counterHours.endHour}h`;
  } else {
    const opening = nextChatOpening(tenant, now);
    const today = toIsoDate(now, TIME_ZONE);
    const dayLabel = opening.day === today ? "hoje" : longWeekday(opening.day);
    statusLabel = `Fechado agora · abre ${dayLabel} às ${opening.hour}h`;
  }

  const whatsappUrl = `https://wa.me/55${digits(tenant.contacts.whatsapp)}`;
  const phoneUrl = `tel:+55${digits(tenant.contacts.phone)}`;
  const mapsUrl = tenant.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tenant.address)}`
    : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">
            Onde nos encontrar
          </span>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
            Contato
          </h1>
        </div>
        <div className="flex flex-col items-start gap-2.5 md:items-end">
          {statusBadge(open, statusLabel)}
          <Link
            href="/centrais"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:text-brand-primary-soft"
          >
            Links oficiais
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div
        className={`mt-6 grid grid-cols-1 items-start gap-4 ${tenant.address ? "md:grid-cols-[400px_1fr]" : ""}`}
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10.5 w-10.5 flex-none items-center justify-center rounded-xl bg-brand-tint">
                <Icon
                  name="whatsapp"
                  className="h-4.5 w-4.5 text-brand-primary-soft"
                />
              </span>
              <div className="flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-accent">
                  WhatsApp e telefone
                </div>
                <div className="mt-0.5 text-base font-bold text-brand-primary">
                  {tenant.contacts.phone}
                </div>
              </div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener"
                className="btn btn-primary btn-md hidden flex-none md:inline-flex"
              >
                Chamar no WhatsApp
              </a>
            </div>
            <div className="mt-3 flex gap-2 md:hidden">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener"
                className="btn btn-primary btn-md flex-1 justify-center"
              >
                Chamar no WhatsApp
              </a>
              <a
                href={phoneUrl}
                className="btn btn-secondary btn-md flex-1 justify-center"
              >
                Ligar
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-card p-4">
            <span className="flex h-10.5 w-10.5 flex-none items-center justify-center rounded-xl bg-brand-tint">
              <Icon
                name="mail"
                className="h-4.5 w-4.5 text-brand-primary-soft"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-accent">
                E-mail institucional
              </div>
              <div className="mt-0.5 truncate text-[15px] font-bold text-brand-primary">
                {tenant.contacts.email}
              </div>
            </div>
            <CopyEmailButton email={tenant.contacts.email} />
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10.5 w-10.5 flex-none items-center justify-center rounded-xl bg-brand-tint">
                <Icon
                  name="clock"
                  className="h-4.5 w-4.5 text-brand-primary-soft"
                />
              </span>
              <div className="flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-accent">
                  Horário de atendimento
                </div>
                <div className="mt-0.5 text-[15px] font-bold text-brand-primary">
                  {tenant.openingHours}
                </div>
              </div>
            </div>
            <p className="mt-2.5 border-t border-brand-border pt-2.5 text-xs leading-relaxed text-brand-muted">
              Sem fechar para almoço. Fins de semana e feriados: fechado — os
              canais online desta página funcionam a qualquer hora.
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft p-4">
            <Icon
              name="info"
              className="mt-0.5 h-4 w-4 flex-none text-brand-accent"
            />
            <p className="text-xs leading-relaxed text-brand-accent">
              Elogios, reclamações e sugestões têm canal próprio: a{" "}
              <Link href="/ouvidoria" className="font-semibold underline">
                Ouvidoria
              </Link>
              . Assuntos de dados pessoais vão pelo{" "}
              <Link href="/lgpd" className="font-semibold underline">
                Canal LGPD
              </Link>
              .
            </p>
          </div>
        </div>

        {tenant.address && (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-card md:flex-col-reverse">
            <div
              aria-hidden="true"
              className="relative h-40 overflow-hidden bg-brand-tint md:h-[396px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand-tint via-brand-surface to-brand-tint" />
              <div className="absolute inset-x-0 top-1/3 h-6 -rotate-6 bg-brand-card shadow-[0_0_0_1px_var(--color-brand-border)]" />
              <div className="absolute inset-y-0 left-[28%] w-3 rotate-12 bg-brand-card shadow-[0_0_0_1px_var(--color-brand-border)]" />
              <div className="absolute top-[15%] right-[18%] h-16 w-24 rounded-lg bg-brand-border/50" />
              <div className="absolute top-[15%] left-[12%] h-12 w-16 rounded-lg bg-brand-border/50" />
              <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
                <span className="mb-0.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-lg">
                  {tenant.name}
                </span>
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  className="text-brand-alert"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"
                  />
                  <circle cx="12" cy="10" r="3" fill="white" />
                </svg>
              </div>
              <div className="absolute right-2 bottom-2 rounded-md bg-brand-card/85 px-2 py-1 text-[10px] text-brand-faint">
                mapa ilustrativo · abre no app de mapas
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-brand-border p-4 md:border-t-0 md:border-b">
              <Icon
                name="mapPin"
                className="h-4 w-4 flex-none text-brand-alert"
              />
              <span className="flex-1 text-sm font-bold text-brand-primary">
                {tenant.address}
              </span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener"
                className="btn btn-primary btn-md flex-none"
              >
                Como chegar
                <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-brand-primary p-6 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-brand-on-dark-body">
          <strong className="text-white">
            Prefere resolver sem sair de casa?
          </strong>{" "}
          A maioria dos serviços começa online e você só vem ao cartório para
          concluir.
        </p>
        <div className="flex flex-none flex-wrap gap-2.5">
          <Link
            href="/solicitar"
            className="btn btn-md bg-white text-brand-primary hover:bg-brand-tint"
          >
            Solicitar serviço
          </Link>
          <Link
            href="/agendar"
            className="btn btn-md border border-brand-primary-soft text-brand-on-dark-body hover:border-brand-accent"
          >
            Agendar horário
          </Link>
          {chatEnabled && <OpenChatButton />}
        </div>
      </div>
    </div>
  );
}
