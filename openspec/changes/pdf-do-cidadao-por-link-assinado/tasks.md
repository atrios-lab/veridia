## 1. O token, no núcleo

- [x] 1.1 Criar `src/core/request/pdf-link.ts`, puro: `signPdfLink({ tenantSlug, protocolNumber,
      documento, expiresAt }, key)` e `verifyPdfLink(token, key, now)` devolvendo o payload ou
      `null`. HMAC-SHA256 sobre `"pdf-link:v1." + payload`, `timingSafeEqual`, `documento`
      restrito a `"requerimento" | "declaracao"`, sem lançar em string malformada.
- [x] 1.2 Derivar a chave uma vez em `src/lib/pdf-link-key.ts`:
      `HMAC(BETTER_AUTH_SECRET, "veridia:pdf-link")`, falhando cedo se a variável não existir,
      no mesmo tom de `src/lib/auth.ts`.
- [x] 1.3 `src/core/request/pdf-link.test.ts` (`node --test`): ida e volta; assinatura
      adulterada; payload adulterado; expirado; outro tenant; outro documento; outro protocolo;
      string sem ponto e base64 inválido devolvem `null`.

## 2. As rotas

- [x] 2.1 Em `src/app/(public)/solicitar/requerimento/route.ts`, depois da verificação da chave:
      `documento=comprovante` continua renderizando, mas com `Content-Disposition: attachment`;
      requerimento e declaração respondem 303 para
      `/solicitar/requerimento/<documento>-<protocolo>.pdf?t=<token>` com validade de 1 hora.
      A checagem de `exemption` para a declaração continua antes do redirect.
- [x] 2.2 Criar `src/app/(public)/solicitar/requerimento/[arquivo]/route.ts` com `GET`:
      ler `t`, verificar com a chave derivada e o tenant do host, 404 em qualquer falha (mesma
      resposta da chave errada). Depois buscar o pedido, montar o documento e responder `inline`
      com `filename="<documento>-<protocolo>.pdf"` e `Cache-Control: private, no-store`. O
      segmento `[arquivo]` não é lido.
- [x] 2.3 Extrair para um módulo compartilhado o que as duas rotas montam igual (carregar pedido,
      ato, `brandFor`, `buildRequerimento`/`buildDeclaracoes`), para que a lógica de "qual
      documento a partir de qual pedido" exista uma vez só.

## 3. O comprovante do painel

- [x] 3.1 Em `src/app/admin/(dashboard)/pedidos/[protocolo]/imprimir/route.ts`, o `POST` responde
      `Content-Disposition: attachment; filename="comprovante-<protocolo>.pdf"`. O `GET` não muda.
- [x] 3.2 Em `key-section.tsx`, o botão passa a "Baixar comprovante (PDF)"; o `target="_blank"`
      pode ficar (o Chrome fecha a aba de um download) ou sair, o que der o comportamento mais
      limpo num Chrome real.
- [x] 3.3 Em `manual-entry-form.tsx`, o rótulo e o estado do comprovante passam de "impresso /
      enviado para impressão" para "baixado"; o requerimento continua "enviado para impressão".
      `printBoth` mantém a ordem (comprovante primeiro, por form submit; requerimento por
      `window.open`) e a checagem do pop-up continua só no requerimento.
- [x] 3.4 Em `e2e/admin-service-requests.spec.ts`, o teste que já faz `request.post` em
      `imprimir` com a chave passa a conferir `content-disposition` `attachment` e o nome do
      arquivo.

## 4. Nome do arquivo e título

- [x] 4.1 Em `src/lib/pdf.ts`, `renderDocuments` e `renderBulletin` passam
      `info: { Title: document.title }` ao `PDFDocument`.
- [ ] 4.2 Conferir num Chrome real que a aba da declaração passa a mostrar o título do documento
      e que o nome sugerido ao salvar é `declaracao-<protocolo>.pdf`.

## 5. Testes que fazem o que o Chrome faz

- [x] 5.1 Em `e2e/service-request.spec.ts`, no teste da declaração por `request.post`: a
      resposta final é `application/pdf` e `response.url()` casa com
      `/solicitar/requerimento/declaracao-<protocolo>.pdf?t=`; `request.get(response.url())`
      devolve 200 `application/pdf` (o refetch do visualizador); com `t` alterado, 404; sem `t`,
      404.
- [x] 5.2 O mesmo para o requerimento, no teste que hoje lê `content-disposition` do POST: passa a
      ler da resposta final e a refazer o GET.
- [x] 5.3 Comprovante: `request.post` com `documento: "comprovante"` devolve
      `attachment; filename="comprovante-<protocolo>.pdf"`.
- [x] 5.4 Os testes de clique da #90 (aba abre, tela da chave fica) continuam passando sem
      mudança; ajustar só se o download direto do comprovante deixar de abrir `page` no Chromium
      automatizado, trocando a espera por `waitForEvent("download")`.

## 6. Verificação e entrega

- [x] 6.1 `pnpm typecheck`, `biome check`, `node --test` do `pdf-link.test.ts` e só o
      `e2e/service-request.spec.ts` e `e2e/admin-service-requests.spec.ts`.
- [ ] 6.2 Pelo host do cartório no Homolog, num Chrome de verdade: abrir a declaração pela
      consulta de protocolo, clicar no botão de download do visualizador, ver o arquivo salvo
      com o nome certo; "Retomar" num download antigo continua falhando, como esperado, e um
      clique novo no site funciona. Baixar o comprovante na tela de sucesso e ver a chave ainda
      na tela. No painel, emitir nova chave, "Baixar comprovante (PDF)", e ver o
      arquivo salvo com a chave certa.
- [ ] 6.3 Abrir o PR a partir da branch; sem push na main.
