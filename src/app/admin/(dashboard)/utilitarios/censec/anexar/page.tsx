import { isQuinzena, quinzenaOf, shiftQuinzena } from "@/core/censec/censec.ts";
import { today } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireCensec } from "../_access.ts";
import { UploadForm } from "../censec-forms.tsx";

export const metadata = { title: "Anexar documentos para a CENSEC" };

export default async function AttachPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireCensec();
  const { q } = await searchParams;
  const quinzena = isQuinzena(q ?? "")
    ? (q as string)
    : shiftQuinzena(quinzenaOf(today()), -1);
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Anexar documentos para a CENSEC"
        description="Envie os traslados ou certidões dos atos. O sistema lê, separa cada ato, põe na central e na quinzena certas e mostra o que falta. Os arquivos não ficam guardados."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/censec?q=${quinzena}`}
          label="Cargas da CENSEC"
        />
        <UploadForm quinzena={quinzena} />
        <section className="rounded-xl border bg-card p-6 text-sm shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Como enviar</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted-foreground text-justify hyphens-auto">
            <li>
              Pode escolher vários arquivos de uma vez: segure Ctrl (no Mac,
              Command) e clique em cada um, ou selecione todos com Ctrl+A na
              pasta.
            </li>
            <li>
              Ou junte todos os atos da quinzena num PDF único e envie só ele. O
              sistema separa cada ato pela primeira folha (escritura,
              procuração, testamento...) e pelo livro e folha. No Adobe Acrobat:
              Ferramentas › Combinar arquivos. Grátis no navegador: ilovepdf.com
              ou smallpdf.com, opção Juntar PDF.
            </li>
            <li>
              Limite: 50 MB por arquivo e 100 MB por envio. Passou disso, mande
              em mais de um envio ou reduza o PDF.
            </li>
            <li>
              Para reduzir o PDF: no Word, Arquivo › Salvar como › PDF › marque
              Tamanho mínimo (publicação online). No Acrobat, Arquivo › Salvar
              como outro › PDF de tamanho reduzido. Grátis no navegador:
              ilovepdf.com ou smallpdf.com, opção Comprimir PDF. Um PDF gerado
              pelo sistema de lavratura é bem menor que um digitalizado.
            </li>
            <li>
              O PDF precisa ter texto (dá para selecionar as palavras). Foto ou
              PDF digitalizado como imagem não tem o que ler: lance esse ato à
              mão.
            </li>
            <li>
              No fim aparece o relatório: quantos arquivos, quantos atos
              encontrados e lançados, e o que ficou pendente. Cada ato pode ser
              conferido, alterado ou excluído.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
