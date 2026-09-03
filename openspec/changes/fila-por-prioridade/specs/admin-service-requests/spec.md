## MODIFIED Requirements

### Requirement: Fila de pedidos filtrável e pesquisável

`/admin/pedidos` SHALL listar os pedidos da serventia da sessão em bandas por prioridade, de cima
para baixo: Com pendência (exigência aberta), Aguardando (novo, protocolado, aguardando
pagamento), Em andamento (em análise, pago, prenotado, em qualificação, em processamento,
registrado, averbado, deferido), Para retirada e Encerrados (concluído, indeferido, cancelado,
arquivado). Cada banda SHALL ter um cabeçalho com o nome e a quantidade de pedidos, omitido
quando só uma banda aparece. Dentro de uma banda aberta a ordem SHALL ser: prazo vencido primeiro
(o mais atrasado no topo), depois os que vencem em até três dias úteis (o mais próximo no topo),
depois os demais por ordem de chegada, do mais antigo ao mais novo. Em Encerrados a ordem SHALL
ser do mais novo ao mais antigo. Cada linha mostra protocolo, solicitante (nome e contato), ato,
andamento (com selo colorido), valor (ou "—" quando não informado) e data. A fila SHALL oferecer
filtro por andamento, filtro por atribuição e busca por texto que casa protocolo ou nome do
solicitante. Clicar numa linha SHALL levar ao detalhe daquele pedido.

#### Scenario: Concluído vai para o fim

- **WHEN** a fila tem um pedido "Concluído" de ontem e uma "Com exigência" de uma semana atrás
- **THEN** a exigência aparece no topo, sob "Com pendência", e o concluído no fim, sob
  "Encerrados"

#### Scenario: Vencido sobe dentro da banda

- **WHEN** dois pedidos "Novo" estão em "Aguardando" e só um tem o prazo vencido
- **THEN** o vencido aparece acima do outro, com o selo de prazo vencido

#### Scenario: Indeferido é encerrado

- **WHEN** a fila tem um pedido "Indeferido"
- **THEN** ele aparece sob "Encerrados", não sob "Com pendência"

#### Scenario: Filtro por andamento

- **WHEN** o operador filtra por "Aguardando pagamento"
- **THEN** só pedidos nesse andamento aparecem na lista, sem cabeçalho de banda

#### Scenario: Busca por protocolo

- **WHEN** o operador busca por `REQ.2026.000482`
- **THEN** só o pedido daquele protocolo aparece

#### Scenario: Busca por nome

- **WHEN** o operador busca por parte do nome do solicitante
- **THEN** os pedidos cujo nome contém o texto buscado aparecem, sem diferenciar maiúsculas de
  minúsculas

#### Scenario: Linha leva ao detalhe

- **WHEN** o operador clica numa linha da fila
- **THEN** a tela de detalhe daquele protocolo abre
