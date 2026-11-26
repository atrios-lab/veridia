import { Download } from "lucide-react";
import Link from "next/link";
import {
  CNM_PROBLEM_LABELS,
  cnmOf,
  cnmProblems,
  cnsDigits,
  formatCnm,
} from "@/core/ri/cnm.ts";
import { statusLabel } from "@/core/ri/sheet.ts";
import { db } from "@/db/index.ts";
import { listExportsWith, loadAcervo } from "@/lib/ri.ts";
import { pgvCredentialWith } from "@/lib/ri-pgv.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { CnmTable } from "../_components/cnm-table.tsx";
import { GenerateCard } from "../_components/onr-forms.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { PgvCredentialForm, PgvImportForm } from "../_components/pgv-forms.tsx";
import { requireRi, riCan, stamp } from "../_lib.ts";

export const metadata = { title: "CNM" };

export default async function CnmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, tenant } = await requireRi();
  const filter = (await searchParams).filtro ?? "fora";
  const cns = cnsDigits(tenant.cns) ?? tenant.cns;
  const acervo = await loadAcervo(tenant.slug);
  const canExport = riCan(session, "ri.export");
  const canEdit = riCan(session, "ri.edit");
  const lots = (await listExportsWith(db, tenant.slug))
    .filter((e) => e.kind === "cnm" && !e.withdrawnAt)
    .slice(0, 5);
  const credential = await pgvCredentialWith(db, tenant.slug);
  const all = acervo.properties
    .filter((p) => p.recordKind !== 4 && p.book === 2)
    .map((p) => {
      const problems = p.cnm
        ? cnmProblems(p.cnm, { cns, book: 2, number: p.number })
        : [];
      return {
        id: p.id,
        number: p.number,
        status: statusLabel(p.status),
        cnm: p.cnm ? formatCnm(p.cnm) : "",
        expected: cnmOf(cns, 2, p.number),
        problem: problems.map((x) => CNM_PROBLEM_LABELS[x]).join("; "),
        inPgv: p.cnmInPgv,
      };
    });
  const rows =
    filter === "todas"
      ? all
      : filter === "problema"
        ? all.filter((r) => r.problem)
        : all.filter((r) => !r.inPgv);
  const tabs = [
    ["fora", `Fora do PGV (${all.filter((r) => !r.inPgv).length})`],
    ["problema", `Não conferem (${all.filter((r) => r.problem).length})`],
    ["todas", `Todas (${all.length})`],
  ];
  return (
    <RiPage
      wide
      title="Código Nacional de Matrícula"
      description={
        <>
          CCCCCC.L.NNNNNNN-DD, com o dígito pelo módulo 97 (CNN, art. 330). O
          que vale é o CNM que o PGV-CNM do ONR devolve (art. 333). Marque aqui
          o que já está lá; o resto vai no próximo lote, em{" "}
          <Link
            href="/admin/ri/onr"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Arquivos para a ONR
          </Link>
          .
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-3">
        {canExport && (
          <div className="flex flex-col gap-3">
            <GenerateCard
              kind="cnm"
              title="1. Exportar para o PGV-CNM"
              rule="CNN, arts. 330 a 334. XML no modelo de lote do PGV."
              how="Vão as matrículas do Livro 2 que ainda não estão no PGV. Gere, clique em Baixar e importe o arquivo no PGV-CNM (passo a passo ao lado)."
            />
            {lots.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-xs">
                {lots.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2 py-1.5"
                  >
                    <span>
                      {stamp(e.createdAt)} · {e.recordCount} matrícula(s)
                      {e.importedAt ? " · importado" : ""}
                    </span>
                    <a
                      href={`/admin/ri/onr/${e.id}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      <Download className="size-4" /> Baixar
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {canEdit && (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <h3 className="text-sm font-semibold">
              2. Importar o retorno do PGV
            </h3>
            <p className="text-xs text-muted-foreground">
              O CNM que vale é o que o PGV devolve (CNN, art. 333). O sistema lê
              o arquivo, marca as matrículas que já estão lá e preenche o CNM
              que faltava. CNM diferente não é trocado sozinho: aparece para
              você corrigir na matrícula.
            </p>
            <PgvImportForm />
          </div>
        )}
        {canExport && (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <h3 className="text-sm font-semibold">
              3. Integração (API do PGV)
            </h3>
            <p className="text-xs text-muted-foreground">
              {credential.clientId || credential.hasHash
                ? `Credencial guardada${credential.updatedAt ? ` em ${stamp(credential.updatedAt)}` : ""}. O Hash fica cifrado e não volta para a tela.`
                : "Ainda sem credencial. Siga o passo a passo abaixo para pegar no PGV."}
            </p>
            <PgvCredentialForm
              clientId={credential.clientId}
              hasHash={credential.hasHash}
            />
          </div>
        )}
      </div>
      <Panel
        title="Como fazer, passo a passo"
        description="Para o funcionário: o que fazer no PGV-CNM (pgv.cnm, no site do ONR) e aqui."
      >
        <div className="grid gap-4 text-sm lg:grid-cols-3">
          <div>
            <p className="font-semibold">Exportar (mandar para o CNM)</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs">
              <li>
                Aqui, no quadro 1, clique em Gerar o arquivo e depois em Baixar.
              </li>
              <li>
                Entre no PGV-CNM com o certificado digital do oficial ou do
                substituto.
              </li>
              <li>
                No menu Matrículas, abra a importação de lote e envie o arquivo
                baixado.
              </li>
              <li>
                Confira no PGV se as matrículas entraram e anote as que deram
                erro.
              </li>
              <li>
                Volte aqui e faça o passo Importar, para marcar o que já está
                lá.
              </li>
            </ol>
          </div>
          <div>
            <p className="font-semibold">Importar (trazer o que está no CNM)</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs">
              <li>
                No PGV-CNM, no menu Matrículas, abra a lista das matrículas
                cadastradas.
              </li>
              <li>
                Baixe a lista (CSV ou planilha; se vier em Excel, salve como
                CSV).
              </li>
              <li>
                Aqui, no quadro 2, escolha o arquivo e clique em Importar o
                retorno do PGV.
              </li>
              <li>
                Leia o resumo: as que tiverem CNM diferente, abra a matrícula e
                corrija pelo CNM do PGV (CNN, art. 333).
              </li>
            </ol>
          </div>
          <div>
            <p className="font-semibold">
              Integração (pegar o Client ID e o Hash)
            </p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs">
              <li>No PGV-CNM, clique em Integrações, no menu verde do alto.</li>
              <li>
                Abra Acesso à API. Se aparecer &quot;Sua credencial ainda não
                foi gerada&quot;, clique em Gerar Credenciais.
              </li>
              <li>
                Na linha Client ID, clique em COPIAR e cole no quadro 3 daqui.
              </li>
              <li>
                Na linha Hash, clique em ABRIR, copie o código e cole no campo
                Hash daqui. Clique em Salvar.
              </li>
              <li>
                Não mande o Hash por e-mail nem mensagem: ele vale como senha do
                cartório no PGV. Se vazar, gere outra credencial no PGV e altere
                aqui.
              </li>
              <li>
                A &quot;Aplicação Offline&quot; do PGV não é necessária para
                usar este sistema.
              </li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              Com a credencial guardada, o envio direto pela API fica pronto
              para ser ligado assim que o ONR fornecer ao cartório a
              especificação técnica dela. Até lá, use Exportar e Importar: é o
              mesmo resultado, com um clique a mais.
            </p>
          </div>
        </div>
      </Panel>
      <nav className="flex flex-wrap gap-2" aria-label="Filtro">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/ri/cnm?filtro=${key}`}
            className={buttonVariants({
              size: "sm",
              variant: filter === key ? "default" : "outline",
            })}
          >
            {label}
          </Link>
        ))}
      </nav>
      <CnmTable rows={rows} canEdit={canEdit} />
    </RiPage>
  );
}
