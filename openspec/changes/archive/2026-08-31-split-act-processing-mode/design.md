## Context

`PROCESSING_MODES` tem três valores e um comentário que já revela a mistura:

```
"identification", // asked and answered on identification alone, no form
"online",         // form signed digitally, start to finish over the internet
"presential",     // started online, finished at the counter in person
```

`identification` fala de **que papéis a serventia pede**. `online` e `presential` falam de **onde
o pedido termina**. São eixos diferentes, e o enum obriga cada ato a declarar um só.

Sete atos declaram `identification`: as certidões de RCPN, notas, RI (duas) e RTD e RCPJ, mais a
busca por indicador. Todos eles também são resolvidos pela internet, mas não podem dizer isso.

A parte errada é a dica: `identification` promete "o mais rápido: sem requerimento". A tela de
sucesso, em `request-form.tsx`, mostra os passos "Baixe o requerimento e assine" e "Envie o
requerimento assinado" sem nenhuma condição de modo. O catálogo promete o que o fluxo não cumpre.

## Goals / Non-Goals

**Goals:**

- Um ato poder dizer as duas coisas quando as duas são verdade.
- Tirar do produto a afirmação de que existe ato sem requerimento.

**Non-Goals:**

- Mudar o fluxo do requerimento (ver `proposal.md`).
- Tornar o modo configurável por serventia.
- Reescrever o catálogo além dos campos deste change.

## Decisions

### 1. Dois campos, e não um enum de quatro valores

A alternativa óbvia seria acrescentar `identification-online` ao enum. Descartada: o enum
cresceria como produto cartesiano dos dois eixos, e a próxima distinção que aparecer dobra o
número de valores de novo. Dois campos independentes é o que os dois fatos são.

`identificationOnly` é opcional e ausente significa "não". A maioria dos atos pede documentos, e
um sinalizador que quase sempre estaria escrito como `false` é ruído em 22 declarações.

### 2. Os sete atos viram `online`

Certidão e busca são entregues pela internet nas seis atribuições, então `online` é a leitura
honesta. **É uma suposição desta proposta**, não um fato lido do sistema anterior: se a serventia
entrega alguma dessas certidões só no balcão, o ato certo é `presential`, e é uma linha por ato.
Vale confirmar com o cartório antes de fechar.

### 3. A dica de `identification` não é reescrita, é apagada

"o mais rápido: sem requerimento" não tem substituto honesto enquanto a tela de sucesso pedir o
requerimento em todo pedido. Trocar por "quase sem papelada" seria a mesma promessa em voz mais
baixa. O selo "Só identificação" já diz o que é verdade: o que a serventia pede do requerente é a
identificação dele.

### 4. O selo vira uma lista de selos

`ProcessingBadge` hoje recebe `mode` e desenha um. Passa a receber o ato e desenhar de um a dois.
Assim o cabeçalho do formulário, a etapa 2 e a tela de sucesso continuam com uma chamada só, e
nenhuma delas precisa saber a regra de quando o segundo selo aparece.

## Risks / Trade-offs

- **Suposição sobre os sete atos.** → Decisão 2; confirmar com a serventia. Errar aqui é uma linha
  por ato, sem migração.
- **`processingLabel` volta na resposta da action e é usado na tela de sucesso.** → Vira o rótulo
  do modo, que continua existindo. O segundo selo, se houver, sai do ato, que a tela já tem.
- **Dois selos ocupam mais espaço no card, no celular.** → São duas palavras curtas; o card já
  empilha selo e dica.

## Migration Plan

Nada a migrar: o catálogo é código, não dado. Nenhum pedido já gravado guarda o modo do ato, então
nenhum registro histórico muda de sentido. Rollback é reverter o commit.

## Open Questions

- Alguma dessas sete certidões é entregue só no balcão nesta serventia? Se sim, ela nasce
  `presential` em vez de `online` (decisão 2).
