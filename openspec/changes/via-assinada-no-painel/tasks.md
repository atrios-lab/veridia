## 1. Core

- [ ] 1.1 Em `src/core/request/attachment.ts`, `SIGNED_FORM_NAMES = { requerimento:
  "requerimento-assinado", declaracao: "declaracao-assinada" }` e `signedFormFor(attachments,
  documento)`: o anexo `signed-form` mais recente com aquele `displayName` (anexo `signed-form`
  com nome fora da lista conta como requerimento, para os antigos). Testes em
  `request.test.ts`.
- [ ] 1.2 `attachmentLabel` (`src/app/admin/_components/attachment-link.ts`) ganha
  "Declaração assinada".

## 2. Site: envio por documento

- [ ] 2.1 `attachSignedForm` (`solicitar/actions.ts`) lê `documento` (`requerimento` |
  `declaracao`, default `requerimento`), recusa `declaracao` em pedido sem gratuidade (lê
  `readExemption`), grava o `displayName` de `SIGNED_FORM_NAMES`. Mensagem de sucesso nomeia o
  documento.
- [ ] 2.2 `request-form.tsx` (tela de sucesso): com `hasExemption`, dois formulários de envio,
  "Requerimento assinado" e "Declaração assinada", cada um com o seu estado; sem gratuidade,
  como hoje.
- [ ] 2.3 `protocolo/actions.ts`: `signedRequerimento` e `signedDeclaracao` via
  `signedFormFor`, com `receivedAt` e `attachmentId` de cada; `hasExemption` já vem.
- [ ] 2.4 `protocol-lookup.tsx`: dois campos de envio com gratuidade; timeline com uma linha
  por documento; rebaixar de cada um.

## 3. Painel

- [ ] 3.1 `pedidos/[protocolo]/page.tsx`: ler `signedFormFor` para os dois documentos e trocar
  as ações do cabeçalho: principal abre `/admin/documento` do anexo ("Requerimento assinado" /
  "Declaração assinada"), secundária "Gerar sem assinatura" na rota `imprimir`. Sem via
  assinada, como hoje.
- [ ] 3.2 `/admin/documento` (`documento/route.ts`): quando o anexo é `signed-form`, registrar
  `service-request.print.requerimento-assinado` ou `.declaracao-assinada`, com o id do anexo.
  Rótulos no histórico do detalhe (`page.tsx`, mapa de ações).
- [ ] 3.3 Seção de anexos do detalhe (`attachments-section.tsx` e
  `attachCitizenDocumentAction`): seletor "Este arquivo é" (documento comum, requerimento
  assinado, declaração assinada); os dois últimos entram como `signed-form` com o
  `displayName` certo, declaração só com gratuidade.

## 4. Fechamento

- [ ] 4.1 E2e `service-request.spec.ts`: pedido com gratuidade envia os dois arquivos na tela
  de sucesso e a consulta mostra as duas linhas recebidas. `admin-service-requests.spec.ts`:
  depois do envio, o detalhe mostra "Requerimento assinado" abrindo o anexo, "Gerar sem
  assinatura" ainda gera, e a auditoria registra a abertura.
- [ ] 4.2 Conferir no Homolog que todo `signed-form` existente tem `displayName`
  `requerimento-assinado` (consulta SQL), antes de mergear.
- [ ] 4.3 `pnpm typecheck`, `pnpm lint`, `pnpm test`; conferir no navegador a tela de sucesso
  e o detalhe do pedido com e sem via assinada.
