## ADDED Requirements

### Requirement: Exceção de quem não possui CPF no balcão
O lançamento manual e a correção de dados DEVEM (SHALL) oferecer a marcação "cidadão não possui CPF".
Marcada, o sistema DEVE (SHALL) exigir o tipo e o número de outro documento e NÃO DEVE (SHALL NOT)
aceitar CPF no mesmo envio. O outro documento DEVE (SHALL) ser gravado no pedido, aparecer mascarado
no detalhe e por completo no requerimento impresso. O formulário público NÃO DEVE (SHALL NOT) oferecer
essa exceção, e os demais canais NÃO DEVEM (SHALL NOT) ser afetados por ela.

#### Scenario: Exceção com outro documento
- **WHEN** o operador marca "cidadão não possui CPF" e informa RG e o número
- **THEN** o pedido é criado sem CPF e com o outro documento gravado

#### Scenario: Exceção sem documento é recusada
- **WHEN** o operador marca "cidadão não possui CPF" e deixa o documento em branco
- **THEN** o pedido não é criado e o erro aparece junto ao campo do documento

#### Scenario: CPF e exceção no mesmo envio
- **WHEN** o envio traz um CPF preenchido e a marcação "cidadão não possui CPF"
- **THEN** nada é gravado e o erro aparece junto ao campo de CPF

#### Scenario: Outro documento mascarado no detalhe
- **WHEN** o detalhe de um pedido com a exceção é aberto
- **THEN** o campo do CPF informa que o cidadão não possui o documento e o outro documento aparece com o número parcialmente oculto

#### Scenario: Outro documento no requerimento
- **WHEN** o requerimento de um pedido com a exceção é impresso
- **THEN** o documento traz o tipo e o número completo do outro documento, no lugar do CPF

## MODIFIED Requirements

### Requirement: Lançar pedido manualmente para atendimento presencial

`/admin/pedidos/novo` SHALL usar o mesmo vocabulário atribuição → ato do wizard público
(`/solicitar`) e o mesmo schema de validação (`serviceRequestSchema`), num formulário único. O
formulário SHALL exigir CPF válido ou a exceção de quem não possui CPF, e o contato SHALL continuar
aceitando e-mail ou telefone. O pedido lançado SHALL gerar protocolo e chave de acesso como no site
público, e SHALL ficar marcado como recebido presencialmente.

#### Scenario: Pedido lançado gera protocolo e chave

- **WHEN** o operador preenche e envia o formulário de lançamento manual
- **THEN** o pedido é criado com protocolo `REQ.AAAA.NNNNNN` e chave de acesso, mostrados na
  própria tela

#### Scenario: Pedido lançado aparece na fila marcado como presencial

- **WHEN** o operador abre a fila depois de lançar um pedido manualmente
- **THEN** o pedido aparece na lista e seu histórico mostra que foi lançado no balcão pela pessoa
  que o lançou

#### Scenario: Validação segue a mesma regra do ato

- **WHEN** o ato escolhido exige finalidade e o operador não a preenche
- **THEN** o formulário recusa o envio com o mesmo erro que o wizard público mostraria

#### Scenario: Lançamento sem CPF nem exceção é recusado

- **WHEN** o operador envia o formulário com o CPF vazio e sem marcar a exceção
- **THEN** o pedido não é criado e o erro aparece junto ao campo de CPF

#### Scenario: Telefone continua aceito como contato

- **WHEN** o operador lança um pedido com CPF válido e contato "(84) 99999-0000"
- **THEN** o pedido é criado normalmente, sem exigir e-mail

### Requirement: Corrigir os dados protocolados
O detalhe do pedido DEVE (SHALL) permitir corrigir nome, contato, CPF, finalidade, descrição e a
data/hora do atendimento — o balcão lança o atendimento depois, e o protocolo vale pelo momento
do atendimento. Cada correção DEVE (SHALL) entrar no histórico do pedido. O ato e o número de
protocolo NÃO DEVEM (SHALL NOT) ser editáveis: trocar o ato muda a atribuição e a base legal do
que já foi protocolado. Um CPF ou outro documento já gravado NÃO DEVE (SHALL NOT) ser apagado sem
substituição: DEVE (SHALL) ser trocado por um CPF válido ou pela exceção com outro documento. Um
pedido gravado sem nenhum dos dois DEVE (SHALL) continuar corrigível sem que eles sejam exigidos.

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

#### Scenario: CPF gravado não pode ser apagado
- **WHEN** o operador esvazia o CPF de um pedido que tem CPF e salva sem marcar a exceção
- **THEN** nada é alterado e a resposta informa que o CPF é necessário

#### Scenario: CPF trocado pela exceção
- **WHEN** o operador esvazia o CPF de um pedido, marca "cidadão não possui CPF" e informa o outro documento
- **THEN** o pedido fica sem CPF, com o outro documento gravado, e o histórico registra a correção

#### Scenario: Exceção trocada por CPF
- **WHEN** o operador informa um CPF válido num pedido gravado com a exceção e desmarca a exceção
- **THEN** o pedido fica com o CPF e o outro documento deixa de ser guardado

#### Scenario: Pedido antigo sem CPF continua corrigível
- **WHEN** o operador corrige o nome de um pedido gravado sem CPF e sem outro documento, deixando o CPF em branco
- **THEN** a correção é salva e o pedido continua sem CPF
