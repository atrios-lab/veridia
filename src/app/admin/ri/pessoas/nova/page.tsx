import { RiPage } from "../../_components/page.tsx";
import { PersonForm } from "../../_components/person-form.tsx";
import { requireRi } from "../../_lib.ts";

export const metadata = { title: "Nova pessoa" };

export default async function NewPersonPage() {
  await requireRi("ri.edit");
  return (
    <RiPage
      title="Nova pessoa"
      description="Quem entra num ato também entra aqui sozinho; use esta tela para cadastrar antes."
      back={{ href: "/admin/ri/pessoas", label: "Pessoas" }}
    >
      <PersonForm />
    </RiPage>
  );
}
