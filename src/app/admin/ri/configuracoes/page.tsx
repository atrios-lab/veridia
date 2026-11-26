import { cnsDigits } from "@/core/ri/cnm.ts";
import { UF_IBGE } from "@/core/ri/codes.ts";
import { db } from "@/db/index.ts";
import { riSettingsWith } from "@/lib/ri.ts";
import { riSignerFor } from "@/lib/ri-docs.ts";
import { listLearnedActsWith } from "@/lib/ri-learning.ts";
import { ConfirmButton } from "../_components/client.tsx";
import { Field, Panel, RiPage } from "../_components/page.tsx";
import { SettingsForm } from "../_components/settings-form.tsx";
import {
  SignatureImageForm,
  SignerForm,
} from "../_components/signature-forms.tsx";
import { requireRi, riCan } from "../_lib.ts";
import { forgetLearnedActAction } from "../actions.ts";

export const metadata = { title: "Configurações do Registro de Imóveis" };

export default async function RiSettingsPage() {
  const { session, tenant } = await requireRi();
  const [settings, signing] = await Promise.all([
    riSettingsWith(db, tenant.slug),
    riSignerFor(tenant),
  ]);
  const image = signing.settings.signatureImage;
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
      <section id="assinatura">
        <Panel
          title="Imagem da assinatura"
          description="Para emitir a ficha em PDF ou TIFF com a assinatura de quem assina. A imagem não substitui a assinatura: o ato vale assinado à mão no papel ou digitalmente com certificado ICP-Brasil (Lei nº 6.015/1973, art. 17, § 1º; Lei nº 14.063/2020, art. 4º)."
        >
          {riCan(session, "certificates.manage") ? (
            <SignatureImageForm
              preview={
                image
                  ? `data:image/png;base64,${Buffer.from(image).toString("base64")}`
                  : null
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {image ? "Cadastrada." : "Não cadastrada."} Só quem cuida dos
              certificados digitais da serventia cadastra ou troca.
            </p>
          )}
        </Panel>
        <div className="mt-5">
          <Panel
            title="Imagem da rubrica"
            description="Vai no canto superior direito de todas as folhas das imagens do Livro 2 para a ONR, como a rubrica nas folhas do livro físico."
          >
            {riCan(session, "certificates.manage") ? (
              <SignatureImageForm
                kind="rubrica"
                canCopySignature={Boolean(image)}
                preview={
                  signing.settings.rubricImage
                    ? `data:image/png;base64,${Buffer.from(signing.settings.rubricImage).toString("base64")}`
                    : null
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {signing.settings.rubricImage
                  ? "Cadastrada."
                  : "Não cadastrada."}{" "}
                Só quem cuida dos certificados digitais da serventia cadastra ou
                troca.
              </p>
            )}
          </Panel>
        </div>
      </section>
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
