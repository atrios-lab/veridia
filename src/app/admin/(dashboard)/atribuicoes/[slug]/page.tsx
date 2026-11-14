import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSize } from "@/core/attributions/files.ts";
import {
  type AttributionGuide,
  CODIGO_DE_NORMAS_RN,
  type GuideBook,
  guideFor,
} from "@/core/attributions/guides.ts";
import { can } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import {
  attributionFolder,
  listAttributionFilesWith,
} from "@/lib/attribution-files.ts";
import { getTenant } from "@/lib/tenant.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { BackLink } from "../../../_components/back-link.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import type { ScreenHelp } from "../../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../../_components/screen-help-button.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { GUIDE_ICONS, requireGuides } from "../_lib.ts";
import {
  AttributionUploadForm,
  RemoveAttributionFileButton,
  RoutineChecklist,
} from "../files-forms.tsx";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const guide = guideFor((await params).slug);
  return { title: guide?.title ?? "Atribuições" };
}

/** The "!" of each part of the guide: what the part is and how to read it. */
function helpOf(guide: AttributionGuide): Record<string, ScreenHelp> {
  return {
    laws: {
      purpose: `As leis que regem o ${guide.title}. Tudo o que este guia diz vem delas, com o artigo.`,
      steps: [
        "A lei federal vale em todo o país; o Código de Normas do RN detalha a forma.",
        "Em caso de dúvida, leia o artigo citado: é ele que vale, não o resumo.",
      ],
    },
    acts: {
      purpose: `Os atos que o ${guide.title} pratica, cada um com o artigo da lei que o prevê.`,
      steps: [
        "Leia o nome do ato e o resumo.",
        "O artigo ao lado é onde a regra está escrita: em caso de dúvida, é ele que vale.",
      ],
      terms: guide.terms,
    },
    books: {
      purpose:
        "Os livros que a lei manda a serventia manter para esta atribuição. Cada ato fica escrito no seu livro, na ordem, e é de lá que sai a certidão.",
      steps: [
        "Cada cartão diz o nome do livro, o que vai nele e o artigo da lei.",
        "Termo de abertura e de encerramento, numeração das folhas e uso de fichas seguem o Código de Normas do RN.",
      ],
      terms: [
        {
          term: "Livro",
          meaning:
            "O registro permanente dos atos. Não se apaga: o que muda é averbado ou anotado.",
        },
        {
          term: "Ficha",
          meaning:
            "Quando a lei permite, a folha solta que substitui o livro encadernado, com o mesmo valor.",
        },
      ],
    },
    indexes: {
      purpose:
        "Os índices que a lei exige para achar os atos: pelo nome das pessoas e, no Registro de Imóveis, também pelos imóveis.",
      steps: [
        "O índice não substitui o livro: ele diz onde o ato está.",
        "No painel, o índice digital é montado com os arquivos do sistema da serventia (como já é no Registro Civil).",
      ],
      terms: [
        {
          term: "Indicador pessoal",
          meaning: "O índice pelas pessoas que aparecem nos atos.",
        },
        {
          term: "Indicador real",
          meaning: "No Registro de Imóveis, o índice pelos imóveis.",
        },
      ],
    },
    deadlines: {
      purpose:
        "Os prazos e deveres que a lei fixa para esta atribuição. Perder um prazo pode gerar responsabilidade da serventia.",
      steps: [
        "Cada linha traz o prazo e o artigo.",
        "Prazos em dias úteis ou corridos seguem o que o artigo diz; confira sempre o texto da lei.",
      ],
    },
    local: {
      purpose:
        "O que a lei federal deixa para a norma do estado. Aqui não se escreve o que não foi conferido: confira no Código de Normas do RN.",
      steps: [
        `Abra o ${CODIGO_DE_NORMAS_RN} e procure o capítulo desta atribuição.`,
        "Quando conferir, peça para incluir aqui o artigo, para todos da serventia seguirem igual.",
      ],
    },
  };
}

function Section({
  title,
  help,
  label,
  children,
}: {
  title: string;
  help: ScreenHelp;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <ScreenHelpButton help={help} canConfigure={false} label={label} />
      </div>
      {children}
    </section>
  );
}

