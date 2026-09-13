## Why

Hoje a chave de acesso `XXXX-XXXX-XXXX` existe em um só lugar: a tela de sucesso do
`/solicitar` (e o comprovante em PDF que ela oferece). O e-mail "Pedido recebido" chega sem a
chave, de propósito. Na prática, o cidadão fecha a aba, não baixa o comprovante, e semanas
depois recebe um aviso ("há uma exigência no seu pedido") que manda consultar com uma chave que
ele não tem mais. A consulta diz "Perdeu a chave? A serventia emite outra pelo WhatsApp ou
telefone": o cidadão liga, o operador aciona "Emitir nova chave", a chave aparece em claro no
painel, e ele a copia e manda por WhatsApp ou dita por telefone. A credencial do cidadão passa
pela área de transferência e pela conversa de um operador, e a serventia vira balcão de senha.

O e-mail é obrigatório no pedido pelo site desde `completar-avisos-por-email`, então todo pedido
público tem uma caixa postal do próprio cidadão. É o canal certo para a credencial chegar, ficar
guardada e ser recuperada: quem perdeu a chave pede outra no site, ela chega no e-mail do
pedido, e ninguém da serventia participa.

## What Changes

- **A chave vai no e-mail de recebimento.** Todo pedido protocolado pelo site rende um e-mail
  "Pedido recebido" que traz protocolo **e** chave de acesso, com a orientação de guardar a
  mensagem e o botão "Consultar o protocolo". A tela de sucesso continua mostrando protocolo e
  chave, com o comprovante em PDF: o e-mail é a segunda via, não a única. O texto da tela deixa
  de dizer "o site não reenvia" e passa a dizer que a chave também foi enviada ao e-mail.
