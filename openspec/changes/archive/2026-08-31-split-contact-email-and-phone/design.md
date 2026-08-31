## Context

Hoje o pedido de serviço guarda a identificação do cidadão em uma coluna só,
`service_requests.contact`, alimentada por um campo misto ("E-mail ou WhatsApp") validado por
`isValidContact`. Quem preenche telefone fica sem nenhum aviso: `sendServiceRequestEmail` chama
`isEmailContact` e devolve `null` quando o contato não parece um endereço, então o "Pedido
recebido" e os avisos de andamento simplesmente não saem.

A mesma coluna é lida por muita coisa: fila e tela do pedido no painel, edição do solicitante
(`src/core/request/edit.ts`), requerimento impresso (`src/core/request/requerimento.ts`), rota de
impressão, canal LGPD e ouvidoria. E a coluna é compartilhada pelos quatro `kind`s da tabela
(pedido, agendamento, LGPD, ouvidoria), o que restringe o que se pode fazer com ela: na ouvidoria
o contato é opcional de propósito, porque a manifestação pode ser anônima.

Restrição do projeto: migração destrutiva de banco exige dois deploys (expand, depois contract).

## Goals / Non-Goals

**Goals:**

- E-mail obrigatório e validado no pedido feito pelo site, para que todo pedido online tenha um
  canal de retorno que o sistema saiba usar sozinho.
- Telefone em campo próprio, opcional, gravado e visível ao operador.
- Nenhuma migração destrutiva e nenhum backfill: os pedidos já gravados continuam sendo lidos
  exatamente como estão.

**Non-Goals:**

- Mudar ouvidoria, agenda, chat, canal LGPD ou o lançamento de balcão (ver `proposal.md`).
- Verificar o e-mail por link de confirmação ou o telefone por SMS.
- Renomear a coluna `contact` no banco.

## Decisions

### 1. O e-mail continua na coluna `contact`; o telefone vai para `details.phone`

O núcleo passa a falar `email` e `phone`; o adaptador de persistência escreve `email` na coluna
`contact` e `phone` dentro de `details`, que já é o lugar documentado do que não é comum aos
quatro kinds e já é parseado por `serviceRequestDetailsSchema` na entrada e na saída.

Alternativas descartadas:

- **Coluna nova `phone`.** Coluna nullable é aditiva e não exigiria os dois deploys, mas é uma
  migração e um campo a mais na tabela compartilhada para servir a um kind só. `details` resolve
  sem tocar no schema do banco.
- **Renomear `contact` para `email`.** É o nome honesto, mas é expand/contract em dois deploys
  numa coluna lida por quatro canais, sendo que em três deles o valor continua sendo "contato" e
  não "e-mail". O ganho é de nomenclatura, o custo é real.

Consequência assumida: `contact` passa a significar "e-mail" para pedidos novos e continua
significando "e-mail ou telefone" para os antigos. Isso fica registrado em comentário na coluna e
é o motivo de a decisão 3 existir.

### 2. O formulário passa a ter dois campos, e o campo misto some do pedido

`serviceRequestSchema` troca `contact: requiredText(160).refine(isValidContact)` por
`email` (obrigatório, validado pelo mesmo regex `EMAIL` que já existe em `form.ts`) e `phone`
(opcional, validado por `isValidPhone`, que já existe e é o que a agenda usa). Nenhuma função de
validação nova: as duas já estão escritas e testadas em `src/core/request/form.ts`.

`isValidContact` e `isEmailContact` continuam existindo — chat e ouvidoria ainda os usam — mas
saem do caminho do pedido.

A máscara do telefone deixa de precisar do desvio condicional de `formatPhone` do ponto de vista
do campo, mas a função fica como está: ela já devolve o valor intacto para entrada não numérica, e
mudá-la quebraria o chat, que ainda tem campo misto.

### 3. O aviso por e-mail mantém a guarda `isEmailContact`

O destinatário passa a existir sempre nos pedidos novos, mas os antigos continuam com telefone em
`contact`. Remover a guarda faria o sistema tentar enviar e-mail para "(84) 99999-0000" em todo
andamento de pedido antigo. A guarda custa uma comparação de regex e é o que impede isso.

### 4. O telefone aparece onde o operador já procura o contato

Tela do pedido (`applicant-section.tsx`), requerimento impresso (`requerimento.ts`) e edição do
solicitante (`edit.ts`) ganham o telefone ao lado do contato. A fila (`pedidos/page.tsx`) continua
mostrando uma linha só: é lista, não ficha.

## Risks / Trade-offs

- **Cidadão sem e-mail deixa de conseguir protocolar pelo site.** → É a mudança pedida, e a saída
  existe e já é usada: o balcão lança o pedido pelo painel, onde o campo de contato continua misto.
  Vale dizer isso na tela, junto ao campo, em vez de deixar a pessoa descobrir no erro.
- **`contact` com dois significados conforme a idade da linha.** → Guarda `isEmailContact` na
  leitura (decisão 3) e comentário na coluna. A dívida fica registrada; renomear a coluna é um
  change próprio.
- **`details.phone` não é consultável por índice.** → Ninguém busca pedido por telefone hoje. Se
  a busca do painel passar a precisar, vira coluna com migração aditiva.
- **Testes e e2e preenchem `contact`.** → São vários pontos; a lista está em `tasks.md` e o e2e do
  pedido é o que prova o fluxo inteiro.

## Migration Plan

Deploy único. Não há migração de banco: a coluna não muda e `details` é jsonb sem checagem no
banco (o schema Zod é a porta). Nada é reescrito nas linhas existentes.

Rollback: reverter o commit. Pedidos gravados no intervalo continuam legíveis, porque o e-mail
está em `contact` — onde o código antigo já esperava o contato — e o `details.phone` extra é
ignorado por um `serviceRequestDetailsSchema` que não o conhece.

## Open Questions

- O aviso de andamento deve passar a citar o telefone para o operador ligar, ou basta a ficha?
  Fora do escopo deste change; anotado se a serventia pedir.
