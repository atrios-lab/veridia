import { Kbd } from "../../_ui/kbd.tsx";

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "Ctrl K", description: "busca global" },
  { keys: "G P", description: "ir para Pedidos" },
  { keys: "G A", description: "ir para Agenda" },
  { keys: "N", description: "novo pedido no balcão" },
];

export function KeyboardShortcutsCard() {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">
        Atalhos de teclado
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.keys}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Kbd>{shortcut.keys}</Kbd>
            <span>{shortcut.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
