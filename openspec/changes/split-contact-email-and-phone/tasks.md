## 1. Núcleo: schema do pedido

- [x] 1.1 Em `src/core/request/form.ts`, trocar `contact` por `email` (obrigatório, validado pelo regex `EMAIL` já existente) e `phone` (opcional, validado por `isValidPhone`) em `serviceRequestSchema`, com as mensagens em português.
- [x] 1.2 Deixar `isValidContact` e `isEmailContact` intactos: chat (`src/core/chat/conversation.ts`) e ouvidoria (`src/core/request/channels.ts`) continuam usando o campo misto.
- [x] 1.3 Em `src/core/request/kinds.ts`, acrescentar `phone` opcional a `serviceRequestDetailsSchema`, com comentário dizendo por que ele mora em `details` e não em coluna.
- [x] 1.4 Comentar na coluna `contact` (`src/db/schema.ts`) que, para `kind: "service-request"` gravado a partir deste change, o valor é sempre um e-mail, e que linhas anteriores podem trazer telefone.

## 2. Formulário público

- [x] 2.1 Em `src/app/(public)/solicitar/request-form.tsx`, substituir o campo "E-mail ou WhatsApp" por dois: e-mail (`type="email"`, `autoComplete="email"`) e telefone (`autoComplete="tel"`, máscara `formatPhone` via `withMask`), mantendo o par lado a lado no desktop e empilhado no celular.
- [x] 2.2 Marcar o telefone como opcional na própria etiqueta, no mesmo padrão do CPF (`· opcional`).
- [x] 2.3 Dizer, junto ao campo de e-mail, que quem não tem e-mail é atendido no balcão — a saída existe e a pessoa não deve descobri-la pelo erro (decisão de `design.md`, "Risks").
- [x] 2.4 Em `src/app/(public)/solicitar/actions.ts`, ler `email` e `phone` do `FormData` e gravar `email` na coluna `contact` e `phone` em `details`.

## 3. Painel e documentos

- [x] 3.1 Mostrar o telefone na tela do pedido (`pedidos/[protocolo]/_components/applicant-section.tsx`), ao lado do contato.
- [x] 3.2 Acrescentar `phone` opcional a `requestDataEditSchema` (`src/core/request/edit.ts`) e ao formulário de edição do solicitante, gravando de volta em `details`.
- [x] 3.3 Acrescentar a linha "Telefone" ao requerimento impresso (`src/core/request/requerimento.ts`, `RequerimentoData` + bloco `applicant`), omitida quando não houver telefone.
- [x] 3.4 Passar o telefone na rota de impressão (`pedidos/[protocolo]/imprimir/route.ts`) e na tela que monta o requerimento (`pedidos/[protocolo]/page.tsx`).
- [x] 3.5 Deixar a fila (`pedidos/page.tsx`) como está: uma linha de contato basta numa lista.

## 4. Avisos por e-mail

- [x] 4.1 Manter a guarda `isEmailContact` em `src/lib/email/service-request.ts`: ela é o que impede tentativa de envio para telefone gravado em pedido antigo.
- [x] 4.2 Conferir que os avisos de andamento (`pedidos/[protocolo]/actions.ts`) continuam passando `request.contact` sem mudança.

## 5. Testes

- [x] 5.1 Testes de núcleo em `src/core/request/`: pedido sem e-mail é recusado, e-mail malformado é recusado, telefone ausente é aceito, telefone com menos de 10 dígitos é recusado, telefone sem pontuação é aceito.
- [x] 5.2 Atualizar os testes existentes que preenchem `contact` no pedido de serviço (`src/db/service-request.test.ts` e o que mais o `pnpm test` apontar).
- [x] 5.3 Atualizar `e2e/service-request.spec.ts` para preencher os dois campos e afirmar que o telefone chega à tela do pedido no painel.
- [ ] 5.4 Rodar `pnpm typecheck`, `pnpm test` e `pnpm e2e` do fluxo de pedido antes de abrir o PR.

## 6. Fechamento

- [ ] 6.1 Abrir PR referenciando SCRUM-10 e registrando que telefone ficou opcional por decisão do cartório, e não obrigatório como o card dizia.
- [ ] 6.2 Rodar `openspec archive split-contact-email-and-phone` depois do merge.
