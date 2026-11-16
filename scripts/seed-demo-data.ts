// Fills a fictional office with invented records. Every name, address and
// number below is made up, and so are the offices themselves.
//
// - Serra Verde (src/core/tenant/tenants/demonstracao.ts), the default: the
//   panel's desk, so a screen recording has something to show. Service
//   requests in a few states, data rights requests, ombudsman
//   manifestations, appointments for today and tomorrow, two publications.
// - Vale do Silício (src/core/tenant/tenants/vale-do-silicio.ts), where the
//   course cohorts land: the public site a participant browses (proclamas,
//   an edital of every other sector, a notice and three monthly bulletins)
//   and the desk every participant works in (change
//   painel-livre-para-alunos): the same requests, data rights requests,
//   ombudsman manifestations and appointments as Serra Verde's.
//
// Every e-mail address is under example.com, the domain reserved for
// examples: the demonstration office holds its messages, but Serra Verde
// sends them, and a made-up address must never be a real mailbox.
//
//   node --conditions=react-server --env-file=.env.local \
//     --import ./scripts/test-resolve.mjs scripts/seed-demo-data.ts [slug]
//
// Refuses any office outside FICTIONAL_SLUGS: this writes rows nobody asked
// for, and only an office with no real citizen may receive them. Idempotent
// enough for its purpose: run again and it adds another batch (bulletins are
// replaced per month), which is fine for an office meant to look busy.
import { eq } from "drizzle-orm";
import { addDays } from "../src/core/scheduling/calendar.ts";
import { COURSES_TENANT_SLUG } from "../src/core/tenant/courses-tenant.ts";
import { TENANTS } from "../src/core/tenant/resolve.ts";
import { user } from "../src/db/auth-schema.ts";
import { db } from "../src/db/index.ts";
import {
  seedDemoOfficeWith,
  seedDeskRecordsWith,
} from "../src/lib/demo-seed.ts";
import { today } from "../src/lib/office-config.ts";
import { createPublication } from "../src/lib/publications.ts";

const DESK_SLUG = "cartorio-demonstracao";
const FICTIONAL_SLUGS = [DESK_SLUG, COURSES_TENANT_SLUG];

const SLUG = process.argv[2] ?? DESK_SLUG;
if (!FICTIONAL_SLUGS.includes(SLUG)) {
  throw new Error(
    `Só serventias fictícias recebem dados inventados: ${FICTIONAL_SLUGS.join(", ")}.`,
  );
}
const tenant = TENANTS[SLUG];
if (!tenant) throw new Error(`A serventia ${SLUG} não está registrada.`);

// Serra Verde has its own panel account. The courses office has learners
// only, so its content is published as the platform account would.
const [actor] = await db
  .select({ id: user.id })
  .from(user)
  .where(
    SLUG === DESK_SLUG
      ? eq(user.tenantSlug, SLUG)
      : eq(user.role, "superadmin"),
  )
  .limit(1);
if (!actor) {
  throw new Error(
    SLUG === DESK_SLUG
      ? `Nenhum usuário da serventia ${SLUG}. Rode antes: ` +
          `ADMIN_SEED_EMAIL=demo@atrioss.com ADMIN_SEED_TENANT=${SLUG} pnpm db:seed`
      : "Nenhuma conta da Átrios. Rode antes: pnpm db:seed-superadmin",
  );
}

/** Serra Verde's desk: the records, and two publications of its own. */
async function fillDesk(): Promise<void> {
  const day = today();
  await seedDeskRecordsWith(db, tenant, day, console.log);
  // Publications: one proclamas on the site, one notice scheduled.
  await createPublication(
    SLUG,
    {
      kind: "marriageBanns",
      sector: "proclamas",
      noticeType: "proclamas-casamento",
      title:
        "Proclamas de casamento: Luana Ribeiro Tavares e Diego Martins Rocha",
      body:
        "Faço saber que pretendem casar-se Luana Ribeiro Tavares e Diego Martins Rocha, " +
        "ambos solteiros, residentes neste município. Quem souber de algum impedimento " +
        "oponha-o na forma da lei.",
      publishAt: day,
      expireAt: addDays(day, 15),
    },
    actor.id,
  );
  await createPublication(
    SLUG,
    {
      kind: "notice",
      sector: null,
      noticeType: null,
      title: "Horário especial na sexta-feira",
      body: "Na próxima sexta-feira o atendimento ao balcão encerra às 12h.",
      publishAt: addDays(day, 2),
      expireAt: addDays(day, 9),
    },
    actor.id,
  );
  console.log("publicações criadas");
}

if (SLUG === DESK_SLUG) {
  await fillDesk();
  console.log(`Mesa da serventia ${SLUG} preenchida.`);
} else {
  await seedDemoOfficeWith(db, tenant, actor.id, today(), console.log);
  console.log(`Site e mesa da serventia ${SLUG} preenchidos.`);
}
process.exit(0);
