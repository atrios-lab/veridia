## ADDED Requirements

### Requirement: Direcionar o pedido dentro do cartório

O pedido SHALL mostrar, na lateral, com quem está (pessoa ou fila do setor), para quê, a prioridade, o prazo e o histórico de direcionamentos. Quem trabalha os pedidos SHALL poder direcionar a uma pessoa ou a um setor, escolhendo a finalidade (executar o ato, com o serviço entre os das atribuições da serventia; conferência; assinatura), a prioridade (normal, atenção, urgente), o prazo e um recado. SHALL poder alterar e desfazer um direcionamento que a outra pessoa ainda não recebeu, sem apagar nada: o valor anterior fica no histórico e na auditoria.

#### Scenario: Direcionar a uma pessoa
- **WHEN** Carlos direciona o pedido a Ana, do Registro Civil, para assinatura
- **THEN** o pedido mostra "Com Ana · para assinatura", Ana recebe o alerta e o pedido entra em "Direcionados a mim" dela

#### Scenario: Alterar antes de receber
- **WHEN** Carlos troca a finalidade de conferência para assinatura antes de Ana receber
- **THEN** o direcionamento passa a dizer assinatura e o histórico guarda que era conferência

#### Scenario: Desfazer
- **WHEN** Carlos desfaz o direcionamento
- **THEN** ele aparece riscado no histórico e o pedido volta a estar com Carlos

### Requirement: Pegar para mim sem bloqueio

Qualquer pessoa que trabalha os pedidos SHALL poder pegar o pedido para si a qualquer momento, sem esperar liberação. Quem estava com ele SHALL ser avisado e o histórico SHALL registrar de quem foi pego.

#### Scenario: Pegar de um colega
- **WHEN** Bruno pega um pedido que está com Ana
- **THEN** o pedido passa a estar com Bruno e Ana recebe o aviso de que Bruno pegou o pedido

### Requirement: Fila do setor

Um direcionamento sem pessoa SHALL ir para a fila do setor: todos do setor recebem o alerta e o primeiro que receber fica com o pedido.

#### Scenario: Primeiro que pega
- **WHEN** o pedido é direcionado ao Registro Civil sem pessoa e Ana clica em "Recebi"
- **THEN** o pedido passa a estar com Ana e sai da fila dos outros do setor

### Requirement: Setores editáveis

A serventia SHALL começar com setores prontos (as atribuições que exerce, Balcão, Caixa e Gabinete do Tabelião). Quem tem `routing.settings` SHALL poder criar, renomear e apagar setores e escolher quem está em cada um. Apagar SHALL ocultar o setor, mantendo o nome nos registros antigos.

#### Scenario: Apagar um setor
- **WHEN** o Tabelião apaga o setor Caixa
- **THEN** ele some das escolhas e os direcionamentos antigos continuam dizendo Caixa

### Requirement: Quem pode assinar e concluir

Quem tem `routing.settings` SHALL poder escolher entre "todos" (padrão) e "só as pessoas escolhidas" para assinar e concluir os pedidos. Com "só as pessoas escolhidas", só elas SHALL mover o pedido a "Pronto para retirada", concluir com entrega digital e responder a busca; as demais veem "Direcionar para assinatura". A lista SHALL manter o Tabelião e nunca ficar vazia.

#### Scenario: Escrevente fora da lista
- **WHEN** a serventia escolheu só Carlos e Ana e Diego tenta concluir com entrega digital
- **THEN** a conclusão é recusada com o aviso de direcionar a um deles

### Requirement: Linha do direcionamento para o cidadão

Enquanto o pedido está com o cartório, a consulta do cidadão SHALL mostrar, abaixo do andamento, o setor e a fase interna ("Com o setor de Registro Civil · aguardando assinatura"), sem nome de funcionário. A linha SHALL poder ser desligada para a serventia e em cada pedido; desligada, a consulta fica como antes.

#### Scenario: Linha desligada no pedido
- **WHEN** o funcionário desliga a linha num pedido
- **THEN** o cidadão vê só o andamento, como antes

### Requirement: A mesa continua igual

Direcionar, pegar, receber, alterar e desfazer NÃO SHALL colocar nem tirar o pedido da "Sua mesa".

#### Scenario: Direcionar não volta à mesa
- **WHEN** um pedido em execução é direcionado para assinatura
- **THEN** ele continua fora da "Sua mesa" e aparece em "Direcionados a mim" de quem recebeu
