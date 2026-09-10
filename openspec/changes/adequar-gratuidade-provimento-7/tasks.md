## 1. Catálogo: separar nascimento/óbito de outras certidões

- [x] 1.1 Em `src/core/acts/catalog.ts`, dividir o item `rcpn-certidao` em dois: manter o `id`
      `rcpn-certidao` renomeado para "Certidão de casamento e demais certidões do RCPN" (mesma
      `legalBasis`, `feeExemption` inalterado), e criar `rcpn-certidao-nascimento-obito` —
      "Certidão de nascimento ou óbito", `identificationOnly: true`, `legalDeadlineDays: 5`,
      mesma `legalDeadlineNote`, `requiresPurpose: false`, **sem** `feeExemption`, com
      `legalBasis: "Lei 6.015 art. 30 §1º (red. Lei 9.534/97)"`.
- [x] 1.2 Posicionar o item novo logo antes (ou depois) de `rcpn-certidao` na lista `ACTS`, mantendo
      a ordem que a tela "Escolha o ato" hoje usa para o Registro Civil.
- [x] 1.3 Conferir que `exemptableActs`/`exemptionAct` (mesmo arquivo, ~linhas 499-528) continuam
      corretos sem alteração: eles já filtram por `feeExemption`, então o item novo (sem
      `feeExemption`) fica de fora da lista de alvos da gratuidade automaticamente.
- [x] 1.4 Atualizar `src/core/acts/catalog.test.ts` (ou equivalente) com casos que confirmem: (a)
      `rcpn-certidao-nascimento-obito` nunca aparece em `exemptableActs`/`exemptionTargets`; (b)
      `rcpn-certidao` (casamento/demais) continua aparecendo.

## 2. Declaração de hipossuficiência: anexo vira opcional

- [x] 2.1 Em `src/app/(public)/solicitar/actions.ts` (~linha 160), remover o bloqueio que recusa o
      pedido quando `act.exemptionTargets && countAttachments(formData) === 0`.
- [x] 2.2 Em `src/app/(public)/solicitar/request-form.tsx` (~linhas 489-499), trocar o texto da
      caixa de anexo: título deixa de ser instrução ("Anexe acima o comprovante") e passa a dizer
      que o anexo é opcional; remover a frase "Sem documento a serventia não consegue conferir".
- [x] 2.3 Atualizar `FEE_EXEMPTION_DOCUMENTS`/comentários em `src/core/acts/catalog.ts` (~linhas
      158-180) para refletir que a lista é de documentos que ajudam quando existem, não requisito.
- [x] 2.4 Atualizar testes de `actions.ts`/`form.ts` que hoje esperam erro de "anexos" quando não
      há arquivo: o pedido deve passar a ser aceito sem anexo, com a declaração marcada.
      (Não havia teste unitário desse bloqueio — só o e2e `e2e/service-request.spec.ts`, já
      atualizado.)

## 3. Quem assina a declaração: beneficiário, representante legal ou a rogo

- [x] 3.1 Em `src/core/request/form.ts`, adicionar ao objeto de campos da gratuidade:
      `exemptionSignedBy` (`z.enum(["beneficiario", "representante", "rogo"]).default("beneficiario")`)
      e `exemptionSignerName` (texto opcional, ~160 chars). Em `actRules` (~linha 194-216), quando
      `act.exemptionTargets` e `exemptionSignedBy !== "beneficiario"`, exigir `exemptionSignerName`
      preenchido, com mensagem apontando o campo.
- [x] 3.2 Repetir a leitura desses dois campos em `publicServiceRequestSchema` (o pedido público é
      o único caminho que oferece gratuidade, como o comentário já existente documenta).
- [x] 3.3 Em `src/app/(public)/solicitar/request-form.tsx`, dentro do bloco `exemptionTargets`
      (~linha 452-502), adicionar um `fieldset` de rádio "Quem assina esta declaração?" com as três
      opções, e um campo de nome condicional às duas últimas.
