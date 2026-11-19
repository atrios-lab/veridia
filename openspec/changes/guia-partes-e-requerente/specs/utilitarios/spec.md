## ADDED Requirements

### Requirement: Partes e requerente da guia

A guia SHALL ter a seção "Das partes", que identifica o vendedor (transmitente) e o comprador (adquirente) com os nomes em negrito e o CPF ou CNPJ. Quando o requerente é uma das partes, o rótulo daquela parte SHALL começar por "Requerente/". Quando o requerente é um terceiro, a seção SHALL trazer "Requerente (procurador)" com o nome e os dados do mandato, ou a indicação de que a procuração foi anexada. Os nomes no texto do requerimento SHALL sair em negrito no PDF e no Word.

#### Scenario: O comprador pede a guia
- **WHEN** o comprador pede a guia de ITIV
- **THEN** a seção diz "Requerente/Adquirente (comprador): **NOME** (CPF ...)."

#### Scenario: Um procurador pede a guia
- **WHEN** um terceiro pede por mandato e escreve o livro e a folha da procuração
- **THEN** a seção começa por "Requerente (procurador): **NOME**, CPF ..., por mandato: ..."

### Requirement: Pedido de guia pelo site por partes

O pedido de guia pelo site SHALL perguntar quem está pedindo e SHALL separar os anexos por parte: vendedor, comprador, imóvel e procuração. Ao marcar "Casado(a)", o pedido SHALL exigir o nome do cônjuge e o regime de bens. Se quem pede é um terceiro, o pedido SHALL exigir a procuração anexada ou os dados do mandato. Os anexos SHALL ser enviados direto ao armazenamento, sem passar pelo limite do corpo do pedido. Os pedidos de guia NÃO SHALL ser contados nas etapas de Pedidos.

#### Scenario: Casado sem cônjuge
- **WHEN** o cidadão marca "Casado(a)" e não informa o cônjuge ou o regime
- **THEN** o pedido é recusado com "Informe o nome do cônjuge." ou "Escolha o regime de bens."

#### Scenario: Contagem de Pedidos
- **WHEN** chega um pedido de guia pelo site
- **THEN** ele aparece em Utilitários › Guias e não aumenta o número de "Em análise" em Pedidos

### Requirement: Assinados à vista no Assinador

A página do Assinador SHALL mostrar sempre aberta a lista de documentos já assinados, inclusive os assinados dentro de um pedido. Cada item SHALL ter os botões "Abrir" e "Baixar".

#### Scenario: Baixar de novo
- **WHEN** o funcionário abre o Assinador
- **THEN** vê os documentos já assinados e pode baixar qualquer um de novo
