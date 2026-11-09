// Fills a fictional office with invented records. Every name, address and
// number below is made up, and so are the offices themselves.
//
// - Serra Verde (src/core/tenant/tenants/demonstracao.ts), the default: the
//   panel's desk, so a screen recording has something to show. Service
//   requests in a few states, data rights requests, ombudsman
//   manifestations, appointments for today and tomorrow, two publications.
// - Vale do Silício (src/core/tenant/tenants/vale-do-silicio.ts), where the
//   course cohorts land: the public site a learner browses. Proclamas, an
//   edital of every other sector, a notice and three monthly bulletins. No
//   citizen filings: nobody reads that office's queue.
//
//   node --conditions=react-server --env-file=.env.local \
//     --import ./scripts/test-resolve.mjs scripts/seed-demo-data.ts [slug]
//
// Refuses any office outside FICTIONAL_SLUGS: this writes rows nobody asked
// for, and only an office with no real citizen may receive them. Idempotent
// enough for its purpose: run again and it adds another batch (bulletins are
// replaced per month), which is fine for an office meant to look busy.
import { eq } from "drizzle-orm";
import { getAct } from "../src/core/acts/catalog.ts";
import { defaultExpiry } from "../src/core/publications/expiry.ts";
import { noticeTypesOf } from "../src/core/publications/notice-types.ts";
import type { PublicationFormInput } from "../src/core/publications/publication.ts";
import {
  generateAccessKey,
  hashAccessKey,
} from "../src/core/request/access-key.ts";
import { parseDetails } from "../src/core/request/kinds.ts";
import {
  generateCancelToken,
  hashCancelToken,
} from "../src/core/scheduling/appointment.ts";
import { addDays } from "../src/core/scheduling/calendar.ts";
import { COURSES_TENANT_SLUG } from "../src/core/tenant/courses-tenant.ts";
import type { NoticeSector } from "../src/core/tenant/gating.ts";
import { TENANTS } from "../src/core/tenant/resolve.ts";
import { FUNDS_BY_STATE } from "../src/core/transparency/rubrics.ts";
import { user } from "../src/db/auth-schema.ts";
import { db } from "../src/db/index.ts";
import { bookAppointmentWith } from "../src/lib/appointments.ts";
import { today } from "../src/lib/office-config.ts";
import { createPublication } from "../src/lib/publications.ts";
import { createRecordWith } from "../src/lib/service-request.ts";
import { upsertBulletin } from "../src/lib/transparency.ts";

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

function act(id: string) {
  const found = getAct(id);
  if (!found) throw new Error(`Ato ${id} não existe no catálogo.`);
  return found;
}

const key = () => hashAccessKey(generateAccessKey());

