## 1. Catálogo e texto da declaração

- [x] 1.1 Em `src/core/acts/catalog.ts`, trocar `FEE_EXEMPTION_DECLARATION` pelo parágrafo do
  bloco 4 do Anexo I (insuficiência de recursos sem prejuízo da manutenção própria e da família)
  e adicionar `FEE_EXEMPTION_ACKNOWLEDGEMENTS`, a lista das cinco ciências (a) a (e); remover
  `FEE_EXEMPTION_DOCUMENTS` e o comentário que a justifica.
- [x] 1.2 Ampliar `Act.feeExemption` para `{ legalBasis, beneficiaryCount: 1 | 2,
  askCertificateType?: true }`; `rcpn-certidao` recebe `askCertificateType: true` e
  `beneficiaryCount: 1`, `rcpn-habilitacao-casamento` recebe `beneficiaryCount: 2`. Exportar
  `CERTIFICATE_TYPES` (`sem-busca`, `com-busca`, `inteiro-teor`) com rótulos.
- [x] 1.3 Renomear `rcpn-alteracao-prenome` para "Alteração de prenome" (mesmo `id`, mesmo
  `guidance`) e dar-lhe `feeExemption` com base "Lei 6.015 art. 30 §1º; Provimento CGJ/TJRN
  n. 7/2026, Anexo I" e `beneficiaryCount: 1`.
- [x] 1.4 Atualizar `src/core/acts/catalog.test.ts`: os três atos-alvo do RCPN, o tipo de
  certidão só na certidão, dois beneficiários só na habilitação, e o texto da declaração sem
  "CadÚnico".

## 2. Dados da declaração no pedido

- [x] 2.1 Em `src/core/request/kinds.ts`, estender o schema de `exemption` conforme o design
  (decisão 1): `certificateType`, `beneficiaries[]` com `signedBy`, `signer`, `witnesses`, e
  `decision`; tudo opcional além de `declaredAt`, para o formato antigo continuar válido.
- [x] 2.2 Fazer `readExemption` devolver o formato novo normalizado (`beneficiaries: []` para o
  antigo) e exportar os tipos `ExemptionDeclaration`, `ExemptionBeneficiary`,
  `ExemptionDecision`; testes em `kinds.test.ts` com um pedido v1 e um v2.
- [x] 2.3 Em `src/core/request/form.ts`, criar `readExemptionForm(formData)` que lê os campos
  planos indexados (`beneficiary[0].name`, `beneficiary[0].signer.name`,
  `beneficiary[0].witness[1].name`, `certificateType`, `exemptionActId`,
  `exemptionDeclaration`) num objeto, e `buildExemptionDetails(parsed, consentedAt)` que monta
  `details.exemption`; ambos usados por site e balcão.
- [x] 2.4 Em `actRules(act, { channel })`, validar: ato-alvo isentável; `certificateType`
  obrigatório se o alvo pede e recusado se não pede; `beneficiaries.length ===
  beneficiaryCount`; nome do beneficiário obrigatório; `signer.name` obrigatório quando
  `signedBy !== "self"`; `witnesses` recusadas no canal `online` e obrigatórias (duas) no
  `counter` quando `signedBy === "on-behalf"`; declaração marcada. Mensagens em português por
  campo, com `path` apontando o campo indexado.
- [x] 2.5 Atualizar `src/core/request/request.test.ts`: certidão sem tipo, habilitação com uma
  declaração só, representante sem nome, a rogo online com testemunhas, a rogo no balcão sem
  testemunhas, e o caminho feliz de cada canal.

## 3. Site: formulário da gratuidade

- [x] 3.1 Em `src/app/(public)/solicitar/request-form.tsx`, substituir o bloco atual da
  gratuidade: radio do ato-alvo (agora três), tipo de certidão quando o alvo pede, aviso da
  primeira via de nascimento/óbito, um componente `BeneficiaryFields` por beneficiário (nome
  obrigatório; CPF/RG, nascimento, profissão, endereço, município/UF, CEP, contato opcionais),
  radio "quem formaliza" (própria pessoa, representante legal, a rogo) abrindo os campos de
  quem assina, e o checkbox com o texto da declaração e as cinco ciências na íntegra. Remover o
  bloco "Anexe o comprovante" e o `DocumentsChecklist` da gratuidade.