- **"Esqueci a chave" no site, resolvido pelo próprio cidadão.** A consulta de protocolo ganha
  o caminho "Perdi a chave de acesso": o cidadão informa o protocolo e o e-mail do pedido; se
  os dois conferem, o sistema gera uma chave nova, invalida a anterior e envia a nova para esse
  e-mail. A resposta na tela é sempre a mesma, confiram ou não ("Se o protocolo e o e-mail
  conferem, enviamos uma nova chave para esse endereço"), para não confirmar a existência de
  um pedido nem o e-mail de ninguém. Com rate limit por IP e por protocolo. Fica registrado no
  histórico do pedido como ação do cidadão.
- **O painel sai da recuperação.** "Emitir nova chave" é removido do detalhe do pedido, junto
  com a chave em claro e o comprovante em PDF que só existia naquele momento. No lugar, a seção
  da chave informa desde quando ela vale e explica que o cidadão recupera pelo site com o
  e-mail do pedido. Para um pedido lançado no balcão com telefone, o operador atualiza o
  contato para um e-mail (ação que já existe) e o cidadão segue o mesmo caminho.
- **Os avisos continuam sem conteúdo.** Exigência, conclusão, valor, entrega: nada muda. A chave
  só viaja no e-mail de recebimento e no de recuperação, os dois e-mails cuja função é entregar a
  credencial.
- **Balcão continua igual.** `/admin/pedidos/novo` segue mostrando protocolo e chave na tela e
  oferecendo o comprovante impresso: o cidadão está na frente do operador, e pode não ter e-mail.
  Quando o contato lançado é um e-mail, o recibo "Pedido recebido" desse fluxo passa a levar a
  chave também, pela mesma regra do site.
- **BREAKING**: nenhuma no banco. A chave continua guardada só como hash; a rota
  `imprimir` (POST com `chave`) continua servindo o comprovante para o balcão, mas o detalhe do
  pedido deixa de ter caminho até ela.

## Capabilities

### New Capabilities
Nenhuma.

### Modified Capabilities
- `service-request`: "E-mail de confirmação do protocolo" passa a exigir a chave no e-mail
  (hoje proíbe); "Protocolo sequencial e chave de acesso exibida uma única vez" ganha o e-mail
  como segunda via e ajusta o aviso da tela de sucesso; novo requisito "Recuperação da chave
  pelo cidadão" na consulta de protocolo.
- `admin-service-requests`: "Emitir nova chave de acesso" é removido; "Imprimir o requerimento
  no balcão" perde a cláusula do comprovante "enquanto a chave está na tela" no detalhe;
  "Recibo por e-mail do pedido lançado no balcão" passa a levar a chave; "Avisos por e-mail"
  mantém a regra de não carregar conteúdo, agora explicitando que a credencial só vai nos
  e-mails de entrega da chave; "Detalhe do pedido" passa a listar a recuperação de chave pelo
  cidadão no histórico.

## Impact

- `src/lib/email/service-request.ts`: novo `sendAccessKey({ tenant, contact, protocolNumber,
  accessKey, reason: "received" | "recovered" })`, com a mesma checagem de devolução e o mesmo
  `after` de `notifyCitizen`; `notifyCitizen` segue intocado para os avisos.
- `src/lib/email/render.ts`: template da credencial (`renderAccessKeyEmailHtml` / `Text`), com
  a orientação de guardar a mensagem.
- `src/app/(public)/solicitar/actions.ts`: `createServiceRequestAction` chama `sendAccessKey`
  em vez de `notifyCitizen` para o "Pedido recebido"; `request-form.tsx` troca o texto do aviso
  da tela de sucesso.
- `src/app/(public)/protocolo/actions.ts`: nova action `recoverAccessKeyAction(protocolNumber,
  email)`: rate limit, `findByProtocol`, comparação do e-mail com o contato, devolução
  permanente, `reissueAccessKey` com ator nulo, `sendAccessKey`; resposta constante.
  `protocol-lookup.tsx`: `LostKeyNotice` vira o formulário "Perdi a chave de acesso".
- `src/lib/service-request.ts`: `reissueAccessKey` aceita `actorId: string | null` (cidadão).
- `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`: `reissueKeyAction` removida;
  `key-section.tsx` vira bloco informativo sem action; rótulo de
  `service-request.key-reissue` no histórico passa a "recuperou a chave de acesso pelo site"
  (autor "Cidadão", como os demais eventos sem conta).
- `src/app/admin/(dashboard)/pedidos/novo/actions.ts`: "Pedido recebido" do balcão via
  `sendAccessKey` quando o contato é e-mail; tela e comprovante inalterados.
- E2e: `admin-service-requests.spec.ts` (o teste do comprovante hoje obtém a chave pela
  reemissão no detalhe; passa a semear a chave), `service-request.spec.ts` (texto da tela de
  sucesso; recuperação com e-mail certo invalida a chave antiga; e-mail errado devolve a mesma
  mensagem sem invalidar). Testes de unidade para o texto do e-mail com a chave e a comparação
  de e-mail.
- Sem migração de banco.

## Non-Goals

- Remover a chave da tela de sucesso ou do comprovante em PDF do site: o e-mail é a segunda via.
  Se um dia a tela deixar de mostrar a chave, é outra change, com o dado de quantos e-mails
  voltam.
- Mudar o balcão (`/admin/pedidos/novo`): chave na tela e comprovante impresso continuam, porque
  o contato pode ser um telefone e o cidadão está presente.
- Recuperação por telefone ou SMS: sem e-mail no pedido não há recuperação pelo site; a
  serventia atualiza o contato.
- Chave de acesso dos outros canais (LGPD, ouvidoria, agendamento): cada um tem a sua tela e o
  seu aviso; ficam como estão. O formulário de recuperação aceita só protocolo de pedido de
  serviço (`REQ.`).
- Login por link mágico ou substituição da chave por conta: fora de escopo.
- Levar o conteúdo dos avisos (texto da exigência, valor, arquivo) para o e-mail: continua
  proibido.
