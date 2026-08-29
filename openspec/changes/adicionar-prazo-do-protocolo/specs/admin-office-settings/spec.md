## ADDED Requirements

### Requirement: Prazo padrão de análise do pedido configurável
As Configurações SHALL oferecer a edição do prazo padrão de análise dos pedidos de serviço, em dias corridos, com valor legal definido em código como default (30 dias, prazo geral de registro da Lei 6.015) quando o cartório nunca salvou um valor. O servidor SHALL validar que o valor está entre 1 e 365 dias e SHALL gravar o override no padrão dos demais ajustes do cartório, com auditoria. O valor salvo SHALL passar a valer para o cálculo de prazo de todos os pedidos sem prazo gravado individualmente, inclusive os anteriores à alteração.

#### Scenario: Cartório nunca configurou o prazo
- **WHEN** o operador abre as Configurações sem nenhum prazo salvo
- **THEN** o campo exibe o default legal definido em código

#### Scenario: Salvar um prazo diferente
- **WHEN** o operador salva um prazo válido diferente do default
- **THEN** o valor passa a ser usado no cálculo do prazo dos pedidos sem prazo gravado e a alteração consta na auditoria

#### Scenario: Valor inválido é recusado
- **WHEN** o operador tenta salvar um prazo fora do intervalo de 1 a 365 dias
- **THEN** o servidor recusa a gravação e a tela informa o erro

#### Scenario: Prazo do canal LGPD não é afetado
- **WHEN** o cartório altera o prazo padrão dos pedidos
- **THEN** o prazo do canal de direitos do titular permanece 15 dias, fixado por lei
