import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { groupByLevel } from "@/core/team/team.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getLegacySigners } from "@/lib/tax-guides.ts";
import {
  getLevelsWith,
  listStaffRowsWith,
  type StaffRow,
  toRecord,
} from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import {
  archivePersonAction,
  movePersonAction,
  restorePersonAction,
  undeletePersonAction,
} from "./actions.ts";
import {
  DeletePerson,
  ImportSigners,
  LevelsEditor,
  PersonForm,
  type PersonView,
} from "./team-forms.tsx";

export const metadata = { title: "Equipe do cartório" };

const PATH = "/admin/configuracoes/equipe";

const viewOf = (row: StaffRow): PersonView => ({
  id: row.id,
  name: row.name,
  levelId: row.levelId,
  profession: row.profession,
  registration: row.registration,
  portariaDate: row.portariaDate ?? "",
  showOnSite: row.showOnSite,
  imageConsent: row.imageConsent,
  canSign: row.canSign,
  isDpo: row.isDpo,
  dpoExternal: row.dpoExternal,
  hasPhoto: Boolean(row.photoPath),
  hasPortaria: Boolean(row.portariaPath),
  portariaName: row.portariaName ?? "",
  hasWord: Boolean(row.wordPath),
  wordName: row.wordName ?? "",
  frame: toRecord(row).frame,
});

