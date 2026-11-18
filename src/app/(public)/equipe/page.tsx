import { publicTeam } from "@/lib/team.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";

export const generateMetadata = publicMetadata("/equipe");

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

/** How big a level's cards are: the first level is the largest, then two steps down. */
const TIERS = [
  {
    card: "w-full max-w-[19rem]",
    avatar: 128,
    name: "text-2xl",
    role: "text-base",
  },
  {
    card: "w-full max-w-[16rem] sm:w-64",
    avatar: 96,
    name: "text-xl",
    role: "text-sm",
  },
  {
    card: "w-[calc(50%-0.5rem)] sm:w-52",
    avatar: 72,
    name: "text-base",
    role: "text-[13px]",
  },
] as const;

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
        groups.map((group, index) => {
          const tier = TIERS[Math.min(index === 0 ? 0 : index <= 2 ? 1 : 2, 2)];
          return (
            <section
              key={group.level.id}
              aria-labelledby={`nivel-${group.level.id}`}
              className="mt-10"
            >
              <h2
                id={`nivel-${group.level.id}`}
                className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink after:h-px after:flex-1 after:bg-brand-border"
              >
                {group.level.label}
              </h2>
              <ul className="mt-5 flex flex-wrap justify-center gap-4">
                {group.people.map((person) => (
                  <li
                    key={person.id}
                    className={`${tier.card} rounded-2xl border border-brand-border bg-white px-3.5 py-5 text-center shadow-sm`}
                  >
                    {person.photo ? (
                      // biome-ignore lint/performance/noImgElement: served by its own route, which checks what may be public
                      <img
                        src={`/equipe/foto/${person.id}`}
                        alt={`Foto de ${person.name}`}
                        width={tier.avatar}
                        height={tier.avatar}
                        loading="lazy"
                        className="mx-auto rounded-full border border-brand-border object-cover"
                        style={{ width: tier.avatar, height: tier.avatar }}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="mx-auto flex items-center justify-center rounded-full bg-brand-tint font-serif font-semibold text-brand-primary"
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
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
