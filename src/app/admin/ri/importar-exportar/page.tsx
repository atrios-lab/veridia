import { Download, FileJson, Send } from "lucide-react";
import Link from "next/link";
import { TRANSFER_LABELS, type TransferKind } from "@/core/ri/transfer.ts";
import { riFolder } from "@/lib/ri-files.ts";
import { TRANSFER_FORMATS, type TransferFormat } from "@/lib/ri-transfer.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { TransferForm } from "../_components/transfer-form.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Importar e exportar" };

const TABLES: { kind: TransferKind; how: string; books?: true }[] = [
  {
    kind: "matriculas",
    how: "Todos os campos de cada matrícula, transcrição e registro do Livro 3, com os proprietários atuais. É o mesmo formato que a importação lê: baixe, acrescente as matrículas novas numa linha cada e importe de volta.",
    books: true,
  },
  {
    kind: "atos",
    how: "Uma linha por R ou AV, na numeração da ficha (Lei nº 6.015/1973, art. 232), com as partes (uma por linha na célula: Papel: Nome | CPF/CNPJ | fração), protocolo, selo e valor. Acrescente os atos novos e importe: entram só os números que a matrícula ainda não tem.",
    books: true,
  },
  {
    kind: "pessoas",
    how: "Cada pessoa uma vez, com o CPF/CNPJ e onde aparece. Importando, entram só as pessoas que ainda não estão no cadastro.",
  },
  {
    kind: "indicador-real",
    how: "Os campos do Indicador Real (Lei nº 6.015/1973, art. 179) do Livro 2, para conferir ou trabalhar na planilha. O arquivo para a ONR (JSON v1.5) sai em Arquivos para a ONR.",
  },
  {
    kind: "indicador-pessoal",
    how: "As linhas do Indicador Pessoal (art. 180) como o Banco Light pede: pessoa, matrícula, tipo de ato e datas. O XML para a ONR sai em Arquivos para a ONR.",
  },
];

const FORMATS = Object.entries(TRANSFER_FORMATS) as [TransferFormat, string][];

function href(kind: string, format: string, book?: 2 | 3) {
  const params = new URLSearchParams({ tipo: kind, formato: format });
  if (book) params.set("livro", String(book));
  return `/admin/ri/importar-exportar/baixar?${params}`;
}

export default async function TransferPage() {
  const { session, tenant } = await requireRi();
  const canExport = riCan(session, "ri.export");
  const canImport = riCan(session, "ri.import");
  return (
    <RiPage
      wide
      title="Importar e exportar"
      description="Matrículas, atos, pessoas e indicadores do Registro de Imóveis em planilha (.xlsx ou .csv) e em JSON, nos dois sentidos. O que sai daqui volta pelo mesmo caminho; os arquivos da ONR também são lidos. Nada é apagado nem substituído: só entra o que falta."
    >
      {canImport && (
        <Panel
          title="Importar"
          description="Primeiro o sistema confere e mostra o que leu e o que já existe; só depois importa. Use só arquivos da própria serventia."
        >
          <TransferForm
            direct={blobUploadEnabled()}
            folder={riFolder(tenant.slug)}
          />
          <details className="mt-4 rounded-lg border bg-background px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">
              Como fazer: o que cada arquivo traz
            </summary>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
              <li>
                Planilha de matrículas (a exportada aqui, ou o índice que a
                serventia já mantém, com colunas como Matrícula, Situação,
                Proprietários, CPF/CNPJ): cria as matrículas que faltam, com os
                proprietários como situação na migração (CNN, art. 336).
              </li>
              <li>
                Planilha de atos: lança os R e AV com o número que têm na ficha
                (art. 232). Ato com número já lançado fica como está; ato de
                matrícula que não está no sistema fica de fora (importe a
                matrícula antes, ou no mesmo JSON).
              </li>
              <li>
                Pessoas ou Indicador Pessoal (planilha ou o XML do Banco Light):
                cadastra as pessoas que faltam no Indicador Pessoal; a mesma
                pessoa é reconhecida pelo CPF/CNPJ.
              </li>
              <li>
                JSON do Indicador Real (ONR, v1.5): cria as matrículas com os
                dados do imóvel; os proprietários vêm pelos atos.
              </li>
              <li>
                XML do lote de CNM: cria as matrículas do lote e, marcando
                &quot;completar&quot;, preenche o CNM das que estão sem.
              </li>
              <li>
                Cópia do acervo (JSON): matrículas, atos e pessoas de uma vez,
                na ordem certa.
              </li>
            </ol>
          </details>
        </Panel>
      )}

      {canExport ? (
        <Panel
          title="Exportar"
          description="Sai só o acervo em vigor (o que foi apagado fica de fora). Os arquivos levam nome e CPF/CNPJ: guarde em lugar seguro e não envie por e-mail comum (LGPD, art. 46). Cada exportação fica na auditoria."
          actions={
            <Link
              href="/admin/ri/onr"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Send className="size-4" /> Arquivos para a ONR
            </Link>
          }
        >
          <ul className="flex flex-col gap-3">
            {TABLES.map((table) => (
              <li
                key={table.kind}
                className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-3 lg:flex-row lg:items-center lg:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {TRANSFER_LABELS[table.kind]}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {table.how}
                  </p>
                </div>
                <div className="flex flex-none flex-wrap gap-1.5">
                  {FORMATS.map(([format, name]) => (
                    <a
                      key={format}
                      href={href(table.kind, format)}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <Download className="size-4" /> {name}
                    </a>
                  ))}
                  {table.books && (
                    <>
                      <a
                        href={href(table.kind, "xlsx", 2)}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Só Livro 2
                      </a>
                      <a
                        href={href(table.kind, "xlsx", 3)}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Só Livro 3
                      </a>
                    </>
                  )}
                </div>
              </li>
            ))}
            <li className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 lg:flex-row lg:items-center lg:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Cópia do acervo (matrículas, atos e pessoas)
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Um JSON só, que este sistema importa de volta inteiro. Bom
                  para guardar uma cópia ou levar o acervo para outro ambiente.
                </p>
              </div>
              <a
                href={href("acervo", "json")}
                className={buttonVariants({ size: "sm" })}
              >
                <FileJson className="size-4" /> Baixar a cópia (JSON)
              </a>
            </li>
          </ul>
        </Panel>
      ) : (
        <Panel title="Exportar">
          <p className="text-sm text-muted-foreground">
            Exportar pede a permissão de gerar os arquivos do Registro de
            Imóveis (Perfis e permissões).
          </p>
        </Panel>
      )}
    </RiPage>
  );
}
