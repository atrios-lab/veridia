## MODIFIED Requirements

### Requirement: Registrar exigência a partir do detalhe

O operador SHALL poder registrar uma exigência (texto livre) num pedido. O texto SHALL aceitar
até 4.000 caracteres — o mesmo teto das mensagens da conversa — e SHALL preservar as quebras de
linha que o operador digitar, tanto na gravação quanto na exibição no detalhe do pedido. Ao
estourar o teto, a mensagem de erro SHALL dizer o limite ("O texto pode ter até 4.000
caracteres."). A exigência registrada SHALL aparecer de imediato na consulta de protocolo do
cidadão. Marcar a exigência como cumprida SHALL ser ação exclusiva do operador: o envio do
cidadão (arquivo ou mensagem na conversa) NÃO SHALL marcá-la cumprida por si. Enquanto pendente,
a exigência SHALL poder ser editada (texto) e excluída pelo operador: a exclusão remove a
exigência, sua conversa e seus arquivos, atrás da confirmação padrão do painel e com registro em
auditoria. Exigência cumprida SHALL ser imutável: sem edição, sem exclusão, conversa encerrada.

#### Scenario: Exigência aparece assim que registrada

- **WHEN** o operador registra "Falta cópia legível do documento de identidade"
- **THEN** a consulta de protocolo daquele pedido já mostra a exigência pendente, sem precisar de
  outra ação

#### Scenario: Explicação longa com parágrafos

- **WHEN** o operador registra uma exigência de vários parágrafos, com uma lista numerada de
  documentos, dentro de 4.000 caracteres
- **THEN** o texto é aceito e o detalhe do pedido o exibe com as quebras de linha como digitadas

#### Scenario: Estouro do teto diz o número

- **WHEN** o operador cola um texto acima de 4.000 caracteres e registra
- **THEN** nada é gravado e o erro exibido informa o limite de 4.000 caracteres

#### Scenario: Envio do cidadão não cumpre sozinho

- **WHEN** o cidadão envia o documento pela consulta de protocolo
- **THEN** a exigência continua pendente, com o envio visível na conversa, até o operador conferir
  e marcá-la cumprida

#### Scenario: Operador marca cumprida

- **WHEN** o operador confere o envio e marca a exigência como cumprida
- **THEN** a exigência aparece cumprida nos dois lados, com a data, e a conversa encerra

#### Scenario: Editar exigência pendente

- **WHEN** o operador corrige o texto de uma exigência ainda pendente
- **THEN** o novo texto aparece nos dois lados, com as quebras de linha preservadas

#### Scenario: Excluir exigência pendente

- **WHEN** o operador exclui uma exigência registrada por engano e confirma no diálogo
- **THEN** a exigência, sua conversa e seus arquivos somem dos dois lados, e a auditoria registra a
  exclusão

#### Scenario: Cumprida é imutável

- **WHEN** a exigência está cumprida
- **THEN** o painel não oferece editar nem excluir para ela

#### Scenario: Mais de uma exigência ao mesmo tempo

- **WHEN** o pedido tem uma exigência pendente e outra já cumprida
- **THEN** o detalhe mostra as duas, cada uma com seu próprio estado

### Requirement: Corrigir os dados protocolados
O detalhe do pedido DEVE (SHALL) permitir corrigir nome, contato, CPF, finalidade, descrição e a
data/hora do atendimento — o balcão lança o atendimento depois, e o protocolo vale pelo momento
do atendimento. Finalidade e descrição DEVEM (SHALL) aceitar até 4.000 caracteres cada, e o
estouro DEVE (SHALL) responder com mensagem legível que informe o limite — nunca um erro cru de
validação. Cada correção DEVE (SHALL) entrar no histórico do pedido. O ato e o número de
protocolo NÃO DEVEM (SHALL NOT) ser editáveis: trocar o ato muda a atribuição e a base legal do
que já foi protocolado.

#### Scenario: Erro de digitação corrigido sem refazer o pedido
- **WHEN** o operador corrige o nome do solicitante e salva
- **THEN** o detalhe e a consulta do cidadão passam a mostrar o nome corrigido, e o histórico registra quem corrigiu e quando

#### Scenario: Descrição longa aceita na correção
- **WHEN** o operador cola na descrição um relato de mais de 1.000 e menos de 4.000 caracteres e salva
- **THEN** a correção é gravada normalmente

#### Scenario: Estouro na correção tem mensagem legível
- **WHEN** o operador salva uma finalidade ou descrição acima de 4.000 caracteres
- **THEN** nada é gravado e o erro exibido informa o limite de 4.000 caracteres

#### Scenario: Data e hora do atendimento
- **WHEN** o operador ajusta a data/hora de um pedido lançado depois do atendimento presencial
- **THEN** o pedido passa a valer pelo momento informado, refletido no detalhe e na consulta

#### Scenario: O ato não se edita
- **WHEN** o formulário de edição é aberto
- **THEN** não há campo para trocar o ato nem o protocolo

#### Scenario: Só com permissão
- **WHEN** a ação de salvar é chamada sem sessão com `requests.manage`
- **THEN** nada é alterado e a resposta nega a permissão
