## Why

O cartório não consegue explicar uma exigência: o campo corta em 500 caracteres arbitrários e achata as quebras de linha antes mesmo de validar, então uma explicação estruturada ("1. isso, 2. aquilo") vira um parágrafo corrido — quando passa. O reporte veio do próprio balcão (Joelison, 29/08/2026): "não tem condições de colocar limite em texto; às vezes as coisas precisam ser explicadas". A contradição é interna: dentro do mesmo cartão, a conversa da exigência aceita 4000 caracteres com quebras preservadas, mas o enunciado — que deveria explicar tudo de primeira — aceita 500 sem quebras.

## What Changes

- O texto da exigência passa a ter a mesma forma de uma mensagem escrita por gente: apenas `trim`, quebras de linha preservadas, teto em `MAX_MESSAGE_LENGTH` (4000) — um teto de acidente (paste gigante), não um orçamento de escrita.
- Os dois pontos que exibem o texto da exigência (detalhe do pedido no painel e cartão na consulta de protocolo do cidadão) passam a renderizar as quebras de linha (`whitespace-pre-line`), como a conversa já faz.
- O textarea de registrar/editar exigência cresce de 2 para 4 linhas, condizente com o que aceita.
- A mensagem de erro de estouro passa a dizer o número ("O texto pode ter até 4.000 caracteres."), em vez de "Texto longo demais." seco.
- Mesma correção para os dois irmãos com a mesma causa na correção de dados protocolados: `purpose` (500) e `description` (1000) hoje estouram com erro cru do Zod, sem mensagem nenhuma. Ganham o mesmo teto de 4000 com mensagem em português.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-service-requests`: registrar/editar exigência aceita texto longo com quebras de linha e as exibe; corrigir dados protocolados aceita finalidade e descrição longas com erro legível.
- `service-request`: o cartão da exigência na consulta de protocolo exibe o texto como o cartório o escreveu, com as quebras de linha.

## Impact

- `src/core/request/requirement.ts` — `requirementTextSchema`: remove o achatamento de whitespace, teto 500 → 4000 reutilizando `MAX_MESSAGE_LENGTH` de `src/core/chat/message.ts`, mensagem com o número.
- `src/core/request/edit.ts` — `purpose` e `description`: teto 4000 com mensagem.
- `src/app/admin/(dashboard)/pedidos/[protocolo]/_components/requirements-section.tsx` — `whitespace-pre-line` no parágrafo do enunciado, `rows={4}` nos textareas de registrar e editar.
- `src/app/(public)/protocolo/protocol-lookup.tsx` — `whitespace-pre-line` nos dois parágrafos do cartão da exigência (pendente e cumprida).
- Testes de `requirementTextSchema` atualizados (quebras preservadas, teto novo).
- Sem migração de banco: a coluna já é `text` sem limite. Sem mudança de e-mail: o e-mail da exigência nunca carrega o texto, só avisa.

## Não-objetivos

- Contador de caracteres ou `maxLength` no textarea: o teto de 4000 ninguém alcança escrevendo à mão, e `maxLength` truncaria paste em silêncio — pior que o erro que estamos corrigindo.
- Markdown ou texto rico: o pedido é poder explicar, não formatar. Quebra de linha cobre listas e passos.
- Limite configurável por serventia: uma tela de config para um número que ninguém vai mudar.
- Mexer nos limites dos campos preenchidos pelo cidadão anônimo (`form.ts`, `channels.ts`): lá o limite guarda uma porta aberta na internet e fica como está.
- `line-clamp`/"ver mais" no cartão público: esconderia exatamente o que o cidadão precisa ler para resolver o pedido. Se exigências longas incomodarem no layout, é uma decisão futura de layout.
