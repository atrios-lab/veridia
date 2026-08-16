# Service Request — delta

## MODIFIED Requirements

### Requirement: Formulário do pedido com aceites e anti-spam invisível
O formulário DEVE (SHALL) pedir nome, e-mail/WhatsApp, CPF opcional, descrição (obrigatória quando o
ato exige), finalidade quando o ato exige, anexos opcionais (até 5, imagem ou PDF, validados
no servidor) e aceites obrigatórios de LGPD e veracidade. Os aceites DEVEM (SHALL) ser
persistidos no registro do pedido com a data do consentimento — a prova do consentimento cabe ao
controlador (LGPD art. 8 §2), e um aceite validado e descartado não é prova. O anti-spam DEVE
(SHALL) ser um honeypot invisível (campo `website`): sem CAPTCHA. Submissões com honeypot
preenchido DEVEM (SHALL) receber resposta de sucesso falsa sem gravação. A rota DEVE (SHALL)
aplicar rate limit.

#### Scenario: Aceites obrigatórios
- **WHEN** o cidadão envia sem marcar um dos aceites
- **THEN** o servidor rejeita com erro de validação apontando o aceite faltante

#### Scenario: Aceites gravados como prova
- **WHEN** um pedido é protocolado com os dois aceites marcados
- **THEN** o registro do pedido carrega os aceites com a data do consentimento, consultáveis depois

#### Scenario: Robô cai no honeypot
- **WHEN** uma submissão chega com o campo `website` preenchido
- **THEN** a resposta simula sucesso e nenhum pedido é gravado

#### Scenario: Anexo inválido
- **WHEN** um arquivo que não é imagem nem PDF (ou excede o tamanho máximo) é enviado
- **THEN** o servidor rejeita a submissão com mensagem clara, independentemente do `accept` do input

## ADDED Requirements

### Requirement: E-mail de confirmação do protocolo

Quando o pedido é protocolado pelo site e o contato informado é um e-mail, o cidadão SHALL
receber uma confirmação — protocolo e a instrução de guardar o número e a chave mostrados na
tela; a chave NÃO SHALL constar do e-mail. O envio SHALL ser fire-and-forget: falha de e-mail
nunca falha o protocolo.

#### Scenario: Confirmação enviada

- **WHEN** o pedido é criado com contato "maria@exemplo.com"
- **THEN** chega um e-mail "Pedido recebido" com o número do protocolo e sem a chave

#### Scenario: Contato é telefone

- **WHEN** o pedido é criado com contato "(84) 99999-0000"
- **THEN** nenhum e-mail é tentado e o pedido é protocolado normalmente
