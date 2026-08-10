## Context

O site público já tem o canal LGPD (`/lgpd`, seção `dpo-lgpd`, gating `always`) com o
Encarregado vindo de `tenant.dpo`. Os únicos cookies do produto são essenciais: a sessão do
Better Auth (admin) e o token httpOnly do chat do cidadão. Falta a política de privacidade como
documento público e o aviso de cookies.

## Goals / Non-Goals

**Goals:**
- Página `/privacidade` estática por tenant, servida no layout público existente.
- Aviso de cookies de ciência, persistido no navegador, só no site público.
- Link no rodapé.

**Non-Goals:**
- Gestão de categorias de consentimento, registro de consentimento em banco, editor de política
  no admin, mudança no canal `/lgpd` (ver Non-goals da proposta).

## Decisions

- **Rota fora do gating de seções.** `/privacidade` não entra em `SECTIONS`/`SECTION_ROUTES`:
  gating é por atribuição legal e a política é obrigatória para todas as serventias. Mesmo
  racional já usado para links fixos do rodapé. Alternativa rejeitada: nova seção com gating
  `always` — igual ao efeito prático, mas incha o schema do tenant sem ganho.
- **Conteúdo hardcoded na página, dados do tenant interpolados.** A redação é estrutura (fixa),
  como os textos do canal LGPD já são; nome, CNS, contatos e DPO vêm de `getTenant()`. Nenhum
  campo novo no schema do tenant — tudo que a política cita já existe (`dpo`, `contacts`,
  `cns`, `name`).
- **Ciência de cookies em cookie próprio, não localStorage.** Um cookie simples (ex.:
  `cookie-notice-ack=1`, `SameSite=Lax`, 1 ano, sem httpOnly — precisa ser lido/escrito pelo
  componente cliente) permite que o próprio banner seja um componente pequeno que decide
  exibição no cliente após a hidratação, evitando flash de banner para quem já deu ciência se
  lido no servidor. Decisão: ler no servidor via `cookies()` no layout público e só renderizar
  o banner quando ausente — zero flash e zero JS para quem já deu ciência. O clique em
  "Entendi" grava o cookie via `document.cookie` e esconde o banner localmente.
  Alternativa rejeitada: localStorage — invisível ao servidor, obrigaria renderizar o banner
  sempre e escondê-lo por JS (flash).
- **Banner não modal, fixo na base da viewport,** com o tema do tenant (tokens `brand-*`), sem
  overlay. Sem dependência nova.
- **Admin intocado.** O banner monta apenas em `(public)/layout.tsx`.

## Risks / Trade-offs

- [Texto jurídico fixo pode não agradar a alguma serventia] → a política cobre só o que o
  produto faz de fato; pedido de texto próprio vira conversa de produto, não fork.
- [Layout público vira Server Component que lê `cookies()`] → torna o layout dinâmico; o
  layout já usa `getTenant()` por host, então já é dinâmico por requisição — sem regressão.
- [Novo canal de coleta futuro (ex.: analytics) tornaria o aviso insuficiente] → a seção de
  cookies da política e o banner declaram "apenas essenciais"; adicionar cookie não essencial
  exige revisitar esta capability (opt-in real).

## Migration Plan

Deploy único, sem banco, sem variável de ambiente. Rollback é reverter o commit.

## Open Questions

Nenhuma.
