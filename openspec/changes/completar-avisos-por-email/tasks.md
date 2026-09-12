## 1. Cidadão — "Disponível para retirada" e comprovante recusado

- [x] 1.1 Em `changeRequestStatusAction` (`src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`),
      capturar o andamento **anterior** do pedido (antes de `updateRequestStatus`) para poder
      distinguir "veio de payment-reported" de "gravação inicial em awaiting-payment". (`request`
      já é lido antes do `updateRequestStatus` e não é refetchado, então `request.status` já é o
      andamento anterior no bloco de e-mail.)
- [x] 1.2 Estender a condição que hoje só cobre `done`/`cancelled`/`rejected` para também disparar
      `notifyCitizen` quando `status === "ready-for-pickup"` (assunto/corpo: "Pedido disponível
      para retirada" / "O seu pedido está disponível para retirada.") e quando
      `status === "awaiting-payment"` com andamento anterior `"payment-reported"` (assunto/corpo:
      "Comprovante não aceito" / "O comprovante que você enviou não foi aceito. Consulte o
      protocolo com a sua chave de acesso e envie um novo comprovante.").
- [x] 1.3 Confirmar que a gravação inicial em `awaiting-payment` (primeira vez que o valor é
      informado, andamento anterior diferente de `payment-reported`) continua dependendo só do
      aviso já existente ("valor informado pela primeira vez") e não duplica com o novo. (A nova
      condição `comprovanteRecusado` exige `request.status === "payment-reported"`; a gravação
      inicial parte de outro andamento e não entra nela.)
- [x] 1.4 Nenhuma mudança em `src/core/request/kinds.ts`: os dois andamentos e a transição já
      existem: só o gatilho de e-mail é novo.

## 2. Serventia — resposta do cidadão na conversa da exigência

- [x] 2.1 Em `src/lib/email/service-request.ts`, adicionar `notifyOfficeRequirementReply`,
      moldada em `notifyOfficePaymentReported` (mesmo arquivo): cartão via `renderEmailCardHtml`/
      `renderEmailCardText`, destino `tenant.contacts.email`, assunto com o protocolo, corpo
      citando o requerente quando houver, botão "Ver o pedido" para
      `https://${tenant.hosts[0]}/admin/pedidos/${protocolNumber}`, disparo via `after()`,
      captura de erro com `console.error` sob tag própria (ex.: `email.requirement-reply`).
- [x] 2.2 Em `writeRequirementMessageAction` (`src/app/(public)/protocolo/actions.ts`), chamar
      `notifyOfficeRequirementReply` depois que `writeCitizenMessage` grava a mensagem com
      sucesso, passando `tenant`, `request.protocolNumber` e `request.applicantName`.
- [x] 2.3 Confirmar que o honeypot e o retorno cedo de exigência não encontrada/já cumprida não
      chegam a chamar a nova função (só dispara depois do `if (!written)`).

## 3. Serventia — requerimento LGPD novo

- [x] 3.1 Em `src/lib/email/service-request.ts`, adicionar `notifyOfficeDataRightsSubmitted`,
      mesmo padrão do item 2.1: destino `tenant.contacts.email`, corpo com protocolo e o direito
      escolhido (rótulo em português, via `DATA_RIGHT_OPTIONS.legalName` de
      `@/core/request/channels.ts`, sem a descrição do pedido), botão para
      `https://${tenant.hosts[0]}/admin/lgpd/${protocolNumber}`. Comentário na função deixando
      claro que o arquivo hospeda avisos de mais de um domínio por conveniência (decisão em
      design.md).
- [x] 3.2 Em `submitDataRights` (`src/app/(public)/lgpd/actions.ts`), chamar
      `notifyOfficeDataRightsSubmitted` depois que `createRecord` retorna o protocolo, ao lado da
      chamada já existente a `notifyCitizen`.

## 4. Serventia — manifestação de ouvidoria nova

- [x] 4.1 Em `src/lib/email/service-request.ts`, adicionar
      `notifyOfficeManifestationSubmitted`, mesmo padrão: destino `tenant.contacts.email`, corpo
      com registro e tipo da manifestação (rótulo em português, via `manifestationLabel` de
      `@/core/request/channels.ts`), **nunca** nome nem contato do manifestante mesmo quando
      identificado, botão para `https://${tenant.hosts[0]}/admin/ouvidoria/${protocolNumber}`.
- [x] 4.2 Em `submitManifestation` (`src/app/(public)/ouvidoria/actions.ts`), chamar
      `notifyOfficeManifestationSubmitted` depois que `createRecord` retorna o protocolo,
      incondicional a `anonymous`/`confidential` (ao contrário da chamada a `notifyCitizen`, que
      já lida com a ausência de contato sozinha).

## 5. Verificação

- [ ] 5.1 Sem `POSTMARK_SERVER_TOKEN` (fallback de log), rodar localmente: troca de andamento
      para "Disponível para retirada", recusa de comprovante (payment-reported → awaiting-payment),
      resposta do cidadão numa exigência, envio de requerimento LGPD e de manifestação de
      ouvidoria (identificada e anônima) — conferir no console destinatário, assunto e corpo de
      cada um dos cinco avisos novos. **Não verificado nesta sessão**: o worktree não tem um
      Postgres acessível (`DATABASE_URL` ausente, sem Docker/OrbStack rodando), então os fluxos
      completos (que gravam no banco) não rodam aqui. Pendente de rodar num ambiente com banco
      (local com Postgres de pé, ou preview) antes de mesclar.
- [x] 5.2 Rodar `node --test src/core/email/*.test.ts` e os testes de `src/core/request/kinds.ts`
      para garantir que nada nas dependências reaproveitadas quebrou. (PGlite embutido/sem banco
      externo: 13 + 43 testes, todos verdes.)
- [x] 5.3 Rodar `pnpm exec playwright test e2e/admin-service-requests.spec.ts
      e2e/admin-requirement-conversation.spec.ts e2e/admin-lgpd.spec.ts
      e2e/admin-ombudsman.spec.ts` localmente para confirmar que os fluxos afetados continuam
      passando (suíte e2e completa fica para o CI). Rodado: 24 passaram, 2 falharam, 10 não
      rodaram (a suíte para na primeira falha de cada arquivo). As 2 falhas ("the office raises a
      requirement and answers in its conversation" e "a registered requirement appears right
      away") são **pré-existentes**: reproduzem sozinhas mesmo com este change stashado (mesmo
      timeout esperando "Falta cópia legível do documento de identidade." em
      `e2e/admin-requirement-conversation.spec.ts:83` e `e2e/admin-service-requests.spec.ts:361`),
      então não têm relação com os cinco avisos novos — provavelmente uma regressão de outra
      frente de trabalho já em andamento no worktree (há várias mudanças não commitadas em
      `pedidos/_components/*` e `admin/_components/*` fora do escopo desta change). Fora do escopo
      corrigir aqui; sinalizar separadamente.

## 6. Qualidade

- [x] 6.1 `pnpm typecheck` (sem erros)
- [x] 6.2 `pnpm lint` (arquivos tocados verificados com `biome check`, sem erros; a suíte
      `pnpm lint` completa aponta erros pré-existentes só em `support.js`, arquivo gerado não
      rastreado que já estava no worktree antes deste change, sem relação com ele)
