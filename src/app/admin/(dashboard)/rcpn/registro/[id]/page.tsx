import Link from "next/link";
import { notFound } from "next/navigation";
import {
  certidaoModel,
  formatMatricula,
  prefillCertidao,
} from "@/core/rcpn/certidao.ts";
import {
  formatIsoDate,
  RCPN_KIND_LABELS,
  RCPN_ROLE_LABELS,
} from "@/core/rcpn/record.ts";
import { db } from "@/db/index.ts";
import { getRecordWith } from "@/lib/rcpn-certidao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { canIssue, requireRcpn } from "../../_lib/access.ts";

export const metadata = { title: "Registro" };

export default async function RcpnRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRcpn();
  const tenant = await getTenant();
  const record = await getRecordWith(db, tenant.slug, (await params).id);
  if (!record) notFound();
  const issue = canIssue(session);
  // The certidão as it will come out: the index plus the book's data.
  const fields = prefillCertidao(record);
  const model = certidaoModel(record.kind);
  const filled = model.fields.filter((f) => fields[f.key]?.trim()).length;
  const where = [
    record.book && `Livro ${record.book}`,
    record.page && `folha ${record.page}`,
    record.term && `termo ${record.term}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`${RCPN_KIND_LABELS[record.kind]}${record.subtype === "natimorto" ? " · Natimorto" : ""}: ${record.people.map((p) => p.name).join(" e ")}`}
        description={where || undefined}
        actions={
          issue ? (
            <span className="inline-flex flex-wrap gap-2">
              <Link
                href={`/admin/rcpn/certidoes/nova?registro=${record.id}`}
                className={buttonVariants()}
              >
                Emitir certidão
              </Link>
              <Link
                href={`/admin/rcpn/certidoes/nova?registro=${record.id}&via=inteiro-teor`}
                className={buttonVariants({ variant: "outline" })}
              >
                Inteiro teor
              </Link>
            </span>
          ) : undefined
        }
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/rcpn/livros/${record.kind}/${encodeURIComponent(record.book || "-")}`}
          label={`Livro ${record.book || "sem número"}`}
        />
        <section className="grid gap-3 rounded-xl border bg-card p-6 shadow-xs sm:grid-cols-2">
          <p className="text-sm">
            <span className="block text-xs text-muted-foreground">
              Matrícula
            </span>
            <span className="font-mono">
              {record.matricula ? formatMatricula(record.matricula) : "-"}
            </span>
          </p>
          <p className="text-sm">
            <span className="block text-xs text-muted-foreground">
              Data do registro
            </span>
            {formatIsoDate(record.registeredOn) || "-"}
          </p>
          {record.people.map((p) => (
            <p key={p.role} className="text-sm sm:col-span-2">
              <span className="block text-xs text-muted-foreground">
                {RCPN_ROLE_LABELS[p.role]}
              </span>
              <span className="font-medium text-foreground">{p.name}</span>
              {p.birthDate && ` · nascimento em ${formatIsoDate(p.birthDate)}`}
              {(p.motherName || p.fatherName) &&
                ` · filiação: ${[p.fatherName, p.motherName].filter(Boolean).join(" e ")}`}
              {p.profession && ` · profissão: ${p.profession}`}
            </p>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              A certidão como vai sair
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
              {filled} de {model.fields.length} campos do modelo já preenchidos
              com o que o sistema do registro civil enviou. Ao emitir, todos
              podem ser conferidos com o livro e corrigidos.
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {model.fields.map((f) => (
              <div
                key={f.key}
                className={f.multiline ? "sm:col-span-2" : undefined}
              >
                <dt className="text-xs font-medium text-muted-foreground">
                  {f.label}
                </dt>
                <dd className="text-sm whitespace-pre-line text-foreground text-justify hyphens-auto">
                  {fields[f.key]?.trim() || (
                    <span className="text-muted-foreground">
                      A completar com o livro
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
