## Context

O Blob Store hoje tem dois prefixos fixos e únicos: `anexos/` (documentos que o cidadão envia num pedido, gravados por `storeAttachments`/`acceptUploadedAttachments` em `src/lib/uploads.ts`) e `marca/` (logotipo e foto de capa que a serventia publica, gravados por `storeBrandImage`). Nenhuma das duas rotas de gravação recebe o tenant — nem o multipart local, nem o upload direto do navegador — e o nome gerado é sempre `<uuid>.<ext>`, sem nenhum segmento que identifique a serventia dona do arquivo.

Dois caminhos escrevem no store hoje:
1. **Multipart, server-side** (`storeAttachments`, `storeBrandImage`): o servidor já tem o tenant em mãos (via `getTenant()` na server action ou a sessão do painel admin), só não repassa para a função de storage.
2. **Upload direto do navegador** (`useAttachmentPrepare`/`uploadOne` em `_lib/attachments.tsx`, mais a rota `/api/anexos/upload`): o *cliente* monta o pathname antes de pedir o token, e a rota só confere se o pathname bate com o formato gerado (`isGeneratedAttachmentPath`) — ela nunca resolve nem confere o tenant da requisição. É o único dos dois caminhos usado hoje pra imagens de marca? Não: marca sempre vai pelo caminho 1 (server action multipart do painel admin), então só o fluxo de anexo de cidadão passa pelo upload direto.

A URL final de cada arquivo é gravada por registro (`serviceRequestAttachments.path`, campos da tabela de tenant para as imagens de marca), nunca reconstruída a partir de um prefixo — então nenhum arquivo já gravado precisa ser movido ou re-referenciado.

## Goals / Non-Goals

**Goals:**
- Todo arquivo novo (anexo de cidadão ou imagem de marca) é gravado sob uma pasta nomeada pelo slug do tenant dono do registro.
- A rota de token de upload direto passa a resolver o tenant da própria requisição e recusa qualquer pathname pedindo a pasta de outro tenant — hoje ela aceita qualquer pathname no formato certo, de qualquer tenant.
- Nenhuma migração de dado: arquivos já gravados nos caminhos achatados continuam servidos exatamente como estão.

**Non-Goals:**
- Não migra ou reorganiza arquivos já existentes no store.
- Não adiciona validação de formato ao slug do tenant em si (`core/tenant/schema.ts` já aceita qualquer string não vazia); o novo regex de pathname só valida o *uso* do slug já conhecido, não sua origem.
- Não muda limite, tipo aceito, mensagem de erro ou qualquer regra de negócio de anexo/marca — só onde o arquivo é gravado.

## Decisions

**Formato do caminho: `<tipo>/<tenant-slug>/<uuid>.<ext>`, não `<tenant-slug>/<tipo>/...`**
Mantém os dois prefixos de topo que já existem (`anexos/`, `marca/`) como a primeira divisão — por tipo de conteúdo, que é como o CSP e o restante do código já pensam nesses arquivos (`ATTACHMENT_FOLDER`, `isGeneratedAttachmentPath`) — e insere o tenant como o próximo nível. Alternativa considerada: `<tenant-slug>/<tipo>/...`, que agruparia por serventia primeiro; rejeitada porque exigiria reescrever `ATTACHMENT_FOLDER`/`isGeneratedAttachmentPath` em vez de estendê-los, sem ganho real — nenhuma operação em lote hoje itera "todos os anexos de todos os tenants" que se beneficiaria do agrupamento por tipo no topo.

**A rota `/api/anexos/upload` passa a chamar `getTenant()` e comparar contra o segmento do pathname**
Hoje `onBeforeGenerateToken` só confere o formato (`isGeneratedAttachmentPath`), nunca de quem é o pathname. Sem essa checagem, nada impediria (tecnicamente) um cliente do site do tenant A de pedir um token para escrever em `anexos/tenant-b/...` — o upload direto para o Blob nunca passa pela server action que amarra o arquivo ao registro certo, então a única barreira contra isso é a própria rota de token. `getTenant()` já resolve o tenant pelo host da requisição em todo o resto do site público; a rota de upload reusa exatamente essa função.

**O slug do tenant chega ao cliente pelo mesmo contexto que já carrega `blobUploadEnabled`**
`BlobUploadProvider` (`_lib/attachments.tsx`) já é o único contexto client-side que o upload direto lê, criado uma vez no layout público a partir de um valor resolvido no servidor. Estender esse mesmo contexto (de `boolean` para `{ enabled, tenantSlug }`) evita criar um segundo provider só para uma string, e mantém a mesma disciplina do que já existe: decidido uma vez no servidor, lido no cliente sem requisição extra.

**`storedFileName`/`brandImageFileName` recebem o slug como parâmetro, não o lêem de um contexto global**
Essas funções vivem no núcleo puro (`src/core`), sem I/O — receber o tenant como argumento explícito mantém essa regra em vez de introduzir alguma forma de contexto implícito ali.

## Risks / Trade-offs

- **[Risco] Slug de tenant com caractere fora do padrão esperado (ex.: maiúscula, espaço) quebraria a comparação exata do pathname na rota de token** → Mitigação: o regex de validação usa o mesmo charset kebab-case que os slugs já usam para compor domínio/URL em outras partes do site; nenhum slug existente foge disso hoje.
- **[Risco] Esquecer de repassar o tenant em algum dos dois caminhos de gravação (multipart vs. upload direto) deixaria esse caminho voltando ao prefixo achatado antigo, sem erro visível** → Mitigação: `storedFileName`/`brandImageFileName` passam a exigir o slug como parâmetro obrigatório (não opcional), então o TypeScript recusa compilar qualquer chamador que não o repasse.

## Migration Plan

Sem migração de dado. O deploy troca o comportamento de gravação para arquivos *novos*; arquivos antigos mantêm sua URL gravada no banco e continuam sendo lidos normalmente, já que nenhuma leitura reconstrói caminho a partir de prefixo. Um único deploy é suficiente (não é uma migração destrutiva de banco, que exigiria dois).
