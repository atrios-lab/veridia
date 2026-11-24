## Decisões

**Uma tabela para tudo.** `appointment_messages` guarda exigências (`requirement`), mensagens
(`message`) e a abertura e o fechamento das perguntas (`open` / `close`). Se as perguntas estão
abertas é o último `open`/`close` visível; assim o histórico de quem abriu e fechou fica no
próprio registro, sem coluna nova em `appointments`.

**Nada sai do banco.** Editar guarda o texto anterior em `history`; apagar grava `hidden_at`.
Cada ato vai para a auditoria com rótulo em português. Apagar pede confirmação e justificativa,
porque o efeito chega ao cliente.

**O cliente escreve só com as perguntas abertas** e o agendamento ainda por vir, pela consulta
com protocolo e chave, com o mesmo campo invisível contra robôs e o mesmo limite de envios das
outras escritas públicas. A exigência é respondida com documentos, pelo envio que já existia.

**O cartório fala como "Cartório"** na consulta: o nome do funcionário fica só no painel.
