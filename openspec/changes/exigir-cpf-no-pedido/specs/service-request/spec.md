## MODIFIED Requirements

### Requirement: Formulário do pedido com aceites e anti-spam invisível
O formulário DEVE (SHALL) pedir nome, e-mail obrigatório, telefone opcional, CPF obrigatório,
descrição (obrigatória quando o ato exige), finalidade quando o ato exige, anexos opcionais (até
5, imagem ou PDF, validados no servidor) e aceites obrigatórios de LGPD e veracidade. O núcleo DEVE
(SHALL) rejeitar o pedido sem CPF válido, e um envio que contorne o cliente DEVE (SHALL) receber os
mesmos erros de campo. O formulário DEVE (SHALL) orientar, junto ao campo, que quem não possui CPF
faça o pedido no balcão da serventia, e NÃO DEVE (SHALL NOT) oferecer outro documento no lugar do
CPF. Os aceites DEVEM (SHALL) ser persistidos no registro do pedido com a data do consentimento: a
prova do consentimento cabe ao controlador (LGPD art. 8 §2), e um aceite validado e descartado não é
prova. O anti-spam DEVE (SHALL) ser um honeypot invisível (campo `website`): sem CAPTCHA.
Submissões com honeypot preenchido DEVEM (SHALL) receber resposta de sucesso falsa sem gravação.
A rota DEVE (SHALL) aplicar rate limit.

#### Scenario: Aceites obrigatórios
- **WHEN** o cidadão envia sem marcar um dos aceites
- **THEN** o servidor rejeita com erro de validação apontando o aceite faltante

#### Scenario: Aceites gravados como prova
- **WHEN** um pedido é protocolado com os dois aceites marcados
- **THEN** o registro do pedido carrega os aceites com a data do consentimento, consultáveis depois

#### Scenario: Robô cai no honeypot
- **WHEN** uma submissão chega com o campo `website` preenchido
- **THEN** a resposta simula sucesso e nenhum pedido é gravado

#### Scenario: Pedido sem CPF é recusado
- **WHEN** o cidadão envia o formulário com o campo de CPF vazio
- **THEN** o pedido não é protocolado e o erro aparece junto ao campo de CPF

#### Scenario: CPF inválido é recusado
- **WHEN** o cidadão preenche um CPF cujos dígitos verificadores não conferem
- **THEN** o pedido não é protocolado e a mensagem de CPF inválido aparece junto ao campo

#### Scenario: Envio que contorna o cliente
- **WHEN** uma submissão chega direto ao servidor sem o campo `cpf`
- **THEN** o pedido não é protocolado e a resposta traz o erro de campo do CPF

#### Scenario: Orientação para quem não tem CPF
- **WHEN** o cidadão chega à etapa de identificação do formulário
- **THEN** o campo de CPF aparece sem a marca de opcional, com a orientação de procurar o balcão caso não possua o documento
