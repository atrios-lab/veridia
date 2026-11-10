## ADDED Requirements

### Requirement: Acesso ao painel em duas etapas

Depois da senha, o painel SHALL exigir um código de 6 dígitos enviado ao e-mail da conta, válido por 10
minutos, antes de liberar qualquer tela, ação ou rota. A confirmação SHALL valer até o fim da sessão, e
códigos errados repetidos SHALL bloquear novas tentativas por um tempo.

#### Scenario: Senha certa, sem código

- **WHEN** a pessoa acerta a senha e tenta abrir uma tela do painel sem informar o código
- **THEN** o painel leva à tela do código e não mostra a tela pedida

#### Scenario: Código certo

- **WHEN** a pessoa informa o código recebido por e-mail
- **THEN** o painel abre a tela que ela pediu
