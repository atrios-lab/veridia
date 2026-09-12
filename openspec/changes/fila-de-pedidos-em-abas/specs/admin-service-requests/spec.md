## MODIFIED Requirements

### Requirement: Fila de pedidos filtrável e pesquisável

`/admin/pedidos` SHALL listar os pedidos da serventia da sessão em abas, uma por andamento em
aberto, nesta ordem: Novo, Aguardando exigência, Aguardando pagamento, Pagamento informado, Pago,
Em andamento, Disponível para retirada; e uma aba Finalizados que reúne Concluído, Indeferido,
Cancelado e Arquivado. Em tela de mesa as abas SHALL ficar numa única linha, sem rolagem
lateral: quando a largura não comporta os rótulos completos, as abas de rótulo longo SHALL
mostrar a forma curta (Exigência, Aguard. pagamento, Pgto. informado, P/ retirada). Cada aba SHALL exibir a quantidade de protocolos que contém, sem
considerar filtro de atribuição nem busca. A aba ativa SHALL vir do parâmetro `aba` da URL, com
Novo como padrão; um valor desconhecido SHALL cair em Novo.

Dentro de uma aba em aberto a ordem SHALL ser: prazo vencido primeiro (o mais atrasado no topo),
depois os que vencem em até três dias úteis (o mais próximo no topo), depois os pausados por
exigência (o que aguarda o cidadão há mais tempo no topo), depois os demais por ordem de
chegada, do mais antigo ao mais novo. Na aba Finalizados a ordem SHALL ser do mais novo ao mais
antigo.

Cada linha SHALL mostrar checkbox de seleção, protocolo, nome do solicitante, ato com a sigla da
atribuição, data de criação e o botão "Detalhar". Nas abas em aberto a linha SHALL mostrar
também a coluna Prazo; na aba Finalizados, a coluna Situação com o andamento terminal (Concluído,
Indeferido, Cancelado ou Arquivado). A linha SHALL NOT mostrar contato nem valor.

A fila SHALL oferecer filtro por atribuição (só as atribuições da serventia) e busca por texto
que casa protocolo ou nome do solicitante, ambos aplicados dentro da aba ativa e refletidos na
URL (`atribuicao`, `q`). Com filtro ou busca ativos a fila SHALL oferecer "Limpar", que os
remove mantendo a aba.

A fila SHALL ser paginada em 10, 25 ou 50 por página (`por`, padrão 10; valor fora dessa lista
cai em 10), com a página em `pagina` (padrão 1). O rodapé SHALL informar "Exibindo X a Y de Z
pedidos" (ou "Nenhum registro") e oferecer navegação para primeira, anterior, próxima e última
página e para os números de página. Trocar de aba, mudar o filtro, buscar ou mudar o tamanho da
página SHALL voltar para a página 1. Uma página além da última SHALL mostrar a última.

O botão "Detalhar" SHALL levar ao detalhe daquele pedido. A linha inteira SHALL NOT ser um link.

#### Scenario: Aba padrão

- **WHEN** o operador abre `/admin/pedidos` sem parâmetros
- **THEN** a aba Novo está ativa e só pedidos em "Novo" aparecem

#### Scenario: Contador de cada aba

- **WHEN** a serventia tem 3 pedidos em "Novo", 2 em "Pago" e 40 encerrados
- **THEN** a aba Novo mostra 3, a aba Pago mostra 2 e a aba Finalizados mostra 40

#### Scenario: Contador ignora filtro

- **WHEN** a aba Novo tem 3 pedidos, sendo 1 de RCPN, e o operador filtra por RCPN
- **THEN** a aba Novo continua mostrando 3 e o rodapé diz "Exibindo 1 a 1 de 1 pedido"

#### Scenario: Pagamento informado tem aba própria

- **WHEN** um pedido está em "Pagamento informado"
- **THEN** ele aparece na aba Pagamento informado, e não nas abas Aguardando pagamento nem Pago

#### Scenario: Abas numa linha só

- **WHEN** o operador abre a fila numa tela entre 1280px e 1440px de largura
- **THEN** as oito abas aparecem lado a lado, na mesma linha, sem rolagem lateral, com os
  rótulos curtos onde os completos não cabem

