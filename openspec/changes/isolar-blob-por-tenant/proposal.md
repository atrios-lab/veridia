## Why

Hoje todo arquivo do Blob Store cai achatado em duas pastas únicas — `anexos/<uuid>.<ext>` para anexos de cidadão e `marca/<uuid>.<ext>` para imagens de marca — sem nenhum segmento de tenant no caminho. Numa plataforma multi-tenant onde um único deploy serve N serventias, isso mistura os arquivos de todas elas no mesmo namespace do store: nada tecnicamente vaza entre tenants (a URL de cada arquivo já é aleatória e fica presa ao registro certo no banco), mas a bagunça cresce com cada serventia nova, dificulta auditoria, limpeza e qualquer operação em lote por tenant (ex.: exportar ou apagar tudo de uma serventia que encerrou o contrato).

## What Changes

- O caminho de todo arquivo novo gravado no Blob Store passa a incluir o slug do tenant: `anexos/<tenant-slug>/<uuid>.<ext>` e `marca/<tenant-slug>/<uuid>.<ext>`.
- A rota de token de upload direto (`/api/anexos/upload`) passa a resolver o tenant da própria requisição e **recusa** qualquer pathname cujo segmento de tenant não bata com o tenant que está pedindo o token — hoje ela não olha pra tenant nenhum.
- O helper client-side que monta o pathname antes do upload direto (`useAttachmentPrepare` / `uploadOne`) recebe o slug do tenant, hoje ausente no contexto do cliente.
- O caminho multipart local (`storeAttachments`, `storeBrandImage`) também passa a receber o tenant e gravar sob a pasta correspondente — tanto em blob quanto no fallback de disco de desenvolvimento.
- Arquivos já existentes nos caminhos antigos (achatados) continuam servidos normalmente: a URL de cada arquivo é gravada por registro no banco, não reconstruída a partir de um prefixo fixo, então nada precisa ser migrado ou re-gravado.

## Capabilities

### New Capabilities
- `tenant-storage-isolation`: cada arquivo gravado no Blob Store (anexo de cidadão ou imagem de marca) vive sob uma pasta nomeada pelo slug do tenant dono do registro; a rota de emissão de token de upload direto recusa qualquer pathname que peça uma pasta de tenant diferente do resolvido pela própria requisição.

### Modified Capabilities
(nenhuma — os fluxos de envio de anexo e de imagem de marca continuam com as mesmas regras de validação, limites e mensagens; muda só onde o arquivo é gravado)

## Impact

- `src/core/request/attachment.ts`: `storedFileName`/`isGeneratedAttachmentPath`/`ATTACHMENT_FOLDER` passam a compor o slug do tenant no caminho gerado e validado.
- `src/core/tenant/brand-image.ts`: `brandImageFileName` ganha o mesmo tratamento para a pasta `marca/`.
- `src/lib/uploads.ts`: `store`, `storeAttachments`, `acceptUploadedAttachments`, `storeBrandImage`, `storeBrandBytes` passam a receber o tenant e usá-lo na montagem do caminho.
- `src/app/api/anexos/upload/route.ts`: resolve o tenant da requisição (mesmo padrão de `getTenant()` usado nas server actions) e valida o pathname contra ele.
- `src/app/(public)/_lib/attachments.tsx` e `src/app/(public)/layout.tsx`: o slug do tenant passa a acompanhar `BlobUploadProvider` (ou contexto irmão) para o cliente montar o pathname certo antes de pedir o token.
- `src/app/admin/(dashboard)/configuracoes/identidade-visual/actions.ts`: passa o tenant já disponível na sessão admin para `storeBrandImage`.
- Nenhuma migração de banco ou de arquivos já armazenados é necessária.
