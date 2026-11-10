import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  floorOf,
  NUMBER_SERIES,
  SERIES_INFO,
} from "@/core/numbering/series.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import {
  getDocumentNumberingWith,
  lastUsedWith,
  nextNumberWith,
} from "@/lib/document-numbering.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { NumberingForm } from "./numbering-form.tsx";

export const metadata = { title: "Numeração de documentos" };

export default async function NumberingSettingsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const tenant = await getTenant();
  const year = officeYear(new Date());
  const years = [year, year + 1];
  const numbering = await getDocumentNumberingWith(db, tenant.slug);

  const rows = await Promise.all(
    NUMBER_SERIES.map(async (series) => {
      const info = SERIES_INFO[series];
      const perYear = await Promise.all(
        years.map(async (y) => {
          const [lastUsed, next] = await Promise.all([
            lastUsedWith(db, tenant.slug, series, y),
            nextNumberWith(db, tenant.slug, series, y),
          ]);
          const floor = floorOf(numbering, series, y);
          return {
            year: y,
            lastUsed,
            lastLabel: lastUsed ? info.format(y, lastUsed) : null,
            nextLabel: info.format(y, next),
            next,
            floor,
          };
        }),
      );
      return { series, info, perYear };
    }),
  );

  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[860px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs role={session.user.role ?? ""} />
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Numeração de documentos
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Cada documento numerado recomeça do 1 todo ano. Se a serventia já
            vinha numerando em outro lugar (por exemplo, as guias já estão na
            019/2026 no livro), informe aqui o próximo número, deste ano ou do
            ano que vem. O sistema nunca repete um número: o próximo é sempre o
            maior entre o que você informou e o último usado mais um.
          </p>
        </section>

        {rows.map(({ series, info, perYear }) => (
          <section
            key={series}
            aria-labelledby={`numeracao-${series}`}
            className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
          >
            <h3
              id={`numeracao-${series}`}
              className="font-serif text-[16px] font-semibold text-admin-primary"
            >
              {info.label}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-admin-muted">{info.hint}</p>
            <ul className="mt-3 grid gap-2 text-[13px] text-admin-text md:grid-cols-2">
              {perYear.map((row) => (
                <li
                  key={row.year}
                  className="rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5"
                >
                  <span className="font-bold text-admin-primary">
                    {row.year}
                  </span>
                  {": "}
                  {row.lastLabel
                    ? `último usado ${row.lastLabel}, `
                    : "nenhum emitido, "}
                  próximo <strong>{row.nextLabel}</strong>
                  {row.floor && row.floor === row.next ? (
                    <span className="text-admin-muted"> (definido aqui)</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <NumberingForm
              series={series}
              years={perYear.map((row) => ({ year: row.year, next: row.next }))}
            />
            {series === "guia" ? (
              <p className="mt-2.5 text-[12px] text-admin-muted">
                Para trocar o número de uma guia já emitida, abra a guia em{" "}
                <Link
                  href="/admin/utilitarios/guias"
                  className="font-semibold text-admin-primary underline"
                >
                  Guias de recolhimento
                </Link>{" "}
                e use "Alterar número".
              </p>
            ) : (
              <p className="mt-2.5 text-[12px] text-admin-muted">
                Protocolos já entregues não mudam: o cidadão já tem o número e o
                pagamento por Pix está ligado a ele.
              </p>
            )}
          </section>
        ))}
      </main>
    </>
  );
}