#### Scenario: Finalizados reúne os terminais

- **WHEN** a fila tem um pedido "Concluído" e um "Indeferido"
- **THEN** os dois aparecem na aba Finalizados, cada um com a sua Situação, do mais novo ao mais
  antigo

#### Scenario: Vencido sobe dentro da aba

- **WHEN** dois pedidos "Novo" estão na aba Novo e só um tem o prazo vencido
- **THEN** o vencido aparece acima do outro, com o selo de prazo vencido

#### Scenario: Aba desconhecida

- **WHEN** o operador abre `/admin/pedidos?aba=qualquer`
- **THEN** a aba Novo está ativa

#### Scenario: Paginação

- **WHEN** a aba Finalizados tem 29 pedidos e o operador está na página 2 com 10 por página
- **THEN** a fila mostra o 11º ao 20º pedido e o rodapé diz "Exibindo 11 a 20 de 29 pedidos"

#### Scenario: Trocar tamanho da página volta ao início

- **WHEN** o operador está na página 3 e escolhe 25 por página
- **THEN** a fila volta para a página 1 com 25 por página

#### Scenario: Página além da última

- **WHEN** a aba tem 12 pedidos, 10 por página, e a URL pede `pagina=5`
- **THEN** a fila mostra a página 2

#### Scenario: Busca por protocolo

- **WHEN** o operador busca por `REQ.2026.000482` na aba onde ele está
- **THEN** só o pedido daquele protocolo aparece

#### Scenario: Busca por nome

- **WHEN** o operador busca por parte do nome do solicitante
- **THEN** os pedidos da aba cujo nome contém o texto buscado aparecem, sem diferenciar
  maiúsculas de minúsculas

#### Scenario: Limpar filtros

- **WHEN** o operador tem atribuição e busca ativas na aba Pago e aciona "Limpar"
- **THEN** a aba Pago continua ativa, sem filtro nem busca

#### Scenario: Detalhar leva ao detalhe

- **WHEN** o operador aciona "Detalhar" numa linha
- **THEN** a tela de detalhe daquele protocolo abre

#### Scenario: Aba vazia

- **WHEN** a aba ativa não tem pedidos com os filtros atuais
- **THEN** a fila mostra "Nenhum pedido encontrado" e o rodapé diz "Nenhum registro"

### Requirement: Urgência do prazo na fila e no detalhe do pedido

A fila de pedidos e o cabeçalho do detalhe SHALL exibir um badge de urgência derivado do prazo
vigente, contado em dias úteis: "vence em N dias" quando faltam 3 dias úteis ou menos, e
"vencido há N dias" quando a data prevista passou. Um pedido pausado por exigência SHALL mostrar
há quantos dias úteis aguarda o cidadão. Pedidos em andamento terminal SHALL NOT exibir
urgência.

Fora da janela de urgência, a fila SHALL mostrar a data prevista em texto simples ("Vence em
dd/mm") na coluna Prazo, e "—" para pedidos em Disponível para retirada; o detalhe SHALL NOT
exibir badge de prazo nesse caso.

#### Scenario: Pedido perto do vencimento

- **WHEN** o operador abre a fila e um pedido em andamento está a 3 dias ou menos da data
  prevista
- **THEN** a linha exibe o badge indicando em quantos dias o prazo vence

#### Scenario: Pedido vencido

- **WHEN** um pedido em andamento passou da data prevista
- **THEN** a fila e o detalhe exibem o badge com há quantos dias o prazo venceu

#### Scenario: Pedido com folga na fila

- **WHEN** um pedido em andamento tem mais de 3 dias úteis até a data prevista
- **THEN** a fila mostra "Vence em dd/mm" em texto simples, sem badge, e o detalhe não mostra
  prazo

#### Scenario: Disponível para retirada não tem prazo

- **WHEN** um pedido está em Disponível para retirada
- **THEN** a coluna Prazo mostra "—"

#### Scenario: Pedido encerrado não tem urgência

- **WHEN** um pedido está em andamento terminal, mesmo com a data prevista no passado
- **THEN** nenhum badge de urgência de prazo é exibido
