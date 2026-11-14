import Link from "next/link";
import { can } from "@/core/auth/roles.ts";
import {
  formatIsoDate,
  RCPN_KIND_LABELS,
  RCPN_KIND_PLURALS,
  RCPN_KINDS,
  type RcpnKind,
  toIsoDate,
} from "@/core/rcpn/record.ts";
import { rcpn } from "@/lib/rcpn.ts";
import {
  type DateField,
  ficha,
  SEARCH_MODE_LABELS,
  SEARCH_MODES,
  type SearchMode,
} from "@/lib/rcpn-ficha.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { RCPN_KINDS_HELP } from "../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../_components/screen-help-button.tsx";
import { Badge } from "../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect, NativeSelectOption } from "../../_ui/native-select.tsx";
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

/** The book of each kind (Lei nº 6.015/1973, art. 33). */
const BOOK_OF: Record<RcpnKind, string> = {
  nascimento: "Livro A",
  casamento: "Livros B e B Auxiliar",
  obito: "Livros C e C Auxiliar",
};

const DATE_LABELS: Record<RcpnKind, Record<DateField, string>> = {
  nascimento: {
    nascimento: "Data de nascimento",
    registro: "Data do registro",
    evento: "Data do registro",
  },
  casamento: {
    nascimento: "Nascimento de um dos cônjuges",
    registro: "Data do registro",
    evento: "Data do casamento",
  },
  obito: {
    nascimento: "Nascimento do falecido",
    registro: "Data do registro",
    evento: "Data do falecimento",
  },
};

/** The date fields that mean something for the kind, in screen order. */
const dateFieldsOf = (kind: RcpnKind): DateField[] =>
  kind === "nascimento"
    ? ["nascimento", "registro"]
    : ["evento", "registro", "nascimento"];

const MODE_HINTS: Record<SearchMode, string> = {
  nome: "Em qualquer ordem, com tolerância a uma letra trocada. Inclui o nome adotado no casamento.",
  filiacao: "Nome da mãe ou do pai, em qualquer ordem.",
  avos: "Um ou mais nomes dos avós, como estão no registro.",
  termo: "Só o número: 11466 acha o termo 0011466.",
  livro: "A08, A-8 e a 8 são o mesmo livro.",
  matricula: "Os 32 dígitos, ou parte deles.",
  dnv: "Número da Declaração de Nascido Vivo.",
  cpf: "Com ou sem pontos.",
};