function Avatar({ row }: { row: StaffRow }) {
  if (row.photoPath) {
    return (
      // biome-ignore lint/performance/noImgElement: a private panel route, not an optimizable asset
      <img
        src={`${PATH}/arquivo/${row.id}/photo`}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full border object-cover"
      />
    );
  }
  const initials = row.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{
    editar?: string;
    novo?: string;
    arquivados?: string;
    excluidos?: string;
  }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "team.edit", session.user.permissions)
  ) {
    notFound();
  }
  const query = await searchParams;
  const tenant = await getTenant();
  const showArchived = query.arquivados === "1";
  const showDeleted = query.excluidos === "1";
  const [levels, all, deleted] = await Promise.all([
    getLevelsWith(db, tenant.slug),
    listStaffRowsWith(db, tenant.slug, { archived: true }),
    listStaffRowsWith(db, tenant.slug, { deleted: true }),
  ]);
  const active = all.filter((row) => !row.archivedAt);
  const archived = all.filter((row) => row.archivedAt);
  const editing = query.editar
    ? all.find((row) => row.id === query.editar)
    : undefined;
  const adding = query.novo === "1";
  const legacy = await getLegacySigners(tenant).catch(() => []);
  const canImport = !all.some((row) => row.canSign) && legacy.length > 0;
  const groups = groupByLevel(
    levels,
    active.map((row) => ({ ...toRecord(row), row })),
  );

  return (
    <>
      <AdminPageHeader maxWidth={960} title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />

        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Equipe do cartório
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            As pessoas da serventia, do Tabelião aos serviços gerais, na ordem
            da hierarquia. No site, o visitante vê só quem você marcar em
            "Mostrar no site": nome, cargo e profissão. A foto só aparece com a
            autorização de imagem, e a portaria (número, data e o PDF) aparece
            quando você anexa o arquivo, porque anexar é publicar. O Word da
            portaria fica só aqui.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`${PATH}?novo=1`}
              className={buttonVariants({ size: "sm" })}
            >
              + Adicionar pessoa
            </Link>
            <a
              href="/equipe"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ver a página do site
            </a>
          </div>
        </section>

        {(adding || editing) && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {editing ? `Editar: ${editing.name}` : "Nova pessoa"}
            </h2>
            <div className="mt-3">
              <PersonForm
                key={editing?.id ?? "novo"}
                levels={levels}
                person={editing ? viewOf(editing) : undefined}
              />
            </div>
          </section>
        )}

        {canImport && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Quem assina
            </h2>
            <div className="mt-2">
              <ImportSigners count={legacy.length} />
            </div>
          </section>
        )}

        {groups.length === 0 ? (
          <section className="rounded-xl border bg-card px-5 py-6 text-sm text-muted-foreground">
            Ninguém cadastrado ainda. Comece pelo Tabelião: clique em "Adicionar
            pessoa".
          </section>
        ) : (
          groups.map(({ level, people }) => (
            <section
              key={level.id}
              aria-labelledby={`nivel-${level.id}`}
              className="rounded-xl border bg-card px-5 py-4"
            >
              <h2
                id={`nivel-${level.id}`}
                className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {level.label}
              </h2>
              <ul className="mt-2 flex flex-col divide-y">
                {people.map(({ row }, index) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
                  >
                    <Avatar row={row} />
                    <div className="min-w-48 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {row.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[row.profession, row.registration]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        className={
                          row.showOnSite
                            ? "bg-success text-success-foreground"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {row.showOnSite ? "No site" : "Só no painel"}
                      </Badge>
                      {row.canSign && (
                        <Badge className="bg-muted text-foreground">
                          Assina
                        </Badge>
                      )}
                      {row.isDpo && (
                        <Badge className="bg-primary text-primary-foreground">
                          {row.dpoExternal
                            ? "Só DPO (fora da equipe)"
                            : "Encarregado de Dados (DPO)"}
                        </Badge>
                      )}
                      {row.portariaPath && (
                        <Badge className="bg-muted text-foreground">
                          Portaria pública
                        </Badge>
                      )}
                      {row.wordPath && (
                        <Badge className="bg-muted text-foreground">Word</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <form action={movePersonAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="direction" value="up" />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          aria-label={`Subir ${row.name}`}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                      </form>
                      <form action={movePersonAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="direction" value="down" />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          aria-label={`Descer ${row.name}`}
                          disabled={index === people.length - 1}
                        >
                          ↓
                        </Button>
                      </form>
                      <Link
                        href={`${PATH}?editar=${row.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Editar
                      </Link>
                      <form action={archivePersonAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Arquivar
                        </Button>
                      </form>
                      <DeletePerson
                        id={row.id}
                        name={row.name}
                        onSite={row.showOnSite}
                        signs={row.canSign}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {archived.length > 0 && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Arquivados ({archived.length})
              </h2>
              <Link
                href={showArchived ? PATH : `${PATH}?arquivados=1`}
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                {showArchived ? "Esconder" : "Mostrar"}
              </Link>
            </div>
            {showArchived && (
              <ul className="mt-2 flex flex-col divide-y">
                {archived.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <Avatar row={row} />
                    <span className="min-w-48 flex-1 text-sm text-foreground">
                      {row.name}
                    </span>
                    <form action={restorePersonAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Voltar para a equipe
                      </Button>
                    </form>
                    <DeletePerson
                      id={row.id}
                      name={row.name}
                      onSite={false}
                      signs={false}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {deleted.length > 0 && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Excluídos ({deleted.length})
              </h2>
              <Link
                href={showDeleted ? PATH : `${PATH}?excluidos=1`}
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                {showDeleted ? "Esconder" : "Mostrar"}
              </Link>
            </div>
            {showDeleted && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Não aparecem no painel, no site nem em Quem assina. O registro
                  fica guardado, com quem excluiu e o motivo na auditoria.
                </p>
                <ul className="mt-2 flex flex-col divide-y">
                  {deleted.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 py-2.5"
                    >
                      <Avatar row={row} />
                      <span className="min-w-48 flex-1 text-sm text-muted-foreground line-through">
                        {row.name}
                      </span>
                      <form action={undeletePersonAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Desfazer exclusão
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <section className="rounded-xl border bg-card px-5 py-4">
          <details>
            <summary className="cursor-pointer text-base font-semibold text-foreground">
              Níveis da hierarquia
            </summary>
            <p className="mt-2 mb-3 text-sm text-muted-foreground">
              A ordem daqui é a do mosaico no site. Dá para renomear, reordenar
              e criar níveis. Um nível com pessoas (mesmo arquivadas) não sai.
            </p>
            <LevelsEditor
              levels={levels}
              inUse={[...new Set(all.map((row) => row.levelId))]}
            />
          </details>
        </section>
      </main>
    </>
  );
}
