## ADDED Requirements

### Requirement: Tipo do ato no lançamento pelo balcão
O lançamento manual em `/admin/pedidos/novo` DEVE (SHALL) pedir o tipo quando o ato tiver tipos, acima do campo de descrição, com as mesmas regras de validação do formulário público. Na entrada de gratuidade, o tipo DEVE (SHALL) aparecer dentro do bloco da gratuidade. Ao trocar o ato ou o ato da gratuidade, o tipo já selecionado DEVE (SHALL) ser descartado.

#### Scenario: Balcão pede o tipo
- **WHEN** o operador escolhe "Certidão (nascimento, casamento, óbito)" no lançamento manual
- **THEN** o select de tipo aparece acima da descrição e o envio sem tipo é recusado com o mesmo erro do formulário público

#### Scenario: Trocar o ato descarta o tipo
- **WHEN** o operador escolhe um tipo e depois troca para um ato sem tipos
- **THEN** o select some e o pedido é lançado sem tipo

### Requirement: Nome específico do ato na fila e no detalhe
Quando o pedido tiver um tipo gravado, o cabeçalho do andamento e o campo "Ato" do detalhe e a linha da fila DEVEM (SHALL) mostrar o nome do tipo no lugar do nome agrupado. No pedido de gratuidade, o selo da gratuidade DEVE (SHALL) mostrar o nome do tipo no lugar do nome do ato pedido. O pedido sem tipo gravado, ou com um tipo que não exista mais no catálogo, DEVE (SHALL) mostrar o nome do ato, sem expor o identificador gravado.

#### Scenario: Detalhe mostra o tipo escolhido
- **WHEN** o operador abre um pedido criado com o tipo "Certidão de casamento"
- **THEN** o cabeçalho do andamento mostra "Certidão de casamento" e o campo "Ato" mostra esse nome seguido da atribuição

#### Scenario: Fila mostra o tipo escolhido
- **WHEN** o operador abre a fila com um pedido do tipo "Procuração"
- **THEN** a linha do pedido mostra "Procuração" como ato

#### Scenario: Selo da gratuidade mostra o tipo
- **WHEN** o operador abre um pedido de gratuidade de certidão com o tipo "Certidão de óbito"
- **THEN** o selo da gratuidade cita "Certidão de óbito"

#### Scenario: Pedido antigo mantém o nome do ato
- **WHEN** o operador abre um pedido criado antes da existência do tipo
- **THEN** o cabeçalho e o campo "Ato" mostram o nome do ato, sem inferir um tipo

## MODIFIED Requirements

### Requirement: Corrigir os dados protocolados
O detalhe do pedido DEVE (SHALL) permitir corrigir nome, contato, CPF, finalidade, descrição, a data/hora do atendimento e o tipo do ato, quando o ato tiver tipos — o balcão lança o atendimento depois, e o protocolo vale pelo momento do atendimento. O servidor DEVE (SHALL) recusar um tipo que não pertença ao ato do pedido e, no pedido de gratuidade, ao ato pedido. Deixar o tipo sem escolha ao salvar um pedido antigo NÃO DEVE (SHALL NOT) impedir a correção dos demais dados. Cada correção DEVE (SHALL) entrar no histórico do pedido. O ato e o número de protocolo NÃO DEVEM (SHALL NOT) ser editáveis: trocar o ato muda a atribuição e a base legal do que já foi protocolado. O tipo não muda nenhuma das duas.

#### Scenario: Erro de digitação corrigido sem refazer o pedido
- **WHEN** o operador corrige o nome do solicitante e salva
- **THEN** o detalhe e a consulta do cidadão passam a mostrar o nome corrigido, e o histórico registra quem corrigiu e quando

#### Scenario: Data e hora do atendimento
- **WHEN** o operador ajusta a data/hora de um pedido lançado depois do atendimento presencial
- **THEN** o pedido passa a valer pelo momento informado, refletido no detalhe e na consulta

#### Scenario: O ato não se edita
- **WHEN** o formulário de edição é aberto
- **THEN** não há campo para trocar o ato nem o protocolo

#### Scenario: Só com permissão
- **WHEN** a ação de salvar é chamada sem sessão com `requests.manage`
- **THEN** nada é alterado e a resposta nega a permissão

#### Scenario: Tipo corrigido pelo operador
- **WHEN** o operador troca o tipo de "Certidão de nascimento" para "Certidão de casamento" e salva
- **THEN** o detalhe, a consulta e o requerimento passam a mostrar "Certidão de casamento", e o histórico registra a correção

#### Scenario: Tipo de outro ato é recusado na correção
- **WHEN** a ação de salvar recebe, para uma certidão RCPN, o tipo `procuracao`
- **THEN** nada é alterado e a resposta informa o erro

#### Scenario: Pedido antigo corrigido sem escolher o tipo
- **WHEN** o operador corrige o nome de um pedido antigo e deixa o tipo sem escolha
- **THEN** a correção é salva e o pedido continua sem tipo gravado

#### Scenario: Ato sem tipos não mostra o campo
- **WHEN** o formulário de edição é aberto em um pedido de ato sem tipos
- **THEN** o campo de tipo não aparece
