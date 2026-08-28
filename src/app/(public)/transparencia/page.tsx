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

      <section className="mt-8">
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
