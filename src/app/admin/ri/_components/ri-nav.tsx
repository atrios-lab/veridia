"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  BookMarked,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileImage,
  Files,
  Globe,
  LayoutDashboard,
  Library,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Menu,
  ScanBarcode,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, useEffect, useState } from "react";
import { cn } from "../../_ui/cn.ts";

interface Entry {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Shown but not open yet: the next phases of the module. */
  soon?: true;
}

/** A count beside an entry, only when there is something to do. */
export interface NavBadge {
  text: string;
  warn?: boolean;
}

/**
 * The menu in the order of the work (decision of 28/11/2026): what is done
 * every day first, then the acervo, the books, the migração and the
 * serventia. The addresses stay the same.
 */
const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: "Dia a dia",
    entries: [
      { label: "Mesa do RI", href: "/admin/ri", icon: LayoutDashboard },
      {
        label: "Protocolo · Livro 1",
        href: "/admin/ri/protocolo",
        icon: ClipboardList,
      },
      {
        label: "Encerrar o dia",
        href: "/admin/ri/protocolo/dias",
        icon: CalendarCheck,
      },
      { label: "Certidões", href: "/admin/ri/certidoes", icon: Files },
    ],
  },
  {
    title: "Acervo",
    entries: [
      {
        label: "Matrículas · Livro 2",
        href: "/admin/ri/matriculas",
        icon: BookOpen,
      },
      {
        label: "Registro Auxiliar · Livro 3",
        href: "/admin/ri/livro-3",
        icon: Files,
      },
      { label: "Pessoas", href: "/admin/ri/pessoas", icon: Users },
      {
        label: "Aquisição por estrangeiro",
        href: "/admin/ri/estrangeiros",
        icon: Globe,
      },
    ],
  },
  {
    title: "Livros e índices",
    entries: [
      {
        label: "Livros e termos",
        href: "/admin/ri/livros",
        icon: Library,
      },
      {
        label: "Indicador Real · Livro 4",
        href: "/admin/ri/indicadores/real",
        icon: MapPin,
      },
      {
        label: "Indicador Pessoal · Livro 5",
        href: "/admin/ri/indicadores/pessoal",
        icon: BookMarked,
      },
      { label: "Mapa (SIG-RI)", href: "/admin/ri/mapa", icon: MapIcon },
    ],
  },
  {
    title: "Migração e ONR",
    entries: [
      {
        label: "Pendências",
        href: "/admin/ri/migracao",
        icon: ListChecks,
      },
      {
        label: "Importar e exportar",
        href: "/admin/ri/importar-exportar",
        icon: ArrowLeftRight,
      },
      { label: "CNM", href: "/admin/ri/cnm", icon: ScanBarcode },
      { label: "Arquivos para a ONR", href: "/admin/ri/onr", icon: Send },
      {
        label: "Imagens do Livro 2 (ONR)",
        href: "/admin/ri/onr/imagens",
        icon: FileImage,
      },
    ],
  },
  {
    title: "Serventia",
    entries: [
      {
        label: "Configurações",
        href: "/admin/ri/configuracoes",
        icon: Settings,
      },
      {
        label: "Guia: livros e prazos",
        href: "/admin/atribuicoes/registro-de-imoveis",
        icon: BookOpen,
      },
    ],
  },
];

const ALL_HREFS = SECTIONS.flatMap((s) => s.entries.map((e) => e.href));

const matches = (pathname: string, href: string) =>
  href === "/admin/ri"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

/** The entry that matches best: "Encerrar o dia" over "Protocolo". */
function isCurrent(pathname: string, href: string): boolean {
  if (!matches(pathname, href)) return false;
  return !ALL_HREFS.some(
    (other) => other.length > href.length && matches(pathname, other),
  );
}

function Entries({
  onPick,
  badges = {},
}: {
  onPick?: () => void;
  badges?: Record<string, NavBadge>;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Registro de Imóveis" className="flex flex-col gap-5 p-3">
      {SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          {section.entries.map((entry) => {
            const Icon = entry.icon;
            if (entry.soon) {
              return (
                <span
                  key={entry.href}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
                >
                  <Icon className="size-4 flex-none opacity-60" />
                  <span className="min-w-0 flex-1">{entry.label}</span>
                  <span className="rounded-full border px-1.5 text-xs">
                    em breve
                  </span>
                </span>
              );
            }
            const current = isCurrent(pathname, entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={onPick}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  current
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4 flex-none" />
                <span className="min-w-0 flex-1">{entry.label}</span>
                {badges[entry.href] && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                      current
                        ? "bg-background text-foreground"
                        : badges[entry.href]?.warn
                          ? "bg-warning-soft text-warning-text"
                          : "bg-primary-soft text-primary",
                    )}
                  >
                    {badges[entry.href]?.text}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      <Link
        href="/admin"
        onClick={onPick}
        className="mt-2 flex items-center gap-2 rounded-md border bg-background px-2 py-2 text-sm font-medium text-foreground shadow-xs hover:bg-muted"
      >
        <ArrowLeft className="size-4" />
        Voltar ao painel do cartório
      </Link>
    </nav>
  );
}

/** The fixed column on a computer. */
export function RiSideNav({ badges }: { badges?: Record<string, NavBadge> }) {
  return (
    <aside className="sticky top-14 hidden max-h-svh w-64 self-start flex-none overflow-y-auto border-r bg-background md:block">
      <Entries badges={badges} />
    </aside>
  );
}

/** The drawer on a phone, opened from the top bar. */
export function RiMobileNav({ badges }: { badges?: Record<string, NavBadge> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes on a new page
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Fechar o menu" : "Abrir o menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex size-10 items-center justify-center rounded-md border bg-background"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto border-t bg-background">
          <Entries badges={badges} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
