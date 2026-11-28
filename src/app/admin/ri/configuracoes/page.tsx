import { cnsDigits } from "@/core/ri/cnm.ts";
import { UF_IBGE } from "@/core/ri/codes.ts";
import { db } from "@/db/index.ts";
import { riSettingsWith } from "@/lib/ri.ts";
import { riSignerFor } from "@/lib/ri-docs.ts";
import { rawSignatureSettingsWith } from "@/lib/ri-files.ts";
import { listLearnedActsWith } from "@/lib/ri-learning.ts";
import { printSignersWith } from "@/lib/ri-signers.ts";
import { ConfirmButton } from "../_components/client.tsx";
import { Field, Panel, RiPage } from "../_components/page.tsx";
import { SettingsForm } from "../_components/settings-form.tsx";
import {
  LegacyOwnerForm,
  SignatureImageForm,
  SignerForm,
} from "../_components/signature-forms.tsx";
import { requireRi, riCan } from "../_lib.ts";
import { forgetLearnedActAction } from "../actions.ts";

export const metadata = { title: "Configurações do Registro de Imóveis" };

export default async function RiSettingsPage() {
  const { session, tenant } = await requireRi();
  const [settings, signing, people] = await Promise.all([
    riSettingsWith(db, tenant.slug),
    riSignerFor(tenant),
    printSignersWith(db, tenant),
  ]);
  // Everyone of "Quem assina", with or without a place in the Equipe: each
  // with their own signature and rubrica (decision of 28/11/2026).
  const team = people.signers;
  const raw = await rawSignatureSettingsWith(db, tenant.slug);
  const legacyUnowned =
    !raw.legacyOwner && Boolean(raw.legacySignature || raw.legacyRubric);
  const dataUrl = (img: Uint8Array | null) =>
    img ? `data:image/png;base64,${Buffer.from(img).toString("base64")}` : null;
  const learned = await listLearnedActsWith(db, tenant.slug);
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
      <Panel
        title="Quem assina"
        description="A lista vem de Quem assina, na Equipe do cartório. Escolha quem assina a ficha e os documentos do Registro de Imóveis."
      >
        {signing.signers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguém marcado para assinar. Marque em Configurações › Equipe.
          </p>
        ) : riCan(session, "ri.edit") ? (
          <SignerForm
            signers={signing.signers}
            index={signing.settings.signerIndex}
          />
        ) : (
          <Field
            label="Assina"
            value={
              signing.signer
                ? `${signing.signer.name}, ${signing.signer.title}`
                : ""
            }
          />
        )}
      </Panel>
      {team.length > 0 && (
        <Panel
          id="assinatura"
          title="Assinaturas e rubricas de quem assina"
          description="Cada pessoa de Quem assina (Configurações › Equipe) com a sua assinatura e a sua rubrica. Na hora de imprimir o livro, os termos ou o índice, escolha quem consta e se vai a rubrica em todas as folhas, a assinatura nos termos e nas linhas de encerramento, a assinatura digital, ou tudo junto. A imagem não substitui a assinatura: o ato vale assinado à mão ou digitalmente com certificado ICP-Brasil."
        >
          <div className="flex flex-col gap-6">
            {team.map((p) => (
              <div
                key={p.index}
                className="flex flex-col gap-3 rounded-lg border bg-background p-4"
              >
                <p className="text-sm font-semibold">
                  {p.name}
                  <span className="font-normal text-muted-foreground">
                    {p.title ? ` · ${p.title}` : ""}
                  </span>
                </p>
                {p.index === people.defaultIndex && (
                  <span className="-mt-2 text-xs font-semibold text-primary">
                    Assina os documentos do RI
                  </span>
                )}
                {riCan(session, "certificates.manage") ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Assinatura
                      </p>
                      <SignatureImageForm
                        staffId={p.staffId ?? undefined}
                        signerName={p.name}
                        preview={dataUrl(p.signatureImage)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Rubrica
                      </p>
                      <SignatureImageForm
                        kind="rubrica"
                        staffId={p.staffId ?? undefined}
                        signerName={p.name}
                        canCopySignature={Boolean(p.signatureImage)}
                        preview={dataUrl(p.rubricImage)}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Assinatura:{" "}
                    {p.signatureImage ? "cadastrada" : "não cadastrada"}.
                    Rubrica: {p.rubricImage ? "cadastrada" : "não cadastrada"}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {legacyUnowned && riCan(session, "certificates.manage") && (
        <Panel
          title="Assinatura cadastrada antes"
          description="Esta imagem foi cadastrada antes de cada pessoa ter a sua, e ia para quem estivesse assinando. Diga de quem ela é: passa a valer só para essa pessoa. Nada é apagado."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-background p-3">
              {raw.legacySignature && (
                // biome-ignore lint/performance/noImgElement: a data URL of the office's own image
                <img
                  src={dataUrl(raw.legacySignature) ?? ""}
                  alt="Assinatura cadastrada antes"
                  className="h-16 w-auto"
                />
              )}
              {raw.legacyRubric && (
                // biome-ignore lint/performance/noImgElement: a data URL of the office's own image
                <img
                  src={dataUrl(raw.legacyRubric) ?? ""}
                  alt="Rubrica cadastrada antes"
                  className="h-12 w-auto"
                />
              )}
            </div>
            <LegacyOwnerForm signers={team.map((p) => p.name)} />
          </div>
        </Panel>
      )}
      <Panel
        title="Integração com o PGV-CNM e com a ONR"
        description="O que já funciona e o que falta para o envio direto."
      >
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>
            <b>Hoje:</b> o sistema gera o lote de CNM, o Indicador Real e o
            Indicador Pessoal nos formatos da ONR (Arquivos para a ONR), e você
            importa no PGV-CNM e no Ofício Eletrônico com o certificado.
          </li>
          <li>
            <b>PGV-CNM por API</b> (CNN, art. 334): o PGV oferece credenciais
            (Client ID e Hash) em Integrações › Acesso à API. Para ligar o envio
            direto falta o manual da API do PGV (menu Manuais do PGV). As
            credenciais nunca vão por chat nem ficam no código: entram aqui, num
            campo protegido, quando a integração estiver pronta.
          </li>
          <li>
            <b>WS Ofício da ONR</b> (e-Protocolo, certidões, BDLight): a
            especificação v4.43 está no sistema, e o serviço segue ativo. A ONR
            libera o acesso ao sistema da serventia com um código de parceiro
            (IDParceiroWS), que o oficial pede em oficioeletronico@onr.org.br.
          </li>
        </ul>
      </Panel>
      <Panel title="Indicador Real">
        {riCan(session, "ri.edit") ? (
          <SettingsForm ibgeCity={settings.ibgeCity} />
        ) : (
          <Field label="Código IBGE do município" value={settings.ibgeCity} />
        )}
      </Panel>
      <Panel
        title={`O que o sistema aprendeu com os atos (${learned.length})`}
        description="A cada ato lançado ou corrigido, o sistema guarda só as palavras da natureza (nunca nome, número ou documento), se foi registro (R) ou averbação (AV) e o que o ato fez. Isso vira sugestão nos próximos lançamentos. Esquecer para a sugestão, mas o registro fica guardado e na auditoria."
      >
        {learned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda nada. O aprendizado começa no próximo ato salvo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {learned.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{l.cue}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {l.kind === "R" ? "registro (R)" : "averbação (AV)"} ·{" "}
                    {l.uses} vez(es)
                  </span>
                </span>
                {riCan(session, "ri.edit") && (
                  <ConfirmButton
                    action={forgetLearnedActAction}
                    fields={{ id: l.id }}
                    trigger="Esquecer"
                    question={`Esquecer "${l.cue}"?`}
                    consequence="O sistema deixa de sugerir isso. Fica guardado e na auditoria, com a sua justificativa."
                    confirmLabel="Esquecer"
                    pendingLabel="Salvando…"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </RiPage>
  );
}
