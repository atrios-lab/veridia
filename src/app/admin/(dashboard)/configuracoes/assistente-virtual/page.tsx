import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { aiConfigured, getAiPolicyWith } from "@/lib/ai.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { AiSwitch } from "./ai-switch.tsx";

export const metadata = { title: "Assistente Virtual" };

export default async function AiSettingsPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const policy = await getAiPolicyWith(db, tenant.slug).catch(() => ({
    enabled: false,
  }));
  const changedLine =
    "changedAt" in policy && policy.changedAt
      ? `${policy.enabled ? "Ligada" : "Desligada"} em ${formatOfficeDateTime(new Date(policy.changedAt))}${"reason" in policy && policy.reason ? `: ${policy.reason}` : ""}.`
      : null;
  const configured = aiConfigured();

  return (
    <>
      <AdminPageHeader maxWidth={860} title="Configurações" />
      <main className="flex max-w-[860px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Assistente Virtual
          </h2>
          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground text-justify hyphens-auto">
            <p>
              O Assistente Virtual da plataforma só executa tarefas fixas: ler
              imagens e PDFs digitalizados enviados à Base jurídica, conferir as
              fontes nos sites oficiais, propor a qualificação de títulos
              (sempre conferida e aprovada por pessoa da serventia) e responder
              no Assistente do DPO, restrito à proteção de dados.
            </p>
            <p>
              Começa desligado. Ligado, os documentos enviados a essas tarefas
              são lidos pelo serviço do Assistente Virtual e não ficam
              guardados. Cada uso fica na auditoria, sem o conteúdo. Desligue
              quando quiser: o resto do painel continua funcionando normalmente.
            </p>
          </div>
        </section>
        {!configured && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-foreground">
            A chave de acesso do Assistente Virtual ainda não foi configurada no
            ambiente da plataforma. Mesmo ligado aqui, ele só funciona depois
            disso.
          </p>
        )}
        <AiSwitch enabled={policy.enabled} changedLine={changedLine} />
      </main>
    </>
  );
}
