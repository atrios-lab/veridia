## Why

O pedido de serviço identifica o cidadão por um campo único de contato, que aceita e-mail **ou**
telefone. Quem preenche só o telefone nunca recebe o e-mail de "Pedido recebido" nem os avisos de
andamento: o envio é silenciosamente pulado (`isEmailContact`), e a serventia fica com um pedido
que só pode ser respondido por ligação. A serventia pediu que a identificação passasse a exigir
e-mail e que o telefone tivesse campo próprio, porque é por telefone que ela resolve pendência de
documento no mesmo dia.

## What Changes

- O formulário público de pedido passa a ter **dois** campos de identificação no lugar do campo
  misto "E-mail ou WhatsApp": **e-mail (obrigatório)** e **telefone (opcional)**.
- **BREAKING** (para quem só tem telefone): um pedido online não pode mais ser protocolado sem
  e-mail. Quem não tem e-mail é atendido pelo balcão, que segue lançando o pedido pelo painel.
- O e-mail passa a ser sempre um endereço válido, então o aviso de protocolo e os avisos de
  andamento passam a sair para **todo** pedido feito pelo site, não só para os que por acaso
  informaram e-mail.
- O telefone informado é gravado no pedido e aparece para o operador na fila, na tela do pedido e
  no requerimento impresso, com máscara `(00) 00000-0000`.
- Pedidos já protocolados continuam válidos como estão: os que têm telefone no campo de contato
  seguem sendo exibidos e continuam sem e-mail automático, como sempre foram.

## Capabilities

### New Capabilities

Nenhuma. A mudança altera requisitos de uma capacidade que já existe.

### Modified Capabilities

- `service-request`: a identificação do solicitante deixa de ser um campo misto e passa a ser
  e-mail obrigatório mais telefone opcional; a máscara de telefone deixa de ser condicional; o
  aviso por e-mail deixa de depender de o contato "parecer" um e-mail.

## Impact

- `src/core/request/form.ts`: `serviceRequestSchema` ganha `email` e `phone` no lugar de
  `contact`; `isValidContact`/`isEmailContact` deixam de ser usados por este canal.
- `src/core/request/kinds.ts`: `serviceRequestDetailsSchema` ganha `phone` opcional. Sem migração
  de banco: a coluna `contact` continua guardando o e-mail e `details` é jsonb.
- `src/app/(public)/solicitar/`: formulário e server action.
- `src/lib/email/service-request.ts`: o destinatário deixa de ser condicional.
- `src/app/admin/(dashboard)/pedidos/`: fila, tela do pedido e edição passam a mostrar o telefone.
- `src/core/request/requerimento.ts`: o requerimento impresso ganha a linha do telefone.
- `e2e/service-request.spec.ts` e os testes de núcleo que preenchem `contact`.

## Non-Goals

- **Ouvidoria** não muda. Contato lá é opcional de propósito: a manifestação pode ser anônima
  (`src/core/request/channels.ts`), e exigir e-mail fecharia esse canal.
- **Agendamento** não muda: já pede e-mail obrigatório e telefone em campo próprio.
- **Chat** e **canal LGPD** não mudam neste change.
- **Lançamento de balcão** (`pedidos/novo`) mantém o campo de contato como está: é o operador que
  digita, com o cidadão na frente, e é justamente a saída de quem não tem e-mail.
- Não há verificação de e-mail (link de confirmação) nem validação de telefone por SMS.
- Não há backfill dos pedidos antigos: nada é reescrito no banco.
