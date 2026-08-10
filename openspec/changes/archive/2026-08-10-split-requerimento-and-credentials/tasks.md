## 1. Núcleo: dois documentos

- [x] 1.1 Em `src/core/request/requerimento.ts`, remover o preenchimento de `credentials` de `buildRequerimento` (o campo continua no tipo, agora usado só pelo comprovante)
- [x] 1.2 Criar `AccessReceiptData` (`protocolNumber`, `accessKey`, `createdAt`) e `buildAccessReceipt(tenant, data)`, devolvendo um `RequerimentoDocument` com eyebrow, título "Comprovante de acesso", subtítulo `Protocolo X · data`, `office`, `footer` e o bloco `credentials`; sem `sections` e sem `signee`
- [x] 1.3 Reescrever a nota do comprovante tirando a instrução de destacar página e mantendo o resto (guardar; o site não mostra a chave de novo; se perder, peça outra à serventia)
- [x] 1.4 Atualizar `src/core/request/requerimento.test.ts`: o teste da chave passa a mirar `buildAccessReceipt`; o teste "a chave não está no requerimento" cobre o documento inteiro, incluindo `credentials`; novo teste de que o comprovante traz protocolo e chave e não tem `signee`

## 2. Renderização

- [x] 2.1 Em `src/lib/pdf.ts`, tirar o `addPage()` do bloco de credenciais e desenhá-lo no fluxo da página corrente
- [x] 2.2 Conferir o espaçamento do comprovante: sem `sections`, o cartão cai logo abaixo do timbre e precisa de respiro acima

## 3. Rota de download

- [x] 3.1 Em `src/app/(public)/solicitar/requerimento/route.ts`, ler o campo `documento` do corpo e montar `buildAccessReceipt` quando valer `comprovante`, mantendo `buildRequerimento` como padrão para qualquer outro valor
- [x] 3.2 Nomear o arquivo conforme o documento: `requerimento-<protocolo>.pdf` ou `comprovante-<protocolo>.pdf`
- [x] 3.3 Confirmar que a verificação da chave e a resposta 404 genérica continuam antes e independentes da escolha do documento

## 4. Interface

- [x] 4.1 Tela de sucesso (`src/app/(public)/solicitar/request-form.tsx`), passo 2: segundo botão contornado "Baixar comprovante" ao lado do sólido, como um segundo form com `documento=comprovante`
- [x] 4.2 Tela de sucesso, passo 1 e bloco da chave: corrigir a microcopy que diz que a chave "vai impressa no PDF do requerimento" e mencionar o comprovante
- [x] 4.3 Consulta de protocolo (`src/app/(public)/protocolo/protocol-lookup.tsx`), bloco de pendência: mesmo par de botões no cartão do passo 1
- [x] 4.4 Consulta de protocolo, lista "Seus arquivos": segunda linha para o comprovante de acesso, ao lado da linha do requerimento

## 5. Verificação

- [x] 5.1 Rodar `pnpm test`, `pnpm lint` e `pnpm typecheck`
- [x] 5.2 Gerar os dois PDFs e conferir: o requerimento não tem a chave em página nenhuma; o comprovante tem uma página só, com timbre, protocolo e chave
- [x] 5.3 Cobrir em `e2e/service-request.spec.ts`: os dois downloads, os nomes dos arquivos e o 404 com chave errada nos dois casos (o teste roda só com `DATABASE_URL`, ausente nesta máquina)
