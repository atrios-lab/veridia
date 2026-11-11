## Why

A auditoria era uma lista corrida: no celular, os filtros passavam da largura da tela, e nada separava o
grave do corriqueiro. O titular pediu três coisas: faixas de urgência, divisão por pessoa e um alerta que
fique na tela até ele verificar. Pediu também que quem exclui algo tenha de justificar, sabendo que vai para
a auditoria.

## What Changes

- **Faixas Urgente, Atenção, Análise e Rotina** (`src/core/audit/severity.ts`). Exclusões, chave Pix, contas,
  e-mails e acesso são urgentes. Todo código novo que exclui cai em Urgente sozinho.
- **Alerta ao Tabelião/Registrador:**
  - aviso vermelho em todas as telas, mais o número no item Auditoria, enquanto houver ato urgente dos
    últimos 30 dias sem verificação;
  - "Marcar como verificado" encerra o alerta daquele ato, um por um ou em lote;
  - os atos do próprio titular não geram alerta para ele.
- **Tela reorganizada:**
  - resumo das três faixas;
  - cartões "Por pessoa" com as contagens;
  - filtros por faixa em um toque;
  - os demais filtros recolhidos e sem estourar a largura no celular;
  - registros agrupados por dia, com a faixa colorida e a justificativa;
  - barra de ações que só aparece quando há registros marcados.
- **Justificativa obrigatória:** toda confirmação de exclusão, desativação, arquivamento ou renumeração pede o
  motivo e avisa que o ato vai para a auditoria. O servidor recusa o ato sem motivo, e o texto vai para o
  registro e para o PDF do relatório.
- **Banco:** a migração `0043` só cria `audit_reviews` e acrescenta `audit_log.reason`. Não apaga nada.