- [x] 3.2 Na habilitação de casamento, renderizar o segundo `BeneficiaryFields` como bloco
  dobrável "Segundo nubente", com os mesmos campos indexados em `[1]`.
- [x] 3.3 Em `src/app/(public)/solicitar/actions.ts`, remover o bloqueio por
  `countAttachments === 0`, ler a declaração com `readExemptionForm`, validar com
  `publicServiceRequestSchema(act)` (canal `online`) e gravar com `buildExemptionDetails`;
  mapear os erros indexados para os campos da tela.
- [x] 3.4 Adicionar o link "Baixar o formulário em branco (PDF)" na tela do ato da gratuidade e
  na lista de atos do RCPN em `src/app/(public)/solicitar/page.tsx`.

## 4. A declaração em PDF

- [x] 4.1 Em `src/core/request/requerimento.ts`, adicionar `fields?: { label: string; value?:
  string }[]` a `RequerimentoSection` e, em `src/lib/pdf.ts`, ensinar `drawSection` a desenhar
  rótulo + linha em branco (ou valor sobre a linha) para cada campo, e um marcador ☒/☐ como
  texto.
- [x] 4.2 Criar `src/core/request/declaracao.ts` com `buildDeclaracao(tenant, act, exemption |
  undefined, beneficiaryIndex, { protocolNumber?, createdAt? })` devolvendo um
  `RequerimentoDocument` com os nove blocos do Anexo I (design, decisão 5): bloco 1 do tenant,
  2 do beneficiário, 3 com o ato marcado e tipo de certidão, 4 com declaração e ciências, 5
  assinatura, 6/7 só quando houver, 8 testemunhas ou em branco, 9 sempre em branco, base
  normativa no rodapé; `exemption` ausente gera o formulário em branco.
- [x] 4.3 `buildDeclaracoes(...)` que devolve um documento por beneficiário, e `renderDocuments`
  em `pdf.ts` (ou extensão de `renderDocument`) que concatena vários no mesmo PDF.
- [x] 4.4 Criar `src/core/request/declaracao.test.ts`: em branco, própria pessoa, representante
  legal, a rogo com e sem testemunhas, habilitação com dois documentos, pedido v1 (tudo em
  branco menos ato e data), e ausência de "CadÚnico" e da chave de acesso no conteúdo.
- [x] 4.5 Em `src/app/(public)/solicitar/requerimento/route.ts`, aceitar `documento=declaracao`
  com a mesma exigência de chave, respondendo 404 em pedido sem `exemption`.
- [x] 4.6 Criar `src/app/(public)/solicitar/declaracao-hipossuficiencia/route.ts` (GET, sem
  estado) que devolve o formulário em branco com a marca do tenant, 404 sem atribuição RCPN.
- [x] 4.7 Oferecer o botão "Baixar declaração de hipossuficiência (PDF)" na tela de sucesso
  (`request-form.tsx`) e na consulta (`acompanhar/protocol-trilho.tsx`) só quando o pedido tem
  gratuidade, com o mesmo padrão de envio da chave dos outros dois botões.

## 5. Balcão

- [x] 5.1 Em `src/app/admin/(dashboard)/pedidos/novo/manual-entry-form.tsx`, renderizar o bloco
  da gratuidade quando `act.exemptionTargets` existe, reaproveitando os campos do site
  (ato-alvo, tipo de certidão, `BeneficiaryFields` por beneficiário, quem formaliza) mais os
  campos das duas testemunhas quando a rogo; `FieldError` para cada campo novo; link para o
  formulário em branco.
- [x] 5.2 Em `pedidos/novo/actions.ts`, ler com `readExemptionForm`, validar com
  `serviceRequestSchema(act)` (canal `counter`) e gravar com `buildExemptionDetails`; mapear
  erros indexados para a tela.
