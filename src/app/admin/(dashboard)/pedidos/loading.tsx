import { QUEUE_TABS } from "./_components/queue-order.ts";

// Ten placeholders, named so React can key them; they never reorder.
const SKELETON_ROWS = Array.from({ length: 10 }, (_, i) => `row-${i + 1}`);

/**
 * What the queue looks like while its two queries run: the same title, the
 * same card, the tabs without their numbers and ten rows of the height a
 * real row has, so the page does not jump when the data lands.
 */
export default function ServiceRequestQueueLoading() {
  return (
    <output
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando a fila de pedidos"
      className="block animate-pulse"
    >
      <div className="flex flex-wrap items-center gap-5 px-[30px] pt-[30px]">
        <div className="flex min-w-[280px] flex-1 flex-col gap-[5px]">
          <div className="h-[29px] w-56 rounded-md bg-admin-readonly-bg" />
          <div className="h-5 w-[420px] max-w-full rounded-md bg-admin-readonly-bg" />
        </div>
        <div className="h-[46px] w-[160px] rounded-[11px] bg-admin-readonly-bg" />
      </div>
      <div className="px-[30px] pt-6 pb-9">
        <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="flex flex-wrap border-b border-admin-border px-3 @container min-[1210px]:flex-nowrap">
            {QUEUE_TABS.map((tab) => (
              <span
                key={tab.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 px-1.5 pt-[15px] pb-3 text-[13px] font-medium whitespace-nowrap text-admin-muted"
              >
                {tab.shortLabel ? (
                  <>
                    <span className="@max-[1120px]:hidden">{tab.label}</span>
                    <span className="hidden @max-[1120px]:inline">
                      {tab.shortLabel}
                    </span>
                  </>
                ) : (
                  tab.label
                )}
                <span className="h-5 w-6 rounded-[10px] bg-admin-readonly-bg" />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2.5 border-b border-admin-border px-[22px] py-4">
            <div className="h-[38px] w-[160px] rounded-[9px] bg-admin-readonly-bg" />
            <span className="flex-1" />
            <div className="h-[38px] w-[170px] rounded-[9px] bg-admin-readonly-bg" />
            <div className="h-[38px] w-[300px] rounded-[9px] bg-admin-readonly-bg" />
          </div>
          <div className="h-[39px] border-b border-admin-border" />
          {SKELETON_ROWS.map((id) => (
            <div
              key={id}
              className="flex h-[49px] items-center gap-2.5 border-b border-admin-border/60 px-[22px]"
            >
              <div className="h-4 w-4 rounded-[4px] bg-admin-readonly-bg" />
              <div className="h-3.5 w-[120px] rounded bg-admin-readonly-bg" />
              <div className="h-3.5 flex-[1.6] rounded bg-admin-readonly-bg" />
              <div className="h-3.5 flex-[1.4] rounded bg-admin-readonly-bg" />
              <div className="h-3.5 w-[60px] rounded bg-admin-readonly-bg" />
              <div className="h-3.5 w-[160px] rounded bg-admin-readonly-bg" />
              <div className="h-[31px] w-[76px] rounded-[8px] bg-admin-readonly-bg" />
            </div>
          ))}
          <div className="h-[60px] bg-admin-footer-bg" />
        </div>
      </div>
    </output>
  );
}
