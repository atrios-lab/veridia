## 1. Impressão no balcão

- [x] 1.1 Criar `src/app/admin/(dashboard)/pedidos/[protocolo]/imprimir/route.ts`: GET autenticado (sessão + `requests.manage`) que resolve o pedido pelo protocolo, monta `buildRequerimento` com `brandFor` e responde o PDF `inline`
- [x] 1.2 Na mesma rota, POST com campo `chave` no corpo: verifica a chave contra o hash e responde o comprovante (`buildAccessReceipt`) `inline`; chave errada é 404 genérico
- [x] 1.3 No topo do detalhe, ação "Imprimir folha" (link para o GET, `target="_blank"`); quando houver anexo `requerimento-assinado`, virar "Imprimir via assinada" apontando para `/admin/documento` do assinado mais recente
- [x] 1.4 No `KeySection`, enquanto a chave reemitida está no estado, oferecer "Imprimir comprovante" como form POST para a rota de impressão com a chave no corpo

## 2. Corrigir dados protocolados

- [x] 2.1 Criar `updateRequestData` em `src/lib/service-request.ts`: atualiza nome, contato, CPF, finalidade, descrição e `createdAt`, grava auditoria `service-request.edit` e devolve o registro atualizado
- [x] 2.2 Criar `updateRequestDataAction` nas actions do detalhe, com validação Zod local (nome ≥ 2, contato ≥ 3, CPF opcional validado pelo helper do núcleo, data/hora obrigatória, não-futura, interpretada em `OFFICE_TIME_ZONE`)
- [x] 2.3 No cartão "Dados do solicitante": botão "Editar dados" que troca os `Field` por formulário com os seis campos, salvar/cancelar, erro inline e toast de sucesso
- [x] 2.4 Registrar o rótulo "corrigiu os dados do pedido" em `HISTORY_LABELS` e conferir que a correção aparece no histórico
- [x] 2.5 Extrair a validação para `src/core/request/edit.ts` (regra de negócio pertence ao núcleo) e testá-la: fuso da serventia, CPF, vazio→null, data futura recusada, ato/protocolo fora do schema. O harness PGlite roda SQL cru e `src/lib` liga no `db` da Neon, então `updateRequestData` em si não é testável ali

## 3. Formulário anexado à exigência

- [x] 3.1 Adicionar `requirementId` (uuid, anulável, FK para `service_request_requirements`, `onDelete: cascade`) em `service_request_attachments`; gerar migração Drizzle (expand, deploy único)
- [x] 3.2 Em `src/lib/service-request.ts`: aceitar `requirementId` ao anexar; filtrar `requirementId is null` nas listas de entrega/consulta; expor os formulários por exigência em `listRequirements`
- [x] 3.3 Action `attachRequirementFormAction` no detalhe (kind `formulario-exigencia`, exigência do próprio pedido)
- [x] 3.4 No cartão da exigência do painel: dropzone "Anexar formulário para imprimir" e linha `AttachmentRow` com excluir; rótulo "Formulário da exigência" no mapa de labels
- [x] 3.5 Na consulta do cidadão: `RequirementView` carrega os formulários; o cartão da exigência lista cada um com download via `POST /protocolo/documento` (protocolo + chave no corpo)
- [x] 3.6 Teste de que o formulário não entra nas listas de entregas ("Entrega ao cidadão" / "Documentos da serventia") e some quando a exigência é excluída

## 4. Verificação

- [x] 4.1 `pnpm test`, `pnpm lint`, `pnpm typecheck`
- [x] 4.2 No painel local: imprimir folha (sem chave no PDF), via assinada, comprovante logo após reemitir chave; corrigir dados e conferir histórico e consulta do cidadão
- [x] 4.3 Fluxo completo da exigência: anexar formulário no painel, baixar pelo cartão na consulta com chave, conferir que não aparece em "Documentos da serventia"
- [x] 4.4 e2e cobrindo a rota de impressão: GET sem sessão nega; POST comprovante com chave errada dá 404