- [x] 5.3 Na `SuccessScreen` do balcão, oferecer "Imprimir declaração" ao lado de "Imprimir
  requerimento" quando o pedido tem gratuidade.
- [x] 5.4 Em `pedidos/[protocolo]/imprimir/route.ts`, aceitar `?documento=declaracao` na GET com
  a mesma sessão, 404 sem `exemption`, auditoria `service-request.print.declaracao`; e
  `?documento=declaracao-em-branco` para o formulário avulso. Rotular a ação no histórico em
  `pedidos/[protocolo]/page.tsx` ("imprimiu a declaração de hipossuficiência").
- [x] 5.5 No detalhe (`pedidos/[protocolo]/page.tsx`), oferecer os dois links de impressão da
  declaração ao lado do requerimento, só em pedido com gratuidade.

## 6. Desfecho da gratuidade no painel

- [x] 6.1 Em `src/lib/service-request.ts`, `setExemptionDecision(tenantSlug, id, outcome | null,
  actorId)`: merge de `exemption.decision` no jsonb (ou remoção quando `null`), recusa em pedido
  sem `exemption`, auditoria `service-request.exemption-decision` com o desfecho nos detalhes.
- [x] 6.2 Em `pedidos/[protocolo]/actions.ts`, `setExemptionDecisionAction` exigindo
  `requests.manage` e validando o desfecho com Zod (`granted`, `referred`, `denied`,
  `installments`, ou vazio para remover).
- [x] 6.3 Componente `ExemptionDecision` ao lado da pill em `status-section.tsx`/`page.tsx`:
  seletor com os quatro desfechos e "sem decisão"; a pill passa a dizer o desfecho com a data
  quando há um. Rótulo do evento no histórico ("registrou o desfecho da gratuidade: concedida").
- [x] 6.4 Teste do core para a rotulagem do desfecho (`kinds.test.ts`) e e2e em
  `e2e/admin-service-requests.spec.ts`: registrar, ver na pill e no histórico, remover, e
  recusar em pedido sem gratuidade.

## 7. Transparência e requerimento

- [ ] 7.1 Em `src/core/transparency/documents.ts`, adicionar "Cartaz de gratuidade e isenção" a
  `DOCUMENT_CATEGORIES`; ajustar `documents.test.ts`.
- [ ] 7.2 Em `requerimento.ts`, a declaração impressa no requerimento passa a citar o novo texto
  e a remeter à declaração de hipossuficiência anexa ("conforme declaração de hipossuficiência
  que acompanha este requerimento"), sem repetir os nove blocos; `requerimento.test.ts`
  atualizado.

## 8. E2E e fechamento

- [ ] 8.1 Atualizar `e2e/service-request.spec.ts`: o bloco da gratuidade cobra ato, tipo de
  certidão e declaração, não anexo; representante legal e a rogo abrem os campos certos;
  habilitação pede dois nubentes; o botão da declaração aparece na tela de sucesso e o download
  exige a chave; o formulário em branco abre sem pedido.
- [ ] 8.2 Atualizar `e2e/admin-service-requests.spec.ts`: lançar gratuidade no balcão (com
  testemunhas quando a rogo), imprimir a declaração escreve na auditoria, o detalhe oferece os
  links só com gratuidade.
- [ ] 8.3 Rodar `pnpm typecheck`, `pnpm check:dashes` (sem travessão em `.ts/.tsx`) e os testes
  tocados com `node --test`.
- [ ] 8.4 Conferir no navegador, lado a lado com o Anexo I do DJe: PDF em branco, preenchido pela
  própria pessoa, a rogo pelo site (bloco 8 em branco) e a rogo pelo balcão (bloco 8
  preenchido), habilitação com dois documentos; e o cartaz publicado na transparência.
- [ ] 8.5 Registrar em nota de fechamento o que ficou para a serventia: substituir o formulário
  físico antigo pelo em branco do painel e afixar o cartaz (art. 14), e a dúvida sobre
  livro/folha/termo (design, Open Questions).
