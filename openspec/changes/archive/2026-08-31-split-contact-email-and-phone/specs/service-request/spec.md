## ADDED Requirements

### Requirement: Identificação do solicitante por e-mail obrigatório e telefone opcional
O formulário público do pedido DEVE (SHALL) pedir a identificação em dois campos separados:
**e-mail**, obrigatório e validado como endereço, e **telefone**, opcional, aceito como número
brasileiro com DDD (10 ou 11 dígitos). O núcleo DEVE (SHALL) rejeitar o pedido sem e-mail válido,
e o servidor DEVE (SHALL) continuar sendo a fronteira de validação: um envio que contorne o
cliente recebe os mesmos erros de campo.

O telefone informado DEVE (SHALL) ser gravado junto ao pedido e ficar visível ao operador na tela
do pedido e no requerimento impresso. Um pedido sem telefone DEVE (SHALL) ser protocolado
normalmente.

#### Scenario: Pedido sem e-mail é recusado
- **WHEN** o cidadão envia o formulário com o campo de e-mail vazio
- **THEN** o pedido não é protocolado e o erro aparece junto ao campo de e-mail

#### Scenario: E-mail malformado é recusado
- **WHEN** o cidadão preenche "maria@" e sai do campo
- **THEN** a mensagem de e-mail inválido aparece junto ao campo, sem requisição ao servidor

#### Scenario: Telefone é opcional
- **WHEN** o cidadão preenche e-mail válido e deixa o telefone em branco
- **THEN** o pedido é protocolado e a tela do pedido mostra o telefone vazio, sem erro

#### Scenario: Telefone inválido é recusado
- **WHEN** o cidadão preenche o telefone com menos de 10 dígitos
- **THEN** o pedido não é protocolado e o erro aparece junto ao campo de telefone

#### Scenario: Telefone chega ao operador
- **WHEN** um pedido é protocolado com telefone "(84) 99000-0000"
- **THEN** o operador vê esse telefone na tela do pedido e no requerimento impresso

#### Scenario: Pedido antigo continua legível
- **WHEN** o operador abre um pedido protocolado antes desta mudança, cujo contato é um telefone
- **THEN** o contato é exibido como está gravado, sem erro e sem reescrita do registro

## MODIFIED Requirements

### Requirement: Máscaras de CPF e telefone durante a digitação
O campo de CPF DEVE (SHALL) formatar o valor como `000.000.000-00` enquanto o cidadão digita.
O campo de telefone DEVE (SHALL) formatar como `(00) 00000-0000` enquanto o cidadão digita, sem
condicional: o campo é só de telefone. O campo de e-mail NÃO DEVE (SHALL NOT) receber máscara. A
máscara é apresentação: o servidor DEVE (SHALL) continuar aceitando o valor com ou sem pontuação.

#### Scenario: CPF ganha máscara ao digitar
- **WHEN** o cidadão digita "12345678909" no campo CPF
- **THEN** o campo exibe "123.456.789-09"

#### Scenario: Telefone ganha máscara ao digitar
- **WHEN** o cidadão digita "84990000000" no campo de telefone
- **THEN** o campo exibe "(84) 99000-0000"

#### Scenario: E-mail não é mascarado
- **WHEN** o cidadão digita "voce@exemplo.com" no campo de e-mail
- **THEN** o valor permanece exatamente como digitado

#### Scenario: Telefone aceito sem pontuação
- **WHEN** uma submissão chega ao servidor com o telefone "84990000000"
- **THEN** o pedido é aceito e o número é gravado

### Requirement: Formulário do pedido com aceites e anti-spam invisível
O formulário DEVE (SHALL) pedir nome, e-mail obrigatório, telefone opcional, CPF opcional,
descrição (obrigatória quando o ato exige), finalidade quando o ato exige, anexos opcionais (até
5, imagem ou PDF, validados no servidor) e aceites obrigatórios de LGPD e veracidade. Os aceites
DEVEM (SHALL) ser persistidos no registro do pedido com a data do consentimento: a prova do
consentimento cabe ao controlador (LGPD art. 8 §2), e um aceite validado e descartado não é
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

### Requirement: E-mail de confirmação do protocolo
Todo pedido protocolado pelo site DEVE (SHALL) render uma confirmação por e-mail para o endereço
informado: protocolo e a instrução de guardar o número e a chave mostrados na tela; a chave NÃO
SHALL constar do e-mail. O envio SHALL ser fire-and-forget: falha de e-mail nunca falha o
protocolo. Pedidos gravados antes desta mudança, cujo contato não é um endereço de e-mail, NÃO
SHALL gerar tentativa de envio.

#### Scenario: Confirmação enviada
- **WHEN** o pedido é criado com e-mail "maria@exemplo.com"
- **THEN** chega um e-mail "Pedido recebido" com o número do protocolo e sem a chave

#### Scenario: Falha de e-mail não derruba o protocolo
- **WHEN** o envio do e-mail falha
- **THEN** o pedido é protocolado normalmente e o cidadão vê protocolo e chave na tela

#### Scenario: Pedido antigo sem e-mail
- **WHEN** um aviso de andamento é disparado para um pedido antigo cujo contato é "(84) 99999-0000"
- **THEN** nenhum e-mail é tentado e o andamento é registrado normalmente
