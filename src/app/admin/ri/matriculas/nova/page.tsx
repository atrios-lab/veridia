import { cnsDigits } from "@/core/ri/cnm.ts";
import { riFolder } from "@/lib/ri-files.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { Panel, RiPage } from "../../_components/page.tsx";
import { PropertyForm } from "../../_components/property-form.tsx";
import { UploadForm } from "../../_components/upload-form.tsx";
import { requireRi } from "../../_lib.ts";

export const metadata = { title: "Nova matrícula" };

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await requireRi("ri.edit");
  const params = await searchParams;
  const livro3 = params.livro === "3";
  const protocolo = (params.protocolo ?? "").replace(/\D/g, "");
  return (
    <RiPage
      title={livro3 ? "Novo registro auxiliar (Livro 3)" : "Nova matrícula"}
      description={
        livro3
          ? "O Livro 3 não tem imóvel: o registro é o título, as partes e o que ele garante (Lei nº 6.015/1973, arts. 177 e 178). Escolha a natureza para ver o que pedir e o passo a passo."
          : "Os dados da ficha. Os proprietários e os ônus entram pelos atos, na tela da matrícula, depois de salvar. Se a matrícula já está em Word, PDF ou foto, use Ler de um arquivo."
      }
      back={
        livro3
          ? { href: "/admin/ri/livro-3", label: "Registro Auxiliar" }
          : { href: "/admin/ri/matriculas", label: "Matrículas" }
      }
    >
      {protocolo && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Título da prenotação nº {protocolo}. Anexe o documento abaixo: o
          sistema lê e mostra para conferir. Se o número já tiver registro no
          Livro 3, ele avisa que o título é averbação desse registro. Ao lançar
          o ato, informe o protocolo nº {protocolo} e o selo.
        </p>
      )}
      <Panel
        title="Ler de um arquivo"
        description={
          livro3
            ? "Anexe o registro do Livro 3 (ou o título: cédula, pacto, convenção) em Word, PDF ou foto. O Assistente Virtual lê a natureza, o título, as partes, o valor, as garantias e as averbações; você confere antes de salvar."
            : "Anexe a matrícula em Word, PDF ou foto. O Assistente Virtual lê a abertura e os atos; você confere antes de salvar."
        }
      >
        <UploadForm
          propertyId=""
          kind="ficha"
          read
          direct={blobUploadEnabled()}
          folder={riFolder(tenant.slug)}
          book={livro3 ? 3 : undefined}
          markdownDefault={livro3}
        />
      </Panel>
      <PropertyForm
        cns={cnsDigits(tenant.cns) ?? tenant.cns}
        defaultBook={livro3 ? 3 : 2}
      />
    </RiPage>
  );
}
