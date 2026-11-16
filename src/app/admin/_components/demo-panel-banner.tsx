import { DEMO_PANEL_NOTICE } from "@/core/tenant/demo-office.ts";

/**
 * On top of every panel screen a course participant opens in the
 * demonstration office (change painel-livre-para-alunos): the office does
 * not exist, the others see what they do, and it may all be wiped. The
 * layout renders it only for them (showsDemoPanelNotice).
 */
export function DemoPanelBanner({ officeName }: { officeName: string }) {
  return (
    <div
      role="note"
      className="mx-4 mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground md:mx-8"
    >
      <strong className="font-semibold">
        {DEMO_PANEL_NOTICE.title.replace("{officeName}", officeName)}
      </strong>{" "}
      {DEMO_PANEL_NOTICE.body}
    </div>
  );
}
