## 1. Núcleo: agrupamentos

- [x] 1.1 Criar `groupBulletinsByYear` em `src/core/transparency/` (anos em ordem decrescente, 12 posições por ano, `null` no mês sem boletim, `count` por ano)
- [x] 1.2 Testes `node --test` de `groupBulletinsByYear`: dois anos, ano incompleto, lista vazia, preliminar preservado na célula
- [x] 1.3 Criar a constante `VERSIONED_DOCUMENT_CATEGORIES` (emolumentos e custas), tipada por `DocumentCategory`, em `listing.ts`
- [x] 1.4 Criar `groupDocumentsByCategory` (ordem dos grupos pela primeira aparição na ordem do painel; `current`/`previous` só nas categorias versionadas; categoria fora da lista vira grupo próprio)
- [x] 1.5 Testes `node --test` de `groupDocumentsByCategory`: tabela com versão anterior, dois avisos sem recolhimento, ordem dos grupos seguindo o painel, categoria desconhecida

## 2. Moldura só nas rotas de PDF

- [x] 2.1 Criar o predicado puro `isFramablePdfPath(pathname)`, que casa só `/transparencia/(documento|boletim)/<um segmento>`
- [x] 2.2 `buildCsp` recebe `frameAncestors: "none" | "self"`, e o middleware passa `"self"` só quando `isFramablePdfPath` é verdadeiro
- [x] 2.3 Casos em `src/lib/csp.test.ts`: as duas variantes de `frame-ancestors`, `object-src 'none'` intacto e o predicado recusando `/transparencia/documentos` e `/transparencia/boletim/<id>/extra`
- [x] 2.4 Em `next.config.ts`, uma entrada depois da global com `source: "/transparencia/:kind(documento|boletim)/:id"` e `X-Frame-Options: SAMEORIGIN`
- [x] 2.5 Conferir com `next build && next start` + `curl -I` que a rota de PDF manda um único `X-Frame-Options: SAMEORIGIN` e que `/transparencia` segue com `DENY`. Se vier em dobro, trocar a entrada global por `source` com lookahead negativo

## 3. Página pública

- [x] 3.1 Client component `PdfViewer` em `src/app/(public)/transparencia/_components/`: um `<dialog>` por página com cabeçalho (título, "Abrir em nova aba", "Baixar" com `download`, fechar), `<iframe title>`, "Carregando PDF…" até o `onLoad`, `src` limpo ao fechar, fechamento por Esc e por clique no backdrop, e foco devolvido ao item
- [x] 3.2 `PdfLink`: mantém o `<a href target="_blank" rel="noopener">` e só intercepta o clique quando `matchMedia("(min-width: 768px) and (pointer: fine)")` casa e não há modificador nem botão do meio
- [x] 3.3 Seção Documentos: grupos por categoria com `groupDocumentsByCategory`, item vigente em destaque e "Versões anteriores (n)" em `<details>` fechado, mantendo a mensagem de "nada publicado"
- [x] 3.4 Seção Boletim: aviso da parcela privada mantido no topo, um `<details>` por ano (o primeiro com `open`, `<summary>` "AAAA · n boletins") e grade de 12 meses (3 colunas no celular, 6 a partir de `md`), com célula vazia apagada e `aria-label` "<mês> de <ano>: não publicado" e marca "Preliminar"
- [x] 3.5 Textos visíveis vindos do lugar onde a página já os mantém, sem hex fora do `@theme` (só tokens `brand-*`)

## 4. Verificação

- [x] 4.1 `pnpm biome check` e os testes tocados (`src/core/transparency/*.test.ts`, `src/lib/csp.test.ts`)
- [x] 4.2 No preview, em `demo.localhost/transparencia`: no computador, o boletim abre na janela, os botões "Abrir em nova aba" e "Baixar" funcionam e Esc fecha com o foco de volta
- [x] 4.3 No preview, na largura de celular (375px): o toque abre aba nova e a grade fica 3×4. Conferir também o tema escuro
- [x] 4.4 Com o JavaScript desligado, os links abrem o PDF em aba nova
