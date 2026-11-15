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

export const metadata = { title: "Inteligência artificial" };

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
            Inteligência artificial
          </h2>
          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground text-justify hyphens-auto">
            <p>
              A IA da plataforma (Claude, da Anthropic) tem uma finalidade só: a
              qualificação de títulos. Ninguém conversa com ela nem faz
              perguntas livres. A serventia apenas a alimenta pela Base jurídica
              da IA (leis, provimentos, jurisprudência e modelos), e ela executa
              só as tarefas fixas do sistema: ler imagens e PDFs digitalizados
              enviados à base e, depois, propor a qualificação do título, sempre
              revisada e aprovada por pessoa da serventia.
            </p>
            <p>
              Começa desligada. Ligada, os documentos enviados a essas tarefas
              vão à Anthropic para leitura e não ficam guardados. Cada uso fica
              na auditoria, sem o conteúdo. Desligue quando quiser: o resto do
              painel continua funcionando sem a IA.
            </p>
          </div>
        </section>
        {!configured && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-foreground">
            A chave de acesso da IA ainda não foi configurada no ambiente da
            plataforma. Mesmo ligada aqui, a IA só funciona depois disso.
          </p>
        )}
        <AiSwitch enabled={policy.enabled} changedLine={changedLine} />
      </main>
    </>
  );
}
