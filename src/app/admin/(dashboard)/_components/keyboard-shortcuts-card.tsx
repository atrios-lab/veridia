const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "Ctrl K", description: "busca global" },
  { keys: "G P", description: "ir para Pedidos" },
  { keys: "G A", description: "ir para Agenda" },
  { keys: "N", description: "novo pedido no balcão" },
];

export function KeyboardShortcutsCard() {
  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
        Atalhos de teclado
      </span>
      <div className="mt-3 flex flex-col gap-2">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.keys}
            className="flex items-center gap-2 text-[12.5px] text-admin-muted"
          >
            <span className="rounded-[5px] border border-admin-input-border bg-admin-input-bg px-1.5 py-0.5 text-[10.5px] font-bold text-admin-muted">
              {shortcut.keys}
            </span>
            <span>{shortcut.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
