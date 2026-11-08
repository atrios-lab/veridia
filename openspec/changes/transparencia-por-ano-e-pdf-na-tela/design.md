## Context

Hoje `src/app/(public)/transparencia/page.tsx` é um server component que lê `publishedDocuments` e
`listBulletins` e renderiza duas listas planas de `<a target="_blank">`. Em produção, Bom Jesus tem
2 documentos e 20 boletins (jan/2025 a ago/2026).

O que já existe e esta change aproveita:

- `transparencyBulletins.referenceMonth` é `YYYY-MM`, e `listBulletins` já ordena do mais recente
  para o mais antigo. Agrupar por ano não precisa de consulta nova.
- `transparencyDocuments.category` vem da lista fechada `DOCUMENT_CATEGORIES`, e `position` é a
  ordem que a operadora define no painel.
- As rotas `/transparencia/documento/[id]` e `/transparencia/boletim/[id]` respondem
  `Content-Disposition: inline` e são da mesma origem da página.

O que hoje impede a janela:

```
next.config.ts      X-Frame-Options: DENY            (source "/:path*")
src/lib/csp.ts      frame-ancestors 'none'           (aplicado pelo middleware em toda rota)
                    object-src 'none'                (descarta <embed> e <object>)
                    frame-src ausente → default-src 'self'   (iframe da mesma origem: permitido)
```

Conferido no ar: `GET /transparencia/boletim/<id>` em cartoriobomjesusrn.com responde
`x-frame-options: DENY` e `frame-ancestors 'none'`. Um `<iframe>` apontando para ele hoje aparece
vazio.

## Goals / Non-Goals

**Goals:**

- Uma página que não cresce uma linha por mês: o ano aberto ocupa no máximo duas fileiras de meses,
  e os outros anos ficam recolhidos.
- PDF visível sem sair da página no computador, com aba nova e download como opções.
- Abrir a moldura só nas duas rotas de PDF público, sem afrouxar mais nada.
- A regra de agrupamento fica no núcleo puro e coberta por teste.

**Non-Goals:** ver a seção Non-goals do proposal (pdf.js, avisos, painel, deep link, migração do
`yearLabel`).

## Decisions

### 1. Ano em `<details>` nativo, não em abas

Cada ano é um `<details>`. O primeiro, que é o mais recente, recebe `open`. O `<summary>` mostra o
ano e a contagem ("2025 · 12 boletins").

- **Por quê:** não precisa de JS nem de estado, a página continua server component, o leitor de
  tela já anuncia o estado aberto/fechado e o Ctrl+F do navegador abre o `<details>` que contém o
  texto buscado.
- **Alternativas:** abas de ano (precisam de client component e escondem os outros anos) e
  `<select>` (esconde quantos anos existem e exige JS para navegar).

### 2. Grade fixa de 12 meses

Cada ano renderiza sempre 12 células, de janeiro a dezembro, em 6 colunas a partir de `md` e 3
colunas abaixo disso. A célula com boletim é um link para o PDF. A célula sem boletim é um `<span>`
apagado, sem link, com `aria-label` "<mês> de <ano>: não publicado". O preliminar mostra a etiqueta
curta "Preliminar" na própria célula, com as cores já usadas hoje na etiqueta "Dados
preliminares".

- **Por quê:** com a posição fixa, o olho encontra o mês sem ler. A lacuna fica visível em vez de
  sumir da lista.
- **Alternativa:** listar só os meses publicados, em chips. É mais curto, mas um mês faltando passa
  despercebido, e o comprimento varia de ano para ano.
- Não há distinção entre mês futuro e mês atrasado. Os dois aparecem como "não publicado". Isso
  evita depender do relógio na renderização (ver Open Questions).

### 3. Agrupamento no núcleo

Duas funções puras em `src/core/transparency/`, sem Drizzle nem Next, que recebem as linhas já
lidas:

```
groupBulletinsByYear(rows: { id, referenceMonth, status }[])
  → { year: number; count: number; months: (Row | null)[12] }[]   // anos em ordem decrescente

groupDocumentsByCategory(rows: { id, category, position, ... }[])
  → { category: string; current: Row[]; previous: Row[] }[]
```

- A ordem das categorias é a da **primeira aparição na ordem do painel**, não a ordem de
  `DOCUMENT_CATEGORIES`. Assim a operadora continua decidindo o que vem primeiro, como a spec já
  manda ("na ordem do painel").
- Uma categoria fora da lista fechada, que só um dado antigo poderia ter, vira um grupo com o
  próprio texto, sem sumir.

### 4. "Vigente" só nas tabelas

