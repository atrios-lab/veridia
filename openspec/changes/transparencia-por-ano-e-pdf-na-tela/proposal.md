## Why

A página pública `/transparencia` mostra cada boletim mensal como uma linha, um embaixo do outro. Em
Bom Jesus já são 20 linhas (janeiro/2025 a agosto/2026), e a lista ganha 12 por ano: em 2028 serão
mais de 40, e o cidadão rola tudo isso para achar um mês. Os documentos ainda são poucos (2 em Bom
Jesus), mas cada nova tabela anual vira mais uma linha solta, sem a categoria que a spec já mandava
usar para agrupar. Além disso, todo PDF abre numa aba nova, e quem só queria conferir um valor
precisa sair da página e voltar.

## What Changes

- Os boletins passam a aparecer agrupados por ano. Cada ano é um bloco que abre e fecha, e só o
  mais recente vem aberto. Dentro dele, os 12 meses ficam numa grade. O mês publicado leva ao PDF,
  o mês sem boletim aparece apagado e sem link, e o preliminar tem marca própria.
- Os documentos passam a aparecer agrupados por categoria, na ordem do painel. Nas tabelas
  (emolumentos e custas), o primeiro da categoria fica em destaque como vigente, e os demais vão
  para "Versões anteriores", recolhidas.
- Em tela de computador, clicar num documento ou num boletim abre o PDF numa janela sobre a
  própria página, com "Abrir em nova aba" e "Baixar" como opções. No celular, o clique continua
  abrindo a aba nova, como hoje.
- Sem JavaScript, os links continuam abrindo o PDF em aba nova.
- As duas rotas de PDF público da transparência (`/transparencia/documento/[id]` e
  `/transparencia/boletim/[id]`) passam a aceitar ser exibidas em moldura pela própria origem
  (`X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`). O restante do site continua
  recusando qualquer moldura.

## Non-goals

- **Não usa pdf.js.** No celular, o Chrome do Android não mostra PDF dentro de `<iframe>`, e a
  saída escolhida é manter a aba nova ali. Renderizar com pdf.js resolveria, mas traz uma
  dependência de ~400 KB, um worker e mais uma diretiva de CSP. Fica para quando a janela no
  celular for exigida.
- **Não mexe nos avisos institucionais** (lavagem de dinheiro e pessoas idosas). Recolhê-los ou
  movê-los depende de saber se a norma exige destaque, e isso é outra conversa.
- **Não mexe no painel** (`/admin/transparencia`). A lista de boletins de lá também cresce, mas é
  usada por outra pessoa, com outra tarefa.
- **Não cria link direto para a janela** (`?ver=<id>`). Compartilhar um boletim continua sendo
  copiar o link do PDF.
- **Não muda o banco nem o `yearLabel`.** Os documentos não são agrupados por ano porque
  `yearLabel` é texto livre ("2026", "Vigência 2025/2026"). Torná-lo estruturado exigiria migração
  e ninguém pediu isso.
- **Não troca o `Content-Disposition: inline`** das rotas. "Baixar" usa o atributo `download` do
  link.

## Capabilities

### New Capabilities

- `transparency-pdf-viewer`: visualização dos PDFs da transparência numa janela sobre a página
  pública, a escolha entre janela e aba nova conforme o aparelho, e a permissão de moldura restrita
  às duas rotas de PDF público.

### Modified Capabilities

- `transparency-documents`: o requisito "Página pública lista documentos publicados" passa a exigir
  o agrupamento por categoria e o destaque da versão vigente nas tabelas.
- `transparency-bulletin`: novo requisito para a lista pública de boletins agrupada por ano, em
  grade de meses.

## Impact

- `src/app/(public)/transparencia/page.tsx`: reescrita da apresentação das duas seções.
- Componente cliente novo em `src/app/(public)/transparencia/_components/` para a janela
  (`<dialog>` + `<iframe>`).
- `src/core/transparency/`: funções puras de agrupamento (boletins por ano e mês, documentos por
  categoria), com testes `node --test`.
- `src/lib/csp.ts` e `src/middleware.ts`: `frame-ancestors` passa a depender da rota.
- `next.config.ts`: `X-Frame-Options: SAMEORIGIN` só nas duas rotas de PDF.
- `src/lib/csp.test.ts`: casos novos para as duas variantes.
- Sem migração de banco, sem dependência nova, sem mudança nas rotas de PDF.
