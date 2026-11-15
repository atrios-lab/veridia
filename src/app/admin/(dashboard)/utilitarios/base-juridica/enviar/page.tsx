import { db } from "@/db/index.ts";
import { aiBlockedWith } from "@/lib/ai.ts";
import { getRequestWith, listSourcesWith } from "@/lib/knowledge.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireKnowledge } from "../_access.ts";
import { OfficialImportForm, SendForm } from "../knowledge-forms.tsx";

export const metadata = { title: "Enviar fontes à base jurídica" };

export default async function SendPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  await requireKnowledge();
  const { pedido } = await searchParams;
  const tenant = await getTenant();
  const [sources, aiOff, request] = await Promise.all([
    listSourcesWith(db, tenant.slug),
    aiBlockedWith(db, tenant.slug),
    pedido ? getRequestWith(db, tenant.slug, pedido) : Promise.resolve(null),
  ]);
  const imported = sources
    .filter((s) => !s.meta.replacedBy && s.meta.url)
    .map((s) => s.meta.url);
  const open = request?.status === "open" ? request : null;

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Enviar fontes à base jurídica"
        description="Leis, provimentos, resoluções, jurisprudência, doutrina e modelos. Tudo vira Markdown dividido por artigo; o arquivo é descartado."
      />
      <main className="flex max-w-[1000px] flex-col gap-6 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/base-juridica"
          label="Base jurídica da IA"
        />
        <section
          id="oficial"
          className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs"
        >
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Do site oficial (texto vigente)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
              O sistema lê o texto compilado direto do site oficial (Planalto,
              Diário Oficial, CNJ, tribunais, Câmara e Senado), sem os trechos
              riscados como revogados. Importar de novo a mesma norma guarda o
              texto novo e deixa o antigo como versão anterior.
            </p>
            {open && (
              <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-foreground">
                Respondendo ao pedido da IA: {open.topic}
              </p>
            )}
          </div>
          <OfficialImportForm
            imported={imported}
            request={open ? { id: open.id, url: open.officialUrl } : undefined}
          />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Arquivos ou texto
          </h2>
          {aiOff && (
            <p className="text-sm text-muted-foreground">
              Fotos e PDFs digitalizados só são lidos com a IA ligada. {aiOff}
            </p>
          )}
          <SendForm />
        </section>
        <section className="rounded-xl border bg-card p-6 text-sm shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Antes de usar, o sistema confere
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted-foreground text-justify hyphens-auto">
            <li>
              Se o documento parece jurídico, se o número da referência aparece
              no texto, se há CPF de cliente (LGPD), se a fonte já existe e se o
              texto veio da leitura da IA.
            </li>
            <li>
              Com qualquer alerta, a fonte fica Em conferência e não é usada até
              alguém conferir e confirmar, ou trocar pelo arquivo certo.
            </li>
            <li>
              Modelos de outros cartórios servem de referência de forma, nunca
              de cópia. Use modelos com dados fictícios.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
