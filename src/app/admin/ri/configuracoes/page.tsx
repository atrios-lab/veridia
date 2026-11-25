import { cnsDigits } from "@/core/ri/cnm.ts";
import { UF_IBGE } from "@/core/ri/codes.ts";
import { db } from "@/db/index.ts";
import { riSettingsWith } from "@/lib/ri.ts";
import { Field, Panel, RiPage } from "../_components/page.tsx";
import { SettingsForm } from "../_components/settings-form.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Configurações do Registro de Imóveis" };

export default async function RiSettingsPage() {
  const { session, tenant } = await requireRi();
  const settings = await riSettingsWith(db, tenant.slug);
  return (
    <RiPage
      title="Configurações do Registro de Imóveis"
      description="O que os arquivos da ONR precisam saber da serventia."
    >
      <Panel title="Serventia">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field
            label="CNS (6 dígitos)"
            value={cnsDigits(tenant.cns) ?? tenant.cns}
          />
          <Field
            label="Município"
            value={`${tenant.location.city}/${tenant.location.state}`}
          />
          <Field
            label="UF (código IBGE)"
            value={String(UF_IBGE[tenant.location.state.toUpperCase()] ?? "")}
          />
        </dl>
      </Panel>
      <Panel title="Indicador Real">
        {riCan(session, "ri.edit") ? (
          <SettingsForm ibgeCity={settings.ibgeCity} />
        ) : (
          <Field label="Código IBGE do município" value={settings.ibgeCity} />
        )}
      </Panel>
    </RiPage>
  );
}
