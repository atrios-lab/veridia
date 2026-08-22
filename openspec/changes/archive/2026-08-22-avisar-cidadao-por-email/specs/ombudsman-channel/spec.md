## ADDED Requirements

### Requirement: E-mail de confirmação da manifestação identificada

Quando a manifestação identificada é registrada com contato de e-mail, o manifestante SHALL
receber uma confirmação com o número de registro e a instrução de guardar o registro e a chave
mostrados na tela; a chave MUST NOT constar do e-mail. A manifestação anônima MUST NOT gerar
tentativa de envio. O envio SHALL ser fire-and-forget: falha de e-mail nunca falha o registro.

#### Scenario: Identificada com e-mail recebe confirmação

- **WHEN** a manifestação identificada é registrada com e-mail
- **THEN** chega um e-mail com o número de registro OUV e sem a chave

#### Scenario: Anônima não gera envio

- **WHEN** a manifestação anônima é registrada
- **THEN** nenhum e-mail é tentado
