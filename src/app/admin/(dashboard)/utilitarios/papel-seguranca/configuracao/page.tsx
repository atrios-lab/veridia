import Link from "next/link";
import { getSecurityPaperSettings } from "@/lib/security-paper.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requirePaperAccess } from "../_lib/access.ts";
import { SettingsForm } from "../forms.tsx";

export const metadata = { title: "Configurar o papel de segurança" };

export default async function SettingsPage() {
  await requirePaperAccess();
  const tenant = await getTenant();
  const settings = await getSecurityPaperSettings(tenant);
  return (
    <>
      <AdminPageHeader
        title="Configurar o papel de segurança"
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description="A quem os ofícios vão e a norma do Estado que eles citam. Vale para os próximos ofícios; os já gerados ficam como foram."
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <SettingsForm initial={settings} />
        <p className="text-[12.5px] text-admin-muted">
          Quem assina os ofícios vem da mesma lista das guias e do ISS:{" "}
          <Link
            href="/admin/configuracoes/quem-assina"
            className="font-semibold text-admin-primary underline"
          >
            Configurações › Quem assina
          </Link>
          .
        </p>
      </main>
    </>
  );
}
