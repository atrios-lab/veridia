"use client";

// Dispatches the contract chat-widget.tsx listens for — see the comment
// there. Kept as its own client component so the rest of the page stays a
// server component.
export function OpenChatButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("veridia:open-chat"))}
      className="btn btn-md border border-brand-primary-soft text-brand-on-dark-body hover:border-brand-accent"
    >
      Atendimento online
    </button>
  );
}
