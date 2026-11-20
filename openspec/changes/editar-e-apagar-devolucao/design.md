## Decisions

- **Funções puras** `editReturnReason` e `withdrawReturn` recebem a conferência atual e devolvem a nova, com o texto anterior em `history`. Só uma devolução pode ser editada ou apagada; qualquer outro caso gera `SignedFormCheckError`, com a mensagem em português.
- **Apagar = desfazer**: o veredito volta para `review` e o `returnedReason` sai da conferência. O pedido continua aguardando o requerimento assinado, e o texto fica no histórico.
- **Histórico preservado**: quando a conferência gravada não traz histórico, `saveSignedFormCheckWith` copia o histórico que já estava no pedido. Assim, uma nova leitura não perde o que foi editado.
- **Auditoria**: `service-request.signed-form-return-edited` (com o texto novo) e `service-request.signed-form-return-withdrawn`.
