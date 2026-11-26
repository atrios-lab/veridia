import { Download } from "lucide-react";
import { db } from "@/db/index.ts";
import { EXPORT_LABELS, listExportsWith } from "@/lib/ri.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { ActionButton, ConfirmButton } from "../_components/client.tsx";
import { GenerateCard } from "../_components/onr-forms.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan, stamp } from "../_lib.ts";
import { markExportImportedAction, withdrawExportAction } from "../actions.ts";

export const metadata = { title: "Arquivos para a ONR" };

export default async function OnrPage() {
  const { session, tenant } = await requireRi();
  const exports = await listExportsWith(db, tenant.slug);
  const canExport = riCan(session, "ri.export");
  const live = exports.filter((e) => !e.withdrawnAt);
  return (
    <RiPage
      wide
      title="Arquivos para a ONR"
      description="O sistema gera os arquivos no formato do ONR e guarda cada um. O envio é da serventia: entre no Ofício Eletrônico ou no PGV-CNM com o certificado do oficial e importe. Nada sai daqui sozinho."
    >
      {canExport && (
        <Panel
          title="Imagens das matrículas (Livro 2)"
          description="Anexe a matrícula em PDF ou Word: o sistema confere, põe a sua assinatura e gera o TIFF do manual da ONR, com a pasta e o nome certos, para a pasta do CSL2."
          actions={
            <a
              href="/admin/ri/onr/imagens"
              className={buttonVariants({ size: "sm" })}
            >
              Assinar para exportar para a ONR
            </a>
          }
        >
          <span className="sr-only">Imagens do Livro 2</span>
        </Panel>
      )}
      {canExport && (
        <div className="grid gap-3 lg:grid-cols-3">
          <GenerateCard
            kind="cnm"
            title="Lote de CNM (PGV-CNM)"
            rule="CNN, arts. 330 a 334. XML do modelo de lote que o PGV oferece para baixar."
            how="Vão as matrículas do Livro 2 que ainda não estão no PGV. Ficam de fora números repetidos (art. 338) e CNM lançado que não confere. Depois de importar no PGV, marque o arquivo como importado."
          />
          <GenerateCard
            kind="indicador-real"
            title="Indicador Real (Livro 4)"
            rule="Prov. CNJ nº 143/2023, art. 15 (CNN, art. 342): base completa e atualização semanal, ou a cada alteração. JSON das especificações técnicas do ONR, v1.5."
            how="Ofício Eletrônico › Cartórios › Envio do Indicador Real › Importar arquivo. Na primeira vez, teste com poucos imóveis."
            withMode
          />
          <GenerateCard
            kind="indicador-pessoal"
            title="Indicador Pessoal (Livro 5)"
            rule="Lei nº 6.015/1973, art. 180. XML do Banco Light (IPS) do WS Ofício, Anexo 1, em ISO-8859-1."
            how="Grave na pasta que o IPS da ONR lê (por padrão C:\BDLight\Xml) ou importe pelo Ofício Eletrônico. Vão só as pessoas com CPF ou CNPJ."
          />
        </div>
      )}

      <Panel
        title="Arquivos gerados"
        description="Cada arquivo fica guardado como saiu, com a data, o número de linhas e o código de conferência (SHA-256)."
      >
        {live.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum arquivo gerado.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {live.map((e) => {
              const skipped =
                (e.skipped as { label: string; reason: string }[]) ?? [];
              return (
                <li key={e.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {EXPORT_LABELS[e.kind as keyof typeof EXPORT_LABELS]}
                        {e.mode === "atualizacao" ? " · atualização" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stamp(e.createdAt)} · {e.recordCount} linha(s) ·{" "}
                        {e.importedAt
                          ? `importado na ONR em ${stamp(e.importedAt)}`
                          : "ainda não importado"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs break-all text-muted-foreground">
                        {e.fileName} · SHA-256 {e.sha256.slice(0, 16)}…
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        href={`/admin/ri/onr/${e.id}`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        <Download className="size-4" /> Baixar
                      </a>
                      {canExport && (
                        <ActionButton
                          action={markExportImportedAction}
                          fields={{
                            id: e.id,
                            op: e.importedAt ? "undo" : "do",
                          }}
                          label={
                            e.importedAt
                              ? "Desmarcar importado"
                              : "Já importei na ONR"
                          }
                          pendingLabel="Salvando…"
                        />
                      )}
                      {canExport && (
                        <ConfirmButton
                          action={withdrawExportAction}
                          fields={{ id: e.id }}
                          trigger="Apagar"
                          question="Tirar este arquivo da lista?"
                          consequence="Ele some desta lista. O conteúdo continua guardado para a auditoria. O que já foi importado na ONR não muda."
                          confirmLabel="Apagar"
                          pendingLabel="Apagando…"
                        />
                      )}
                    </div>
                  </div>
                  {e.note && (
                    <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-text">
                      {e.note}
                    </p>
                  )}
                  {skipped.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer font-medium text-warning-text">
                        {skipped.length} ficaram de fora
                      </summary>
                      <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                        {skipped.slice(0, 100).map((s, i) => (
                          <li key={`${s.label}-${i}`}>
                            {s.label}: {s.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </RiPage>
  );
}
