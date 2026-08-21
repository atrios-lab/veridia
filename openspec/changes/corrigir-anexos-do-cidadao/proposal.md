## Why

O cidadão não consegue anexar documentos em produção. O app promete até 5 arquivos de 8 MB, mas todo upload viaja no corpo de uma server action, e a Vercel corta qualquer request acima de ~4,5 MB **totais** com `413 FUNCTION_PAYLOAD_TOO_LARGE` — antes do nosso código rodar. Uma única foto de celular (5–15 MB) já estoura o teto, e como não há error boundary nem validação no cliente, a falha aparece como erro genérico ou tela muda. Agravante: fotos HEIC de iPhone chegam com `File.type === ""` em Chrome no Windows/Android e são recusadas mesmo pequenas, embora a UI diga aceitar HEIC.

## What Changes

- Upload dos anexos do cidadão passa a ir do navegador direto para o Vercel Blob (`@vercel/blob/client` + rota `handleUpload`), tirando os bytes do corpo da server action. O limite por arquivo sobe de 8 MB para **20 MB** e vira real; a action recebe só as referências (URL, tipo, tamanho) e continua validando tudo no servidor.
- Vale para **todo** anexo do cidadão, não só os do pedido: anexos em `/solicitar`, requerimento assinado, "anexar outro documento" e resposta de exigência na consulta de protocolo, pedido de direitos LGPD, manifestação de ouvidoria e anexo do chat de atendimento. Todos passavam pelo mesmo `storeAttachments` e estavam presos ao mesmo teto.
- Validação de tipo, tamanho e quantidade também no cliente, com mensagem imediata antes de gastar upload — o servidor segue sendo a autoridade.
- HEIC aceito de verdade: arquivo com MIME vazio e extensão `.heic`/`.heif` é tratado como HEIC (verificação no servidor pelos magic bytes), e o `accept` do input passa a incluir as extensões.
- Em desenvolvimento (sem `BLOB_READ_WRITE_TOKEN`), o fluxo continua funcionando via disco local como hoje.

## Non-goals

- Não muda uploads do painel admin (imagens de marca, documentos de transparência, publicações): passam por operador treinado, com arquivos pequenos, numa rede de escritório. Se o mesmo teto os atingir, é outra mudança.
- Não introduz compressão/redimensionamento de imagem no cliente.
- Não muda as quantidades (5 arquivos no pedido, 3 na exigência) nem o modelo de nomes anônimos (`anexo-N`); a única mudança de limite é o tamanho por arquivo (8 → 20 MB).
- Não adiciona antivírus/scan de conteúdo além da checagem de tipo.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `service-request`: o requisito de anexos passa a exigir upload direto do navegador para o storage (sem transitar pelo corpo da action), validação prévia no cliente com mensagem imediata, e aceitação de HEIC mesmo quando o navegador não informa o MIME. O cenário "anexo inválido" ganha o caminho do cliente além do servidor.
- `requirement-conversation`, `ombudsman-channel`, `data-rights-channel`: sem delta próprio — todos herdam "mesmos limites e mesmo caminho dos demais uploads do cidadão", agora definido no delta de `service-request`.

## Impact

- `src/lib/uploads.ts` (store por referência e coletor único), nova rota `src/app/api/anexos/upload/route.ts`, `src/core/request/attachment.ts` (HEIC, limite, nome gerado), helper de cliente `src/app/(public)/_lib/attachments.tsx`, e os sete formulários/actions do cidadão: `solicitar`, `protocolo`, `lgpd`, `ouvidoria` e o chat.
- `src/middleware.ts`: o CSP `connect-src 'self'` bloqueava o upload direto — precisa liberar o host da API do Blob e o do store.
- `src/lib/rate-limit.ts`: orçamento próprio para a rota de upload (uma requisição por arquivo esgotaria o limite compartilhado de 10/min numa única submissão com anexos).
- Dependência já instalada: `@vercel/blob` (parte `client`). Nenhuma dependência nova.
- Segurança: a rota `handleUpload` precisa limitar tipo/tamanho/quantidade e escopo de pathname no servidor; blobs continuam com URL aleatória nunca exposta ao navegador de terceiros (a URL do blob passa a ser conhecida do próprio remetente — avaliar no design se isso muda algo para o modelo "o path nunca chega ao browser").
- e2e: o teste de 2 MB local não cobre o teto da plataforma; adicionar cobertura do novo fluxo e do HEIC sem MIME.
