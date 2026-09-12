## 1. Core

- [x] 1.1 Em `src/core/request/attachment.ts`, `SIGNED_FORM_NAMES = { requerimento:
  "requerimento-assinado", declaracao: "declaracao-assinada" }` e `signedFormFor(attachments,
  documento)`: o anexo `signed-form` mais recente com aquele `displayName` (anexo `signed-form`
  com nome fora da lista conta como requerimento, para os antigos). Testes em
  `request.test.ts`.
- [x] 1.2 `attachmentLabel` (`src/app/admin/_components/attachment-link.ts`) ganha
  "Declaração assinada".

## 2. Site: envio por documento

- [x] 2.1 `attachSignedForm` (`solicitar/actions.ts`) lê `documento` (`requerimento` |
  `declaracao`, default `requerimento`), recusa `declaracao` em pedido sem gratuidade (lê
  `readExemption`), grava o `displayName` de `SIGNED_FORM_NAMES`. Mensagem de sucesso nomeia o
  documento.
- [x] 2.2 `request-form.tsx` (tela de sucesso): com `hasExemption`, dois formulários de envio,
  "Requerimento assinado" e "Declaração assinada", cada um com o seu estado; sem gratuidade,
  como hoje.
- [x] 2.3 `protocolo/actions.ts`: `signedRequerimento` e `signedDeclaracao` via
  `signedFormFor`, com `receivedAt` e `attachmentId` de cada; `hasExemption` já vem.
- [x] 2.4 `protocol-lookup.tsx`: dois campos de envio com gratuidade; timeline com uma linha
  por documento; rebaixar de cada um.

## 3. Painel

- [x] 3.1 `pedidos/[protocolo]/page.tsx`: ler `signedFormFor` para os dois documentos e trocar
  as ações do cabeçalho: principal abre `/admin/documento` do anexo ("Requerimento assinado" /
  "Declaração assinada"), secundária "Gerar sem assinatura" na rota `imprimir`. Sem via
  assinada, como hoje.
- [x] 3.2 `/admin/documento` (`documento/route.ts`): quando o anexo é `signed-form`, registrar
  `service-request.print.requerimento-assinado` ou `.declaracao-assinada`, com `targetId` do
  pedido. `audit_log` não tem coluna de detalhes, então o id do anexo não é gravado: a ação
  nomeia o documento e o histórico do pedido mostra a abertura (spec ajustada). Rótulos no
  histórico do detalhe (`page.tsx`, mapa de ações).
- [x] 3.3 Seção de anexos do detalhe (`attachments-section.tsx` e
  `attachCitizenDocumentAction`): seletor "Este arquivo é" (documento comum, requerimento
  assinado, declaração assinada); os dois últimos entram como `signed-form` com o
  `displayName` certo, declaração só com gratuidade.

## 4. Fechamento

- [x] 4.1 E2e `service-request.spec.ts`: pedido com gratuidade envia os dois arquivos na tela
  de sucesso e a consulta mostra as duas linhas recebidas. `admin-service-requests.spec.ts`:
  depois do envio, o detalhe mostra "Requerimento assinado" abrindo o anexo, "Gerar sem
  assinatura" ainda gera, e a auditoria registra a abertura.
- [x] 4.2 Conferido no Homolog (consulta SQL): `requerimento.pdf` (55, semeados pelo e2e),
  `requerimento-assinado` (33) e `declaracao-assinada` (1, do e2e desta change). Os dois
  primeiros caem na regra do requerimento; nada fora do padrão. Produção não foi consultada:
  só `attachSignedForm` grava `signed-form`, sempre com `requerimento-assinado`.
- [x] 4.3 `pnpm typecheck`, `pnpm lint`, `check:dashes`, `pnpm test`; e2e das duas telas com o
  servidor próprio do Playwright: tela de sucesso com os dois envios e consulta com as duas
  linhas; detalhe sem via assinada ("Imprimir requerimento"), balcão anexa como requerimento
  assinado, cabeçalho passa a "Requerimento assinado" + "Gerar sem assinatura", abertura
  auditada.
