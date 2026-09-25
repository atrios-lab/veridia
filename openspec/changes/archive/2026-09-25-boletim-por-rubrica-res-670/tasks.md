## 1. Núcleo

- [x] 1.1 Criar `src/core/transparency/rubrics.ts`: `RUBRICS` (I a IV com o texto do art. 6º, § 3º), `FUNDS_BY_STATE.RN` na ordem da tabela (FDJ → II, FRMP → IV, FCRCPN → III, FUNAF → IV) e `groupByRubric(state, amounts)`, que devolve só as rubricas com fundos, cada uma com subtotal e detalhe, e o total dos fundos sem o ISS; teste com o exemplo da spec (IV = 419,10; total = 1.864,06) e com a rubrica I ausente no RN
- [x] 1.2 Em `src/core/transparency/bulletin.ts`: `BulletinFigures` troca `taxesPaidCents` por `fundAmountsCents` e `issCents`, com `grossRevenueCents` e `expensesCents` opcionais; `bulletinTaxesCents` soma fundos e ISS; `bulletinBalanceCents` devolve `null` sem arrecadação ou despesas
- [x] 1.3 `parseBulletinFigures(state, input, { privateFigures })`: exige exatamente os fundos da UF e o ISS (zero aceito); com `privateFigures` exige arrecadação e despesas, sem ele as ignora; atualizar `bulletin.test.ts` (campo vazio, zero aceito, chave desconhecida rejeitada, centavos exatos e o exemplo da spec com saldo R$ -2.743,78)
- [x] 1.4 Parser de leitura para o jsonb: linha com chave faltando, sobrando ou valor não inteiro é erro, nunca zero; teste

## 2. Tenant

- [x] 2.1 `TenantSchema`: campo obrigatório `location: { city, state }`, com `state` em enum que hoje só tem `"RN"`; comentário explicando por que não reaproveita `municipality` (Pix, caixa alta, 15 caracteres)
- [x] 2.2 `TenantSchema`: `publishBulletinPrivateFigures: z.boolean().default(true)`; `OfficeBulletinSchema` e `OfficeBulletinOverrideSchema` em `overrides.ts`, no padrão de `OfficeDeadlineSchema`, e a aplicação do override junto dos demais
- [x] 2.3 Preencher `location` nos 13 arquivos de `src/core/tenant/tenants/` com a cidade acentuada; ajustar `tenant.test.ts` e o teste de overrides (sem override = ligada; override malformado = ligada)

## 3. Banco (deploy 1, expand)

- [x] 3.1 `src/db/schema.ts`: adicionar `fundAmountsCents` (jsonb, NOT NULL, default `{}`) e `issCents` (bigint, NOT NULL, default 0) em `transparency_bulletins`; tornar nuláveis `gross_revenue_cents`, `taxes_paid_cents` e `expenses_cents`, com comentário em `taxes_paid_cents` apontando o contract
- [x] 3.2 `pnpm db:generate` e revisar o SQL linha a linha; não rodar `db:migrate`

## 4. Camada de dados

- [x] 4.1 `src/lib/transparency.ts`: `BulletinInput` e `upsertBulletin` gravam atos, `fundAmountsCents`, `issCents` e, quando vierem, arrecadação e despesas; nunca `taxes_paid_cents`. A leitura passa pelo parser do 1.4. A regra fica numa função `...With(db, ...)`
- [x] 4.2 Gravar a opção pelo painel no padrão dos overrides, com `recordAudit`, numa função `...With(db, ...)`
- [x] 4.3 Testes em processo contra PGlite: publicar, republicar o mesmo mês (substitui, sem duplicar), ler de volta fundos, ISS, arrecadação e despesas; publicar com a opção desligada grava arrecadação e despesas nulas; gravar a opção deixa auditoria

## 5. Painel

- [x] 5.1 Aba Boletim mensal: a opção "Publicar também arrecadação, despesas e saldo" acima do formulário, gravada no servidor, com a consequência dita na legenda
- [x] 5.2 `bulletin-form.tsx`: tirar o campo "Tributos pagos"; um campo por fundo da UF, na ordem do mapa, com o rótulo da tabela (FDJ, FRMP, FCRCPN, FUNAF), mais ISS e atos; arrecadação, despesas e a caixa "Saldo final (emolumentos e outras receitas)" só com a opção ligada
- [x] 5.3 `actions.ts`: `publishBulletinAction` e a action da opção só fazem o transporte e chamam núcleo e camada de dados; erros por campo com os nomes novos
- [x] 5.4 `bulletin-preview.tsx`: rubricas com subtotal e detalhe, total dos fundos, linha "ISS, tributo municipal (<cidade>)", e arrecadação, despesas e saldo só com a opção ligada; rodapé citando o art. 6º, § 3º, da Res. CNJ 215/2015 com a redação da Res. CNJ 670/2025
- [x] 5.5 `bulletin-list.tsx` e o cabeçalho do módulo: conferir que nada lê `taxes_paid_cents`

## 6. PDF e site

- [x] 6.1 `src/lib/pdf.ts`: o corpo do PDF do boletim segue a pré-visualização do 5.4, lendo a opção vigente na hora de gerar; saldo negativo exibido como tal
- [x] 6.2 `src/app/(public)/transparencia/page.tsx`: aviso fixo do § 3º-B na seção do boletim, visível também no estado vazio
- [x] 6.3 Conferir no navegador, pelo host de uma serventia: formulário e pré-visualização com a opção ligada e desligada, publicação, PDF e o aviso na página pública

## 7. Entrega

- [x] 7.1 Contar os boletins em produção (eram 20, de Bom Jesus: ver grupo 8); aplicar a migração no Homolog (pooler, porta 5432) e em produção (`POSTGRES_URL_NON_POOLING`) antes do merge
- [x] 7.2 Abrir o PR

## 8. Boletins no formato anterior

- [x] 8.1 Núcleo: `legacyBulletinView` (atos, total de tributos e, com a opção, arrecadação, despesas e saldo); teste
- [x] 8.2 `bulletinFiguresOf` distingue linha nova (fundos válidos), antiga (fundos vazios e total de tributos gravado) e malformada; `upsertBulletinWith` zera `taxes_paid_cents` ao gravar no formato novo; testes em PGlite com uma linha no formato antigo
- [x] 8.3 Rota e PDF: desenhar o boletim antigo com a nota de formato anterior; comentário de `taxes_paid_cents` no schema explica que a coluna fica
- [x] 8.4 Conferir no Homolog com um boletim no formato antigo, com a opção ligada e desligada
- [x] 8.5 Migrar a produção
