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
  const livro3 = (await searchParams).livro === "3";
  return (
    <RiPage
      title={livro3 ? "Novo registro auxiliar (Livro 3)" : "Nova matrícula"}
      description="Os dados da ficha. Os proprietários e os ônus entram pelos atos, na tela da matrícula, depois de salvar. Se a matrícula já está em Word, PDF ou foto, use Ler de um arquivo."
      back={
        livro3
          ? { href: "/admin/ri/livro-3", label: "Registro Auxiliar" }
          : { href: "/admin/ri/matriculas", label: "Matrículas" }
      }
    >
      <Panel
        title="Ler de um arquivo"
        description="Anexe a matrícula em Word, PDF ou foto. O Assistente Virtual lê a abertura e os atos; você confere antes de salvar."
      >
        <UploadForm
          propertyId=""
          kind="ficha"
          read
          direct={blobUploadEnabled()}
          folder={riFolder(tenant.slug)}
        />
      </Panel>
      <PropertyForm
        cns={cnsDigits(tenant.cns) ?? tenant.cns}
        defaultBook={livro3 ? 3 : 2}
      />
    </RiPage>
  );
}
