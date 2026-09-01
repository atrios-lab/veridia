## Context

A gratuidade entrou no site como `feeExemption` no catálogo mais um checkbox dentro do formulário
dos dois atos isentáveis (change `add-fee-exemption-request`, ainda não arquivada). Funciona para
quem já sabe qual ato quer; não funciona para quem chega sabendo só que é isento. A serventia
pediu a inversão: a gratuidade como item da lista de atos do RCPN, e o ato que se quer isento
perguntado dentro dela.

O catálogo já tem o molde para um item que não é um ato do rol: `otherAct(attribution)` gera "Outro
ato desta área" por atribuição, e `getAct` a reconhece pelo prefixo do id. A entrada da gratuidade
é o mesmo padrão, com outro prefixo.

## Goals / Non-Goals

**Goals:**

- Uma porta só para pedir gratuidade, visível na tela em que o cidadão escolhe o ato.
- O ato que a isenção pede fica gravado no pedido, não só na cabeça de quem leu o formulário.
- Nada do que a change anterior fixou se perde: declaração datada, anexo obrigatório, lista aberta
  de documentos, visibilidade no painel e no requerimento.

**Non-Goals:**

- Conceder a isenção, calcular valor ou integrar com sistema de benefício social.
- Migrar pedidos antigos: os que não têm ato-alvo continuam sem, e a leitura tolera a ausência.
- Generalizar para outras atribuições antes de existir ato isentável fora do RCPN.

## Decisions

**A entrada é um ato sintético, gerado por atribuição, no padrão de `otherAct`.**
`exemptionAct(attribution)` devolve um `Act` com id `gratuidade-<atribuição>`, e `getAct` passa a
reconhecer esse prefixo como já reconhece `outros-`. Alternativa descartada: escrever o ato à mão
em `ACTS` — seria uma linha por atribuição que um dia tenha isentável, e o gerador já existe ao
lado. A entrada só é acrescentada por `actsOfAttribution` quando `exemptableActs(attribution)` não
é vazio, o que hoje dá RCPN e só ele, sem nenhuma lista paralela para manter.

**O ato-alvo é um campo do formulário, não uma segunda tela.** `exemptionActId` entra em
`publicServiceRequestSchema`, obrigatório quando o ato é o da gratuidade e recusado fora dele, na
mesma `actRules` que hoje amarra declaração e anexo. Alternativa descartada: um passo 2.5 no
wizard — a URL já carrega `atribuicao` e `ato`, e um terceiro parâmetro para escolher entre duas
opções é navegação para um radio de dois itens.

**A gratuidade deixa de ser um sinalizador do pedido e passa a ser o ato escolhido.**
`exemptionRequested` sai do schema: quem pediu gratuidade é quem escolheu o ato da gratuidade.
`details.exemption` continua existindo, agora com `{ declaredAt, actId? }` — `actId` opcional
exatamente para que o pedido antigo continue válido sem migração.

**O prazo vem do ato-alvo, não do ato sintético.** A certidão tem prazo legal de 5 dias úteis
(Lei 6.015 art. 19); se o pedido de gratuidade nascesse com o `legalDeadlineDays` do ato
sintético, que não tem nenhum, cairia no prazo padrão da serventia e a certidão isenta ganharia
prazo diferente da certidão paga pelo mesmo pedido. Onde se lê `act.legalDeadlineDays` para
protocolar, o pedido de gratuidade lê o do ato que ele pede.

**O selo de tramitação é `online`**, como os dois atos que ele pode pedir: o requerimento é
assinado pelo Gov.br e a documentação vai anexada, sem balcão.

## Risks / Trade-offs

- **Dois caminhos vivos no intervalo entre o merge e o deploy** → nenhum: a remoção do checkbox e a
  entrada nova vão no mesmo change. O que sobrevive é o dado antigo, e ele é lido, não reescrito.
- **A serventia pode achar que "gratuidade" na lista se lê como um ato jurídico próprio, que não é**
  → o rótulo diz "Solicitar gratuidade (isento)", verbo antes do substantivo, e o formulário
  pergunta o ato logo na primeira pergunta. Confirmar o rótulo com o cartório antes de fechar.
- **Pedido antigo sem `actId`** → o painel e o requerimento mostram a solicitação sem o ato, sem
  placeholder inventado; a ausência é o que os dados dizem.
- **Um ato isentável novo no catálogo entra na lista sozinho** → é o efeito desejado, mas significa
  que marcar `feeExemption` num ato passa a mudar duas telas. O comentário do campo passa a dizer
  isso.

## Migration Plan

Nenhuma migração de dados. `details.exemption.actId` nasce opcional e só os pedidos novos o
trazem. Rollback é reverter o commit: os pedidos criados pelo caminho novo continuam legíveis
pelo código antigo, que ignora o campo que não conhece.

## Open Questions

- O rótulo da entrada ("Solicitar gratuidade (isento)") e o texto de apoio na lista são da
  serventia, como a declaração e a lista de documentos já são.
- Se a habilitação de casamento isenta deve continuar pedindo os documentos dos nubentes que o ato
  pede hoje, além da comprovação do benefício: a resposta muda o que o formulário da gratuidade
  mostra depois que o cidadão escolhe o ato.
