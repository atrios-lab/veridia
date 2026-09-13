## 1. Motivo real exibido em componente próprio, fora do card de instruções

- [x] 1.1 Em `protocol-trilho.tsx`, criar `RejectionReason({ result, protocolNumber, accessKey })`
      com o rótulo "Motivo", o texto de `result.statusReason` (fallback "Motivo não informado."
      quando ausente e sem documento) e, quando `result.rejectionDocumentAttachmentId` existir, o
      botão de download — reaproveitando o mesmo `form action="/protocolo/documento"` já usado em
      outros downloads da página.
- [x] 1.2 Simplificar `RejectedCard` para receber só `result` (sem `protocolNumber`/`accessKey`,
      que migraram para `RejectionReason`) e remover dele o texto do motivo.

## 2. Orientação de refazer o pedido (só Indeferido)

- [x] 2.1 Dentro de `RejectedCard`, exibir a orientação de refazer o pedido de forma adequada à
      solicitação apenas quando `result.requestStatus === "rejected"` (não para `"cancelled"`).
- [x] 2.2 Manter a menção ao atendimento online/balcão para dúvidas, já existente no card.

## 3. Remover a afirmação de motivo "enviado"

- [x] 3.1 Em `computeHeadline`, trocar o `leadText` do ramo `rejected` para não afirmar envio de
      mensagem nem referenciar a posição do motivo na página.
- [x] 3.2 Em `buildLog`, trocar o `sub: "Enviamos o motivo para você."` do evento de
      indeferimento/cancelamento pelo texto revisado (sem afirmar envio).
- [x] 3.3 Revisar se sobra alguma outra ocorrência de "enviamos"/"explicamos o motivo" ligada ao
      indeferimento em `protocol-trilho.tsx` e ajustar.

## 4. Layout: alerta em cima, motivo em largura total, parágrafos preservados

- [x] 4.1 Para o desfecho `rejected` (indeferido ou cancelado), substituir a grade de duas colunas
      (`md:grid-cols-2`) por uma pilha de largura total: headline, `RejectedCard` (instruções),
      `RejectionReason` (motivo), `leadText`, prazo e exigências resolvidas/pendentes, nessa
      ordem. A grade de duas colunas permanece inalterada para todo o resto dos status.
- [x] 4.2 Extrair a lista de `RequirementCard` de exigências pendentes para uma variável
      (`pendingRequirementCards`) computada uma vez, reaproveitada nos dois ramos (rejeitado e
      grade padrão), evitando duplicar o callback `onSent`.
- [x] 4.3 Em `RejectionReason`, quebrar `result.statusReason` em parágrafos por linha em branco
      (`splitParagraphs`, split em `\n\s*\n`) e renderizar cada um como `<p>` próprio, com
      `text-justify`, em vez de um bloco único.

## 5. Verificação

- [x] 5.1 Rodar `pnpm tsc --noEmit` para conferir os componentes e a reestruturação do layout.
- [x] 5.2 Rodar a suíte de testes existente (`node --test`) para garantir que nada quebrou.
- [x] 5.3 Subir o app localmente, indeferir um pedido de teste com motivo curto, depois com motivo
      longo e com parágrafos separados por linha em branco, e conferir em `/acompanhar` que: o
      card de instruções aparece antes do motivo; o motivo ocupa a largura total da página; o
      texto está justificado; cada parágrafo separado por linha em branco aparece como bloco
      distinto; a orientação de refazer o pedido só aparece para indeferido, nunca para cancelado.
      Feito com um pedido real criado no banco de dev (REQ.2026.000397, chave
      3BQT-49VX-PRHD), indeferido três vezes pelo painel admin (motivo curto, motivo longo em um
      só parágrafo, motivo com três parágrafos separados por linha em branco) — confirmado
      visualmente em todos os casos. Registro mantido a pedido do usuário para conferência. Casos
      com PDF anexado e sem motivo/documento não foram testados manualmente (mesmo caminho de
      código, coberto pela leitura do `protocol-lookup.tsx`, que já usa esse padrão em produção).
