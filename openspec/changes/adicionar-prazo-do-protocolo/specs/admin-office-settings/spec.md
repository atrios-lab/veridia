## ADDED Requirements

### Requirement: Prazo padrão dos atos sem prazo legal
As Configurações SHALL oferecer a edição do prazo padrão dos atos que a lei não fixa prazo, em dias úteis, com 10 dias como valor inicial quando o cartório nunca salvou um. Este valor SHALL NOT sobrepor o prazo legal de um ato que tenha um. O servidor SHALL validar que o valor está entre 1 e 365 dias e SHALL gravar o override no padrão dos demais ajustes do cartório, com auditoria. O valor salvo SHALL passar a valer para os pedidos desses atos sem prazo gravado individualmente, inclusive os anteriores à alteração.

#### Scenario: Cartório nunca configurou o prazo
- **WHEN** o operador abre as Configurações sem nenhum prazo salvo
- **THEN** o campo exibe o valor inicial definido em código

#### Scenario: Ato com prazo legal ignora o padrão do cartório
- **WHEN** o cartório salva um prazo padrão e um cidadão pede um ato que a lei fixa prazo
- **THEN** o protocolo nasce com o prazo legal do ato, não com o padrão salvo

#### Scenario: Salvar um prazo diferente
- **WHEN** o operador salva um prazo válido diferente do default
- **THEN** o valor passa a ser usado nos atos sem prazo legal e a alteração consta na auditoria

#### Scenario: Valor inválido é recusado
- **WHEN** o operador tenta salvar um prazo fora do intervalo de 1 a 365 dias
- **THEN** o servidor recusa a gravação e a tela informa o erro

#### Scenario: Prazo do canal LGPD não é afetado
- **WHEN** o cartório altera o prazo padrão dos pedidos
- **THEN** o prazo do canal de direitos do titular permanece 15 dias corridos, fixado por lei
