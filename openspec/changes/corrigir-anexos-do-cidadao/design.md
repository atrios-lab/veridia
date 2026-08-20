## Context

Todos os anexos do cidadão (pedido em `/solicitar`, requerimento assinado, documento extra e
resposta de exigência na consulta de protocolo) viajam como multipart no corpo de uma server
action e caem em `storeAttachments` (`src/lib/uploads.ts`), que valida via
`src/core/request/attachment.ts` e grava no Vercel Blob (produção) ou em disco (dev). O
`bodySizeLimit: "45mb"` cobre o Next, mas a Vercel corta o corpo de qualquer request a uma
function em ~4,5 MB totais (`413 FUNCTION_PAYLOAD_TOO_LARGE`) antes do código rodar. Como não
há error boundary nem validação de tamanho no cliente, o cidadão vê um erro genérico. HEIC com
`File.type === ""` (Chrome no Windows/Android) é recusado pela checagem de MIME.

## Goals / Non-Goals

**Goals:**
- Anexo de até 20 MB por arquivo funciona em produção, nos quatro fluxos do cidadão
  (`MAX_ATTACHMENT_BYTES` sobe de 8 para 20 MB).
- Rejeição de tipo/tamanho/quantidade aparece no cliente, antes de subir bytes.
- HEIC real (inclusive com MIME vazio) é aceito; executável renomeado continua recusado.
- Dev sem `BLOB_READ_WRITE_TOKEN` continua funcionando sem Blob.

**Non-Goals:**
- Uploads do painel admin; compressão de imagem; mudança das quantidades (5 no pedido, 3 na
  exigência); antivírus.

## Decisions

**1. Client upload do `@vercel/blob/client` com rota `handleUpload`, em vez de aumentar limite
ou compactar.** O teto de 4,5 MB é da plataforma, não configurável; compressão no cliente não
resolve PDF nem HEIC e adiciona código frágil. O pacote `@vercel/blob` já está instalado e tem o
fluxo pronto: o navegador pede um token à nossa rota (`onBeforeGenerateToken` valida), sobe
direto ao Blob, e a server action recebe só as referências. Alternativa considerada: presigned
URL manual — é reimplementar o que o pacote já faz.

**2. Uma rota única `POST /api/anexos/upload` para os quatro fluxos.** `onBeforeGenerateToken`
impõe no servidor: `allowedContentTypes` (os cinco MIMEs), `maximumSizeInBytes` (20 MB),
pathname restrito ao prefixo `anexos/` com nome gerado por nós (`storedFileName`), e
`addRandomSuffix`. Rate limit da rota com o `isRateLimited` existente. A rota não exige
protocolo/chave: o token só autoriza escrever um blob órfão com nome aleatório; o vínculo a um
pedido continua sendo feito pela action, que é quem valida credenciais. Blob órfão (upload sem
submissão) fica inerte com URL aleatória — mesmo perfil de risco de hoje; limpeza é non-goal.

**3. A action valida as referências, nunca confia no cliente.** O formulário envia campos
ocultos com `{url, contentType, size}` por anexo. `storeAttachments` ganha um irmão
(`acceptUploadedAttachments`) que re-aplica `checkAttachments` (quantidade, tipo, tamanho) e
confere que cada URL pertence ao nosso store (prefixo do host do Blob) antes de gravar as
linhas. Em produção o `size` declarado é conferido contra `head()` do blob. Regra continua em
`src/core/request/attachment.ts` (núcleo puro); a rota e a action só a chamam.

**4. Dev sem token continua no caminho atual.** Sem `BLOB_READ_WRITE_TOKEN`, o formulário posta
os `File`s na action como hoje (multipart, disco local) — localmente não há teto de 4,5 MB. O
componente escolhe o modo por uma flag serializada da página (`blobUploadEnabled`). Isso mantém
e2e local rodando sem Blob e evita mock do serviço. O `bodySizeLimit` do Next sobe para
`"110mb"` (5 × 20 MB + overhead de multipart) para o caminho local acompanhar o limite novo.

**5. HEIC por extensão + magic bytes quando o MIME vem vazio.** No cliente, arquivo com `type`
vazio e extensão `.heic`/`.heif` é tratado como `image/heic`; o `accept` do input ganha
`.heic,.heif`. No servidor, `checkAttachments` aceita MIME vazio somente se os magic bytes
(`ftypheic`/`ftypheix`/`ftypmif1` no offset 4) confirmarem HEIC — a leitura dos primeiros bytes
fica na borda (rota/action), o núcleo recebe o resultado.

**6. Validação no cliente reusa o núcleo.** `addAttachments` chama `checkAttachments` +
`describeProblem` (já são puros e importáveis no cliente) e mostra a mensagem junto ao campo,
descartando o arquivo recusado. Servidor permanece a fronteira de confiança.

## Risks / Trade-offs

- [URL do blob passa a existir no navegador do remetente] → é o próprio dono do arquivo; o
  modelo "URL nunca vai a terceiros" se mantém: as rotas de download continuam proxy por
  protocolo+chave e a URL não é exibida na UI.
- [Blobs órfãos acumulam] → nome aleatório, acesso público improvável; aceitável agora,
  `del()` em job de limpeza se virar custo. (`ponytail:` registrado no código.)
- [Dois caminhos de envio (com/sem Blob)] → o modo dev é o caminho antigo já testado; e2e cobre
  os dois: local sem token e um teste de contrato da rota de token.
- [413 ainda possível no modo multipart local com arquivos enormes] → só afeta dev; irrelevante.

## Migration Plan

Deploy único: a rota nova e o caminho client-upload entram juntos; sem mudança de banco.
Rollback = reverter o deploy (o caminho antigo continua no código para dev). Requer
`BLOB_READ_WRITE_TOKEN` já presente no projeto Vercel (já é usado hoje).

## Open Questions

- Nenhuma bloqueante. Se o `head()` de conferência de tamanho custar latência perceptível na
  submissão com 5 anexos, pode virar conferência em paralelo ou amostral — decidir na
  implementação.
