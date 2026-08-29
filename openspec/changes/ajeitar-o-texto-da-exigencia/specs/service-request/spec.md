## ADDED Requirements

### Requirement: O cartão da exigência exibe o texto como o cartório o escreveu

O cartão da exigência na consulta de protocolo DEVE (SHALL) exibir o texto integral da
exigência com as quebras de linha preservadas, tanto no cartão pendente quanto no cumprido.
O texto NÃO DEVE (SHALL NOT) ser truncado nem escondido atrás de um "ver mais": é a instrução
que o cidadão precisa ler por inteiro para resolver o pedido.

#### Scenario: Exigência com parágrafos na consulta

- **WHEN** o cidadão abre a consulta de um pedido cuja exigência foi escrita em vários
  parágrafos com uma lista de documentos
- **THEN** o cartão mostra o texto completo, com os parágrafos e a lista nas linhas em que
  foram escritos

#### Scenario: Cumprida preserva o texto também

- **WHEN** a exigência de vários parágrafos é marcada como cumprida
- **THEN** o cartão cumprido continua exibindo o texto com as quebras de linha
