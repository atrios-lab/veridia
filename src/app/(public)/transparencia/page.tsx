import {
  type BulletinStatus,
  formatMonthYear,
  MONTHS_PT,
} from "@/core/transparency/bulletin.ts";
import {
  type BulletinYear,
  type DocumentGroup,
  groupBulletinsByYear,
  groupDocumentsByCategory,
} from "@/core/transparency/listing.ts";
import type {
  TransparencyBulletinRow,
  TransparencyDocumentRow,
} from "@/lib/transparency.ts";
import { listBulletins, publishedDocuments } from "@/lib/transparency.ts";
import { Icon } from "../_components/icon.tsx";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";
import { PdfLink, PdfViewerProvider } from "./_components/pdf-viewer.tsx";

export const generateMetadata = publicMetadata("/transparencia");

/** "259 KB", "1.4 MB": shown before the citizen opens the file. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({
  doc,
  current = false,
}: {
  doc: TransparencyDocumentRow;
  /** The edition in force of a table that has older ones folded below it. */
  current?: boolean;
}) {
  return (
    <PdfLink
      href={`/transparencia/documento/${doc.id}`}
      title={doc.title}
      className="flex items-center gap-3 border-t border-brand-border p-5 hover:bg-brand-tint"
    >
      <Icon name="file" className="h-5 w-5 flex-none text-brand-accent" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-primary">
          {doc.title}
        </span>
        <span className="block text-xs text-brand-muted">
          {doc.yearLabel} · {formatFileSize(doc.fileSizeBytes)}
        </span>
      </span>
      {current && (
        <span className="flex-none rounded-full bg-brand-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Vigente
        </span>
      )}
      <span className="flex-none text-xs font-semibold text-brand-primary-soft">
        Abrir PDF
      </span>
    </PdfLink>
  );
}

/** A category of documents: its current ones up front, older table editions
 * folded under "Versões anteriores". */
function DocumentGroupCard({
  group,
}: {
  group: DocumentGroup<TransparencyDocumentRow>;
}) {
  const hasPrevious = group.previous.length > 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-card">
      <h3 className="px-5 pt-4 pb-3 text-xs font-bold uppercase tracking-[0.12em] text-brand-accent-ink">
        {group.category}
      </h3>
      {group.current.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} current={hasPrevious} />
      ))}
      {hasPrevious && (
        <details className="group border-t border-brand-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-xs font-semibold text-brand-primary-soft hover:bg-brand-tint [&::-webkit-details-marker]:hidden">
            <Icon
              name="chevronRight"
              className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
            />
            Versões anteriores ({group.previous.length})
          </summary>
          {group.previous.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </details>
      )}
    </div>
  );
}

/** The CNJ's own copy of the code the money-laundering notice cites. */
const CNN_URL =
  "https://atos.cnj.jus.br/files/original1336562023090464f5dd78ec839.pdf";

function NoticeCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-5">
      <h3 className="text-sm font-semibold text-brand-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
        {children}
      </p>
    </div>
  );
}

/**
 * One year of bulletins: a fold with the year and how many were published,
 * and inside it the twelve months in a fixed grid, so a month is always in
 * the same place and one not published shows as a gap, not as a list that
 * quietly closed up.
 */
