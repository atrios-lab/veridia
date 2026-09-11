## Context

O indeferimento de pedido de serviço (protocolo) já exige justificativa em texto livre desde a
PR #92 ("Motivo obrigatório ao cancelar ou indeferir um protocolo"): o operador confirma a mudança de andamento pela `<ReasonConfirmation>` em
`src/app/admin/(dashboard)/pedidos/[protocolo]/_components/status-section.tsx`, `changeStatus`
(`.../actions.ts:136-254`) valida o texto com `statusReasonSchema`
(`src/core/request/kinds.ts`), grava em `service_requests.status_reason` e a consulta pública
(`src/app/(public)/protocolo/protocol-lookup.tsx:1044-1049`) exibe o motivo. O e-mail de aviso já
inclui "Indeferido" na lista que notifica o cidadão, sem carregar conteúdo no corpo.

**Nota sobre o estado do OpenSpec:** essa mudança (#92) já foi implementada e mergeada, mas o
change `cancelamento-protocolo-com-justificativa` nunca foi sincronizado/arquivado — as specs
principais (`openspec/specs/admin-service-requests`, `openspec/specs/service-request`) ainda não
refletem esse comportamento já em produção. As specs deste change (`specs/**/*.md`) foram escritas
como `ADDED` autocontido, descrevendo o estado final desejado, em vez de `MODIFIED` sobre um
requisito que ainda não existe no arquivo principal. Recomenda-se rodar `/opsx:sync` no change
`cancelamento-protocolo-com-justificativa` antes ou depois de arquivar este change, para que as
specs principais fiquem consistentes com o que já roda em produção.

O projeto já tem toda a infraestrutura de anexo necessária: `service_request_attachments`
(`src/db/schema.ts:181-226`), `storeAttachments`/`attachToRequest`
(`src/lib/uploads.ts`), a allowlist de MIME e o teto de tamanho
(`src/core/request/attachment.ts`), e dois exemplos de upload feito pelo operador no mesmo
formulário de ações do pedido: `deliverDocumentAction` e `attachRequirementFormAction`
(`actions.ts:348-434`). O `comprovante-de-pagamento` já resolveu "novo tipo de anexo sem
migração de banco" adicionando um valor de `kind` (`"payment-receipt"`) à tabela existente — o
mesmo caminho serve aqui.

## Goals / Non-Goals

**Goals:**
- Permitir que o operador anexe um PDF como alternativa (ou complemento) ao texto do motivo, só
  para o andamento "Indeferido".
- Reaproveitar 100% a infraestrutura de anexo já existente (tabela, storage, validação de tipo e
  tamanho, rotas de download autenticadas) — nenhuma peça nova de storage.
- Manter a regra já deliberada em #92 de que o e-mail nunca carrega conteúdo: o PDF, como o texto,
  só aparece atrás da chave de acesso na consulta pública.

**Non-Goals:**
- Não estende a opção de PDF ao "Cancelado" — só "Indeferido" muda.
- Não versiona múltiplos PDFs por pedido nem por mudança de andamento: um indeferimento tem no
  máximo um PDF, e uma nova mudança de andamento não empilha anexos anteriores (mesma filosofia de
  `status_reason`, que é sobrescrito, não histórico).
- Não migra o upload do operador para o padrão direto-ao-Blob do cidadão: o PDF passa pelo corpo
  da server action, como os demais anexos do admin, sujeito ao mesmo teto prático de payload da
  Vercel (~4,5 MB) que já vale para `deliverDocumentAction`.
- Não sincroniza automaticamente as specs do change #92 — fica como recomendação (ver Context).

## Decisions

### Onde grava o PDF: `service_request_attachments` com novo `kind`, não nova coluna

Alternativa considerada: coluna `statusReasonAttachmentId` em `service_requests`, espelhando
`resolutionAttachmentId` de `service_request_requirements`. **Rejeitada**: exigiria migração e um
segundo caminho de leitura/gravação de anexo só para este caso, enquanto o padrão mais recente do
projeto (`comprovante-de-pagamento`, `kind: "payment-receipt"`) já resolveu exatamente esse
problema — "novo tipo de documento no ciclo de vida do pedido" — sem coluna nova. **Decisão**: novo
valor de `kind` em `service_request_attachments`, `"rejection-document"` (inglês, seguindo a
convenção mais recente — `payment-receipt`, não os `kind` legados em português como
`documento-final`). Para saber "qual é o PDF do indeferimento atual", a leitura busca o anexo mais
recente desse `kind` para o `requestId`; como um pedido só é indeferido de novo depois de sair
desse andamento e voltar (caso raro, já tratado como não-objetivo em #92 para o texto), não há
ambiguidade prática.

### Validação "pelo menos um dos dois": no núcleo, não na action

`statusReasonSchema` hoje exige texto não vazio sempre que `requiresStatusReason(status)` for
verdadeiro (`cancelled` ou `rejected`). **Decisão**: a regra passa a ser "texto OU PDF" apenas para
`rejected`; para `cancelled` nada muda (texto continua obrigatório sozinho). Isso fica expresso
como uma função pura no núcleo (`src/core/request/kinds.ts`), recebendo `{status, reason,
hasAttachment}` e devolvendo aceito/recusado com a mensagem de erro, para que `changeStatus`
apenas chame a função em vez de reimplementar a condicional "se for rejected e tiver PDF, ignora
motivo vazio". Alternativa (validar só na action) rejeitada pelo mesmo motivo já registrado no
design de #92: regra de negócio pertence ao núcleo, transporte só chama.

### UI: campo de arquivo dentro do `ReasonConfirmation`, condicionado ao status

`ReasonConfirmation` (`status-section.tsx`) hoje é genérico para `cancelled`/`rejected`, com um
único `<textarea name="reason">`. **Decisão**: quando o `target` for `rejected`, o componente
também renderiza um `<input type="file" name="rejectionDocument" accept="application/pdf">`
seguindo o padrão de arquivo oculto com auto-submit já usado em
`attachments-section.tsx` — sem introduzir um segundo passo de confirmação nem um modal. O
`<textarea>` deixa de ser `required` via HTML quando o target é `rejected` (a obrigatoriedade
"pelo menos um dos dois" é reforçada no servidor, que é a fonte de verdade); para `cancelled`
continua `required` como hoje.

Alternativa considerada: um passo de confirmação separado só para o PDF, depois do texto.
**Rejeitada**: duplicaria a interação de confirmar/cancelar por um campo que é opcional junto do
outro, tornando o fluxo mais longo para o caso comum (só texto, sem PDF).

### E-mail e consulta pública: mesma regra de conteúdo zero, extensão natural

Nenhuma decisão nova aqui — a regra já vale (#92): o aviso por e-mail não carrega motivo nem
anexo; a consulta pública, atrás da chave, mostra o conteúdo completo. O botão de download do PDF
reaproveita o mesmo componente `ProtocolFields` + POST para `/protocolo/documento` já usado pelos
demais anexos da tela (`protocol-lookup.tsx`), passando o `attachmentId` do PDF de indeferimento
quando existir.

## Risks / Trade-offs

- **[Risco] PDF grande (perto de 20 MB, o teto geral de anexo) estourar o limite prático de
  payload de server action da Vercel (~4,5 MB)** → aceito como trade-off já existente para todo
  upload do operador (`deliverDocumentAction` tem o mesmo risco); fora de escopo migrar o upload do
  admin para o padrão direto-ao-Blob do cidadão. Se isso incomodar na prática, é um change à parte
  (mesma migração que `corrigir-anexos-do-cidadao` já fez para o cidadão).
- **[Risco] Confundir "motivo obrigatório" com "motivo OU PDF obrigatório" numa leitura rápida da
  spec de #92** → mitigado escrevendo a nova regra como uma exceção explícita restrita a
  `rejected`, deixando `cancelled` textualmente inalterado nas specs.
- **[Trade-off] Specs principais de #92 (`admin-service-requests`, `service-request`) seguem sem
  sincronizar** → não é introduzido nem agravado por este change (já era assim antes); registrado
  como recomendação de sync, não bloqueia esta proposta.

## Migration Plan

1. Sem migração de banco: `kind: "rejection-document"` é só um novo valor de texto na coluna já
   existente.
2. Núcleo (regra "texto ou PDF"), action (`changeStatus` lê o arquivo do `FormData`) e UI
   (`ReasonConfirmation` + `protocol-lookup.tsx`) sobem no mesmo deploy — nada aditivo/destrutivo
   a sequenciar.
3. Sem rollback especial: um PDF já gravado como anexo continua acessível mesmo se o deploy for
   revertido antes de a consulta pública aprender a exibi-lo (fica só sem link até o próximo
   deploy).

## Open Questions

(nenhuma)
