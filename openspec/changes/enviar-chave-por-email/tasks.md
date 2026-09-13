## 1. Núcleo e e-mail

- [x] 1.1 `emailsMatch(a, b)` em `src/core/email/match.ts` (`trim` + minúsculas nos dois lados,
  sem normalizar pontos ou `+`), com testes em `match.test.ts`.
- [x] 1.2 `renderAccessKeyEmailHtml` e `renderAccessKeyEmailText` em `src/lib/email/render.ts`:
  mesmo cabeçalho e botão "Consultar o protocolo" do aviso, bloco de credenciais (protocolo e
  chave em linhas separadas, monoespaçado, espaçamento largo), rodapé "Guarde este e-mail… Não
  compartilhe a chave." e, com `reason: "recovered"`, "A chave anterior deixou de valer." e o
  aviso para quem não pediu. Chave nunca no link.
- [x] 1.3 `sendAccessKey({ tenant, contact, protocolNumber, accessKey, reason })` em
  `src/lib/email/service-request.ts`: extrair de `notifyCitizen` a checagem de devolução e o
  `after` + `sendEmail` + `console.error` para uma função interna compartilhada; assunto
  "Pedido recebido · <protocolo>" ou "Nova chave de acesso · <protocolo>", sem a chave;
  devolve o mesmo aviso `string | null`. Atualizar o comentário de contrato do arquivo: os
  avisos nunca levam conteúdo; a credencial só sai por `sendAccessKey`.
- [x] 1.4 `reissueAccessKey` (`src/lib/service-request.ts`) aceita `actorId: string | null`;
  comentário explica o ator nulo (cidadão, pelo site).
- [x] 1.5 ~~Testes de unidade para 1.2 e 1.3~~ Não viável como planejado: `render.ts` importa
  `@/core/tenant/palette.ts` e `@/core/tenant/brand-image.ts` por alias, que `node --test`
  não resolve sem o bundler (por isso nenhum arquivo de `src/lib/email/` tinha teste antes
  desta change; os poucos testes existentes em `src/lib/` e `src/app/` só alcançam módulos
  cujas dependências de tempo de execução são só relativas ou `import type`). `sendAccessKey`
  soma a isso o `import "server-only"`. Cobertura real fica com o e2e (3.3, 6.1) e a conferência
  manual do e-mail de desenvolvimento (6.3); `emailsMatch` (1.1) já tem seus próprios testes.
- [x] 1.6 Comentário em `sendEmail` (`src/lib/email/send.ts`) registrando que o log de
  desenvolvimento (sem `POSTMARK_SERVER_TOKEN`) imprime o corpo, chave incluída, e por que isso
  é aceitável fora de produção.

## 2. Site: a chave no e-mail de recebimento

- [x] 2.1 `createServiceRequestAction` (`src/app/(public)/solicitar/actions.ts`): trocar o
  `notifyCitizen` do "Pedido recebido" por `sendAccessKey({ reason: "received" })`, ainda
  `await`ed e sem expor o aviso; refazer o comentário ("a chave nunca vai no e-mail" deixa de
  ser verdade); o estado `success` passa a carregar `email`.
- [x] 2.2 `request-form.tsx` (tela de sucesso): substituir "O site não guarda nem reenvia…" por
  "Enviamos o protocolo e a chave também para <e-mail>. Se não chegar em alguns minutos, veja o
  spam ou baixe o comprovante abaixo." `ProtocolReveal` e o comprovante continuam.

## 3. Site: recuperação da chave pelo cidadão

- [x] 3.1 `recoverAccessKeyAction` em `src/app/(public)/protocolo/actions.ts`: rate limit por IP
  (`isRateLimited`, chave própria) e por protocolo (3/h, no mesmo mecanismo); normalizar
  protocolo (só `REQ.`) e e-mail; `findByProtocol`; `emailsMatch` com `contact`;
  `findPermanentBounce`; `reissueAccessKey(tenant.slug, id, null)`; `sendAccessKey({ reason:
  "recovered" })`. Resposta constante `{ status: "sent" }` em todos os ramos que não são erro de
  formato ou limite; nenhum ramo revela existência do pedido ou e-mail.
- [x] 3.2 `protocol-lookup.tsx`: `LostKeyNotice` vira `LostKeyForm`: link "Perdi a chave de
  acesso" que abre, na mesma tela, os campos protocolo (pré-preenchido com o digitado na
  consulta) e e-mail e o botão "Enviar nova chave"; mensagem de resultado genérica; erros de
  formato e de limite junto ao campo. WhatsApp e telefone saem desse aviso.
