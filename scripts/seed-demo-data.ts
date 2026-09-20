// Fills the demonstration office's desk with invented records, so a screen
// recording of the panel has something to show: service requests in a few
// states, data rights requests, ombudsman manifestations, appointments for
// today and tomorrow, and two publications. Every name, address and number
// below is made up; the office itself is fictional (see
// src/core/tenant/tenants/demonstracao.ts).
//
//   node --conditions=react-server --env-file=.env.local \
//     --import ./scripts/test-resolve.mjs scripts/seed-demo-data.ts
//
// Refuses any office but the demonstration one: this writes rows nobody
// asked for, and only an office with no real citizen may receive them.
// Idempotent enough for its purpose: run again and it adds another batch,
// which is fine for a desk that is meant to look busy.
import { eq } from "drizzle-orm";
import { getAct } from "../src/core/acts/catalog.ts";
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
import { TENANTS } from "../src/core/tenant/resolve.ts";
import { user } from "../src/db/auth-schema.ts";
import { db } from "../src/db/index.ts";
import { bookAppointmentWith } from "../src/lib/appointments.ts";
import { today } from "../src/lib/office-config.ts";
import { createPublication } from "../src/lib/publications.ts";
import { createRecordWith } from "../src/lib/service-request.ts";

const SLUG = "cartorio-demonstracao";
const tenant = TENANTS[SLUG];
if (!tenant) throw new Error(`A serventia ${SLUG} não está registrada.`);

const [actor] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.tenantSlug, SLUG))
  .limit(1);
if (!actor) {
  throw new Error(
    `Nenhum usuário da serventia ${SLUG}. Rode antes: ` +
      `ADMIN_SEED_EMAIL=demo@atrioss.com ADMIN_SEED_TENANT=${SLUG} pnpm db:seed`,
  );
}

function act(id: string) {
  const found = getAct(id);
  if (!found) throw new Error(`Ato ${id} não existe no catálogo.`);
  return found;
}

const key = () => hashAccessKey(generateAccessKey());

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
    description: "Meu endereço está desatualizado na certidão emitida em 2024.",
    right: "rectification",
  },
]) {
  const { protocolNumber } = await createRecordWith(db, tenant, "data-rights", {
    applicantName: d.applicantName,
    contact: d.contact,
    description: d.description,
    accessKeyHash: key(),
    details: parseDetails("data-rights", { right: d.right }),
  });
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
    console.log(`agenda ${a.date} ${a.slotTime}: ${(error as Error).message}`);
  }
}

// Publications: one proclamas on the site, one notice scheduled.
await createPublication(
  SLUG,
  {
    kind: "marriageBanns",
    sector: "proclamas",
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
    title: "Horário especial na sexta-feira",
    body: "Na próxima sexta-feira o atendimento ao balcão encerra às 12h.",
    publishAt: addDays(day, 2),
    expireAt: addDays(day, 9),
  },
  actor.id,
);
console.log("publicações criadas");

console.log(`Mesa da serventia ${SLUG} preenchida.`);
process.exit(0);
