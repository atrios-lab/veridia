## 1. Textos no core

- [ ] 1.1 Em `src/core/acts/catalog.ts`, adicionar `PLATFORM_CHANNEL_RULE`,
  `PLATFORM_SECURITY_STATEMENT` e `PLATFORM_DATA_PROTECTION` com a redação do design
  (decisão 4), ao lado de `PLATFORM_STATEMENT`; sem travessão nem meia-risca.
- [ ] 1.2 Em `catalog.test.ts`, incluir as três no teste que proíbe "Provimento 7 autoriza a
  plataforma" e conferir que `PLATFORM_CHANNEL_RULE` diz "exclusivamente" e cita o 180.

## 2. Página `/plataforma`

- [ ] 2.1 Criar `src/app/(public)/plataforma/page.tsx` no molde de `privacidade/page.tsx`:
  eyebrow com o nome do tenant, título "Sobre a plataforma", intro, e as quatro seções (o que
  é; por onde os pedidos entram; segurança e rastreabilidade, com o lema; seus dados, com link
  para `/privacidade`). `metadata.title = "Sobre a plataforma"`.
- [ ] 2.2 Conferir que a página abre fora do gating (como `/privacidade`) e que a navegação não
  marca nenhum item quando ela está aberta (spec "Shell público", cenário da página que o menu
  não lista).

## 3. Rodapé e wizard

- [ ] 3.1 Em `src/app/(public)/layout.tsx`, trocar o parágrafo institucional do rodapé pelo
  texto da decisão 2 e adicionar o link "Sobre a plataforma" no grupo Cidadão, antes de
  "Política de privacidade", sem `data-section`.
- [ ] 3.2 Em `src/app/(public)/solicitar/page.tsx`, adicionar sob o título a linha "Pedido
  recebido pela Plataforma Eletrônica Oficial da Serventia (Provimento CNJ n. 180/2024). Saiba
  mais." com link para `/plataforma`, em `text-brand-muted`, sem modal.

## 4. Fechamento

- [ ] 4.1 E2e: em `tenants.spec.ts` (ou spec do site público), teste que `/plataforma` abre,
  mostra o nome do tenant e cita "180/2024"; e que o rodapé traz o link "Sobre a plataforma".
  Confirmar que a comparação de `data-section` do rodapé continua passando.
- [ ] 4.2 `pnpm typecheck`, `pnpm lint`, `check:dashes`, `check:a11y`, `pnpm test`; conferir
  o rodapé e a página em 390px e no desktop no navegador.