function BulletinYearBlock({
  group,
  open,
}: {
  group: BulletinYear<TransparencyBulletinRow>;
  open: boolean;
}) {
  return (
    <details
      open={open}
      className="group overflow-hidden rounded-2xl border border-brand-border bg-brand-card"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 hover:bg-brand-tint [&::-webkit-details-marker]:hidden">
        <Icon
          name="chevronRight"
          className="h-4 w-4 flex-none text-brand-primary-soft transition-transform group-open:rotate-90"
        />
        <span className="font-serif text-lg font-semibold text-brand-primary">
          {group.year}
        </span>
        <span className="text-xs text-brand-muted">
          {group.count} {group.count === 1 ? "boletim" : "boletins"}
        </span>
      </summary>
      <ul className="grid grid-cols-3 gap-2 border-t border-brand-border p-4 md:grid-cols-6">
        {group.months.map((row, index) => {
          const monthName = MONTHS_PT[index];
          if (!row) {
            return (
              <li
                key={monthName}
                className="rounded-xl border border-dashed border-brand-border px-2 py-3 text-center text-sm text-brand-faint"
              >
                {monthName}
                <span className="sr-only"> de {group.year}: não publicado</span>
              </li>
            );
          }
          const preliminary = (row.status as BulletinStatus) === "preliminary";
          return (
            <li key={monthName}>
              <PdfLink
                href={`/transparencia/boletim/${row.id}`}
                title={`Boletim de ${formatMonthYear(index + 1, group.year).toLowerCase()}`}
                className="flex h-full flex-col items-center justify-center gap-1 rounded-xl border border-brand-border px-2 py-3 text-center text-sm font-semibold text-brand-primary hover:border-brand-primary-soft hover:bg-brand-tint"
              >
                {monthName}
                <span className="sr-only"> de {group.year}</span>
                {preliminary && (
                  <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-accent-ink">
                    Preliminar
                  </span>
                )}
              </PdfLink>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default async function TransparencyPage() {
  const tenant = await requireSection("transparencia");

  const documents = groupDocumentsByCategory(
    await publishedDocuments(tenant.slug),
  );
  const bulletinYears = groupBulletinsByYear(await listBulletins(tenant.slug));

  return (
    <PdfViewerProvider>
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-10">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          {tenant.name}
        </span>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
          Transparência
        </h1>
        <p className="mt-3 max-w-[60ch] leading-relaxed text-brand-muted">
          Documentos públicos da serventia e o boletim mensal de arrecadação, na
          forma da Lei de Acesso à Informação.
        </p>

        {/* The two notices are the same for every office: they restate national
          (CNJ) and state (CGJ-RN) rules, not anything the office writes, so
          only its name varies. The money-laundering text stays general on
          purpose: art. 154 of the CNN puts every report to the UIF under
          secrecy, so a public page names no operation, value or party. */}
        <section className="mt-8" aria-labelledby="avisos-institucionais">
          <h2
            id="avisos-institucionais"
            className="font-serif text-xl font-semibold text-brand-primary"
          >
            Avisos institucionais
          </h2>
          <div className="mt-3 grid gap-3">
            <NoticeCard title="Prevenção à lavagem de dinheiro">
              {tenant.name} declara que não tolera a prática de atos ilícitos e
              que todos os seus colaboradores estão instruídos a identificar e
              reportar operações que apresentem indícios de lavagem de dinheiro,
              na forma do Código Nacional de Normas da Corregedoria Nacional de
              Justiça (
              <a
                href={CNN_URL}
                target="_blank"
                rel="noopener"
                className="font-semibold text-brand-primary-soft hover:underline"
              >
                Provimento CNJ nº 149/2023
              </a>
              ), com identificação rigorosa de beneficiários finais e
              monitoramento de transações de alto valor.
            </NoticeCard>
            <NoticeCard title="Atos que envolvem pessoas idosas">
              Na lavratura de atos notariais que envolvam pessoas com 60 anos ou
              mais, {tenant.name} observa as cautelas do Provimento nº 053/2010
              da Corregedoria Geral da Justiça do Rio Grande do Norte:
              procurações com prazo de validade de um ano e objeto específico,
              vedação da cláusula de irrevogabilidade fora dos casos em que ela
              é da natureza do ato, facilidade de revogação e prestação de
              informações claras sobre as consequências do ato, nos termos do
              Estatuto do Idoso (Lei nº 10.741/2003).
            </NoticeCard>
          </div>
        </section>

        <section className="mt-9">
          <h2 className="font-serif text-xl font-semibold text-brand-primary">
            Documentos
          </h2>
          {documents.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-brand-border bg-brand-card p-5 text-sm leading-relaxed text-brand-muted">
              Nenhum documento publicado no momento. Eles aparecem aqui assim
              que a serventia os publicar.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {documents.map((group) => (
                <DocumentGroupCard key={group.category} group={group} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-9">
          <h2 className="font-serif text-xl font-semibold text-brand-primary">
            Boletim mensal de arrecadação
          </h2>
          {/* Res. CNJ 215/2015, art. 6º, § 3º-B, as rewritten by Res. CNJ
            670/2025: the private share is reached through the Corregedoria,
            never through the office. Shown with or without bulletins, and
            whether or not the office publishes its totals: the totals are not
            the detail a third party may ask for. */}
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-brand-muted">
            A parcela privada dos emolumentos e as demais receitas e despesas da
            serventia podem ser solicitadas por terceiro legitimamente
            interessado, mediante requerimento administrativo fundamentado
            encaminhado à Corregedoria-Geral de Justiça, observada a Lei Geral
            de Proteção de Dados (Resolução CNJ nº 215/2015, art. 6º, § 3º-B).
          </p>
          {bulletinYears.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-brand-border bg-brand-card p-5 text-sm leading-relaxed text-brand-muted">
              Nenhum boletim publicado no momento.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {bulletinYears.map((group, index) => (
                <BulletinYearBlock
                  key={group.year}
                  group={group}
                  open={index === 0}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PdfViewerProvider>
  );
}
