## Context

Os andamentos já existem: "Em execução do ato", "Disponível para retirada" e "Concluído" (`ready-for-pickup`, `done`), e quem os muda é o seletor de andamento do pedido. O que falta é o elo entre anexar o documento final e escolher um deles, e o registro de quem retirou. O pedido já guarda o CPF do solicitante e, nos atos que perguntam, a forma de entrega que ele pediu (`deliveryFormat`).

## Goals / Non-Goals

**Goals:**
- Depois de anexar o documento final, o funcionário decide como o pedido termina sem abrir o seletor de andamento.
- Quem retirou no balcão fica registrado, com prova suficiente para uma conferência futura.
- Nada é apagado.

**Non-Goals:**
- Reescrever o seletor de andamento ou os e-mails ao cidadão.

## Decisions

### 1. O cartão decide pelo estado, em regra pura

`closingStage` (núcleo, sem I/O) devolve `ask`, `held`, `pickup`, `picked-up` ou `none` a partir do andamento, do número de documentos liberados e retidos e de haver retirada registrada. A pergunta aparece só nos andamentos "Novo", "Em análise" e "Em execução": antes do pagamento ou durante uma exigência, o documento anexado não é o fim da história. Pedidos sem documento liberado não perguntam.

### 2. Tabela própria para a retirada

`service_request_pickups` guarda nome, relação, tipo e número do documento, observação, instante e quem registrou. Alternativa descartada: gravar em `details` do pedido, que o painel e o cidadão leem em vários lugares e que já guarda o CPF do solicitante. A tabela fica fora do alcance das telas do cidadão. Não há chave estrangeira, como nas outras tabelas do pedido, e a tabela entra na lista de tabelas mantidas da limpeza da demonstração para não criar caminho novo de apagamento.

### 3. Registrar conclui

`registerPickupWith` recusa se o pedido não está "Disponível para retirada", grava a linha, registra na auditoria e move o pedido para "Concluído" no mesmo passo. O caminho do balcão tem duas etapas (aguardar, depois registrar) porque o documento pode ficar dias à espera de quem venha buscá-lo.

### 4. O que o painel mostra do documento

O CPF aparece com o meio escondido; RG e CNH, só com os últimos três caracteres. O número inteiro fica no registro, que é a prova.

## Risks / Trade-offs

- **Dado pessoal guardado.** O CPF de quem retira é dado pessoal. É o mínimo para a prova da entrega, fica restrito ao painel e é descrito aqui para entrar no inventário de tratamento da serventia.
- **Conclusão pelo seletor.** Quem conclui um pedido "Disponível para retirada" pelo seletor de andamento não registra quem retirou. O cartão continua oferecendo o registro até haver um.
