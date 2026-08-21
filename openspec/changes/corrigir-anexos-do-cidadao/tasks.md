## 1. Núcleo: regras de anexo (HEIC e referências)

- [x] 1.0 Em `src/core/request/attachment.ts`, subir `MAX_ATTACHMENT_BYTES` de 8 para 20 MB (mensagem de erro acompanha via `describeProblem`)
- [x] 1.1 Em `src/core/request/attachment.ts`, aceitar MIME vazio como candidato a HEIC: função pura `resolveMimeType(fileName, mimeType, headBytes?)` que resolve `""` + extensão `.heic`/`.heif` + magic bytes (`ftypheic`/`ftypheix`/`ftypmif1` no offset 4) em `image/heic`, senão mantém o MIME informado
- [x] 1.2 Adicionar ao núcleo a validação de referência de upload: `checkUploadedAttachments(refs: {url, mimeType, size}[], allowedHost)` reusando `checkAttachments` e recusando URL fora do host do store
- [x] 1.3 Testes `node --test` do núcleo: HEIC com MIME vazio aceito, extensão sem magic bytes recusada, referência com host estranho recusada

## 2. Rota de token e store por referência

- [x] 2.1 Criar `src/app/api/anexos/upload/route.ts` com `handleUpload` do `@vercel/blob/client`: `onBeforeGenerateToken` impõe `allowedContentTypes`, `maximumSizeInBytes` (20 MB), pathname `anexos/<storedFileName>` gerado no servidor e `addRandomSuffix`; rate limit com `isRateLimited`
- [x] 2.2 Em `src/lib/uploads.ts`, adicionar `acceptUploadedAttachments(refs, options)`: revalida via núcleo, confere `size` contra `head()` do blob e devolve `StoredAttachment[]` no mesmo formato de `storeAttachments`
- [x] 2.3 Aplicar `resolveMimeType` também no caminho multipart existente (`storeAttachments`), lendo os primeiros bytes do arquivo quando o MIME vem vazio
- [x] 2.4 Subir `bodySizeLimit` em `next.config.ts` para `"110mb"` (5 × 20 MB + overhead), cobrindo o caminho multipart local

## 3. Cliente: validação imediata e upload direto

- [x] 3.1 Extrair um helper client-side compartilhado (validação com `checkAttachments`/`describeProblem` + `resolveMimeType`, upload com `upload()` do `@vercel/blob/client`, montagem dos campos ocultos `{url, contentType, size}`) para os quatro fluxos
- [x] 3.2 `/solicitar` (`request-form.tsx` + `actions.ts`): validar na seleção com mensagem junto ao campo, subir via Blob quando `blobUploadEnabled`, action lendo referências com `acceptUploadedAttachments` (mantendo o caminho multipart sem token); `accept` ganha `.heic,.heif`
- [x] 3.3 Requerimento assinado (tela de sucesso + `attachSignedForm`): mesmo tratamento
- [x] 3.4 Consulta de protocolo (`protocol-lookup.tsx` + `attachExtraDocument` e `writeRequirementMessageAction`): mesmo tratamento, respeitando os limites próprios (1 documento extra por envio, 3 na resposta de exigência)
- [x] 3.5 Serializar `blobUploadEnabled` (presença de `BLOB_READ_WRITE_TOKEN`) do servidor para os componentes, sem expor o token

## 4. Verificação

- [x] 4.1 e2e: manter o teste multipart local de 2 MB e adicionar um teste do fluxo com validação no cliente (arquivo acima de 20 MB recusado na seleção, sem request) e um `.heic` pequeno com MIME vazio aceito
- [x] 4.2 Teste de contrato da rota `/api/anexos/upload`: token recusado para tipo proibido, tamanho acima do limite e pathname fora de `anexos/`
- [x] 4.3 `pnpm test`, `pnpm e2e` e Biome limpos; conferir no preview que o formulário continua funcional sem token (modo disco)
- [ ] 4.4 Validação manual pós-deploy: anexo de ~20 MB em produção protocola sem 413 (registrar no PR)

## 5. Extensão aos demais anexos do cidadão

- [x] 5.1 Liberar no CSP (`src/middleware.ts`) os hosts do storage em `connect-src`, sem os quais o upload direto é barrado pela própria política
- [x] 5.2 Dar à rota de upload um limitador próprio (`veridia:upload`, 40/min), já que cada arquivo é uma requisição
- [x] 5.3 `/lgpd` e `/ouvidoria`: mesmo helper de cliente e `collectAttachments` nas actions
- [x] 5.4 Chat de atendimento: `useAttachmentPrepare` no composer e `collectAttachments` no route handler
