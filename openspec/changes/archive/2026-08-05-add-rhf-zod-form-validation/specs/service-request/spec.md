# Spec: service-request

## ADDED Requirements

### Requirement: Validação client-side do formulário com o mesmo schema do servidor
O formulário do pedido DEVE (SHALL) validar os campos no cliente com react-hook-form usando o
mesmo schema Zod do núcleo (`serviceRequestSchema(act)`), sem schema paralelo. Erros DEVEM
(SHALL) aparecer por campo, em português, a partir do blur do campo, e o envio DEVE (SHALL) ser
bloqueado enquanto houver erro de validação no cliente. A validação do servidor DEVE (SHALL)
permanecer integral: o cliente é conveniência, o servidor é a fronteira de confiança.

#### Scenario: Erro apontado sem ida ao servidor
- **WHEN** o cidadão preenche um CPF inválido e sai do campo
- **THEN** a mensagem "CPF inválido." aparece junto ao campo sem requisição ao servidor

#### Scenario: Envio bloqueado com aceite faltante
- **WHEN** o cidadão tenta enviar sem marcar o aceite de LGPD
- **THEN** o formulário não é submetido e o erro aparece junto ao aceite

#### Scenario: Servidor continua validando
- **WHEN** uma submissão chega ao server action sem passar pela validação do cliente (ex.: script)
- **THEN** o servidor rejeita com os mesmos erros de campo de antes

#### Scenario: Erro que só o servidor conhece continua exibido
- **WHEN** o cliente aprova os campos mas o servidor reprova (ex.: anexo inválido ou rate limit)
- **THEN** a mensagem de erro do servidor é exibida no formulário como hoje

### Requirement: Máscaras de CPF e telefone durante a digitação
O campo de CPF DEVE (SHALL) formatar o valor como `000.000.000-00` enquanto o cidadão digita.
O campo de contato DEVE (SHALL) formatar como telefone `(00) 00000-0000` apenas quando o valor
digitado for numérico, preservando a digitação livre de e-mail. A máscara é apresentação: o
servidor DEVE (SHALL) continuar aceitando o valor com ou sem pontuação.

#### Scenario: CPF ganha máscara ao digitar
- **WHEN** o cidadão digita "12345678909" no campo CPF
- **THEN** o campo exibe "123.456.789-09"

#### Scenario: Contato numérico ganha máscara de telefone
- **WHEN** o cidadão digita "84990000000" no campo de contato
- **THEN** o campo exibe "(84) 99000-0000"

#### Scenario: E-mail não é mascarado
- **WHEN** o cidadão digita "voce@exemplo.com" no campo de contato
- **THEN** o valor permanece exatamente como digitado
