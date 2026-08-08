## ADDED Requirements

### Requirement: Dias oferecidos são dias de atendimento

A página de agendamento SHALL oferecer apenas dias em que a serventia atende: de segunda a
sexta, excluídos os feriados nacionais (fixos e móveis) e o próprio dia corrente depois do
encerramento do expediente. O cidadão MUST NOT ser capaz de escolher uma data digitando-a: a
escolha é feita entre os dias oferecidos.

#### Scenario: Fim de semana não aparece

- **WHEN** a faixa de dias oferecida cobre um sábado ou domingo
- **THEN** esses dias não aparecem entre as opções, e a faixa avança para o próximo dia útil

#### Scenario: Feriado nacional móvel não aparece

- **WHEN** a faixa de dias inclui sexta-feira santa, carnaval ou Corpus Christi do ano corrente
- **THEN** esse dia não aparece entre as opções

#### Scenario: Dia é apresentado por extenso

- **WHEN** um dia é oferecido
- **THEN** ele é exibido com o dia da semana abreviado, o dia do mês e o mês abreviado
  (ex.: "qua 06 ago"), nunca em formato numérico americano

### Requirement: Faixas de uma hora com ocupação visível

O horário SHALL ser escolhido em faixas de uma hora dentro da janela de atendimento configurada
para a serventia, e cada faixa SHALL declarar seu estado: livre, escolhida ou ocupada. Uma faixa
está ocupada quando o número de pedidos de agendamento vivos naquele dia e faixa alcança a
capacidade configurada. Faixa ocupada MUST NOT ser selecionável.

#### Scenario: Faixa ocupada é recusada no servidor

- **WHEN** um pedido chega com uma faixa cuja capacidade já foi alcançada
- **THEN** o pedido não é gravado e a resposta explica que a faixa fechou, oferecendo o próximo
  dia com vaga

#### Scenario: Dia sem faixa livre

- **WHEN** todas as faixas do dia escolhido estão ocupadas
- **THEN** a página mostra o bloco "Este dia está cheio", nomeia o próximo dia com vaga, oferece
  o atalho para ele e o contato da serventia
- **AND** o botão de envio não fica disponível enquanto não houver faixa escolhida

### Requirement: Pedido de horário com contato e motivo livre

O formulário SHALL exigir apenas dia, faixa de horário, nome completo e um contato (e-mail ou
telefone com DDD). O motivo do atendimento SHALL ser texto livre e opcional — o cidadão MUST NOT
precisar saber o nome do ato. O formulário SHALL usar campo-armadilha invisível contra robô e
MUST NOT usar CAPTCHA.

#### Scenario: Envio válido gera protocolo AGD e chave

- **WHEN** o cidadão envia dia, faixa, nome e contato válidos
- **THEN** o agendamento é gravado com protocolo `AGD.AAAA.NNNNNN`, sequência própria do tipo
  por serventia e ano, e uma chave de acesso é exibida uma única vez, armazenada apenas como
  hash

#### Scenario: Campo-armadilha preenchido

- **WHEN** o campo invisível chega preenchido
- **THEN** a tela de sucesso é exibida e nada é gravado

#### Scenario: Expectativa dita junto do botão

- **WHEN** a tela do formulário é exibida
- **THEN** o aviso de que se trata de um pedido, confirmado ou contraproposto pela serventia,
  aparece imediatamente antes do botão de envio

### Requirement: Confirmação do agendamento

A tela de confirmação SHALL mostrar o dia e a faixa pedidos, o protocolo e a chave em destaque
com o aviso de que a chave aparece só naquele momento, o que acontece em seguida, e os atalhos
para acompanhar pelo protocolo e para adicionar o horário à agenda.

#### Scenario: Arquivo de agenda

- **WHEN** o cidadão escolhe "Adicionar à agenda"
- **THEN** o site entrega um arquivo `.ics` com o dia, a faixa de horário, o nome da serventia,
  o endereço e o protocolo no corpo do evento

### Requirement: Acompanhamento e horário proposto

A consulta por protocolo e chave SHALL mostrar o andamento do agendamento a partir das datas do
próprio registro. Quando a serventia propõe outro horário, a consulta SHALL destacar o bloco "É
a sua vez", comparar o horário pedido com o proposto e oferecer aceitar ou pedir outro.

#### Scenario: Aceite da proposta

- **WHEN** o cidadão aceita o horário proposto informando protocolo e chave
- **THEN** o agendamento passa a valer com o horário proposto, o aceite entra no andamento e o
  bloco "É a sua vez" some

#### Scenario: Chave errada

- **WHEN** a chave informada não corresponde ao protocolo
- **THEN** a consulta responde com a mesma mensagem de protocolo ou chave inválidos, sem revelar
  se o protocolo existe
