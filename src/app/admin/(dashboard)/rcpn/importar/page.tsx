import Link from "next/link";
import { rcpn, rcpnFolder } from "@/lib/rcpn.ts";
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

export const metadata = { title: "Importar arquivos do Registro Civil" };

// A whole registry base (tens of thousands of registros) is read, checked
// and published from here: more time than the default (decision of
// 14/11/2026, after a full carga did not fit).
export const maxDuration = 300;

export default async function ImportPage() {
  await requireRcpn("rcpn.import");
  const tenant = await getTenant();
  const imports = await rcpn.listImports(tenant.slug);
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
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Só os dados de que o índice precisa são lidos (nome, filiação,
            nascimento, livro, folha, termo, matrícula e profissões). CPF,
            documentos e causa da morte ficam de fora. O arquivo enviado é
            apagado do painel quando a importação é publicada ou descartada.
          </p>
          <UploadForm
            direct={blobUploadEnabled()}
            folder={rcpnFolder(tenant.slug)}
          />
        </section>

        <section className="rounded-xl border bg-card shadow-xs">
          <h2 className="border-b px-6 py-3 text-lg font-semibold text-foreground">
            Arquivos enviados
          </h2>
          {imports.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              Nenhum arquivo enviado ainda.
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
                      </TableCell>
                      <TableCell className="text-sm">
                        {when(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/rcpn/importar/${item.id}`}
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {item.status === "lida"
                            ? "Conferir e publicar"
                            : "Ver"}
                        </Link>
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
