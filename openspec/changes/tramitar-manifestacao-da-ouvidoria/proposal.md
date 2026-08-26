## Why

A ouvidoria do painel só tem uma saída: responder. Quem responde fecha a manifestação; quem não
tem a quem responder não fecha nada. Como toda manifestação anônima nasce em `new` e nenhuma tela
consegue escrever `in-review` ou `done`, ela fica aberta para sempre — e o contador de pendências
da sidebar e da Visão geral, que conta tudo que não está num status terminal, sobe e nunca desce.

A serventia pediu por nome: "Ouvidoria não tem a opção de tramitação (Resolver, Arquivar,
Responder e etc)". Hoje só o "Responder" existe, e só para manifestação identificada.

## What Changes

- O detalhe da manifestação ganha um bloco de tramitação com os andamentos do canal, disponível
  para toda manifestação — identificada ou anônima.
- Dois andamentos que já existem como rótulo e nunca tiveram quem os escrevesse passam a ser
  alcançáveis pelo operador: **Em apuração** (`in-review`) e **Concluída** (`done`).
- Entra um andamento novo, **Arquivada** (`archived`), para a manifestação que se encerra sem
  providência — denúncia improcedente, duplicidade, texto sem conteúdo apurável. Terminal, como
  `done`, mas dizendo outra coisa.
- Manifestação anônima passa a ter saída: apura, anota e conclui ou arquiva. Com isso o contador
  de manifestações em aberto volta a significar "o que ainda precisa de mim".
- A mudança de andamento entra no histórico do registro e na auditoria, como já entram a resposta,
  o rascunho e a anotação interna.
- A consulta do cidadão passa a poder mostrar os novos andamentos pelo nome, sem vazar a anotação
  interna.

## Capabilities

### New Capabilities

- `admin-ombudsman`: o tratamento da manifestação no painel — fila, detalhe, resposta, anotação
  interna e agora tramitação. Hoje a tela existe sem spec; a única exigência escrita sobre ela
  vive em `ombudsman-channel`, do ponto de vista do cidadão.

### Modified Capabilities

- `ombudsman-channel`: a consulta do cidadão passa a nomear os andamentos novos (`in-review`,
  `archived`) e o histórico do tratamento passa a incluir a mudança de andamento. A anotação
  interna continua invisível para o cidadão.

## Non-Goals

- **Não** vira máquina de estados. A ouvidoria segue o mesmo princípio do pedido: o servidor
  valida que o destino é um dos andamentos do canal e que não é o atual, nada mais. Correção de
  erro humano é caso de uso, não exceção.
- **Não** entra prazo legal, SLA nem alerta de manifestação parada. A ouvidoria de serventia não
  tem prazo estatutário como o direito do titular (LGPD art. 19); se um dia precisar, é outra
  mudança.
- **Não** entra filtro nem aba de encerradas na fila. A lista hoje mostra tudo em ordem de data e
  o volume do canal não pede corte; quando pedir, o filtro do `/admin/pedidos` é o molde.
- **Não** entra atribuição de responsável, transferência entre setores ou fluxo de aprovação.
- **Não** entra aviso por e-mail na mudança de andamento. O cidadão é avisado quando há resposta;
  ser avisado de que a manifestação dele entrou "em apuração" é ruído.
- **Não** mexe no formulário público nem na regra de anonimato e sigilo.

## Impact

- `src/core/request/kinds.ts`: `archived` entra em `STATUS_LABELS.ombudsman` e em
  `TERMINAL_STATUSES.ombudsman`; nasce a lista de andamentos do canal e o que cada um oferece
  como próximo passo.
- `src/app/admin/(dashboard)/ouvidoria/[protocolo]/`: uma Server Action nova e um componente de
  tramitação no detalhe.
- `src/lib/service-request.ts`: `updateRecordStatus` ganha o primeiro chamador (foi escrita para
  agendamento, que depois migrou para tabela própria).
- `src/lib/admin-overview.ts` e o `HISTORY_LABELS` do detalhe: rótulo da ação nova, senão o
  histórico mostra a chave crua.
- Contadores de `openCountByKind` para `ombudsman` caem para as manifestações realmente abertas —
  mudança visível na sidebar e na Visão geral no primeiro encerramento.
- Sem migração: `status` é `text` e `archived` já convive com os dezoito andamentos do pedido na
  mesma coluna.