- [x] 3.4 Em `src/app/(public)/solicitar/actions.ts`, incluir os dois campos novos no
      `formData.get(...)` passado ao `safeParse` (~linha 121-133) e gravá-los em
      `details.exemption` junto com `declaredAt`/`actId` (~linha 208-213), só quando
      `exemptionSignedBy !== "beneficiario"`.
- [x] 3.5 Em `src/core/request/kinds.ts`, ampliar o schema de `exemption` (~linha 398-400) com
      `signedBy` e `signerName` opcionais, e `readExemption` (~linha 416-429) para devolvê-los;
      ausência continua lida como "não informado", nunca inventada.
- [x] 3.6 Em `src/core/request/requerimento.ts`, quando `data.exemption` trouxer `signedBy !==
      "beneficiario"`, imprimir na seção "Declarações" a identificação separada do beneficiário e
      de quem assina (nome + qualidade: representante legal / assinatura a rogo). Quando
      `signedBy === "rogo"`, adicionar a nota de leitura em voz alta e explicação ao beneficiário,
      e reservar duas linhas de assinatura de testemunha (novo campo, ex. `witnessLines` no
      `RequerimentoDocument`, desenhado só para esse caso).
- [x] 3.7 Ajustar o(s) renderizador(es) de PDF do requerimento (onde `RequerimentoDocument` vira
      arquivo) para desenhar as linhas de testemunha quando presentes. (`src/lib/pdf.ts`)
- [x] 3.8 Testes: `requerimento.test.ts` ganha casos para representante legal (nome separado, sem
      testemunhas) e a rogo (nome separado, duas linhas de testemunha, nota de leitura em voz
      alta) — inspirados no padrão já existente ("Sem pedir, nada disso aparece").

## 4. Painel do operador

- [x] 4.1 Em `src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx` (~linhas 186-278), o badge de
      gratuidade passa a mostrar, quando houver, quem assinou e a qualidade (representante
      legal/a rogo), além do que já mostra hoje.

## 5. Cartaz de transparência (Anexo II do Provimento)

- [x] 5.1 Em `src/core/transparency/documents.ts`, adicionar `"Cartaz de gratuidade e isenção"` a
      `DOCUMENT_CATEGORIES`.
- [x] 5.2 Atualizar `src/core/transparency/documents.test.ts` com o novo valor em
      `isDocumentCategory`.
- [x] 5.3 Conferir que a tela de upload do painel (`src/app/admin/(dashboard)/transparencia/`) já
      lista a categoria nova sem mudança adicional (ela lê `DOCUMENT_CATEGORIES` diretamente). —
      confirmado: `document-form.tsx` mapeia `DOCUMENT_CATEGORIES` sem lista própria.

## 6. Fechamento

- [x] 6.1 Rodar a suíte de testes (`node --test`) cobrindo `src/core/acts`, `src/core/request`,
      `src/core/transparency` e a rota `solicitar`. — 516/516 testes passando; `pnpm typecheck` e
      `pnpm lint` limpos nos arquivos tocados por esta change.
- [x] 6.2 Verificar manualmente no navegador: (a) pedido de certidão de nascimento não mostra mais
      opção de gratuidade em nenhum lugar do fluxo; (b) pedido de gratuidade para casamento é
      aceito sem anexo; (c) escolher "assinatura a rogo" exige o nome de quem assina e aparece no
      requerimento gerado com as linhas de testemunha. — confirmado ao vivo: nascimento/óbito sem
      qualquer menção a gratuidade; anexo com texto "opcional"; alternar entre beneficiário/
      representante legal/rogo mostra e esconde o campo de nome e a nota de testemunhas
      corretamente; cobertura equivalente no requerimento impresso confirmada por
      `requerimento.test.ts`.
- [ ] 6.3 Deixar registrada, em nota de fechamento (como as changes anteriores fizeram), a
      pendência de confirmar com a serventia se pedidos de certidão de nascimento/óbito feitos
      pelo site são sempre "primeira via" (ver Open Question do design.md) — sem isso, não travar a
      implementação: o comportamento atual (sempre gratuito, sem formulário) é a leitura literal do
      art. 3º §1º do Provimento.
