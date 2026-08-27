## Context

`status-badge.tsx` colore o selo por fase (`phaseOfStatus`) mais três exceções avulsas
(`done`, `rejected`, `archived`). A regra foi escrita quando a fase e a urgência coincidiam;
com dezoito andamentos elas não coincidem mais: `with-requirement` e `awaiting-compliance`
moram na fase "Análise" e por isso saem verdes, o mesmo verde de "Em análise" e "Deferido".
O operador lê a fila de cima a baixo procurando o que travou, e nada na cor aponta para lá.

Com cinco andamentos precisando de exceção sobre dezoito, a regra por fase deixa de explicar
o que se vê — é mais barato dizer o tom de cada um do que manter uma regra e a lista de quem
foge dela.

## Goals / Non-Goals

**Goals:**
- Exigência lida como bloqueio: vermelho, no mesmo grau de destaque do laranja de pagamento.
- Um único lugar dizendo a cor de cada andamento, sem camada de exceções por cima.
- Fila e detalhe continuam pelo mesmo componente, sem chance de divergirem.

**Non-Goals:**
- Fases (`SERVICE_REQUEST_PHASES`) continuam existindo e servindo a mesa de trabalho e a linha
  do tempo — só deixam de decidir cor.
- Nenhum token ou hex novo; nenhuma mudança no site público.

## Decisions

**Mapa explícito de tom por andamento, no componente.** `STATUS_TONES: Record<ServiceRequestStatus,
Tone>` com as dezoito chaves, e `TONE_STYLES` com as cinco classes. O `Record` completo faz o
TypeScript cobrar o tom de qualquer andamento novo no mesmo commit que o cria — hoje um andamento
novo herda em silêncio a cor da fase.

Alternativa descartada: manter fase + acrescentar duas exceções. Diff menor no dia, mas deixaria
cinco exceções de dezoito e a próxima pessoa continuaria lendo uma regra que não vale.

**A cor mora na apresentação, não em `src/core`.** Tom é decisão visual do painel; `core` segue
sem saber de Tailwind. `phaseOfStatus` fica como está.

**Os cinco tons e o que cada um significa:**

| Tom | Classes | Andamentos |
| --- | --- | --- |
| `blocked` | `admin-error-bg` / `admin-error-text` | Com exigência, Aguardando exigência, Indeferido |
| `waiting` | `admin-warning-bg` / `admin-warning-text` | Novo, Protocolado, Aguardando pagamento |
| `working` | `admin-success-bg` / `admin-success-text` | Em análise, Pago, Prenotado, Em qualificação, Em processamento, Registrado, Averbado, Deferido |
| `delivered` | `admin-primary` / `white` | Disponível para retirada, Concluído |
| `closed` | `admin-readonly-bg` / `admin-faint` | Cancelado, Arquivado |

"Indeferido" entra no vermelho junto das exigências: já era vermelho antes, e continua sendo o
fim que ninguém queria. "Aguardando pagamento" fica no laranja que o balcão já reconhece — dinheiro
pendente é espera prevista, exigência é impedimento.

## Risks / Trade-offs

- [Mais vermelho na fila do que antes; se muitos pedidos ficam em exigência, o alarme vira
  paisagem] → é a leitura correta da operação: exigência é exatamente o que precisa ser visto e
  resolvido. Se virar paisagem, o problema está na fila, não na cor.
- [Perde-se a leitura "a cor conta a fase"] → a fase continua legível no detalhe e na mesa de
  trabalho, onde ela é agrupamento e não semáforo.

## Migration Plan

Uma alteração de arquivo, sem dado nem contrato envolvido. Rollback é reverter o commit.
