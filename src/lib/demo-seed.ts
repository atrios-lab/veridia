import "server-only";
import { getAct } from "@/core/acts/catalog.ts";
import { defaultExpiry } from "@/core/publications/expiry.ts";
import { noticeTypesOf } from "@/core/publications/notice-types.ts";
import type { PublicationFormInput } from "@/core/publications/publication.ts";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import { addDays, type IsoDate } from "@/core/scheduling/calendar.ts";
import type { NoticeSector } from "@/core/tenant/gating.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { FUNDS_BY_STATE } from "@/core/transparency/rubrics.ts";
import type { Database } from "@/db/index.ts";
import { bookAppointmentWith } from "./appointments.ts";
import { createPublicationWith } from "./publications.ts";
import { createRecordWith } from "./service-request.ts";
import { upsertBulletinWith } from "./transparency.ts";

// The invented records of a fictional office: the desk (requests, data
// rights, ombudsman, appointments) and the public site (publications and
// bulletins). Every name, address and number is made up, every e-mail is
// under example.com, the domain reserved for examples. Called by
// scripts/seed-demo-data.ts and, for the demonstration office, by its
// cleaning (lib/demo-reset.ts), which seeds it again right after.
//
// Never called for a real office: the callers refuse any office that is not
// fictional before they get here.

function act(id: string) {
  const found = getAct(id);
  if (!found) throw new Error(`Ato ${id} não existe no catálogo.`);
  return found;
}

const key = () => hashAccessKey(generateAccessKey());

/** The desk's records: requests, data rights, ombudsman, appointments. */
export async function seedDeskRecordsWith(
  database: Database,
  tenant: Tenant,
  day: IsoDate,
  log: (line: string) => void = () => {},
): Promise<void> {
  // Service requests: the queue's usual mix, newest first on the desk.
  const requests = [
    {
      act: act("rcpn-certidao"),
      applicantName: "Joana Beatriz Farias",
      contact: "joana.farias@example.com",
      cpf: "529.982.247-25",
      status: "new",
    },
    {
      act: act("notas-certidao"),
      applicantName: "Carlos Eduardo Menezes",
      contact: "carlos.menezes@example.com",
      cpf: "168.995.350-09",
      status: "awaiting-payment",
    },
    {
      act: act("rcpn-habilitacao-casamento"),
      applicantName: "Luana Ribeiro Tavares",
      contact: "luana.tavares@example.com",
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
      contact: "renata.sousa@example.com",
      cpf: "406.912.130-00",
      status: "ready-for-pickup",
    },
  ];
  for (const r of requests) {
    // createRecordWith rather than createServiceRequestWith: only the former
    // takes a status, and a desk of five "new" rows would show nothing.
    const { protocolNumber } = await createRecordWith(
      database,
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
    log(`pedido ${protocolNumber} (${r.status})`);
  }

  // Data rights: one fresh, one older so the deadline shows some urgency.
  for (const d of [
    {
      applicantName: "Marcos Vinícius Leal",
      contact: "marcos.leal@example.com",
      description:
        "Quero saber quais dados meus constam no cadastro do cartório.",
      right: "access",
    },
    {
      applicantName: "Sílvia Regina Dantas",
      contact: "silvia.dantas@example.com",
      description:
        "Meu endereço está desatualizado na certidão emitida em 2024.",
      right: "rectification",
    },
  ]) {
    const { protocolNumber } = await createRecordWith(
      database,
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
    log(`LGPD ${protocolNumber}`);
  }

  // Ombudsman: a praise and a complaint, both signed.
  for (const m of [
    {
      applicantName: "Dona Terezinha Alves",
      contact: "terezinha.alves@example.com",
      description:
        "Fui muito bem atendida na retirada da certidão do meu neto. Parabéns à equipe.",
      manifestationType: "praise",
    },
    {
      applicantName: "Fábio Henrique Costa",
      contact: "fabio.costa@example.com",
      description:
        "Esperei mais de quarenta minutos na fila do reconhecimento de firma na terça.",
      manifestationType: "complaint",
    },
  ]) {
    const { protocolNumber } = await createRecordWith(
      database,
      tenant,
      "ombudsman",
      {
        applicantName: m.applicantName,
        contact: m.contact,
        description: m.description,
        accessKeyHash: key(),
        details: parseDetails("ombudsman", {
          manifestationType: m.manifestationType,
          anonymous: false,
          confidential: false,
        }),
      },
    );
    log(`ouvidoria ${protocolNumber}`);
  }

  // Appointments: today's agenda card wants today; tomorrow fills the queue.
  const tomorrow = addDays(day, 1);
  for (const a of [
    { date: day, slotTime: "09:00", citizenName: "Paula Cristina Nogueira" },
    { date: day, slotTime: "10:30", citizenName: "Ricardo Amaral Teixeira" },
    { date: day, slotTime: "14:00", citizenName: "Beatriz Lopes Andrade" },
    { date: tomorrow, slotTime: "09:00", citizenName: "Gustavo Henrique Melo" },
    { date: tomorrow, slotTime: "11:00", citizenName: "Camila Duarte Freitas" },
  ]) {
    try {
      const booked = await bookAppointmentWith(database, tenant.slug, {
        date: a.date,
        slotTime: a.slotTime,
        citizenName: a.citizenName,
        email: `${a.citizenName.split(" ")[0].toLowerCase()}@example.com`,
        phone: "(84) 99777-0000",
        serviceId: "rcpn-certidao",
        serviceLabel: "Certidão",
        mode: "presencial",
        cancelTokenHash: hashCancelToken(generateCancelToken()),
      });
      log(`agenda ${booked.protocolNumber} ${a.date} ${a.slotTime}`);
    } catch (error) {
      // A slot already taken by a previous run is not worth stopping for.
      log(`agenda ${a.date} ${a.slotTime}: ${(error as Error).message}`);
    }
  }
}

/** The public site's content: proclamas, an edital of every other sector,
 * a notice and the last three months' bulletins. */
export async function seedPublicSiteWith(
  database: Database,
  tenant: Tenant,
  actorId: string,
  day: IsoDate,
  log: (line: string) => void = () => {},
): Promise<void> {
  const publish = (data: PublicationFormInput) =>
    createPublicationWith(database, tenant.slug, data, actorId);

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
  log("publicações e editais criados");

  // The last three full months, consolidated: the transparency page's
  // bulletin table. Funds keyed by the state's own map, never invented keys.
  const [year, month] = day.split("-").map(Number);
  for (let back = 1; back <= 3; back++) {
    // Months counted on the calendar, not through a Date: "back" months
    // before the office's current month, always its first day.
    const monthIndex = year * 12 + (month - 1) - back;
    const referenceMonth = `${Math.floor(monthIndex / 12)}-${String(
      (monthIndex % 12) + 1,
    ).padStart(2, "0")}-01`;
    const fundAmountsCents = Object.fromEntries(
      FUNDS_BY_STATE[tenant.location.state].map((fund, i) => [
        fund.key,
        (180_000 + back * 9_000) * (i + 1),
      ]),
    );
    await upsertBulletinWith(
      database,
      tenant.slug,
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
      actorId,
    );
    log(`boletim ${referenceMonth}`);
  }
}

/** Both: the demonstration office as it starts (change
 * painel-livre-para-alunos). */
export async function seedDemoOfficeWith(
  database: Database,
  tenant: Tenant,
  actorId: string,
  day: IsoDate,
  log: (line: string) => void = () => {},
): Promise<void> {
  await seedPublicSiteWith(database, tenant, actorId, day, log);
  await seedDeskRecordsWith(database, tenant, day, log);
}
