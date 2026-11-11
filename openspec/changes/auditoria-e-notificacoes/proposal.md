## Why

O Tabelião/Registrador precisa ver em detalhe o que cada pessoa fez no painel. Quando um ato precisa de
explicação, ele tem de pedir esclarecimentos por escrito, com fundamento legal, um prazo e um registro
do que foi pedido e respondido. A conta da Átrios precisa ver a auditoria de todas as serventias.

## What Changes

- **Aba Auditoria no painel**, para todos os cargos, com conteúdo que depende de quem entra:
  - **Tabelião/Registrador** (`audit.manage`):
    - vê a trilha completa da serventia, com filtros por pessoa, período e texto;
    - anota em cada registro (os registros em si nunca mudam);
    - marca registros para gerar o PDF (imprimir ou salvar), enviar o relatório por e-mail ou notificar a
      pessoa.
  - **Demais cargos:** veem só as notificações endereçadas a eles e respondem por lá.
  - **Conta mestre da Átrios:** vê a trilha de qualquer serventia, ou de todas juntas, sem restrição.
- **Notificação formal para esclarecimentos:**
  - numerada por ano na série `notificacao` (001/2026), que aparece em Configurações › Numeração;
  - traz os fatos, os atos marcados, a fundamentação (CF art. 5º, LV; Lei 8.935/1994, arts. 20 e 21;
    CLT art. 2º; LGPD arts. 37 e 46), editável a cada caso, e o pedido de resposta em 24 horas;
  - aceita imagens e provas anexadas;
  - vai por e-mail para a conta da pessoa, com o PDF no timbre da serventia;
  - o Tabelião/Registrador pode reenviar, imprimir, assinar digitalmente com o certificado A1 (assinador
    ICP-Brasil) e encerrar com uma conclusão;
  - a pessoa responde com texto e anexos, uma única vez. O titular recebe um e-mail quando a resposta
    chega;
  - o item Auditoria mostra quantas notificações a pessoa ainda tem em aberto.
- **Banco:** a migração `0041` só cria as tabelas `audit_notes`, `audit_notifications` e
  `audit_notification_files`. Não apaga nem altera nada.