async function fillDesk(): Promise<void> {
  // Service requests: the queue's usual mix, newest first on the desk.
  const requests = [
    {
      act: act("rcpn-certidao"),
      applicantName: "Joana Beatriz Farias",
      contact: "joana.farias@exemplo.com",
      cpf: "529.982.247-25",
      status: "new",
    },
    {
      act: act("notas-certidao"),
      applicantName: "Carlos Eduardo Menezes",
      contact: "carlos.menezes@exemplo.com",
      cpf: "168.995.350-09",
      status: "awaiting-payment",
    },
    {
      act: act("rcpn-habilitacao-casamento"),
      applicantName: "Luana Ribeiro Tavares",
      contact: "luana.tavares@exemplo.com",
      cpf: "854.713.240-04",
      status: "awaiting-compliance",
    },
    {
      act: act("rcpn-certidao"),
      applicantName: "Antônio Sérgio Pontes",
      contact: "(84) 99888-0001",
      status: "processing",
    },
    {
      act: act("notas-abertura-firma"),
      applicantName: "Renata Quintela Sousa",
      contact: "renata.sousa@exemplo.com",
      cpf: "406.912.130-00",
      status: "ready-for-pickup",
    },
  ];
  for (const r of requests) {
    // createRecordWith rather than createServiceRequestWith: only the former
    // takes a status, and a desk of five "new" rows would show nothing.
    const { protocolNumber } = await createRecordWith(
      db,
      tenant,
      "service-request",
      {
        applicantName: r.applicantName,
        contact: r.contact,
        cpf: r.cpf,
        accessKeyHash: key(),
        actId: r.act.id,
        attribution: r.act.attribution,
        status: r.status,
        details: parseDetails("service-request", { channel: "online" }),
      },
    );
    console.log(`pedido ${protocolNumber} (${r.status})`);
  }

  // Data rights: one fresh, one older so the deadline shows some urgency.
  for (const d of [
    {
      applicantName: "Marcos Vinícius Leal",
      contact: "marcos.leal@exemplo.com",
      description:
        "Quero saber quais dados meus constam no cadastro do cartório.",
      right: "access",
    },
    {
      applicantName: "Sílvia Regina Dantas",
      contact: "silvia.dantas@exemplo.com",
      description:
        "Meu endereço está desatualizado na certidão emitida em 2024.",
      right: "rectification",
    },
  ]) {
    const { protocolNumber } = await createRecordWith(
      db,
      tenant,
      "data-rights",
      {
        applicantName: d.applicantName,
        contact: d.contact,
        description: d.description,
        accessKeyHash: key(),
        details: parseDetails("data-rights", { right: d.right }),
      },
    );
    console.log(`LGPD ${protocolNumber}`);
  }

  // Ombudsman: a praise and a complaint, both signed.
  for (const m of [
    {
      applicantName: "Dona Terezinha Alves",
      contact: "terezinha.alves@exemplo.com",
      description:
        "Fui muito bem atendida na retirada da certidão do meu neto. Parabéns à equipe.",
      manifestationType: "praise",
    },
    {
      applicantName: "Fábio Henrique Costa",
      contact: "fabio.costa@exemplo.com",
      description:
        "Esperei mais de quarenta minutos na fila do reconhecimento de firma na terça.",
      manifestationType: "complaint",
    },
  ]) {
    const { protocolNumber } = await createRecordWith(db, tenant, "ombudsman", {
      applicantName: m.applicantName,
      contact: m.contact,
      description: m.description,
      accessKeyHash: key(),
      details: parseDetails("ombudsman", {
        manifestationType: m.manifestationType,
        anonymous: false,
        confidential: false,
      }),
    });
    console.log(`ouvidoria ${protocolNumber}`);
  }

  // Appointments: today's agenda card wants today; tomorrow fills the queue.
  const day = today();
  const tomorrow = addDays(day, 1);
  for (const a of [
    { date: day, slotTime: "09:00", citizenName: "Paula Cristina Nogueira" },
    { date: day, slotTime: "10:30", citizenName: "Ricardo Amaral Teixeira" },
    { date: day, slotTime: "14:00", citizenName: "Beatriz Lopes Andrade" },
    { date: tomorrow, slotTime: "09:00", citizenName: "Gustavo Henrique Melo" },
    { date: tomorrow, slotTime: "11:00", citizenName: "Camila Duarte Freitas" },
  ]) {
    try {
      const booked = await bookAppointmentWith(db, SLUG, {
        date: a.date,
        slotTime: a.slotTime,
        citizenName: a.citizenName,
        email: `${a.citizenName.split(" ")[0].toLowerCase()}@exemplo.com`,
        phone: "(84) 99777-0000",
        serviceId: "rcpn-certidao",
        serviceLabel: "Certidão",
        mode: "presencial",
        cancelTokenHash: hashCancelToken(generateCancelToken()),
      });
      console.log(`agenda ${booked.protocolNumber} ${a.date} ${a.slotTime}`);
    } catch (error) {
      // A slot already taken by a previous run is not worth stopping for.
      console.log(
        `agenda ${a.date} ${a.slotTime}: ${(error as Error).message}`,
      );
    }
  }

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

async function fillPublicSite(): Promise<void> {
  const day = today();
  const publish = (data: PublicationFormInput) =>
    createPublication(SLUG, data, actor.id);

  await publish({
    kind: "marriageBanns",
    sector: "proclamas",
    noticeType: "proclamas-casamento",
    title: "Proclamas de casamento: Bianca Torres Lima e Otávio Reis Moura",
    body:
      "Faço saber que pretendem casar-se Bianca Torres Lima e Otávio Reis Moura, " +
      "ambos solteiros, residentes neste município. Quem souber de algum impedimento " +
      "oponha-o na forma da lei.",
    publishAt: day,
    expireAt: defaultExpiry("proclamas-casamento", day) ?? addDays(day, 15),
  });

  // One edital per other sector, of the sector's first type in the catalog.
  const editais: { sector: NoticeSector; title: string; body: string }[] = [
    {
      sector: "registro-imoveis",
      title: "Edital de usucapião extrajudicial: Sítio Boa Esperança",
      body:
        "Faço saber a terceiros interessados que tramita nesta serventia pedido de " +
        "usucapião extrajudicial do imóvel rural denominado Sítio Boa Esperança, " +
        "requerido por Marcos Vinícius Paiva. Eventual impugnação deve ser apresentada " +
        "no prazo legal.",
    },
    {
      sector: "protesto",
      title: "Edital de intimação: título apresentado por Comercial Byte Ltda.",
      body:
        "Fica intimado Jonas Ferreira Leal, em lugar incerto e não sabido, a pagar ou " +
        "dar as razões da recusa do título apresentado a protesto por Comercial Byte " +
        "Ltda., no valor de R$ 1.250,00.",
    },
    {
      sector: "rtd",
      title: "Edital de notificação: Carla Menezes Souto",
      body:
        "Fica notificada Carla Menezes Souto, em lugar incerto e não sabido, do teor " +
        "da notificação extrajudicial registrada nesta serventia a requerimento de " +
        "Imobiliária Vale Digital.",
    },
    {
      sector: "rcpj",
      title: "Edital: Associação dos Desenvolvedores de Vale do Silício",
      body:
        "Torna-se público o registro da alteração estatutária da Associação dos " +
        "Desenvolvedores de Vale do Silício, para ciência de terceiros.",
    },
  ];
  for (const edital of editais) {
    const noticeType = noticeTypesOf(edital.sector)[0] ?? null;
    await publish({
      kind: "publicNotice",
      sector: edital.sector,
      noticeType,
      title: edital.title,
      body: edital.body,
      publishAt: day,
      expireAt: defaultExpiry(noticeType, day) ?? addDays(day, 30),
    });
  }

  await publish({
    kind: "notice",
    sector: null,
    noticeType: null,
    title: "Atendimento por agendamento",
    body: "Para ser atendido sem fila, marque dia e hora pela página Agendar atendimento.",
    publishAt: day,
    expireAt: addDays(day, 60),
  });
  console.log("publicações e editais criados");

  // The last three full months, consolidated: the transparency page's
  // bulletin table. Funds keyed by the state's own map, never invented keys.
  const [year, month] = day.split("-").map(Number);
  for (let back = 1; back <= 3; back++) {
    const ref = new Date(Date.UTC(year, month - 1 - back, 1));
    const referenceMonth = ref.toISOString().slice(0, 10);
    const fundAmountsCents = Object.fromEntries(
      FUNDS_BY_STATE[tenant.location.state].map((fund, i) => [
        fund.key,
        (180_000 + back * 9_000) * (i + 1),
      ]),
    );
    await upsertBulletin(
      SLUG,
      {
        referenceMonth,
        figures: {
          actsCount: 900 + back * 37,
          fundAmountsCents,
          issCents: 410_000 + back * 12_000,
          grossRevenueCents: 9_800_000 + back * 150_000,
          expensesCents: 6_100_000 + back * 90_000,
        },
        status: "consolidated",
      },
      actor.id,
    );
    console.log(`boletim ${referenceMonth}`);
  }
}

if (SLUG === DESK_SLUG) {
  await fillDesk();
  console.log(`Mesa da serventia ${SLUG} preenchida.`);
} else {
  await fillPublicSite();
  console.log(`Site da serventia ${SLUG} preenchido.`);
}
process.exit(0);
