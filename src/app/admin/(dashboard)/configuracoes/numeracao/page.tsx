import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { GUIDE_KIND_INFO } from "@/core/guides/catalog.ts";
import { competenceTitle } from "@/core/iss/declaration.ts";
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
import { listIssDeclarationsWith } from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { listGuidesWith } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { ClearNumbering, type IssuedItem, IssuedList } from "./issued-list.tsx";
import { NumberingForm } from "./numbering-form.tsx";

export const metadata = { title: "Numeração de documentos" };

export default async function NumberingSettingsPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "numbering.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const year = officeYear(new Date());
  const years = [year, year + 1];
  const numbering = await getDocumentNumberingWith(db, tenant.slug);
  const may = (permission: "guides.manage" | "iss.manage") =>
    can(session.user.role ?? "", permission, session.user.permissions);
  const canManage = {
    guia: may("guides.manage"),
    "declaracao-iss": may("iss.manage"),
  };
  // What was issued this year, to renumber or exclude (a test) from here.
  const [guides, declarations] = await Promise.all([
    canManage.guia ? listGuidesWith(db, tenant.slug, year) : [],
    canManage["declaracao-iss"] ? listIssDeclarationsWith(db, tenant.slug) : [],
  ]);
  const issued: Record<"guia" | "declaracao-iss", IssuedItem[]> = {
    guia: guides.map((g) => ({
      id: g.id,
      year: g.year,
      sequence: g.sequence,
      number: SERIES_INFO.guia.format(g.year, g.sequence),
      description: GUIDE_KIND_INFO[g.guide.kind]?.label ?? "Guia",
      href: `/admin/utilitarios/guias/${g.id}`,
    })),
    "declaracao-iss": declarations
      .filter((d) => d.year === year)
      .sort((a, b) => a.sequence - b.sequence)
      .map((d) => ({
        id: d.id,
        year: d.year,
        sequence: d.sequence,
        number: SERIES_INFO["declaracao-iss"].format(d.year, d.sequence),
        description: `Competência ${competenceTitle(d.competence).toLowerCase()}`,
        href: `/admin/utilitarios/iss/${d.id}`,
      })),
  };

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
      <AdminPageHeader maxWidth={860} title="Configurações" />
      <main className="flex max-w-[860px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Numeração de documentos
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Cada documento numerado recomeça do 1 todo ano. Se a serventia já
            vinha numerando em outro lugar (por exemplo, as guias já estão na
            019/2026 no livro), informe aqui o próximo número, deste ano ou do
            ano que vem. O sistema nunca repete um número em uso.
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-admin-muted">
            Nas guias e nas declarações de ISS, você também pode alterar o
            número de um documento já emitido ou excluir um de teste: o número
            dele fica livre e é o próximo a ser usado. Excluir não apaga do
            banco; o registro continua na auditoria.
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
                  {row.floor ? (
                    <>
                      {row.floor === row.next && (
                        <span className="text-admin-muted">
                          {" "}
                          (definido aqui)
                        </span>
                      )}{" "}
                      <ClearNumbering series={series} year={row.year} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <NumberingForm
              series={series}
              years={perYear.map((row) => ({ year: row.year, next: row.next }))}
            />
            {series === "guia" || series === "declaracao-iss" ? (
              canManage[series] && (
                <IssuedList
                  series={series}
                  year={year}
                  items={issued[series]}
                />
              )
            ) : series === "notificacao" ? null : (
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
