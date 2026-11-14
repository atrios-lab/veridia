import { isCentral, isQuinzena } from "@/core/censec/censec.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireCensec } from "../_access.ts";
import { ActForm } from "../censec-forms.tsx";

export const metadata = { title: "Lançar ato na CENSEC" };

export default async function NewActPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; central?: string }>;
}) {
  await requireCensec();
  const { q, central } = await searchParams;
  const quinzena = isQuinzena(q ?? "") ? (q as string) : "";
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Lançar ato à mão"
        description="Para o ato que não tem arquivo com texto (foto ou PDF digitalizado). Escolha a central e o tipo: os campos mudam como nas telas da CENSEC."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/censec${quinzena ? `?q=${quinzena}` : ""}`}
          label="Cargas da CENSEC"
        />
        <ActForm
          values={{
            central: isCentral(central ?? "") ? (central as string) : "cep",
          }}
          quinzena={quinzena}
        />
      </main>
    </>
  );
}