function BookCards({ items }: { items: GuideBook[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((book) => (
        <div key={book.name} className="rounded-lg border p-4">
          <p className="font-semibold text-foreground">{book.name}</p>
          <p className="mt-1 text-sm text-foreground text-justify hyphens-auto">
            {book.holds}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{book.source}</p>
        </div>
      ))}
    </div>
  );
}

export default async function AttributionGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireGuides();
  const guide = guideFor((await params).slug);
  if (!guide) notFound();
  const help = helpOf(guide);
  const tenant = await getTenant();
  const canSend = can(
    session.user.role ?? "",
    "attributions.import",
    session.user.permissions,
  );
  const files = await listAttributionFilesWith(db, tenant.slug, guide.slug);

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title={guide.title}
        description={guide.summary}
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/atribuicoes" label="Todas as atribuições" />

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <AdminIcon
                name={GUIDE_ICONS[guide.slug] ?? "file"}
                className="h-4.5 w-4.5"
              />
            </span>
            <h2 className="text-lg font-semibold text-foreground">
              O que já dá para fazer no painel
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {guide.panel.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:border-primary/40"
              >
                <span className="font-medium text-primary">{link.label}</span>
                <span className="text-sm text-muted-foreground text-justify hyphens-auto">
                  {link.does}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {(guide.routines?.length ?? 0) > 0 && (
          <Section
            title="Roteiros dos atos"
            help={{
              purpose:
                "Listas para seguir na hora de fazer o ato: cada item é um requisito do artigo citado. Marque conforme confere.",
              steps: [
                "Abra o roteiro do ato que vai fazer.",
                "Marque cada item quando conferir no documento. A marcação não fica salva.",
                "O quadro amarelo, quando aparece, diz o que conferir na norma antes de seguir.",
              ],
            }}
            label="Como usar os roteiros dos atos"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {guide.routines?.map((routine, index) => (
                <div
                  key={routine.title}
                  className="flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {routine.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {routine.source}
                    </p>
                  </div>
                  <RoutineChecklist
                    id={`${guide.slug}-roteiro-${index}`}
                    items={routine.items}
                  />
                  {routine.check && (
                    <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-text text-justify hyphens-auto">
                      {routine.check}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section
          title="Arquivos"
          help={{
            purpose:
              "Os arquivos desta atribuição no painel: livros e índices exportados do sistema, remessas e retornos das centrais, PDFs, imagens digitalizadas e modelos.",
            steps: [
              "Escolha o arquivo, em qualquer formato, e diga do que se trata.",
              "O painel reconhece o tipo pelo conteúdo e guarda como veio.",
              "O mesmo arquivo não entra duas vezes.",
              "Excluir pede justificativa: o arquivo sai da lista e continua guardado na auditoria.",
            ],
            terms: [
              {
                term: "Remessa e retorno",
                meaning:
                  "Os arquivos trocados com as centrais (por exemplo, a CRA e a CENPROT no protesto, o ONR no registro de imóveis).",
              },
            ],
          }}
          label="Como enviar arquivos a esta atribuição"
        >
          {guide.slug === "registro-civil" && (
            <p className="text-sm text-muted-foreground text-justify hyphens-auto">
              Os arquivos do sistema do registro civil que alimentam o índice
              entram em{" "}
              <Link
                href="/admin/rcpn/importar"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Registro Civil › Importar arquivos
              </Link>
              . Aqui ficam os demais (modelos, ofícios, imagens).
            </p>
          )}
          {canSend ? (
            <AttributionUploadForm
              attribution={guide.slug}
              folder={attributionFolder(tenant.slug)}
              direct={blobUploadEnabled()}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Para enviar arquivos, peça ao Tabelião/Registrador a permissão
              "Atribuições: enviar e excluir arquivos".
            </p>
          )}
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum arquivo enviado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="align-top whitespace-normal">
                      <a
                        href={`/admin/atribuicoes/${guide.slug}/arquivos/${file.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {file.fileName}
                      </a>
                      {file.description && (
                        <span className="block text-xs text-muted-foreground">
                          {file.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline">{file.format}</Badge>
                    </TableCell>
                    <TableCell className="align-top text-sm tabular-nums">
                      {formatSize(file.sizeBytes)}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {formatOfficeDateTime(file.createdAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      {canSend && <RemoveAttributionFileButton id={file.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section
          title="A lei"
          help={help.laws}
          label="De onde vêm as regras desta atribuição"
        >
          <ul className="flex flex-col gap-2">
            {guide.laws.map((law) => (
              <li key={law.name} className="text-justify text-sm hyphens-auto">
                <span className="font-semibold text-foreground">
                  {law.name}
                </span>
                <span className="text-muted-foreground">: {law.about}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Atos"
          help={help.acts}
          label="O que é cada ato desta atribuição"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {guide.acts.map((act) => (
              <div key={act.name} className="rounded-lg border p-4">
                <p className="font-semibold text-foreground">{act.name}</p>
                <p className="mt-1 text-sm text-foreground text-justify hyphens-auto">
                  {act.about}
                </p>
                {act.source && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {act.source}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>

        {guide.structure && (
          <Section
            title={guide.structure.title}
            help={{
              purpose: guide.structure.intro,
              steps: [
                "Cada parte mostra o que vai nela e o artigo da lei que a exige.",
                "Na dúvida sobre um lançamento, confira o artigo: é ele que vale.",
              ],
            }}
            label={`Explicação: ${guide.structure.title.toLowerCase()}`}
          >
            <p className="text-sm text-muted-foreground text-justify hyphens-auto">
              {guide.structure.intro}
            </p>
            <ol className="flex flex-col gap-2">
              {guide.structure.parts.map((part, index) => (
                <li
                  key={part.name}
                  className="flex gap-3 rounded-lg border p-4"
                >
                  <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold text-foreground">
                      {part.name}
                    </span>
                    <span className="text-sm text-foreground text-justify hyphens-auto">
                      {part.holds}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {part.source}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <Section
          title="Livros"
          help={help.books}
          label="O que são os livros e o que vai em cada um"
        >
          {guide.books.length > 0 ? (
            <BookCards items={guide.books} />
          ) : (
            <p className="text-sm text-muted-foreground text-justify hyphens-auto">
              A lei federal não lista os livros desta atribuição: eles estão no{" "}
              {CODIGO_DE_NORMAS_RN}. Veja o quadro Conferir no Código de Normas,
              abaixo.
            </p>
          )}
        </Section>

        <Section
          title="Índices"
          help={help.indexes}
          label="Para que servem os índices"
        >
          {guide.indexes.length > 0 ? (
            <BookCards items={guide.indexes} />
          ) : (
            <p className="text-sm text-muted-foreground text-justify hyphens-auto">
              A lei federal não fixa o índice desta atribuição: a forma está no{" "}
              {CODIGO_DE_NORMAS_RN}.
            </p>
          )}
        </Section>

        {(guide.deadlines.length > 0 || (guide.duties?.length ?? 0) > 0) && (
          <Section
            title="Prazos e deveres"
            help={help.deadlines}
            label="Os prazos e deveres da lei"
          >
            <ul className="flex flex-col gap-3">
              {[...guide.deadlines, ...(guide.duties ?? [])].map((line) => (
                <li
                  key={line.what}
                  className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3"
                >
                  <span className="text-sm text-foreground text-justify hyphens-auto">
                    {line.what}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {line.source}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Palavras desta atribuição
          </h2>
          <dl className="grid gap-3 md:grid-cols-2">
            {guide.terms.map((t) => (
              <div key={t.term} className="rounded-lg border p-4">
                <dt className="font-semibold text-foreground">{t.term}</dt>
                <dd className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
                  {t.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft p-6 text-warning-text">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              Conferir no Código de Normas do RN
            </h2>
            <ScreenHelpButton
              help={help.local}
              canConfigure={false}
              label="Por que conferir no Código de Normas"
            />
          </div>
          <ul className="list-disc pl-5 text-justify text-sm hyphens-auto">
            {guide.checkLocal.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-muted-foreground">
          Este guia resume a lei para o dia a dia. Em caso de dúvida, vale o
          texto da lei e a orientação do Tabelião/Registrador.
        </p>
        <div>
          <Link
            href="/admin/atribuicoes"
            className={buttonVariants({ variant: "outline" })}
          >
            Ver todas as atribuições
          </Link>
        </div>
      </main>
    </>
  );
}
