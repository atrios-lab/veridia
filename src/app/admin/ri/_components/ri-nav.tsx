"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  BookMarked,
  BookOpen,
  ClipboardList,
  Files,
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

const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: "Trabalho",
    entries: [
      { label: "Mesa do RI", href: "/admin/ri", icon: LayoutDashboard },
      {
        label: "Protocolo (Livro 1)",
        href: "/admin/ri/protocolo",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "Acervo",
    entries: [
      {
        label: "Matrículas (Livro 2)",
        href: "/admin/ri/matriculas",
        icon: BookOpen,
      },
      {
        label: "Registro Auxiliar (Livro 3)",
        href: "/admin/ri/livro-3",
        icon: Files,
      },
      { label: "Pessoas", href: "/admin/ri/pessoas", icon: Users },
    ],
  },
  {
    title: "Índices",
    entries: [
      {
        label: "Indicador Real (Livro 4)",
        href: "/admin/ri/indicadores/real",
        icon: MapPin,
      },
      {
        label: "Indicador Pessoal (Livro 5)",
        href: "/admin/ri/indicadores/pessoal",
        icon: BookMarked,
      },
    ],
  },
  {
    title: "Migração e ONR",
    entries: [
      {
        label: "Pendências da migração",
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
    ],
  },
  {
    title: "Próximas fases",
    entries: [
      {
        label: "Mapa (SIG-RI)",
        href: "#mapa",
        icon: MapIcon,
        soon: true,
      },
      {
        label: "Livros e assinatura",
        href: "#livros",
        icon: Library,
        soon: true,
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

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/admin/ri") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Entries({ onPick }: { onPick?: () => void }) {
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
export function RiSideNav() {
  return (
    <aside className="sticky top-14 hidden max-h-svh w-64 self-start flex-none overflow-y-auto border-r bg-background md:block">
      <Entries />
    </aside>
  );
}

/** The drawer on a phone, opened from the top bar. */
export function RiMobileNav() {
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
          <Entries onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