export default async function RcpnPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    por?: string;
    q?: string;
    data?: string;
    de?: string;
    ate?: string;
  }>;
}) {
  const session = await requireRcpn();
  const tenant = await getTenant();
  const params = await searchParams;
  const kind: RcpnKind = (RCPN_KINDS as readonly string[]).includes(
    params.tipo ?? "",
  )
    ? (params.tipo as RcpnKind)
    : "nascimento";
  const mode: SearchMode = (SEARCH_MODES as readonly string[]).includes(
    params.por ?? "",
  )
    ? (params.por as SearchMode)
    : "nome";
  const modes = SEARCH_MODES.filter(
    (m) => kind === "nascimento" || (m !== "avos" && m !== "dnv"),
  );
  const text = String(params.q ?? "").slice(0, 200);
  const dateFields = dateFieldsOf(kind);
  const dateField: DateField = dateFields.includes(params.data as DateField)
    ? (params.data as DateField)
    : (dateFields[0] ?? "registro");
  const from = toIsoDate(params.de ?? "");
  const to = toIsoDate(params.ate ?? "");
  const searched = Boolean(text.trim() || from || to);
  const [coverage, hits] = await Promise.all([
    rcpn.coverage(tenant.slug),
    searched
      ? ficha.search(tenant.slug, {
          kind,
          mode: modes.includes(mode) ? mode : "nome",
          text,
          dateField,
          from,
          to,
        })
      : Promise.resolve([]),
  ]);
  const total = coverage.reduce((sum, c) => sum + c.count, 0);
  const issue = canIssue(session);
  const guide = canReadGuides(session);
  const edit = can(
    session.user.role ?? "",
    "rcpn.edit",
    session.user.permissions,
  );

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Registro Civil"
        description="Nascimentos, casamentos e óbitos desta serventia, com os dados dos arquivos do sistema do registro civil. Abra o registro para ver a ficha completa, emitir a certidão ou corrigir. O índice orienta; quem dá fé é o livro."
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
        <nav aria-label="Tipo de registro" className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Escolha o tipo de registro
            </h2>
            <ScreenHelpButton
              help={RCPN_KINDS_HELP}
              canConfigure={false}
              label="O que cada tipo de registro reúne"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {coverage.map((c) => {
              const active = c.kind === kind;
              return (
                <Link
                  key={c.kind}
                  href={`/admin/rcpn?tipo=${c.kind}`}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl border-2 p-4 transition-colors ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}
                  >
                    {RCPN_KIND_PLURALS[c.kind]}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {c.count.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {BOOK_OF[c.kind]}
                    {" · "}
                    {c.count > 0
                      ? `de ${year(c.first)} a ${year(c.last)}`
                      : "nenhum registro ainda"}
                  </p>
                  {c.kind === "obito" && c.natimortos > 0 && (
                    <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground tabular-nums">
                        {c.natimortos.toLocaleString("pt-BR")}
                      </span>{" "}
                      {c.natimortos === 1 ? "natimorto" : "natimortos"} (Livro C
                      Auxiliar)
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {total === 0 && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            O índice está vazio. Envie os arquivos do sistema do registro civil
            (a carga XML e o banco de dados) em Importar arquivos.
          </p>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Pesquisar {RCPN_KIND_PLURALS[kind].toLowerCase()}
          </h2>
          <form method="get" className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="tipo" value={kind} />
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">
                Pesquisar por
              </legend>
              <div className="flex flex-wrap gap-2">
                {modes.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:font-semibold has-[:checked]:text-primary"
                  >
                    <input
                      type="radio"
                      name="por"
                      value={m}
                      defaultChecked={m === mode}
                      className="accent-primary"
                    />
                    {SEARCH_MODE_LABELS[m]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {MODE_HINTS[mode]}
              </p>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rcpn-q">O que procurar</Label>
              <Input
                id="rcpn-q"
                name="q"
                defaultValue={text}
                autoComplete="off"
                autoFocus
              />
            </div>
            <fieldset className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <legend className="mb-2 text-sm font-medium text-foreground">
                Entre datas (opcional)
              </legend>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rcpn-data">Data de</Label>
                <NativeSelect
                  id="rcpn-data"
                  name="data"
                  defaultValue={dateField}
                  className="w-full"
                >
                  {dateFields.map((f) => (
                    <NativeSelectOption key={f} value={f}>
                      {DATE_LABELS[kind][f]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rcpn-de">De</Label>
                <Input id="rcpn-de" name="de" type="date" defaultValue={from} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rcpn-ate">Até</Label>
                <Input id="rcpn-ate" name="ate" type="date" defaultValue={to} />
              </div>
            </fieldset>
            <div>
              <Button type="submit">Pesquisar</Button>
            </div>
          </form>
        </section>

        {searched && (
          <section
            aria-label="Resultado"
            className="rounded-xl border bg-card shadow-xs"
          >
            <p className="border-b px-6 py-3 text-sm text-muted-foreground">
              {hits.length === 0
                ? "Nada encontrado. Isso não quer dizer que o registro não exista: ele pode estar só no livro ou fora do período dos arquivos enviados."
                : hits.length === 200
                  ? "Os 200 primeiros resultados. Refine a pesquisa para ver os outros."
                  : `${hits.length} ${hits.length === 1 ? "registro encontrado" : "registros encontrados"}.`}
            </p>
            {hits.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Termo</TableHead>
                    <TableHead>
                      {kind === "casamento" ? "Cônjuges" : "Nome"}
                    </TableHead>
                    {kind !== "casamento" && <TableHead>Filiação</TableHead>}
                    <TableHead>Livro e folha</TableHead>
                    <TableHead>
                      {kind === "nascimento"
                        ? "Nascimento"
                        : kind === "casamento"
                          ? "Casamento"
                          : "Falecimento"}
                    </TableHead>
                    <TableHead>
                      <span className="sr-only">Abrir</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hits.map((hit) => (
                    <TableRow
                      key={hit.id}
                      className={hit.canceled ? "opacity-70" : undefined}
                    >
                      <TableCell className="align-top font-mono text-sm tabular-nums">
                        {hit.term || "-"}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Link
                          href={`/admin/rcpn/registro/${hit.id}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {hit.names.join(" e ")}
                        </Link>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {hit.fit === "near" && (
                            <Badge variant="outline">Semelhante</Badge>
                          )}
                          {hit.canceled && (
                            <Badge variant="destructive">Cancelado</Badge>
                          )}
                          {hit.subtype === "natimorto" && (
                            <Badge variant="outline">Natimorto</Badge>
                          )}
                          {hit.hasNotes && (
                            <Badge variant="secondary">
                              Com anotações ou averbações
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      {kind !== "casamento" && (
                        <TableCell className="align-top whitespace-normal text-sm">
                          <span className="block">
                            {hit.motherName || "Não informada"}
                          </span>
                          <span className="block text-muted-foreground">
                            {hit.fatherName}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="align-top text-sm whitespace-nowrap">
                        {[hit.book, hit.page && `fl. ${hit.page}`]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </TableCell>
                      <TableCell className="align-top text-sm whitespace-nowrap">
                        {formatIsoDate(
                          kind === "nascimento" ? hit.birthDate : hit.eventOn,
                        ) || "-"}
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="inline-flex flex-wrap gap-1">
                          <Link
                            href={`/admin/rcpn/registro/${hit.id}`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            Abrir
                          </Link>
                          {issue && !hit.canceled && (
                            <Link
                              href={`/admin/rcpn/certidoes/nova?registro=${hit.id}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              })}
                            >
                              Certidão
                            </Link>
                          )}
                          {edit && !hit.canceled && (
                            <Link
                              href={`/admin/rcpn/registro/${hit.id}/alterar`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              })}
                            >
                              Alterar
                            </Link>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        )}
        <p className="text-xs text-muted-foreground">
          {RCPN_KIND_LABELS[kind]}: o registro aberto mostra a ficha completa
          (registro, pessoas, filiação, avós, declarante, testemunhas, anotações
          e averbações) e o histórico de alterações.
        </p>
      </main>
    </>
  );
}