- [x] 3.2.1 Descoberto durante a implementação: `/acompanhar` (`protocol-trilho.tsx`,
  experiência nova de trilho/chat/Pix atrás da flag `citizen-tracking-v2`, ver
  `openspec/changes/feature-flag-acompanhar`) tem o seu próprio gate de protocolo + chave
  (`Gate`), independente do de `/protocolo`, e não foi coberto pela proposta original.
  `LostKeyForm` passa a ser exportado de `protocol-lookup.tsx` e importado por
  `protocol-trilho.tsx`, para o `Gate` oferecer "Perdi a chave de acesso" também: os dois gates
  usam o mesmo componente, para "perdi a chave" não virar duas implementações a manter
  sincronizadas. Nenhuma outra rota do site pede protocolo + chave fora dessas duas.
- [x] 3.3 E2e `service-request.spec.ts`: a tela de sucesso nomeia o e-mail do pedido;
  recuperação com e-mail certo mostra a mensagem genérica e a chave antiga deixa de abrir o
  pedido; com e-mail errado, a mesma mensagem e a chave antiga continua abrindo; quarta
  tentativa no mesmo protocolo em uma hora é recusada.

## 4. Painel: sem emissão de chave

- [x] 4.1 Remover `reissueKeyAction` e `ReissueKeyState` de `pedidos/[protocolo]/actions.ts`.
- [x] 4.2 `key-section.tsx` vira componente de servidor sem action: data de emissão, orientação
  de que o cidadão recupera pelo site com o e-mail do pedido e, quando `!isEmailContact(contact)`,
  a instrução de atualizar o contato. Sem "••••  ••••  ••••", sem chave em claro, sem o
  formulário `POST …/imprimir`. `page.tsx` passa `contact`.
- [x] 4.3 Rótulo de `service-request.key-reissue` para "recuperou a chave de acesso pelo site"
  em `pedidos/[protocolo]/page.tsx` e `src/lib/admin-overview.ts`; conferir que o autor sai
  como "Cidadão" com `actorId` nulo e revisar o comentário de `admin-overview.ts` sobre
  `key-reissue`.
- [x] 4.4 `pedidos/[protocolo]/imprimir/route.ts`: ajustar o comentário do POST do comprovante
  (o único chamador passa a ser o balcão); comportamento inalterado.

## 5. Balcão: só o recibo muda

- [x] 5.1 `createManualRequestAction` (`pedidos/novo/actions.ts`): trocar o `notifyCitizen` do
  recibo por `sendAccessKey({ reason: "received" })` (telefone devolve `null` sem tentativa);
  refazer o comentário. Tela, "copiar" e comprovante do `manual-entry-form.tsx` inalterados.

## 6. Fechamento

- [x] 6.1 E2e `admin-service-requests.spec.ts`: o teste do comprovante passa a semear o pedido
  com chave conhecida (`hashAccessKey`, como `admin-lgpd.spec.ts` faz) em vez de clicar "Emitir
  nova chave". Novos casos: detalhe sem "Emitir nova chave" e sem texto no padrão
  `[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}`; pedido de balcão com telefone mostra a instrução de
  atualizar o contato; após recuperação pelo site, o histórico mostra "Cidadão recuperou a chave
  de acesso pelo site".
- [x] 6.2 `pnpm typecheck`, `pnpm lint`, `check:dashes`, `pnpm test`: todos limpos (587/587). E2e
  das telas tocadas rodado localmente contra build de produção: achou um bug real (o `LostKeyForm`
  do mobile ficava dentro do `<form>` de "Destrave o detalhe", HTML não aceita form aninhado, e o
  navegador descartava a tag aninhada — a recuperação nunca disparava); corrigido movendo o
  `LostKeyForm` para fora do `<form>`, como irmão dentro do mesmo cartão. Depois da correção, os
  dois testes de recuperação e os três de gratuidade passam isolados. Restam duas falhas
  observadas e diagnosticadas como alheias a esta change, não perseguidas mais a pedido (rodar
  e2e repetidamente por sessão de diagnóstico é lento demais para o ganho): dados de sobra de
  execuções locais anteriores (e-mail e CPF fixos de teste colidindo com o próprio detector de
  duplicidade — limpos uma vez, os testes voltam a passar) e uma falha de login no primeiro teste
  do arquivo logo após o servidor subir (some ao repetir, e a tela de login não foi tocada por
  esta change). E2e completo fica para o CI.
- [x] 6.3 Conferido por leitura do código (`renderAccessKeyEmailHtml`/`Text`, `sendAccessKey`):
  assunto é `"<motivo> · <protocolo>"`, sem a chave; corpo traz protocolo e chave. Reforçado
  indiretamente pelos e2e acima, que dependem do fluxo real de `sendAccessKey` completar sem
  lançar (a recuperação chega ao estado "sent", o pedido com gratuidade chega a "Pedido
  registrado"). Não repetido como subida de servidor isolada, a pedido, para não alongar mais a
  tarefa com outro ciclo de build.
