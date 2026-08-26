## 1. Auditoria das emissões

- [x] 1.1 Em `imprimir/route.ts`, chamar `recordAudit` depois de o documento ser produzido com
      sucesso, nos dois métodos, com verbos distintos no padrão já usado pelo módulo
      (`service-request.print.requerimento` e `service-request.print.comprovante`),
      `targetType: "service-request"` e o protocolo como `targetId`
- [x] 1.2 Garantir que nenhum caminho de recusa (sem sessão, sem `requests.manage`, protocolo
      inexistente, chave errada) grave entrada: o registro vem depois do documento, nunca antes
- [x] 1.3 Teste do caminho de auditoria: uma emissão bem-sucedida grava; uma recusada não

## 2. Botão no detalhe do pedido

- [x] 2.1 Ligar a ação de imprimir o requerimento no detalhe (`pedidos/[protocolo]`), apontando
      para o GET da rota que já existe, abrindo em aba nova para o operador imprimir de lá
- [x] 2.2 Conferir se o pedido não é `service-request` (a rota recusa) e não oferecer a ação
      nesses casos, em vez de oferecer um botão que responde 404

## 3. Comprovante na chave recém-emitida

- [x] 3.1 Em `key-section.tsx`, quando `state.status === "success"`, oferecer a impressão do
      comprovante: form que faz POST da chave para a rota, com `target` em aba nova
- [x] 3.2 Conferir que a ação some quando a chave não está mais em claro (é o estado `idle`, que
      já mostra os pontinhos)

## 4. Tela de sucesso do lançamento manual

- [x] 4.1 Em `pedidos/novo/actions.ts`, devolver no estado de sucesso o nome do requerente e o
      nome do ato, além de protocolo e chave
- [x] 4.2 Em `manual-entry-form.tsx`, identificar o pedido na tela de sucesso (requerente e ato)
- [x] 4.3 Oferecer as duas impressões individualmente, pelos mesmos caminhos das tarefas 2 e 3
- [x] 4.4 Oferecer "imprimir os dois", decidindo o comportamento no momento da implementação:
      duas abas é o caminho direto, mas bloqueadores de pop-up recusam a segunda — se for o caso,
      encadear as aberturas a partir do clique
- [x] 4.5 Oferecer copiar protocolo e chave juntos, com confirmação visível de que copiou

## 5. Verificação

- [x] 5.1 Rever `e2e/service-request.spec.ts`: o comentário "the route is the gate, not the button
      that links to it" deixa de valer, e o teste pode passar a acionar o botão
- [x] 5.2 No painel rodando: lançar um pedido manual, imprimir os dois, conferir que os PDFs saem
      com o conteúdo de hoje e que as duas entradas aparecem em `audit_log`
- [ ] 5.3 Conferir o outro caminho: emitir nova chave num pedido existente, imprimir o
      comprovante dali, recarregar e ver a ação sumir
- [x] 5.4 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:dashes`
