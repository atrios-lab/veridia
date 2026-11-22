import Link from "next/link";
import { RCPN_MAX_MB } from "@/core/rcpn/limits.ts";
import { rcpn, rcpnFolder } from "@/lib/rcpn.ts";
import { importMeta } from "@/lib/rcpn-import-meta.ts";
import { getTenant } from "@/lib/tenant.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { requireRcpn } from "../_lib/access.ts";
import { statusOf, when } from "../_lib/status.ts";
import { UploadForm } from "../forms.tsx";
import { ImportRowActions } from "./import-row-actions.tsx";

export const metadata = { title: "Importar arquivos do Registro Civil" };

// A whole registry base (tens of thousands of registros) is read, checked
// and published from here: more time than the default (decision of
// 14/11/2026, after a full carga did not fit).
export const maxDuration = 300;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ ocultos?: string }>;
}) {
  await requireRcpn("rcpn.import");
  const tenant = await getTenant();
  const showHidden = (await searchParams).ocultos === "1";
  const [all, meta] = await Promise.all([
    rcpn.listImports(tenant.slug),
    importMeta(tenant.slug).catch(
      () => ({}) as Awaited<ReturnType<typeof importMeta>>,
    ),
  ]);
  const hiddenCount = all.filter((item) => meta[item.id]?.hiddenAt).length;
  const imports = all.filter(
    (item) => Boolean(meta[item.id]?.hiddenAt) === showHidden,
  );
  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Importar arquivos do Registro Civil"
        back={{ href: "/admin/rcpn", label: "Registro Civil" }}
        description="Envie as informações gerais do sistema do registro civil (o banco completo, com os dados de cada livro, folha, termo e matrícula) sempre que houver registro novo. O painel monta o índice de cada livro e guarda os dados de cada registro, para a certidão sair pronta. Nada entra antes da sua conferência, e um registro que já existe com dados diferentes só é substituído se você marcar."
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Enviar arquivo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            São lidos os dados de cada registro que a certidão e a ficha usam:
            nomes, filiação, avós, datas, livro, folha, termo, matrícula,
            declarante, testemunhas, anotações e averbações, CPF e documentos e,
            no óbito, a causa da morte. Usuários, senhas e registros de uso do
            sistema ficam de fora. O arquivo enviado é apagado do painel quando
            a importação é publicada ou descartada.
          </p>
          <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success-text">
            <p className="font-semibold">Vá alimentando aos poucos</p>
            <p className="mt-1 text-justify hyphens-auto">
              Envie aqui sempre que gerar os arquivos do sistema do registro
              civil, mesmo que sejam os mesmos de antes ou só uma parte. O
              painel completa sozinho o que estava em branco em cada registro; o
              que vier diferente do que já está no painel aparece na conferência
              para você decidir. O que nenhum arquivo trouxer, complete à mão na
              ficha do registro, em Alterar.
            </p>
          </div>
          <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <p className="font-semibold">
              O arquivo mais completo: a cópia de segurança do Cartosoft
            </p>
            <p className="mt-1 text-justify hyphens-auto">
              O Cartosoft guarda uma cópia de todo o banco na pasta{" "}
              <span className="font-mono break-all">
                C:\Cartosoft\Backup_Cartosoft_Mysql
              </span>
              , em arquivos .sql. Ela traz os nascimentos, casamentos e óbitos
              de todos os anos, com avós, declarante, testemunhas e anotações.
              Pegue o .sql mais recente (o nome traz a data, como "New Project
              20260717 1001.sql"), compacte em .zip e envie aqui: uma cópia de
              100 MB costuma ficar com menos de 10 MB. O arquivo é lido como
              texto, nada nele é executado, e só saem os dados dos registros.
              Para uma cópia do dia, no HeidiSQL use Ferramentas › Exportar
              banco de dados como SQL, com o banco do Cartosoft marcado e Dados
              em "Inserir": o arquivo gerado também serve.
            </p>
          </div>
          <div className="mt-3 mb-5 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <p className="font-semibold">
              Como enviar arquivos grandes (até {RCPN_MAX_MB} MB por envio)
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-justify hyphens-auto">
              <li>
                Feche o sistema do registro civil em todos os computadores. Com
                ele aberto, o banco fica travado (aparece um arquivo .ldb ao
                lado) e a cópia pode sair incompleta.
              </li>
              <li>
                Compacte em .zip: no Windows, clique com o botão direito na
                pasta ou nos arquivos e escolha Enviar para › Pasta compactada.
                O banco do Access encolhe muito no .zip (um banco de 45 MB
                costuma ficar com menos de 5 MB).
              </li>
              <li>
                Ponha no mesmo .zip a cópia .sql, os bancos (NA, CA e OB) e a
                carga XML, o que tiver: o sistema junta tudo pela matrícula. O
                RC.mdb não precisa ir, porque não tem registros.
              </li>
              <li>
                Se ainda passar de {RCPN_MAX_MB} MB, envie cada banco num .zip
                separado. Pode também usar .rar.
              </li>
            </ol>
          </div>
          <UploadForm
            direct={blobUploadEnabled()}
            folder={rcpnFolder(tenant.slug)}
          />
        </section>

        <section className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
            <h2 className="mr-auto text-lg font-semibold text-foreground">
              {showHidden ? "Arquivos tirados da lista" : "Arquivos enviados"}
            </h2>
            {(hiddenCount > 0 || showHidden) && (
              <Link
                href={
                  showHidden
                    ? "/admin/rcpn/importar"
                    : "/admin/rcpn/importar?ocultos=1"
                }
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {showHidden
                  ? "Voltar aos arquivos enviados"
                  : `Mostrar os tirados da lista (${hiddenCount})`}
              </Link>
            )}
          </div>
          <p className="border-b px-6 py-3 text-sm text-muted-foreground">
            O painel guarda os dados lidos de cada registro, não o arquivo. O
            arquivo é apagado sozinho quando a importação é publicada ou
            descartada, e pode ser apagado antes em "Apagar o arquivo". "Apagar
            da lista" tira só a linha: os registros continuam no índice. Para
            corrigir ou cancelar um registro, abra a ficha dele em Nascimentos,
            Casamentos ou Óbitos.
          </p>
          {imports.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              {showHidden
                ? "Nenhum arquivo tirado da lista."
                : "Nenhum arquivo enviado ainda."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((item) => {
                  const status = statusOf(item.status);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-normal">
                        {meta[item.id]?.label && (
                          <span className="block font-semibold text-foreground">
                            {meta[item.id]?.label}
                          </span>
                        )}
                        <span className="font-medium text-foreground break-all">
                          {item.fileName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {(item.sizeBytes / 1024 / 1024).toLocaleString(
                            "pt-BR",
                            { maximumFractionDigits: 1 },
                          )}{" "}
                          MB
                          {item.status === "publicada" &&
                          item.publishedCount !== null
                            ? ` · ${item.publishedCount} registro(s) publicado(s)`
                            : ""}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.hasFile
                            ? "Arquivo guardado no painel até publicar ou descartar."
                            : "Arquivo apagado: ficaram só os dados."}
                        </span>
                        {meta[item.id]?.note && (
                          <span className="block text-xs text-foreground">
                            {meta[item.id]?.note}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {when(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ImportRowActions
                          id={item.id}
                          open={
                            item.status === "lida" || item.status === "nao-lida"
                          }
                          hasFile={item.hasFile}
                          hidden={Boolean(meta[item.id]?.hiddenAt)}
                          label={meta[item.id]?.label ?? ""}
                          note={meta[item.id]?.note ?? ""}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </>
  );
}
