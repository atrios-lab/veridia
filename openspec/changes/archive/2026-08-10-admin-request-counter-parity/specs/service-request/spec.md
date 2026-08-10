## ADDED Requirements

### Requirement: O cartão da exigência entrega o formulário da serventia
O cartão da exigência na consulta de protocolo DEVE (SHALL) oferecer para download o formulário
que a serventia anexou a ela, protegido pelo mesmo par protocolo + chave dos demais documentos
do pedido. O formulário NÃO DEVE (SHALL NOT) aparecer em "Documentos da
serventia" nem herdar o prazo de disponibilidade daquela lista: enquanto a exigência existir, o
formulário existe com ela.

#### Scenario: Download dentro do cartão da exigência
- **WHEN** o cidadão abre a consulta com a chave correta e a exigência tem um formulário anexado
- **THEN** o cartão da exigência mostra o arquivo e o download vai pela rota protegida por chave, com protocolo e chave no corpo da requisição

#### Scenario: Exigência sem formulário não muda
- **WHEN** a exigência não tem formulário anexado
- **THEN** o cartão aparece como hoje, só com o texto e o envio do cumprimento
