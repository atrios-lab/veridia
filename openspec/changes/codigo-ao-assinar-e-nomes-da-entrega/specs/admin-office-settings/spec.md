## ADDED Requirements

### Requirement: Código de confirmação ao assinar

Toda assinatura digital SHALL exigir, além do login e da senha do certificado, um código de 6 dígitos enviado
ao e-mail do painel de quem assina, válido por 10 minutos. Códigos errados repetidos SHALL bloquear novas
tentativas por um tempo.

#### Scenario: Assinar sem o código

- **WHEN** o funcionário tenta assinar sem pedir o código
- **THEN** o painel pede o código de confirmação e não assina

#### Scenario: Código errado

- **WHEN** o funcionário digita um código diferente do enviado
- **THEN** o painel recusa a assinatura e conta a tentativa
