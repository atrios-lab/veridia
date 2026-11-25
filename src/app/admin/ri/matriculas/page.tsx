import { Plus } from "lucide-react";
import Link from "next/link";
import { situationOf } from "@/core/ri/acts.ts";
import { formatCnm } from "@/core/ri/cnm.ts";
import { CNM_SITUATIONS } from "@/core/ri/codes.ts";
import { addressLine, propertyTitle } from "@/core/ri/property.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Matrículas" };

const LIMIT = 300;

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function MatriculasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, tenant } = await requireRi();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = params.situacao ?? "";
  const local = params.local ?? "";
  const apagadas = params.apagadas === "1";
  const acervo = await loadAcervo(tenant.slug, { deleted: apagadas });
  const rows = acervo.properties
    .filter((p) => (apagadas ? Boolean(p.deletedAt) : !p.deletedAt))
    .map((p) => ({ p, s: situationOf(acervo.acts.get(p.id) ?? []) }));
  const words = fold(q).split(/\s+/).filter(Boolean);
  const digits = q.replace(/\D/g, "");
  const filtered = rows.filter(({ p, s }) => {
    if (status !== "" && String(p.status) !== status) return false;
    if (local !== "" && String(p.location) !== local) return false;
    if (!q) return true;
    if (
      digits &&
      digits.length <= 7 &&
      String(p.number) === String(Number(digits))
    ) {
      return true;
    }
    const hay = fold(
      [
        p.number,
        p.cnm,
        addressLine(p),
        p.street,
        p.rural.denominacao,
        p.rural.ccir,
        p.rural.nirf,
        p.rural.car,
        p.rural.incra,
        p.rural.sigef,
        p.origin,
        p.ficha,
        ...s.owners.map((o) => `${o.name} ${o.document}`),
      ].join(" "),
    );
    const hayDigits = hay.replace(/\D/g, " ");
    return words.every(
      (word) =>
        hay.includes(word) ||
        (/^\d[\d./-]*$/.test(word) &&
          hayDigits.includes(word.replace(/\D/g, ""))),
    );
  });
  const shown = filtered.slice(0, LIMIT);
  return (
    <RiPage
      wide
      title="Matrículas"
      description="O acervo do Livro 2 (e do Livro 3 e das transcrições) no sistema, com a situação atual de cada uma: proprietários e ônus em vigor."
      actions={
        riCan(session, "ri.edit") && (
          <Link
            href="/admin/ri/matriculas/nova"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-4" /> Nova matrícula
          </Link>
        )
      }
    >
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
          Buscar
          <input
            name="q"
            defaultValue={q}
            placeholder="Número, CNM, proprietário, CPF, CCIR, denominação…"
            className="h-9 rounded-md border bg-background px-2.5 text-sm font-normal"
          />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <label htmlFor="ri-situacao">Situação</label>
          <NativeSelect id="ri-situacao" name="situacao" defaultValue={status}>
            <option value="">Todas</option>
            {[...CNM_SITUATIONS].map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <label htmlFor="ri-local">Localização</label>
          <NativeSelect id="ri-local" name="local" defaultValue={local}>
            <option value="">Urbano e rural</option>
            <option value="0">Urbano</option>
            <option value="1">Rural</option>
          </NativeSelect>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="apagadas"
            value="1"
            defaultChecked={apagadas}
            className="size-4"
          />
          Só as apagadas
        </label>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Buscar
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")}{" "}
        {filtered.length === 1 ? "matrícula" : "matrículas"}
        {filtered.length > LIMIT
          ? `; mostrando as ${LIMIT} primeiras. Refine a busca.`
          : "."}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma matrícula encontrada.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map(({ p, s }) => (
            <li key={p.id}>
              <Link
                href={`/admin/ri/matriculas/${p.id}`}
                className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3 shadow-xs transition-colors hover:border-primary/40 md:flex-row md:items-center md:gap-4"
              >
                <span className="flex flex-none items-center gap-2 md:w-48">
                  <span className="font-semibold text-foreground">
                    {propertyTitle(p)}
                  </span>
                  <span
                    className={`rounded-full px-2 text-xs font-medium ${p.status === 0 ? "bg-success-soft text-success-text" : "bg-muted text-muted-foreground"}`}
                  >
                    {statusLabel(p.status)}
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate text-foreground">
                    {s.owners.map((o) => o.name).join("; ") ||
                      "Sem proprietário lançado"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {addressLine(p) || "Sem endereço"}
                    {p.area ? ` · ${p.area}` : ""}
                  </span>
                </span>
                <span className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:w-72 md:justify-end">
                  {s.burdens.length > 0 && (
                    <span className="rounded-full bg-warning-soft px-2 font-medium text-warning-text">
                      {s.burdens.length} ônus
                    </span>
                  )}
                  <span className="tabular-nums">
                    {p.cnm ? formatCnm(p.cnm) : "sem CNM"}
                    {p.cnmInPgv ? " · no PGV" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </RiPage>
  );
}
