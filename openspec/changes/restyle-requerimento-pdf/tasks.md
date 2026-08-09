## 1. Paleta legível pelo servidor

- [x] 1.1 Criar `src/core/tenant/palette.ts` com `PALETTES: Record<Theme, Palette>`, cobrindo os cinco temas e os tokens que o documento usa (`primary`, `shade`, `accent`, `accentSoft`, `surface`, `border`, `muted`, `text`, `textSoft`), com os hexes atuais de `src/app/globals.css`
- [x] 1.2 Criar `src/lib/palette.test.ts` que lê `src/app/globals.css`, extrai os `--palette-*` e falha se algum valor divergir do mapa ou se um tema/token estiver faltando dos dois lados
- [x] 1.3 Liberar `src/core/tenant/palette.ts` no `scripts/check-tokens.mjs`, com o motivo escrito: é o único arquivo fora do `@theme` que pode escrever cor, e o teste acima é o que garante que ele não diverge

## 2. Modelo do documento

- [x] 2.1 Adicionar `RequerimentoCredentials` (`heading`, `rows`, `note`) e o campo opcional `credentials` a `RequerimentoDocument` em `src/core/request/requerimento.ts`
- [x] 2.2 Em `buildRequerimento`, remover `Protocolo` e `Chave de acesso` da seção "Pedido" e preencher `credentials` com protocolo, chave e a nota explicando que a página é o comprovante de acesso e não deve ser anexada ao requerimento assinado
- [x] 2.3 Manter `buildDataRightsReceipt` sem `credentials`: o recibo do Encarregado não é assinado nem devolvido, e suas linhas seguem no corpo
- [x] 2.4 Atualizar `src/core/request/requerimento.test.ts`: os testes de protocolo/chave passam a verificar `credentials`, mais um teste afirmando que a chave não aparece em nenhuma seção do corpo e que o protocolo continua aparecendo

## 3. Marca do documento

- [x] 3.1 Definir `DocumentBrand` (`palette`, `logoPath?`) e um helper em `src/lib/` que o monta a partir do `Tenant` (paleta pelo `theme`, logo pelo `logos.light` resolvido em `public/`)
- [x] 3.2 Fazer o helper tolerar logotipo ausente ou ilegível devolvendo `logoPath: undefined`, sem lançar

## 4. Renderização

- [x] 4.1 Mudar a assinatura de `renderDocument` em `src/lib/pdf.ts` para receber `brand: DocumentBrand` e passar a usar as cores da paleta em vez de preto
- [x] 4.2 Desenhar o cabeçalho institucional: faixa em `primary`, logotipo quando houver, nome da serventia e as linhas de `document.office` em contraste sobre a faixa
- [x] 4.3 Desenhar o título com régua `accent` e os cabeçalhos de seção em `primary` com filete `accent`
- [x] 4.4 Desenhar as linhas rótulo/valor em duas colunas alinhadas (rótulo em `muted`, valor em `text`), no lugar do `"Rótulo: valor"` corrido
- [x] 4.5 Repetir o rodapé (régua `border` + texto em `muted`) em toda página, via o evento `pageAdded` do PDFKit
- [x] 4.6 Emitir a página de credenciais quando `document.credentials` existir: `addPage()` ao final, cartão único centralado, protocolo e chave em Courier corpo grande, e a nota abaixo
- [x] 4.7 Atualizar as duas chamadas — `src/app/(public)/solicitar/requerimento/route.ts` e `src/app/(public)/lgpd/recibo/route.ts` — para passar a marca do tenant

## 5. Verificação

- [x] 5.1 Rodar `pnpm test` (node --test) e garantir que o modelo, a paleta e os testes existentes passam
- [x] 5.2 Gerar os dois PDFs (requerimento e recibo LGPD) com pelo menos dois temas diferentes e conferir visualmente: cor, logotipo, alinhamento das linhas, rodapé em todas as páginas
- [x] 5.3 Conferir no requerimento gerado que a chave de acesso aparece só na última página e que destacá-la deixa o requerimento completo, com o campo de assinatura
- [x] 5.4 Rodar `pnpm lint` (Biome) e o typecheck
