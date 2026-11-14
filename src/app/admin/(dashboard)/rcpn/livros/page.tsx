import Link from "next/link";
import { RCPN_KIND_PLURALS, RCPN_KINDS } from "@/core/rcpn/record.ts";
import { rcpn } from "@/lib/rcpn.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { requireRcpn } from "../_lib/access.ts";

export const metadata = { title: "Livros do Registro Civil" };

const year = (iso: string) => iso.slice(0, 4);

export default async function RcpnBooksPage() {
  await requireRcpn();
  const tenant = await getTenant();
  const books = await rcpn.books(tenant.slug);

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Livros do Registro Civil"
        description="O índice de cada livro, montado com as informações gerais enviadas do sistema do registro civil. Abra um livro para ver os registros por folha e termo, abrir cada um e emitir a certidão já preenchida."
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        <BackLink href="/admin/rcpn" label="Registro Civil" />
        {books.length === 0 && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            Nenhum livro ainda. Envie as informações gerais do sistema do
            registro civil em Importar arquivos.
          </p>
        )}
        {RCPN_KINDS.map((kind) => {
          const own = books.filter((b) => b.kind === kind);
          if (own.length === 0) return null;
          return (
            <section key={kind} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {RCPN_KIND_PLURALS[kind]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {own.map((b) => (
                  <Link
                    key={`${b.subtype}-${b.book}`}
                    href={`/admin/rcpn/livros/${kind}/${encodeURIComponent(b.book || "-")}`}
                    className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40"
                  >
                    <span className="font-semibold text-foreground">
                      Livro {b.book || "sem número"}
                      {b.subtype === "natimorto" ? " · Natimortos" : ""}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {b.count.toLocaleString("pt-BR")}{" "}
                      {b.count === 1 ? "registro" : "registros"}
                    </span>
                    {b.first && (
                      <span className="text-xs text-muted-foreground">
                        {year(b.first) === year(b.last)
                          ? `Registros de ${year(b.first)}`
                          : `Registros de ${year(b.first)} a ${year(b.last)}`}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
