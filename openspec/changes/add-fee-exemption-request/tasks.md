## 1. Núcleo

- [x] 1.1 Em `src/core/acts/catalog.ts`, acrescentar `feeExemption?: { legalBasis: string }` à interface `Act`, com comentário dizendo que ausente significa "sem previsão de isenção", e o texto da declaração exportado (`FEE_EXEMPTION_DECLARATION`), com CP art. 299 e CC arts. 186 e 927 escritos nele.
- [x] 1.2 Marcar os dois atos: `rcpn-certidao` (CF art. 5º LXXVI; Lei 6.015 art. 30 §1º, red. Lei 9.534/97) e `rcpn-habilitacao-casamento` (CC art. 1.512, parágrafo único).
- [x] 1.3 Em `src/core/request/form.ts`, acrescentar `exemptionRequested` e `exemptionDeclaration` a `publicServiceRequestSchema`, e as duas regras em `actRules`: marcado sem declaração aponta a declaração; marcado em ato sem `feeExemption` é recusado.
- [x] 1.4 Em `src/core/request/kinds.ts`, acrescentar `exemption: z.object({ declaredAt: isoInstant }).optional()` a `serviceRequestDetailsSchema`, com um leitor `readExemption` no padrão de `readPhone`.
- [x] 1.5 Em `src/core/request/requerimento.ts`, `RequerimentoData` ganha o sinal da gratuidade e o PDF ganha a seção com o texto da declaração, presente só quando solicitada.

## 2. Formulário público

- [x] 2.1 Em `request-form.tsx`, renderizar o bloco da gratuidade apenas quando `act.feeExemption` existe: o checkbox "Solicitar gratuidade (ISENTO)", e, ao marcá-lo, a declaração específica e o aviso de que a documentação do benefício deve ser anexada.
- [x] 2.2 No envio com gratuidade marcada, recusar no cliente quando não há nenhum anexo, antes de qualquer upload, com mensagem apontando o bloco de anexos.
- [x] 2.3 Em `actions.ts`, contar as entradas `anexos` com bytes e as `anexosRef` do FormData antes de armazenar; gratuidade sem anexo é erro de campo. Gravar `details.exemption = { declaredAt }` junto dos consents.
- [x] 2.4 Passar o sinal da gratuidade às duas rotas que montam o requerimento (pública e do painel), lendo de `details`.

## 3. Painel

- [x] 3.1 Na tela do pedido (`pedidos/[protocolo]/page.tsx` + seção adequada), mostrar "Gratuidade solicitada (ISENTO)" com a data da declaração, visível sem abrir nada.
- [x] 3.2 Não mexer em `amountCents` nem sugerir valor: conceder é decisão do operador (não-objetivo).

## 4. Testes

- [x] 4.1 Núcleo: gratuidade sem declaração é recusada; com declaração passa; em ato sem `feeExemption` é recusada mesmo com tudo marcado; pedido sem gratuidade não exige nada novo.
- [x] 4.2 Núcleo: o texto da declaração cita CP art. 299, e os dois atos isentáveis são exatamente `rcpn-certidao` e `rcpn-habilitacao-casamento`.
- [x] 4.3 Núcleo (requerimento): o PDF de um pedido com gratuidade carrega a declaração; o de um pedido sem, não.
- [x] 4.4 E2e sem banco: a opção aparece na certidão e não aparece num ato sem isenção; marcar e enviar sem declaração e sem anexo bloqueia no cliente com os erros certos.
- [x] 4.5 Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `check:dashes`, `check:tokens`, `check:a11y`; o e2e que grava fica para o CI.

## 5. Fechamento

- [ ] 5.1 Confirmar com a serventia o texto da declaração e as bases legais: o texto sai em documento assinado, a palavra final é do cartório.
- [x] 5.2 Abrir PR referenciando SCRUM-11; merge é decisão do Vinícios.
- [ ] 5.3 Depois do merge, `openspec archive add-fee-exemption-request`.
