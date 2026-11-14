import Link from "next/link";
import {
  formatIsoDate,
  RCPN_KIND_LABELS,
  RCPN_KIND_PLURALS,
  RCPN_ROLE_LABELS,
  toIsoDate,
} from "@/core/rcpn/record.ts";
import { rcpn } from "@/lib/rcpn.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { RCPN_KINDS_HELP } from "../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../_components/screen-help-button.tsx";
import { Badge } from "../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../_ui/table.tsx";
import {
  canImport,
  canIssue,
  canReadGuides,
  requireRcpn,
} from "./_lib/access.ts";

export const metadata = { title: "Registro Civil" };

const year = (iso: string) => iso.slice(0, 4);

export default async function RcpnPage({
  searchParams,
}: {
  searchParams: Promise<{ nome?: string; mae?: string; nascimento?: string }>;
}) {
  const session = await requireRcpn();
  const tenant = await getTenant();
  const params = await searchParams;
  const name = String(params.nome ?? "").slice(0, 200);
  const mother = String(params.mae ?? "").slice(0, 200);
  const birthDate = toIsoDate(params.nascimento ?? "");
  const searched = Boolean(name.trim() || birthDate);
  const [coverage, hits] = await Promise.all([
    rcpn.coverage(tenant.slug),
    searched
      ? rcpn.search(tenant.slug, { name, mother, birthDate })
      : Promise.resolve([]),
  ]);
  const total = coverage.reduce((sum, c) => sum + c.count, 0);
  const issue = canIssue(session);
  const guide = canReadGuides(session);

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Registro Civil"
        description="Índice dos registros de nascimento, casamento e óbito desta serventia, lido dos arquivos do sistema do registro civil. Use para responder a busca no balcão. O índice orienta; quem prova é a certidão."
        actions={
          <span className="inline-flex flex-wrap gap-2">
            <Link
              href="/admin/rcpn/livros"
              className={buttonVariants({ variant: "outline" })}
            >
              Livros
            </Link>
            {guide && (
              <Link
                href="/admin/atribuicoes/registro-civil"
                className={buttonVariants({ variant: "ghost" })}
              >
                Guia: livros e prazos
              </Link>
            )}
            {issue && (
              <Link
                href="/admin/rcpn/certidoes"
                className={buttonVariants({ variant: "outline" })}
              >
                Certidões
              </Link>
            )}
            {canImport(session) && (
              <Link
                href="/admin/rcpn/importar"
                className={buttonVariants({ variant: "outline" })}
              >
                Importar arquivos
              </Link>
            )}
          </span>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        <section
          aria-label="O que o índice cobre"
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              O que o índice tem
            </h2>
            <ScreenHelpButton
              help={RCPN_KINDS_HELP}
              canConfigure={false}
              label="O que cada tipo de registro reúne"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {coverage.map((c) => (
              <div key={c.kind} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {RCPN_KIND_PLURALS[c.kind]}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {c.count.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.count > 0
                    ? `Registros de ${year(c.first)} a ${year(c.last)}`
                    : "Nenhum registro no índice"}
                </p>
                {c.kind === "obito" && (
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">
                      {c.natimortos.toLocaleString("pt-BR")}
                    </span>{" "}
                    {c.natimortos === 1 ? "natimorto" : "natimortos"} (Livro C
                    Auxiliar)
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {total === 0 && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            O índice está vazio. Envie o arquivo exportado do sistema do
            registro civil em Importar arquivos.
          </p>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Pesquisar registro
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Por nome (em qualquer ordem, com tolerância a uma letra trocada),
            com ou sem o nome da mãe e a data de nascimento.
          </p>
          <form
            method="get"
            className="mt-4 grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto] md:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rcpn-nome">Nome</Label>
              <Input
                id="rcpn-nome"
                name="nome"
                defaultValue={name}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rcpn-mae">Nome da mãe</Label>
              <Input
                id="rcpn-mae"
                name="mae"
                defaultValue={mother}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rcpn-nascimento">Nascimento</Label>
              <Input
                id="rcpn-nascimento"
                name="nascimento"
                type="date"
                defaultValue={birthDate}
              />
            </div>
            <Button type="submit">Pesquisar</Button>
          </form>
        </section>

        {searched && (
          <section
            aria-label="Resultado"
            className="rounded-xl border bg-card shadow-xs"
          >
            <p className="border-b px-6 py-3 text-sm text-muted-foreground">
              {hits.length === 0
                ? "Nada encontrado no índice. Isso não quer dizer que o registro não exista: ele pode estar só no livro ou fora do período do índice."
                : `${hits.length === 50 ? "Os 50 primeiros resultados" : `${hits.length} resultado(s)`}.`}
            </p>
            {hits.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Filiação</TableHead>
                    <TableHead>Profissão declarada</TableHead>
                    {issue && (
                      <TableHead>
                        <span className="sr-only">Certidão</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hits.map(({ fit, person, record }) => (
                    <TableRow key={`${record.id}-${person.role}`}>
                      <TableCell className="align-top whitespace-normal">
                        <span className="font-medium text-foreground">
                          {person.name}
                        </span>
                        {person.marriedName &&
                          person.marriedName !== person.name && (
                            <span className="block text-xs text-muted-foreground">
                              Passou a usar: {person.marriedName}
                            </span>
                          )}
                        <span className="block text-xs text-muted-foreground">
                          {person.birthDate
                            ? `Nascimento: ${formatIsoDate(person.birthDate)}`
                            : "Nascimento não informado"}
                        </span>
                        {fit === "near" && (
                          <Badge variant="outline" className="mt-1">
                            Semelhante
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal text-sm">
                        <span className="font-medium text-foreground">
                          {RCPN_KIND_LABELS[record.kind]} ·{" "}
                          {record.subtype === "natimorto"
                            ? "Natimorto"
                            : RCPN_ROLE_LABELS[person.role]}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {[
                            record.book && `Livro ${record.book}`,
                            record.page && `folha ${record.page}`,
                            record.term && `termo ${record.term}`,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                            "Livro, folha e termo não informados"}
                        </span>
                        {record.eventOn && record.kind !== "nascimento" && (
                          <span className="block text-xs text-muted-foreground">
                            {record.kind === "casamento"
                              ? "Casamento em "
                              : "Falecimento em "}
                            {formatIsoDate(record.eventOn)}
                          </span>
                        )}
                        {record.matricula && (
                          <span className="block font-mono text-xs text-muted-foreground">
                            {record.matricula}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal text-sm">
                        <span className="block">
                          Mãe: {person.motherName || "não informada"}
                        </span>
                        <span className="block text-muted-foreground">
                          Pai: {person.fatherName || "não informado"}
                        </span>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal text-sm">
                        {[
                          person.profession && `Própria: ${person.profession}`,
                          person.fatherProfession &&
                            `Pai: ${person.fatherProfession}`,
                          person.motherProfession &&
                            `Mãe: ${person.motherProfession}`,
                        ]
                          .filter(Boolean)
                          .map((line) => (
                            <span key={line as string} className="block">
                              {line}
                            </span>
                          ))}
                        {!person.profession &&
                          !person.fatherProfession &&
                          !person.motherProfession && (
                            <span className="text-muted-foreground">
                              Não está nos dados digitais
                            </span>
                          )}
                      </TableCell>
                      {issue && (
                        <TableCell className="align-top">
                          <Link
                            href={`/admin/rcpn/registro/${record.id}`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                          >
                            Abrir
                          </Link>
                          <Link
                            href={`/admin/rcpn/certidoes/nova?registro=${record.id}`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            Emitir certidão
                          </Link>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        )}
      </main>
    </>
  );
}
