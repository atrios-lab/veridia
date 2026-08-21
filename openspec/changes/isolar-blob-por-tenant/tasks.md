## 1. Núcleo: caminho com o slug do tenant

- [x] 1.1 Em `src/core/request/attachment.ts`, `storedFileName(mimeType, id)` passa a exigir também `tenantSlug` e monta `<uuid>.<ext>` sob esse segmento; `ATTACHMENT_FOLDER` continua sendo só o prefixo por tipo (`anexos`)
- [x] 1.2 No mesmo arquivo, `isGeneratedAttachmentPath(pathname, tenantSlug)` passa a exigir o slug como parâmetro e o regex gerado passa a validar `anexos/<tenant-slug>/<uuid>.<ext>` (slug no charset kebab-case: `[a-z0-9]+(-[a-z0-9]+)*`)
- [x] 1.3 Em `src/core/tenant/brand-image.ts`, `brandImageFileName(mimeType, id)` ganha o mesmo tratamento: passa a exigir `tenantSlug` e monta o caminho sob `marca/<tenant-slug>/`
- [x] 1.4 Testes `node --test` do núcleo: caminho gerado inclui o slug certo; `isGeneratedAttachmentPath` aceita o pathname do próprio tenant e recusa o de outro tenant e o formato antigo sem pasta

## 2. Camada de storage (`src/lib/uploads.ts`)

- [x] 2.1 `store(bytes, storedName, mimeType)` — `storedName` já chega com o segmento de tenant embutido (via `storedFileName`/`brandImageFileName`); ajustado o `mkdir` do fallback de disco para criar o diretório completo do arquivo (`dirname(path)`), não só a raiz de upload, já que o nome agora carrega uma subpasta
- [x] 2.2 `storeAttachments(files, options)` passa a exigir `tenantSlug` em `options` (sem valor default) e repassa para `storedFileName`
- [x] 2.3 `acceptUploadedAttachments(refs, options)` passa a exigir `tenantSlug` e confere `isGeneratedAttachmentPath` contra o pathname real do blob (`head().pathname`) como segunda checagem, além da validação de host já existente
- [x] 2.4 `collectAttachments(formData, field, options)` passa a exigir `tenantSlug` em `options` e repassa para as duas funções acima
- [x] 2.5 `storeBrandImage(file, kind, tenantSlug)` e `storeBrandBytes` passam a exigir `tenantSlug` e repassam para `brandImageFileName`; o `mkdir` do dev também ajustado para `dirname(path)`

## 3. Rota de token de upload direto

- [x] 3.1 Em `src/app/api/anexos/upload/route.ts`, resolver `getTenant()` no início do `POST` (mesmo padrão das server actions do site público)
- [x] 3.2 `onBeforeGenerateToken` passa a chamar `isGeneratedAttachmentPath(pathname, tenant.slug)` em vez da versão sem tenant, recusando qualquer pathname fora da pasta do tenant resolvido
- [x] 3.3 Comportamento de aceitar/recusar por tenant coberto pelos testes de núcleo (1.4), que exercitam exatamente a chamada que a rota faz; não existe hoje neste repo um padrão de teste de contrato para route handlers do App Router (nenhuma outra rota em `src/app/api` tem um), e `getTenant()` depende do `headers()` do Next em escopo de requisição, o que inviabiliza chamar `POST` diretamente de um teste `node --test` sem esse contexto

## 4. Callers: repassar o tenant

- [x] 4.1 `src/app/(public)/solicitar/actions.ts` (`submitServiceRequest`, `attachSignedForm`) passa `tenant.slug` para `collectAttachments`
- [x] 4.2 `protocolo/actions.ts` (`attachExtraDocument`, `writeRequirementMessageAction`), `lgpd/actions.ts`, `ouvidoria/actions.ts` e a rota do chat de atendimento passam `tenant.slug` para `collectAttachments`; achados durante a implementação, os chamadores diretos de `storeAttachments` no painel admin (`pedidos/[protocolo]/actions.ts` ×3, `lgpd/[protocolo]/actions.ts`, `transparencia/actions.ts`, `publicacoes/actions.ts`) também passam a repassar `tenant.slug` — o TypeScript acusou os seis por exigir o parâmetro
- [x] 4.3 `src/app/admin/(dashboard)/configuracoes/identidade-visual/actions.ts` passa o slug do tenant da sessão para `storeBrandImage`

## 5. Cliente: o slug acompanha o upload direto

- [x] 5.1 `BlobUploadProvider` (`src/app/(public)/_lib/attachments.tsx`) passa a carregar `{ enabled, tenantSlug }` em vez de só o booleano
- [x] 5.2 `src/app/(public)/layout.tsx` passa `tenant.slug` ao `BlobUploadProvider`
- [x] 5.3 `uploadOne` (mesmo arquivo) lê o slug do contexto e monta `anexos/<tenant-slug>/<uuid>.<ext>` antes de pedir o token

## 6. Verificação

- [x] 6.1 `pnpm test` (342/342), `tsc --noEmit` e Biome limpos nos arquivos tocados
- [x] 6.2 e2e (`e2e/service-request.spec.ts`, porta isolada): os 11 testes que não dependem de banco local passam; os 11 do describe "filing a request" (que gravam de fato um pedido com anexo) ficam skipped nesse ambiente por falta de `DATABASE_URL` local — mesmo comportamento de antes desta mudança, não é regressão
- [ ] 6.3 Validação manual pós-deploy: anexo novo e imagem de marca nova de uma serventia real caem na pasta certa; anexo antigo (pasta achatada) continua abrindo pela URL já salva
