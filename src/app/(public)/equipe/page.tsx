import type { Metadata } from "next";
import { frameImageStyle } from "@/core/team/team.ts";
import { publicTeam } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";

const pageMetadata = publicMetadata("/equipe");

// While nobody is published the page is only its empty state: no menu links
// to it and the sitemap leaves it out, and a noindex keeps a search engine
// that reaches it anyway from filing that as the office's team page.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const [metadata, team] = await Promise.all([
    pageMetadata(),
    publicTeam(tenant.slug),
  ]);
  return team.groups.length > 0
    ? metadata
    : { ...metadata, robots: { index: false, follow: true } };
}

/** "2024-05-20" as "20/05/2024". */
const brDate = (iso: string) => iso.split("-").reverse().join("/");

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter((part) => part.length > 2 || part === part.toUpperCase())
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/**
 * How big a level's cards are: the first level is the largest, then two
 * steps down. `perRow` is how many hang from one branch on a wide screen; a
 * larger level is split into more branches, so the lines never overhang.
 */
const TIERS = [
  {
    card: "w-full max-w-[19rem] sm:w-72",
    avatar: 128,
    name: "text-2xl",
    role: "text-base",
    perRow: 3,
  },
  {
    card: "w-full max-w-[16rem] sm:w-60",
    avatar: 96,
    name: "text-xl",
    role: "text-sm",
    perRow: 3,
  },
  {
    card: "w-36 sm:w-44 md:w-52",
    avatar: 72,
    name: "text-base",
    role: "text-[13px]",
    perRow: 4,
  },
] as const;

/** A card's branch: the bar over the row and the drop into the card (wide screens). */
const BRANCH =
  "relative px-1.5 pt-5 md:px-2 md:pt-6 md:before:absolute md:before:inset-x-0 md:before:top-0 md:before:h-px md:before:bg-brand-accent-ink/35 md:after:absolute md:after:top-0 md:after:left-1/2 md:after:h-6 md:after:w-px md:after:bg-brand-accent-ink/35 md:first:before:left-1/2 md:last:before:right-1/2 md:only:before:hidden";

/** Splits a level into even branches of at most `size` (5 become 3 and 2, not 4 and 1). */
function branches<T>(items: readonly T[], size: number): T[][] {
  const count = Math.max(1, Math.ceil(items.length / size));
  const each = Math.ceil(items.length / count);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += each) {
    rows.push(items.slice(i, i + each));
  }
  return rows;
}

export default async function TeamPage() {
  const tenant = await requireSection("equipe");
  const { groups } = await publicTeam(tenant.slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-10">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        Quem atende você
      </span>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
        Nossa equipe
      </h1>
      <p className="mt-2 max-w-2xl text-left text-[15px] leading-relaxed text-brand-muted hyphens-none">
        Conheça quem trabalha no {tenant.name}, do titular aos colaboradores. As
        portarias de nomeação, quando publicadas, podem ser abertas em PDF.
      </p>

      {groups.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-brand-border bg-brand-surface px-5 py-6 text-sm text-brand-muted">
          A equipe ainda não foi publicada nesta página. Para falar com o
          cartório, use a página de contato.
        </p>
      ) : (
        // The hierarchy as a tree: one trunk runs behind the levels, each
        // level hangs from it under its name, and each person from a branch.
        <div className="relative mt-10 before:absolute before:inset-y-0 before:left-1/2 before:w-px before:bg-brand-accent-ink/35">
          {groups.map((group, index) => {
            const tier =
              TIERS[Math.min(index === 0 ? 0 : index <= 2 ? 1 : 2, 2)];
            return (
              <section
                key={group.level.id}
                aria-labelledby={`nivel-${group.level.id}`}
                className={index === 0 ? "" : "mt-8"}
              >
                <h2
                  id={`nivel-${group.level.id}`}
                  className="relative z-10 mx-auto w-fit max-w-full rounded-full border border-brand-border bg-brand-tint px-4 py-1.5 text-center text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink"
                >
                  {group.level.label}
                </h2>
                {branches(group.people, tier.perRow).map((row) => (
                  <ul
                    key={row.map((person) => person.id).join("-")}
                    className="flex flex-wrap justify-center"
                  >
                    {row.map((person) => (
                      <li key={person.id} className={BRANCH}>
                        <div
                          className={`${tier.card} relative z-10 rounded-2xl border border-brand-border bg-white px-3.5 py-5 text-center shadow-sm`}
                        >
                          {person.photo ? (
                            <span
                              className={`relative mx-auto block overflow-hidden border border-brand-border bg-white ${
                                person.frame.shape === "square"
                                  ? "rounded-xl"
                                  : "rounded-full"
                              }`}
                              style={{
                                width: tier.avatar,
                                height: tier.avatar,
                              }}
                            >
                              {/* biome-ignore lint/performance/noImgElement: served by its own route, which checks what may be public */}
                              <img
                                src={`/equipe/foto/${person.id}`}
                                alt={`Foto de ${person.name}`}
                                width={tier.avatar}
                                height={tier.avatar}
                                loading="lazy"
                                className="absolute inset-0 size-full"
                                style={frameImageStyle(person.frame)}
                              />
                            </span>
                          ) : (
                            <span
                              aria-hidden="true"
                              className={`mx-auto flex items-center justify-center bg-brand-tint font-serif font-semibold text-brand-primary ${
                                person.frame.shape === "square"
                                  ? "rounded-xl"
                                  : "rounded-full"
                              }`}
                              style={{
                                width: tier.avatar,
                                height: tier.avatar,
                                fontSize: tier.avatar * 0.34,
                              }}
                            >
                              {initialsOf(person.name)}
                            </span>
                          )}
                          <p
                            className={`mt-3 text-center font-serif ${tier.name} font-semibold leading-tight text-brand-primary hyphens-none`}
                          >
                            {person.name}
                          </p>
                          <p
                            className={`mt-1 text-center ${tier.role} text-brand-muted`}
                          >
                            {group.level.label}
                          </p>
                          {person.profession && (
                            <p className="mt-1 text-center text-xs text-brand-muted">
                              {person.profession}
                            </p>
                          )}
                          {person.portaria && (
                            <p className="mt-2 text-center text-xs text-brand-muted">
                              {[
                                person.registration,
                                person.portariaDate
                                  ? `de ${brDate(person.portariaDate)}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                              <br />
                              <a
                                href={`/equipe/portaria/${person.id}`}
                                target="_blank"
                                rel="noopener"
                                className="font-semibold text-brand-accent-ink underline underline-offset-2"
                              >
                                Ver portaria
                              </a>
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
