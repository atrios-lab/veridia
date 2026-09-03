## Why

O protocolo de pedido de serviço (REQ) não tem prazo nenhum: o cidadão abre a consulta, vê só a data de criação e liga para o cartório cobrando; o cartório não enxerga quais pedidos estão perto de estourar o prazo legal. O canal LGPD já resolve isso (prazo de 15 dias, contagem na consulta, badge de urgência na fila) — falta o mesmo no canal de pedidos.

A diferença é que o pedido não tem um prazo só: cada ato responde ao seu, e o registral depende da demanda. Então o protocolo nasce com o prazo que a lei fixa para aquele ato e o cartório ajusta manualmente quando precisa — inclusive zerando quando a análise de fato começa.

## What Changes

- Todo pedido de serviço passa a ter um prazo: par (data de início, dias úteis). O protocolo nasce com o prazo que a lei fixa para o ato pedido, contado da emissão — online ou no balcão.
- O prazo legal de cada ato entra no catálogo (config as code), com a fonte citada em cada entrada. Só entram prazos lidos da lei; onde nenhuma lei fixa prazo (atos notariais, procedimentos de rito próprio) o ato fica sem prazo legal.
- O cartório ganha, no painel, o prazo padrão **dos atos sem prazo legal**. Ele nunca sobrepõe um prazo legal.
- A contagem é em dias úteis, excluído o dia do protocolo, como manda a Lei 14.382/2022; feriados nacionais entram, municipais não.
- Toda previsão mostrada ao cidadão vem acompanhada da ressalva de que os pedidos são atendidos por ordem de chegada.
- Na troca de andamento, o operador vê o prazo atual e pode, opcionalmente: manter (default, zero cliques), zerar (início = hoje, "para já iniciar o prazo a partir de lá") ou trocar a quantidade de dias (prazo maior, manualmente).
- A consulta pública (protocolo/QR) mostra ao cidadão se o pedido está dentro do prazo e até quando ("dia X de N", em dias úteis).
- A confirmação da emissão mostra o prazo estimado de análise junto do número do protocolo.
- A fila de pedidos e o detalhe no painel ganham o badge de urgência que o LGPD já tem: "vence em N dias" perto do fim, "vencido há N dias" depois dele. Andamentos encerrados não têm urgência.
- O pedido ganha urgência própria (`deadlineUrgency`), em dias úteis. O canal LGPD mantém a contagem dele, em dias corridos: os 15 dias são da Lei 13.709 art. 19 e a regra de dias úteis da Lei 14.382 não os alcança.

## Capabilities

### New Capabilities

Nenhuma — o prazo é comportamento novo de capabilities existentes.

### Modified Capabilities

- `service-request`: a emissão informa o prazo estimado e a consulta pública mostra a situação do prazo (dentro / dia X de N / vencido).
- `admin-service-requests`: a troca de andamento oferece o controle de prazo (manter / zerar / trocar dias); fila e detalhe exibem o badge de urgência do prazo.
- `admin-office-settings`: novo ajuste do prazo padrão de análise do pedido, com default legal em código e edição pelo painel.

## Impact

- `src/core/request/kinds.ts`: `serviceRequestDetailsSchema` ganha campos opcionais de prazo (sem migração de banco — vive no JSONB `details`).
- `src/core/acts/catalog.ts`: `legalDeadlineDays` e `legalDeadlineNote` por ato.
- `src/core/request/deadline.ts`: contagem em dias úteis, reusando `isBusinessDay`/`nationalHolidays` da agenda.
- `src/core/overview/urgency.ts`: urgência do pedido em dias úteis, ao lado da do LGPD em dias corridos.
- `src/core/tenant/overrides.ts` + `tenant_content`: novo override `OfficeDeadline` no padrão dos existentes (sem migração).
- `src/app/(public)/protocolo/` e `src/app/(public)/solicitar/`: exibição do prazo ao cidadão.
- `src/app/admin/(dashboard)/pedidos/`: controle de prazo na troca de status, badge na fila e no detalhe (reuso do `deadline-badge` do LGPD).
- `src/app/admin/(dashboard)/` (Ajustes): campo do prazo padrão.

## Non-goals

- Prazo legal para os atos que a lei não fixa prazo: ficam com o padrão do cartório, nunca com um número inventado.
- Feriados municipais e estaduais: só os nacionais entram, porque não há onde a serventia declarar os seus (mesma limitação da agenda).
- Prazos menores que um dia: a certidão de inteiro teor tem 4 horas na lei e é tratada como 1 dia.
- Pausa automática do relógio em exigência: o controle é manual do operador na troca de andamento — é exatamente o que foi pedido.
- Alterar o prazo do canal LGPD: continua fixo em 15 dias por lei.
- Urgência de prazo do pedido na Visão geral / mesa de trabalho: a fila e o detalhe cobrem a necessidade; integração com a mesa fica para depois se fizer falta.
- Notificações (e-mail/WhatsApp) de prazo vencendo.
