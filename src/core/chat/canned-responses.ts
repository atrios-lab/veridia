/**
 * The four ready-made replies the design offers (US-16). A fixed list, not a
 * per-office editable set: nothing in the user stories asks the panel to
 * manage this content, and text visible to the citizen still comes from
 * here, never hardcoded in a component: see openspec/config.yaml,
 * "Convenção de idioma".
 */
export interface CannedResponse {
  key: string;
  label: string;
  text: string;
}

export const CANNED_RESPONSES: readonly CannedResponse[] = [
  {
    key: "greeting",
    label: "Saudação",
    text: "Olá! Em que posso ajudar hoje?",
  },
  {
    key: "request-document",
    label: "Pedir documento",
    text: "Para seguir com o seu pedido, poderia enviar uma foto ou um PDF do documento, por favor?",
  },
  {
    key: "hours",
    label: "Horário de funcionamento",
    text: "Atendemos de segunda a sexta, dentro do horário informado no site. Fora desse horário, o canal fica fechado.",
  },
  {
    key: "closing",
    label: "Encerramento",
    text: "Posso encerrar por aqui? Se precisar de algo mais, é só abrir uma nova conversa.",
  },
] as const;
