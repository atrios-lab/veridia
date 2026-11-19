## ADDED Requirements

### Requirement: Fechar a entrega depois de anexar o documento final

Com o documento final anexado e liberado ao cidadão, e o pedido em "Novo", "Em análise" ou "Em execução do ato", o detalhe do pedido SHALL perguntar como o pedido termina: "Concluir com entrega digital", que move o pedido para "Concluído", ou "Aguardando retirada no balcão", que o move para "Disponível para retirada". Em ambos os casos o cidadão SHALL ser avisado por e-mail. Quando o solicitante escolheu a forma de entrega ao pedir, a pergunta SHALL destacar essa forma. Se o documento anexado estiver retido, esperando a assinatura, a conclusão SHALL ser recusada com a orientação de assinar antes.

#### Scenario: Entrega digital
- **WHEN** o funcionário anexa o documento final e escolhe "Concluir com entrega digital"
- **THEN** o pedido passa a "Concluído" e o cidadão recebe o aviso de pedido concluído

#### Scenario: Retirada no balcão
- **WHEN** o funcionário escolhe "Aguardando retirada no balcão"
- **THEN** o pedido passa a "Disponível para retirada", o cidadão é avisado e o cartão mostra o formulário de quem retirou

#### Scenario: Documento ainda retido
- **WHEN** o único documento anexado está retido, esperando a assinatura
- **THEN** o cartão avisa que é preciso assinar antes de concluir, e a escolha de como terminar não é oferecida

#### Scenario: Pedido sem documento
- **WHEN** o pedido não tem nenhum documento anexado para o cidadão
- **THEN** o cartão não pergunta como o pedido termina

### Requirement: Registrar quem retirou o documento no balcão

Com o pedido "Disponível para retirada", o detalhe SHALL oferecer o registro da retirada: quem retirou (o próprio solicitante, advogado ou procurador, pessoa autorizada, familiar ou outra pessoa), o nome completo, o documento apresentado (CPF, RG, CNH ou outro), o número e uma observação opcional. O CPF SHALL ser conferido pelos dígitos verificadores. Salvar SHALL gravar o dia e a hora do registro e o nome de quem registrou, concluir o pedido, avisar o cidadão e entrar na auditoria. O registro SHALL ser recusado se o pedido não estiver "Disponível para retirada". O número do documento SHALL aparecer ao painel com o meio escondido e NUNCA ao cidadão. Nada SHALL ser apagado ou editado: uma correção é um novo registro, e o mais recente vale.

#### Scenario: Registro bem feito
- **WHEN** o funcionário registra a retirada de uma pessoa autorizada com CPF válido
- **THEN** o pedido passa a "Concluído", o cartão mostra quem retirou, o documento com o meio escondido e a hora, e o ato fica na auditoria

#### Scenario: CPF inválido
- **WHEN** o funcionário informa um CPF com dígitos verificadores errados
- **THEN** o registro é recusado com a mensagem de CPF inválido e o pedido continua aguardando retirada

#### Scenario: Pedido que não aguarda retirada
- **WHEN** a retirada é registrada para um pedido que não está "Disponível para retirada"
- **THEN** o servidor recusa e nada é gravado

#### Scenario: O cidadão não vê o documento
- **WHEN** o cidadão consulta o protocolo de um pedido com retirada registrada
- **THEN** a consulta não mostra o nome nem o número do documento de quem retirou
