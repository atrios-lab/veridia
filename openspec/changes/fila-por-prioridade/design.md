## Context

`listServiceRequests` (`src/lib/service-request.ts`) devolve a fila em `createdAt desc` e a
página só mapeia as linhas. O tom de cada andamento já existe em `STATUS_TONES`
(`_components/status-tone.ts`): cinco tons que dizem o que o andamento pede da serventia
(blocked, waiting, working, delivered, closed). A urgência do prazo já é calculada por linha para
o `DeadlineBadge`, via `deadlineUrgency` (`src/core/overview/urgency.ts`).

## Goals / Non-Goals

**Goals:**
- Ordem que responde "o que precisa de mão agora" sem o operador varrer a lista.
- Uma fonte só para "banda" e "cor": nenhum andamento pode ficar sob um cabeçalho que discorde
  do seu selo.

**Non-Goals:**
- Ordenação no banco. A fila de uma serventia cabe em memória e o critério mistura prazo (que
  depende do ato e do jsonb `details`) com status; empurrar isso para SQL seria repetir o
  cálculo do prazo em dois lugares.
- Ordem configurável por operador.

## Decisions

- **Banda = tom do selo, com terminais ao fim.** `queueGroupOf(status)` devolve o tom, salvo se o
  andamento é terminal (`isOpenServiceRequestStatus` falso), quando devolve `closed`. Alternativa
  descartada: uma tabela nova status → banda, que seria uma segunda lista de dezoito entradas
  para manter em sincronia com a de tons.
- **Comparador puro em `queue-order.ts`, testado com `node --test`.** A página só monta as
  linhas e chama `sort`. O comparador lê banda, `DeadlineUrgency` e `createdAt`; imports
  relativos porque o `node --test` não resolve o alias `@/`.
- **Dentro da banda: urgência, depois chegada.** Vencido (mais atrasado primeiro), vence em breve
  (mais próximo primeiro), demais por `createdAt` crescente. Encerrados em `createdAt`
  decrescente: ali ninguém está na fila, e o último concluído é o que ainda perguntam.
- **Cabeçalho de banda só com mais de uma banda visível.** Com filtro por andamento a lista é
  toda de uma banda e o cabeçalho seria ruído.
- **`DeadlineBadge` fica como está.** Ele também serve o detalhe do pedido; a página calcula a
  urgência para ordenar e o badge recalcula para exibir. É um cálculo de dias por linha, barato.

## Risks / Trade-offs

- [Operador acostumado a "o mais novo no topo" estranha a mudança] → mitigado pelos cabeçalhos
  com contagem, que explicam a ordem na própria tela; a busca por protocolo segue achando
  qualquer pedido.
- [Dois pedidos vencidos em bandas diferentes ficam separados] → aceito: a banda diz o tipo de
  ação, o badge vermelho continua marcando o atraso onde ele estiver.
