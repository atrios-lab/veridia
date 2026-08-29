## Why

O protocolo de pedido de serviço (REQ) não tem prazo nenhum: o cidadão abre a consulta, vê só a data de criação e liga para o cartório cobrando; o cartório não enxerga quais pedidos estão perto de estourar o prazo legal. O canal LGPD já resolve isso (prazo de 15 dias, contagem na consulta, badge de urgência na fila) — falta estender o mesmo tratamento ao canal de pedidos, com uma diferença: o prazo do pedido é editável pelo cartório, porque na prática registral o prazo depende da demanda e recomeça quando o cartório entende que a análise começou.

## What Changes

- Todo pedido de serviço passa a ter um prazo: par (data de início, dias corridos). Na emissão — online ou no balcão — o início é a data de criação e os dias vêm do padrão do cartório.
- O cartório ganha um padrão de prazo configurável no painel (Ajustes), com default legal em código. Pedidos sem prazo gravado (inclusive os anteriores à mudança) calculam com o padrão vigente.
- Na troca de andamento, o operador vê o prazo atual e pode, opcionalmente: manter (default, zero cliques), zerar (início = hoje, "para já iniciar o prazo a partir de lá") ou trocar a quantidade de dias (prazo maior, manualmente).
- A consulta pública (protocolo/QR) mostra ao cidadão se o pedido está dentro do prazo e até quando ("dia X de N do prazo"), no mesmo formato que o canal LGPD já usa.
- A confirmação da emissão mostra o prazo estimado de análise junto do número do protocolo.
- A fila de pedidos e o detalhe no painel ganham o badge de urgência que o LGPD já tem: "vence em N dias" perto do fim, "vencido há N dias" depois dele. Andamentos encerrados não têm urgência.
- A mecânica de urgência do LGPD (`dataRightsUrgency`) é generalizada para receber (início, dias) em vez dos 15 fixos; o canal LGPD continua travado em 15 dias (Lei 13.709, art. 19 — o cartório não pode esticar).

## Capabilities

### New Capabilities

Nenhuma — o prazo é comportamento novo de capabilities existentes.

### Modified Capabilities

- `service-request`: a emissão informa o prazo estimado e a consulta pública mostra a situação do prazo (dentro / dia X de N / vencido).
- `admin-service-requests`: a troca de andamento oferece o controle de prazo (manter / zerar / trocar dias); fila e detalhe exibem o badge de urgência do prazo.
- `admin-office-settings`: novo ajuste do prazo padrão de análise do pedido, com default legal em código e edição pelo painel.

## Impact

- `src/core/request/kinds.ts`: `serviceRequestDetailsSchema` ganha campos opcionais de prazo (sem migração de banco — vive no JSONB `details`).
- `src/core/overview/urgency.ts` e `src/core/request/channels.ts`: generalização da contagem e da urgência hoje específicas do LGPD.
- `src/core/tenant/overrides.ts` + `tenant_content`: novo override `OfficeDeadline` no padrão dos existentes (sem migração).
- `src/app/(public)/protocolo/` e `src/app/(public)/solicitar/`: exibição do prazo ao cidadão.
- `src/app/admin/(dashboard)/pedidos/`: controle de prazo na troca de status, badge na fila e no detalhe (reuso do `deadline-badge` do LGPD).
- `src/app/admin/(dashboard)/` (Ajustes): campo do prazo padrão.

## Non-goals

- Prazo por ato ou por atribuição: um único padrão por cartório basta ("na regra esse prazo não é seguido, depende da demanda"). Fica para quando alguém pedir.
- Dias úteis e calendário de feriados: contagem em dias corridos, como o LGPD já faz.
- Pausa automática do relógio em exigência: o controle é manual do operador na troca de andamento — é exatamente o que foi pedido.
- Alterar o prazo do canal LGPD: continua fixo em 15 dias por lei.
- Urgência de prazo do pedido na Visão geral / mesa de trabalho: a fila e o detalhe cobrem a necessidade; integração com a mesa fica para depois se fizer falta.
- Notificações (e-mail/WhatsApp) de prazo vencendo.
