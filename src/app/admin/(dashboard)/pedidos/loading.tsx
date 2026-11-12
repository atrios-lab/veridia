import Link from "next/link";
import { ATTRIBUTIONS } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { QUEUE_TABS, queueSearchParams } from "./_components/queue-order.ts";
import { QueueToolbar } from "./_components/queue-toolbar.tsx";

// The tab, filter, search and page size the toolbar shows until the real
// query is known: the same defaults `queueSearchParams` falls back to, so a
// plain `/admin/pedidos` load never has to swap them out once the data lands.
const DEFAULT_QUERY = queueSearchParams({});

// Ten placeholders, named so React can key them; they never reorder.
const SKELETON_ROWS = Array.from({ length: 10 }, (_, i) => `row-${i + 1}`);

/**
 * What the queue looks like while its two queries run: the real title,
 * description and "Lançar pedido" button, which need no data, and the same
 * card, the tabs without their numbers and ten rows of the height a real row
 * has, so the page does not jump when the data lands.
 */
export default function ServiceRequestQueueLoading() {
  return (
    <output
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando a fila de pedidos"
    >
      <AdminPageHeader
        title="Pedidos de serviço"
        description="Acompanhe e dê andamento aos pedidos feitos pelo site ou no balcão."
        actions={
          <Link
            href="/admin/pedidos/novo"
            className={buttonVariants({ size: "lg" })}
          >
            <AdminIcon name="plus" strokeWidth={2.4} className="size-4" />
            Lançar pedido
          </Link>
        }
      />
      <div className="animate-pulse px-4 pt-6 pb-8 md:px-8">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-2 gap-x-2 border-b px-4 pt-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 @container">
            {QUEUE_TABS.map((tab) => (
              <span
                key={tab.id}
                className="flex items-start justify-between gap-2 px-2 pt-2 pb-3 text-sm leading-tight font-medium text-muted-foreground"
              >
                {tab.shortLabel ? (
                  <span>
                    <span className="@max-[1120px]:hidden">{tab.label}</span>
                    <span className="hidden @max-[1120px]:inline">
                      {tab.shortLabel}
                    </span>
                  </span>
                ) : (
                  tab.label
                )}
                <span className="h-5 w-6 shrink-0 rounded-full bg-muted" />
              </span>
            ))}
          </div>
          <QueueToolbar query={DEFAULT_QUERY} attributions={ATTRIBUTIONS} />
          <div className="h-10 border-b" />
          {SKELETON_ROWS.map((id) => (
            <div
              key={id}
              className="flex h-12 items-center gap-2 border-b px-4"
            >
              <div className="size-4 rounded-sm bg-muted" />
              <div className="h-3.5 w-30 rounded-sm bg-muted" />
              <div className="h-3.5 flex-[1.6] rounded-sm bg-muted" />
              <div className="h-3.5 flex-[1.4] rounded-sm bg-muted" />
              <div className="h-3.5 w-15 rounded-sm bg-muted" />
              <div className="h-3.5 w-40 rounded-sm bg-muted" />
              <div className="h-8 w-20 rounded-md bg-muted" />
            </div>
          ))}
          <div className="h-14 border-t bg-muted/50" />
        </div>
      </div>
    </output>
  );
}
