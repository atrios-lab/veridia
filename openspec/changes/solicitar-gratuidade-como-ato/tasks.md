## 1. Preparar o terreno

- [x] 1.1 Arquivar `add-fee-exemption-request` (`openspec archive add-fee-exemption-request`), que já foi mergeada: o requisito desta change é `MODIFIED` sobre o que aquela adicionou, e sem sincronizar a spec principal o delta não encontra o bloco que altera.

## 2. Catálogo

- [x] 2.1 Em `src/core/acts/catalog.ts`, `exemptableActs(tenant, attribution)`: os atos daquela atribuição que o cartório oferece e que têm `feeExemption`.
- [x] 2.2 `exemptionAct(attribution)`, no padrão de `otherAct`: id `gratuidade-<atribuição minúscula>`, nome "Solicitar gratuidade (isento)", `processingMode: "online"`, `requiresPurpose: false`, sem `legalDeadlineDays` (o prazo é o do ato-alvo, tarefa 4.3). Ensinar `getAct` a reconhecer o prefixo, como já faz com `outros-`.
- [x] 2.3 `actsOfAttribution` acrescenta a entrada da gratuidade quando `exemptableActs` não é vazio, antes da entrada "Outro ato desta área".
- [x] 2.4 No comentário de `feeExemption`, dizer que marcar o campo agora também acrescenta o ato à lista da gratuidade.

## 3. Formulário público

- [x] 3.1 Em `src/core/request/form.ts`, trocar `exemptionRequested` por `exemptionActId`: obrigatório quando o ato é o da gratuidade, recusado em qualquer outro, e recusado quando aponta ato sem `feeExemption` ou de outra atribuição.
- [x] 3.2 Em `request-form.tsx`, remover o bloco do checkbox dos atos isentáveis e criar o bloco do ato da gratuidade: a escolha do ato (radio, os isentáveis da atribuição), a base legal do ato escolhido, a declaração e a lista de documentos, todos já existentes.
- [x] 3.3 Manter a recusa no cliente de envio sem anexo, agora condicionada ao ato da gratuidade em vez do checkbox.
- [x] 3.4 Em `actions.ts`, gravar `details.exemption = { declaredAt, actId }`; a contagem de anexos passa a olhar o ato, não o campo removido.

## 4. Registro do pedido

- [x] 4.1 Em `src/core/request/kinds.ts`, `exemption` ganha `actId` opcional, e `readExemption` devolve os dois.
- [x] 4.2 Em `src/core/request/requerimento.ts`, a seção da gratuidade nomeia o ato pedido quando ele existe, e omite a linha quando não (pedido antigo).
- [x] 4.3 No protocolo, o prazo legal do pedido de gratuidade vem do ato-alvo: onde se lê `act.legalDeadlineDays`, o ato sintético resolve para o ato que a isenção pede.

## 5. Painel

- [x] 5.1 Na tela do pedido, "Gratuidade solicitada (ISENTO)" passa a dizer qual ato, com a data; pedido sem `actId` mostra só o que tem.

## 6. Testes

- [x] 6.1 Núcleo (catálogo): a entrada da gratuidade aparece no RCPN e não aparece em atribuição sem ato isentável; `getAct` resolve o id sintético; a lista de atos-alvo é exatamente `rcpn-certidao` e `rcpn-habilitacao-casamento`.
- [x] 6.2 Núcleo (form): gratuidade sem ato-alvo é recusada; com ato-alvo sem `feeExemption` é recusada; `exemptionActId` num ato comum é recusado; ato comum segue sem exigência nova.
- [x] 6.3 Núcleo (requerimento): o PDF nomeia o ato pedido; um pedido antigo sem `actId` sai sem a linha e sem quebrar.
- [x] 6.4 Núcleo (prazo): o pedido de gratuidade de certidão nasce com os 5 dias úteis da Lei 6.015 art. 19, não com o padrão do cartório.
- [x] 6.5 Atualizar os testes da change anterior que afirmam que o checkbox existe no formulário da certidão.
- [x] 6.6 E2e sem banco: a entrada aparece na lista do Registro Civil; abrir a gratuidade pede o ato; enviar sem ato, sem declaração e sem anexo bloqueia no cliente com os erros certos; o formulário da certidão não oferece mais gratuidade.
- [x] 6.7 Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `check:dashes`, `check:tokens`, `check:a11y`; o e2e que grava fica para o CI.

## 7. Fechamento

- [ ] 7.1 Confirmar com a serventia o rótulo da entrada e o texto de apoio na lista, e a questão aberta do design: se a habilitação isenta continua pedindo os documentos dos nubentes.
- [ ] 7.2 Abrir PR referenciando o pedido do Joelison e o SCRUM-11; merge é decisão do Vinícios.
- [ ] 7.3 Depois do merge, `openspec archive solicitar-gratuidade-como-ato`.
