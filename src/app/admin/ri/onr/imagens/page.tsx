import { Download } from "lucide-react";
import Link from "next/link";
import { ONR_PATTERNS, onrPath } from "@/core/ri/onr-images.ts";
import { db } from "@/db/index.ts";
import { signatureSettingsWith } from "@/lib/ri-files.ts";
import { currentOf, listOnrImagesWith } from "@/lib/ri-onr-images.ts";
import { buttonVariants } from "../../../_ui/button.tsx";
import { ActionButton, ConfirmButton } from "../../_components/client.tsx";
import {
  FichaChanges,
  OnrImageForm,
} from "../../_components/onr-image-form.tsx";
import { Panel, RiPage } from "../../_components/page.tsx";
import { requireRi, stamp } from "../../_lib.ts";
import { setOnrCopiedAction, setOnrImageDeletedAction } from "../../actions.ts";

export const metadata = { title: "Imagens do Livro 2 para a ONR" };

/**
 * "Assinar para exportar para a ONR": the matrículas the office finished
 * in the Word become the TIFF of the manual "Matrícula Online" (200 dpi,
 * black and white, 00000000/00000001.TIF), signed with the image of who
 * signs, ready for the folder the CSL2 copies to the ONR.
 */
export default async function OnrImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ apagadas?: string }>;
}) {
  const { tenant } = await requireRi("ri.export");
  const showDeleted = (await searchParams).apagadas === "1";
  const [rows, signature] = await Promise.all([
    listOnrImagesWith(db, tenant.slug),
    signatureSettingsWith(db, tenant.slug),
  ]);
  const current = currentOf(rows);
  const pending = current.filter((r) => !r.copiedAt);
  const deleted = rows.filter((r) => r.deletedAt);
  const older = rows.filter(
    (r) => !r.deletedAt && !current.some((c) => c.id === r.id),
  );
  return (
    <RiPage
      wide
      title="Imagens do Livro 2 para a ONR"
      description="Anexe as matrículas que você terminou no Word. O sistema confere o número, põe a sua assinatura logo abaixo do último ato e gera a imagem no padrão do manual da ONR (TIFF preto e branco, 200 dpi), já com a pasta e o nome certos. Sem imprimir e digitalizar."
      back={{ href: "/admin/ri/onr", label: "Arquivos para a ONR" }}
      actions={
        pending.length > 0 && (
          <a
            href="/admin/ri/onr/imagens/baixar?pendentes=1"
            className={buttonVariants({ size: "sm" })}
          >
            <Download className="size-4" /> Baixar as {pending.length} ainda não
            copiadas (.zip)
          </a>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel
            title="Assinar para exportar para a ONR"
            description="A assinatura digital continua no Assinador, para quando você quiser o PDF assinado com certificado. Aqui é a imagem que a ONR mostra na Matrícula Online."
          >
            <OnrImageForm
              patterns={ONR_PATTERNS.map((p) => ({ id: p.id, label: p.label }))}
              hasSignature={Boolean(signature.signatureImage)}
            />
          </Panel>

          <Panel
            title={`Prontas para a ONR (${current.length})`}
            description="A imagem em vigor de cada matrícula. Gerar de novo a mesma matrícula substitui a anterior, que fica no histórico."
            actions={
              current.length > 0 && (
                <a
                  href="/admin/ri/onr/imagens/baixar"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  <Download className="size-4" /> Baixar todas (.zip)
                </a>
              )
            }
          >
            {current.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma imagem gerada ainda.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {current.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Matrícula nº {r.number.toLocaleString("pt-BR")}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {onrPath(r.number, r.pattern).replace("/", "\\")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.pages} {r.pages === 1 ? "folha" : "folhas"} ·{" "}
                        {r.source === "word" ? "do Word" : "do PDF"} ·{" "}
                        {r.signed ? "com a assinatura" : "sem assinatura"} ·
                        gerada em {stamp(r.createdAt)}
                        {r.copiedAt
                          ? ` · copiada para a pasta em ${stamp(r.copiedAt)}`
                          : ""}
                      </p>
                      <div className="mt-1">
                        <FichaChanges
                          id={r.id}
                          read={Boolean(r.reading)}
                          changes={
                            (r.changes as {
                              kind: string;
                              label: string;
                              before?: string;
                            }[]) ?? []
                          }
                          applied={Boolean(r.appliedAt)}
                        />
                      </div>
                      {(r.issues as string[]).length > 0 && (
                        <p className="text-xs text-warning-text">
                          Gerada com apontamentos conferidos:{" "}
                          {(r.issues as string[]).join(" ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/admin/ri/onr/imagens/baixar?id=${r.id}&formato=pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({
                          size: "sm",
                          variant: "outline",
                        })}
                      >
                        Ver em PDF
                      </a>
                      <a
                        href={`/admin/ri/onr/imagens/baixar?id=${r.id}`}
                        className={buttonVariants({
                          size: "sm",
                          variant: "outline",
                        })}
                      >
                        Baixar TIF
                      </a>
                      <ActionButton
                        action={setOnrCopiedAction}
                        fields={{ id: r.id, op: r.copiedAt ? "undo" : "do" }}
                        label={
                          r.copiedAt ? "Desfazer copiada" : "Marcar copiada"
                        }
                        pendingLabel="Salvando…"
                      />
                      <ConfirmButton
                        action={setOnrImageDeletedAction}
                        fields={{ id: r.id }}
                        trigger="Apagar"
                        question={`Apagar a imagem da matrícula nº ${r.number.toLocaleString("pt-BR")}?`}
                        consequence="Ela sai da lista e do zip, mas continua guardada e pode ser restaurada. Se já foi copiada para a pasta do CSL2, tire o arquivo de lá também."
                        confirmLabel="Apagar"
                        pendingLabel="Apagando…"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {pending.length > 1 && (
              <div className="mt-3">
                <ActionButton
                  action={setOnrCopiedAction}
                  fields={{ ids: pending.map((r) => r.id).join(","), op: "do" }}
                  label="Marcar todas como copiadas"
                  pendingLabel="Salvando…"
                />
              </div>
            )}
          </Panel>

          {(older.length > 0 || deleted.length > 0) && (
            <Panel title="Histórico">
              {older.length > 0 && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Substituídas por uma imagem mais nova:{" "}
                  {older
                    .map(
                      (r) =>
                        `nº ${r.number.toLocaleString("pt-BR")} (${stamp(r.createdAt)})`,
                    )
                    .join("; ")}
                </p>
              )}
              {deleted.length > 0 &&
                (showDeleted ? (
                  <ul className="flex flex-col gap-2">
                    {deleted.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          Matrícula nº {r.number.toLocaleString("pt-BR")},
                          apagada em {stamp(r.deletedAt)}
                        </span>
                        <ConfirmButton
                          action={setOnrImageDeletedAction}
                          fields={{ id: r.id, op: "restore" }}
                          trigger="Restaurar"
                          question="Restaurar esta imagem?"
                          consequence="Ela volta à lista; se for a mais nova da matrícula, passa a ser a imagem em vigor."
                          confirmLabel="Restaurar"
                          pendingLabel="Restaurando…"
                          destructive={false}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Link
                    href="/admin/ri/onr/imagens?apagadas=1"
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    Ver as {deleted.length} apagadas
                  </Link>
                ))}
            </Panel>
          )}
        </div>

        <Panel title="Como fazer">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-foreground">
            <li>
              No Word, deixe umas 4 ou 5 linhas em branco depois do último ato.
              É ali que entra a assinatura. Salve como PDF (Arquivo › Salvar
              como › PDF).
            </li>
            <li>
              Cadastre uma vez a imagem da sua assinatura em{" "}
              <Link
                href="/admin/ri/configuracoes"
                className="text-primary underline underline-offset-4"
              >
                RI › Configurações
              </Link>
              . O fundo da foto é limpo para o preto e branco.
            </li>
            <li>
              Anexe as matrículas aqui, uma ou várias. O sistema confere o
              número (no texto, no nome do arquivo e no acervo) e, só quando não
              acha o número, pergunta ao assistente virtual. Se algo não bate,
              ele mostra e espera você marcar "Conferi".
            </li>
            <li>
              A imagem sai como pede o manual "Matrícula Online": TIFF preto e
              branco, 200 × 200 dpi, compressão sem perdas (CCITT Group 4),
              todas as folhas num arquivo. A pasta tem 8 dígitos por milhar e o
              arquivo, 8 dígitos: a matrícula 1 vai em 00000000\00000001.TIF e a
              1.234 em 00000001\00001234.TIF.
            </li>
            <li>
              Clique em "Baixar as ainda não copiadas", descompacte o .zip
              dentro da pasta das matrículas configurada no CSL2 (WinService
              .CSLSConfig.exe) e marque como copiadas.
            </li>
            <li>
              O CSL2 envia sozinho no horário configurado; o computador precisa
              estar ligado. Cópia reprográfica (xerox digitalizado) não serve: a
              imagem é a da ficha da matrícula.
            </li>
            <li>
              Para corrigir uma matrícula já enviada, gere de novo com o mesmo
              número e copie por cima. A imagem antiga fica no histórico daqui.
            </li>
          </ol>
        </Panel>
      </div>
    </RiPage>
  );
}
