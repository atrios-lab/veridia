## 1. Núcleo

- [x] 1.1 Em `src/core/request/kinds.ts`, ajustar a validação de `statusReasonSchema`/
      `requiresStatusReason` para expor uma função pura que decide se a mudança para `rejected`
      pode ser aceita com texto vazio quando há um PDF anexado (ex.:
      `validateStatusReason({status, reason, hasAttachment})`), mantendo `cancelled` exatamente
      como hoje (texto sempre obrigatório, sem PDF).
- [x] 1.2 Reaproveitar `ALLOWED_MIME_TYPES`/`MAX_ATTACHMENT_BYTES` de
      `src/core/request/attachment.ts` para validar o PDF do indeferimento; restringir o `accept`
      desse campo especificamente a `application/pdf` (os demais tipos aceitos pelos outros
      uploads não se aplicam aqui). (`REJECTION_DOCUMENT_MIME_TYPE` em `attachment.ts`; tamanho
      continua sob `MAX_ATTACHMENT_BYTES` via `storeAttachments`.)
- [x] 1.3 Adicionar `"rejection-document"` como valor de `kind` reconhecido para anexos de pedido,
      ao lado de `"payment-receipt"`, `"documento-final"` etc., sem migração de banco.

## 2. Server action do painel

- [x] 2.1 Em `src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`, `changeStatus` passa a
      ler um arquivo opcional de `formData.get("rejectionDocument")` quando o `status` alvo for
      `rejected`.
- [x] 2.2 Validar o arquivo (quando presente) com as mesmas checagens de tipo/tamanho já usadas em
      `deliverDocumentAction`/`attachRequirementFormAction`, recusando com mensagem em português
      quando o tipo não for PDF ou o tamanho exceder o limite.
- [x] 2.3 Aplicar a regra "pelo menos um dos dois" de 1.1: recusar a confirmação de `rejected` só
      quando texto vazio E nenhum arquivo enviado; aceitar as três combinações válidas (só texto,
      só PDF, os dois).
- [x] 2.4 Quando o PDF for aceito, gravá-lo via `storeAttachments`/`attachToRequest`
      (`src/lib/uploads.ts`) com `kind: "rejection-document"`, amarrado ao `requestId`, na mesma
      transação/chamada que grava `status`/`status_reason` via `updateRequestStatus`.
- [x] 2.5 Confirmar que `changeStatus` continua recusando `cancelled` sem texto, sem nenhuma opção
      de PDF para esse andamento (comportamento de #92 inalterado).

## 3. Histórico do painel

- [x] 3.1 Em `listRequestHistory`/na busca do detalhe do pedido (`src/lib/service-request.ts`),
      trazer junto o anexo mais recente de `kind: "rejection-document"` do pedido, quando existir.
      (Implementado como o comprovante de pagamento: sem novo join, filtrado de `ownAttachments`
      já carregado por `listAttachments` em `page.tsx`.)
- [x] 3.2 Na exibição do histórico do detalhe (`_components` do pedido), mostrar o link de
      download do PDF na mesma entrada onde já aparece o texto do motivo, para a mudança de
      andamento mais recente para `rejected`.

## 4. UI do painel (status-section.tsx)

- [x] 4.1 Em `ReasonConfirmation` (`_components/status-section.tsx`), quando o `target` for
      `rejected`, renderizar um `<input type="file" name="rejectionDocument" accept="application/pdf">`
      junto do `<textarea name="reason">`, seguindo o padrão de arquivo oculto com auto-submit já
      usado em `_components/attachments-section.tsx`. (Sem auto-submit aqui: o arquivo viaja no
      mesmo submit do botão "Confirmar", já que os dois campos pertencem à mesma confirmação.)
- [x] 4.2 Tornar o `<textarea name="reason">` não obrigatório no HTML quando `target === "rejected"`
      (a obrigatoriedade "pelo menos um dos dois" é validada no servidor, tarefa 2.3); manter
      `required` para `target === "cancelled"`.
- [x] 4.3 Exibir a mensagem de erro do servidor (nem texto nem PDF informados, ou PDF de tipo
      inválido) no mesmo bloco de erro que o formulário já usa. (Já genérico; nenhuma mudança
      necessária além da mensagem vinda do núcleo/action.)
- [x] 4.4 Mostrar o nome do PDF selecionado antes de confirmar (mesmo padrão visual usado em
      `attachments-section.tsx` para o arquivo já escolhido).
- [x] 4.5 Garantir que a confirmação de `cancelled` continua sem campo de arquivo.

## 5. Consulta pública de protocolo

- [x] 5.1 Em `src/app/(public)/protocolo/protocol-lookup.tsx`, junto ao bloco que já exibe
      `statusReason` para `rejected` (linhas ~1044-1049), exibir um botão "Baixar documento"
      quando houver anexo de `kind: "rejection-document"`, reaproveitando o padrão
      `<form action="/protocolo/documento" method="post">` + `ProtocolFields` já usado pelos
      demais anexos da tela.
- [x] 5.2 Repassar o `attachmentId` do PDF de indeferimento do server action que monta
      `ServiceRequestDetail` para o componente, sem expor a URL do blob ao cliente.
      (`rejectionDocumentAttachmentId` em `src/app/(public)/protocolo/actions.ts`.)
- [x] 5.3 Quando não houver PDF (só texto, ou nenhum motivo informado), não exibir o botão de
      download — comportamento atual continua para esses casos.

## 6. Testes

- [x] 6.1 `node --test`: função de 1.1 aceita `rejected` com PDF e texto vazio, aceita com texto e
      sem PDF, aceita com os dois, e recusa sem nenhum dos dois. (`src/core/request/kinds.test.ts`)
- [x] 6.2 `node --test`: função de 1.1 recusa `cancelled` sem texto mesmo que um PDF seja passado
      (não existe opção de PDF para esse andamento).
- [x] 6.3 `node --test`: `updateRequestStatus`/gravação do anexo persistem `status`,
      `status_reason` (quando houver) e o anexo `rejection-document` (quando houver) na mesma
      chamada, contra PGlite com as migrações reais — mesmo padrão já usado em
      `src/db/service-request.test.ts`.
- [x] 6.4 Playwright: fluxo do operador indeferindo um pedido só com PDF (sem texto) — sucesso,
      link no histórico. (`e2e/admin-service-requests.spec.ts`; não executado localmente — precisa
      de `DATABASE_URL`/sessão de admin reais, e2e completo roda só no CI.)
- [x] 6.5 Playwright: fluxo do operador tentando confirmar o indeferimento sem texto e sem PDF —
      erro, andamento não muda. (Mesmo arquivo, mesma ressalva de execução.)
- [x] 6.6 Playwright: consulta pública mostra o botão de download quando o protocolo indeferido
      tem PDF anexado, e não mostra quando só tem motivo em texto.
      (`e2e/service-request.spec.ts`; mesma ressalva de execução.)

## 7. Verificação manual

- [ ] 7.1 Rodar o app localmente, indeferir um protocolo anexando um PDF sem escrever motivo, e
      confirmar: e-mail chega sem anexo e sem link direto, histórico do painel mostra o link, e a
      consulta pública com a chave de acesso permite baixar o PDF.
- [ ] 7.2 Confirmar que indeferir com um arquivo que não é PDF é recusado com mensagem clara, e que
      cancelar um protocolo continua exigindo só texto, sem opção de anexo.
