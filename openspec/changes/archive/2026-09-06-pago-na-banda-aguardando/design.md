## Context

A fila lê em bandas (`fila-por-prioridade`): `queueGroupOf(status)` em
`_components/queue-order.ts` devolve o tom do selo (`STATUS_TONES`) como banda, com uma
correção só: andamento terminal vai para `closed`. "Pago" tem tom `working` (verde) e por isso
cai em "Em andamento", ordenado por prazo e chegada entre pedidos que já estão em trabalho. Na
prática um pedido pago some no meio da lista, e a serventia não vê que há dinheiro recebido
esperando o balcão começar.

O delta de `fila-por-prioridade` ainda não foi sincronizado para `openspec/specs`: o spec
principal ainda descreve a ordem por data. O delta desta mudança parte do texto de
`fila-por-prioridade`, que é o comportamento em produção.

## Goals / Non-Goals

**Goals:**
- "Pago" visível no alto da fila, na banda de quem espera o balcão, sem perder a leitura por
  prazo dentro da banda.
- Diff mínimo: uma exceção a mais em `queueGroupOf`, um teste, nada de tabela nova.

**Non-Goals:**
- Trocar o tom (cor) de "Pago".
- Reordenar bandas ou criar banda nova.
- Distinguir "Novo" de "Pago" dentro de "Aguardando" além do selo.

## Decisions

- **Exceção em `queueGroupOf`, não mudança de tom.** `queueGroupOf("paid")` devolve `waiting`;
  `STATUS_TONES.paid` continua `working`. Alternativa descartada: mudar `paid` para tom
  `waiting`, que resolveria em uma linha e manteria o invariante "banda = tom", mas pintaria
  "Pago" de âmbar, a mesma cor de "Aguardando pagamento". Os dois são estados opostos do
  dinheiro e ficariam iguais de relance. O invariante passa a ter duas correções (terminais e
  pago), ambas documentadas no comentário da função, e o teste de `queueGroupOf` fixa as duas.
- **"Aguardando", não "Com pendência".** O ticket diz "acima igual as exigências". Exigência é
  impedimento (tom vermelho, alguém precisa agir para destravar); pago é espera normal do
  balcão, o mesmo caso de "Novo". Colocar em "Com pendência" faria um selo verde sentar sob o
  cabeçalho de travados e inflaria a contagem de pendências.
- **Ordem interna inalterada.** `compareQueueRows` já lê urgência e chegada; um "Pago" com prazo
  vencido sobe dentro de "Aguardando" como um "Novo" vencido. Nenhum ajuste no comparador.

## Risks / Trade-offs

- [Selo verde sob o cabeçalho "Aguardando" estranha quem lê cor como banda] → aceito: o rótulo
  "Pago" explica; a alternativa (âmbar) confundiria com "Aguardando pagamento", que é pior.
- [Contagem de "Aguardando" cresce e a de "Em andamento" cai] → esperado, é o pedido do ticket;
  nada mais consome essas contagens.
