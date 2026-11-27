import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { publicDpoWith } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { DpoForm } from "./dpo-form.tsx";

export const metadata = { title: "Encarregado" };

export default async function DpoSettingsPage() {
  // Same shape as configuracoes/page.tsx: the layout already proved session
  // and admin.access, this screen checks content.edit for itself.
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const person = await publicDpoWith(db, tenant.slug);

  return (
    <>
      <AdminPageHeader maxWidth={720} title="Configurações" />
      <main className="flex max-w-[720px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <div className="rounded-xl border bg-card p-6">
          <DpoForm tenant={tenant} />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold">Foto no site</h2>
          {person ? (
            <div className="flex items-center gap-3">
              {person.photo ? (
                // biome-ignore lint/performance/noImgElement: served by the team photo route
                <img
                  src={`/equipe/foto/${person.id}`}
                  alt={`Foto de ${person.name}`}
                  width={56}
                  height={56}
                  className="size-14 rounded-full border object-cover"
                />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  sem foto
                </span>
              )}
              <div className="text-sm">
                <p className="font-medium">{person.name}</p>
                <p className="text-muted-foreground">
                  {person.photo
                    ? "Marcada como Encarregado de Dados na Equipe: a foto aparece na área LGPD e no quadro da equipe."
                    : 'Marcada como Encarregado de Dados, mas a foto não aparece: envie a foto, registre a autorização de imagem e marque "Mostrar no site" na Equipe.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ninguém da equipe está marcado como Encarregado de Dados. Para a
              foto aparecer na área LGPD do site, abra a pessoa em Equipe do
              cartório e marque &quot;Encarregado de Dados (DPO)&quot;.
            </p>
          )}
          <Link
            href="/admin/configuracoes/equipe"
            className="w-fit text-sm text-primary underline-offset-4 hover:underline"
          >
            Abrir Equipe do cartório
          </Link>
        </div>
      </main>
    </>
  );
}
