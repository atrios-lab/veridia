/**
 * The Visão geral's title: the greeting and how much sits on the desk. The
 * global search and the date it used to carry moved to the top bar (see
 * ../../_components/top-bar.tsx), which now sits over this screen like over
 * every other. Same shape as AdminPageHeader, with the greeting where the
 * title goes.
 */
export function OverviewHeader({
  greeting,
  deskCount,
  criticalCount,
}: {
  greeting: string;
  deskCount: number;
  criticalCount: number;
}) {
  return (
    <div className="flex flex-none flex-col gap-[5px] px-[30px] pt-[30px]">
      <h1 className="font-serif text-[26px] leading-[1.1] font-semibold text-admin-primary">
        {greeting}
      </h1>
      <p className="text-[13.5px] leading-normal text-admin-muted">
        {deskCount} {deskCount === 1 ? "item" : "itens"} na sua mesa
        {criticalCount > 0 &&
          ` · ${criticalCount} prazo${criticalCount === 1 ? "" : "s"} crítico${criticalCount === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
