import {
  type BulletinStatus,
  formatMonthYear,
} from "@/core/transparency/bulletin.ts";
import type {
  TransparencyBulletinRow,
  TransparencyDocumentRow,
} from "@/lib/transparency.ts";
import { listBulletins, publishedDocuments } from "@/lib/transparency.ts";
import { Icon } from "../_components/icon.tsx";
import { requireSection } from "../_lib/section.ts";

export const metadata = { title: "Transparência" };

/** "259 KB", "1.4 MB": shown before the citizen opens the file. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({ doc }: { doc: TransparencyDocumentRow }) {
  return (
    <a
      href={`/transparencia/documento/${doc.id}`}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-3 border-b border-brand-border p-5 last:border-b-0 hover:bg-brand-tint"
    >
      <Icon name="file" className="h-5 w-5 flex-none text-brand-accent" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-primary">
          {doc.title}
        </span>
        <span className="block text-xs text-brand-muted">
          {doc.category} · {doc.yearLabel} · {formatFileSize(doc.fileSizeBytes)}
        </span>
      </span>
      <span className="flex-none text-xs font-semibold text-brand-primary-soft">
        Abrir PDF
      </span>
    </a>
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

function BulletinRow({ row }: { row: TransparencyBulletinRow }) {
  const [year, month] = row.referenceMonth.split("-").map(Number);
  const status = row.status as BulletinStatus;
  return (
    <a
      href={`/transparencia/boletim/${row.id}`}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-3 border-b border-brand-border p-5 last:border-b-0 hover:bg-brand-tint"
    >
      <span className="min-w-0 flex-1 text-sm font-semibold text-brand-primary">
        {formatMonthYear(month, year)}
      </span>
      {status === "preliminary" && (
        <span className="flex-none rounded-full bg-brand-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-accent-ink">
          Dados preliminares
        </span>
      )}
      <span className="flex-none text-xs font-semibold text-brand-primary-soft">
        Abrir PDF
      </span>
    </a>
  );
}

export default async function TransparencyPage() {
  const tenant = await requireSection("transparencia");

  const documents = await publishedDocuments(tenant.slug);
  const bulletins = await listBulletins(tenant.slug);

  return (
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
            mais, {tenant.name} observa as cautelas do Provimento nº 053/2010 da
            Corregedoria Geral da Justiça do Rio Grande do Norte: procurações
            com prazo de validade de um ano e objeto específico, vedação da
            cláusula de irrevogabilidade fora dos casos em que ela é da natureza
            do ato, facilidade de revogação e prestação de informações claras
            sobre as consequências do ato, nos termos do Estatuto do Idoso (Lei
            nº 10.741/2003).
          </NoticeCard>
        </div>
      </section>

      <section className="mt-9">
        <h2 className="font-serif text-xl font-semibold text-brand-primary">
          Documentos
        </h2>
        {documents.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-brand-border bg-brand-card p-5 text-sm leading-relaxed text-brand-muted">
            Nenhum documento publicado no momento. Eles aparecem aqui assim que
            a serventia os publicar.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-brand-border bg-brand-card">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-9">
        <h2 className="font-serif text-xl font-semibold text-brand-primary">
          Boletim mensal de arrecadação
        </h2>
        {bulletins.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-brand-border bg-brand-card p-5 text-sm leading-relaxed text-brand-muted">
            Nenhum boletim publicado no momento.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-brand-border bg-brand-card">
            {bulletins.map((row) => (
              <BulletinRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