Só `Tabela de emolumentos` e `Tabela de custas` usam o par vigente/anteriores: `current` recebe o
primeiro da categoria e `previous` recebe o restante. Nas demais categorias (Aviso, Relatório de
gestão, Cartaz, Outro), todos vão para `current`, porque dois avisos são documentos diferentes, não
versões um do outro. A lista de categorias versionadas é uma constante no núcleo, ao lado de
`DOCUMENT_CATEGORIES`.

- **Alternativa:** recolher todo documento depois do primeiro de qualquer categoria. É mais simples,
  mas chamaria um aviso de "versão anterior" de outro aviso.
- "Versões anteriores (n)" é outro `<details>`, fechado por padrão.

### 5. Janela: `<dialog>` + `<iframe>`, com aprimoramento progressivo

Um client component pequeno (`PdfLink`) renderiza o mesmo
`<a href={url} target="_blank" rel="noopener">` de hoje. No `onClick`:

```
clique
  │
  ├─ matchMedia("(min-width: 768px) and (pointer: fine)") ?
  │      não → deixa o link seguir (aba nova, como hoje)
  │      sim → preventDefault(); abre o <dialog> com o <iframe src={url}>
  │
  └─ modificador (Ctrl/⌘/Shift/botão do meio) → deixa o link seguir
```

Um único `<dialog>` compartilhado pela página, aberto com `showModal()`, que já traz foco preso,
Esc para fechar e `::backdrop`. O cabeçalho tem o título do PDF, "Abrir em nova aba" (o mesmo
`href` com `target="_blank"`), "Baixar" (`<a href download>`) e fechar. O `<iframe>` tem `title`
igual ao título do PDF. Ao fechar, o `src` é limpo, para o leitor de PDF não continuar ocupando
memória.

- **Por quê `pointer: fine`:** o iPad passa de 768px, mas o Safari do iPadOS mostra PDF em iframe
  de forma limitada. Um ponteiro de precisão é o melhor indicador de "computador".
- **Por quê iframe, e não `<embed>`/`<object>`:** `object-src 'none'` bloqueia os dois, e não há
  motivo para afrouxá-lo.
- **Sem JS ou antes da hidratação**, o link funciona como hoje.
- Fechar ao clicar no backdrop: sim, com um handler que compara `event.target === dialog`.

### 6. Moldura liberada só nas duas rotas de PDF

**CSP.** `buildCsp` ganha a entrada `frameAncestors: "none" | "self"`. O middleware decide pela
rota com um predicado puro `isFramablePdfPath(pathname)`, que casa exatamente
`/transparencia/documento/<id>` e `/transparencia/boletim/<id>` (um segmento, sem barra a mais). O
resto continua `'none'`.

**X-Frame-Options.** Em `next.config.ts` entra uma segunda entrada, depois da global, com
`source: "/transparencia/:kind(documento|boletim)/:id"` e `X-Frame-Options: SAMEORIGIN`. Quando
duas entradas de `headers()` definem a mesma chave para o mesmo caminho, o Next fica com a última.
Isso precisa ser **conferido** no build de produção (tarefa própria), porque, se o Next mandar os
dois valores, o navegador recusa a moldura.

- Navegadores que entendem `frame-ancestors` ignoram `X-Frame-Options`. Mesmo assim, os dois
  ficam coerentes, para não depender disso.
- O predicado e as duas variantes do CSP entram em `csp.test.ts`.

## Risks / Trade-offs

- [O Next manda `X-Frame-Options` em dobro na rota de PDF] → tarefa de conferência com
  `next build && next start` + `curl -I`. Se acontecer, a entrada global passa a usar um `source`
  com lookahead negativo, excluindo as duas rotas.
- [O PDF do boletim é gerado por pdfkit a cada requisição, e a janela pode abrir vazia por alguns
  segundos] → um estado "Carregando PDF…" atrás do iframe, que some no `onLoad`.
- [Um navegador de computador sem leitor de PDF embutido, com o plugin desligado por política, faz
  o iframe oferecer download] → "Abrir em nova aba" e "Baixar" ficam sempre visíveis no cabeçalho.
- [Clickjacking nas rotas de PDF] → a moldura só é aceita da mesma origem, e a rota é um GET
  público, sem ação de estado. Não há o que sequestrar.
- [Meses sem boletim em cinza podem ser lidos como atraso da serventia] → ver Open Questions.
  Trocar para "esconder lacunas" muda só a renderização da célula.

## Migration Plan

Não há migração de banco. O deploy é único. Para reverter, basta o revert do PR: as rotas de PDF
não mudam, e a página volta à lista plana.

## Open Questions

- Mostrar os meses sem boletim em cinza é a escolha padrão desta change. Se o produto preferir não
  expor lacunas, a célula vazia some e a grade passa a mostrar só os meses publicados.
