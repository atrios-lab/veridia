## MODIFIED Requirements

### Requirement: Edição de horário e contatos da serventia

O bloco "Atendimento e contato" SHALL permitir editar a frase de horário de atendimento, a hora
de abertura e de fechamento do balcão, o intervalo opcional (início e fim), o telefone, o
WhatsApp e o e-mail da serventia. A frase, as horas e os três contatos SHALL ser obrigatórios; o
intervalo SHALL ser opcional, mas, se preenchido, com início e fim. Tudo SHALL ser validado no
servidor com o mesmo schema que descreve `contacts`, `openingHours` e `counterHours` no
`TenantSchema`. Uma gravação bem-sucedida SHALL registrar entrada em `audit_log` com o autor, a
ação e a serventia, e SHALL gravar o intervalo explicitamente (objeto ou `null`).

#### Scenario: Gravação válida

- **WHEN** o usuário altera o telefone para um valor válido e aciona "Salvar"
- **THEN** o valor é persistido como override da serventia e a tela confirma a gravação

#### Scenario: E-mail inválido é recusado no servidor

- **WHEN** o formulário é enviado com `contato@` no campo de e-mail
- **THEN** nada é gravado e o campo de e-mail exibe a mensagem de erro correspondente

#### Scenario: Campo obrigatório vazio

- **WHEN** o formulário é enviado com o horário de atendimento em branco
- **THEN** nada é gravado e o campo exibe erro; os demais valores digitados permanecem no
  formulário

#### Scenario: Intervalo pela metade

- **WHEN** o formulário é enviado com o início do intervalo preenchido e o fim em branco
- **THEN** nada é gravado e o campo do intervalo exibe "Informe o início e o fim do intervalo."

#### Scenario: Intervalo apagado

- **WHEN** o usuário limpa os dois campos do intervalo e salva
- **THEN** o override grava `lunchBreak: null` e o site deixa de considerar intervalo

#### Scenario: Toda gravação deixa rastro

- **WHEN** uma gravação é aceita
- **THEN** existe uma linha em `audit_log` identificando quem gravou, em qual serventia e quando
