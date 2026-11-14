import { notFound } from "next/navigation";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  CHANNELS,
  channelFor,
  competenceLabel,
  deadlineOf,
  isChannel,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { getFilingWith } from "@/lib/title-transfers.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../../_components/sign-or-print.tsx";
import { requireTitularidade } from "../../_access.ts";
import { MarkSentForm, RemoveFilingButton } from "../../titularidade-forms.tsx";

export const metadata = { title: "Ofício de titularidade" };

const br = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

export default async function FilingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviado?: string }>;
}) {
  await requireTitularidade();
  const tenant = await getTenant();
  const filing = await getFilingWith(db, tenant.slug, (await params).id);
  if (!filing) notFound();
  const query = await searchParams;
  const deadline = deadlineOf(filing.competence, officeHolidays(tenant));
  const pdf = `/admin/utilitarios/titularidade/oficios/${filing.id}/arquivo`;
  const suggested = channelFor(filing.transfers.map((t) => t.service));
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Ofício nº ${filing.number}`}
        description={`Mudanças de titularidade de ${competenceLabel(filing.competence)} à Secretaria Municipal de Tributação · ${
          filing.transfers.length === 0
            ? "sem movimento"
            : `${filing.transfers.length} ato${filing.transfers.length === 1 ? "" : "s"}`
        }`}
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/titularidade?mes=${filing.competence}`}
          label="Titularidade à prefeitura"
        />
        {query.enviado && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Envio registrado.
          </output>
        )}
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">1. Assinar</h2>
          <p className="text-sm text-muted-foreground text-justify hyphens-auto">
            O ofício traz a relação e a ficha de cada ato, com o destinatário da
            configuração da Declaração de ISS (Secretaria, prefeitura, CNPJ,
            endereço e secretário). Assine digitalmente pelo painel ou imprima
            para assinar à mão.
          </p>
          <SignOrPrint
            pdfHref={pdf}
            title={`Ofício ${filing.number} · titularidade à prefeitura`}
          />
        </section>
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            2. Enviar à plataforma e registrar o recibo
          </h2>
          <p className="text-sm text-muted-foreground text-justify hyphens-auto">
            Prazo: até {br(deadline)}, o último dia útil do mês seguinte (art.
            184-A). Lance os atos na {CHANNELS[suggested]} com a planilha do mês
            e anexe o ofício assinado; depois registre aqui o número do recibo
            de entrega e, se puder, o comprovante. A entrega à SEMUT em papel é
            complementar e não substitui o envio eletrônico (§ 2º).
          </p>
          {filing.sentOn && (
            <p className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-text">
              Enviado em {br(filing.sentOn)} ·{" "}
              {isChannel(filing.channel)
                ? CHANNELS[filing.channel]
                : filing.channel}{" "}
              · recibo {filing.receipt}
              {filing.receiptPath && (
                <>
                  {" · "}
                  <a
                    href={`/admin/utilitarios/titularidade/oficios/${filing.id}/recibo`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    ver comprovante
                  </a>
                </>
              )}
              {filing.semutOn && ` · entregue à SEMUT em ${br(filing.semutOn)}`}
            </p>
          )}
          <MarkSentForm
            id={filing.id}
            sentOn={filing.sentOn}
            channel={isChannel(filing.channel) ? filing.channel : suggested}
            receipt={filing.receipt}
            semutOn={filing.semutOn}
            semutReceipt={filing.semutReceipt}
            hasReceiptFile={Boolean(filing.receiptPath)}
            today={today()}
          />
        </section>
        <section className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-justify hyphens-auto">
            Errou o mês ou faltou um ato? Corrija os atos e gere outro ofício;
            este pode ser excluído com justificativa e fica guardado com o
            número.
          </p>
          <RemoveFilingButton id={filing.id} />
        </section>
      </main>
    </>
  );
}
