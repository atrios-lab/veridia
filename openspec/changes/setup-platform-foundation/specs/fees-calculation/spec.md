## ADDED Requirements

### Requirement: Composicao do valor do ato

O sistema DEVE (SHALL) calcular o valor de um ato como utilitario puro, sem I/O, onde o total pago
pelo cidadao e a soma do emolumento com os fundos. O ISS DEVE (SHALL) ser calculado sobre o
emolumento e tratado como deducao da parte da serventia, e NAO DEVE (SHALL NOT) ser somado ao total
pago pelo cidadao. A base de calculo da NFS-e DEVE (SHALL) ser o emolumento.

#### Scenario: Total pago pelo cidadao

- **WHEN** um ato com emolumento e fundos e calculado
- **THEN** o total e a soma de emolumento e fundos, sem o ISS

#### Scenario: ISS como deducao

- **WHEN** o ISS e aplicado sobre o emolumento pela aliquota da serventia
- **THEN** ele reduz o liquido da serventia e nao altera o total pago pelo cidadao

#### Scenario: Base da nota fiscal

- **WHEN** a base de calculo da NFS-e e apurada
- **THEN** ela e igual ao emolumento

#### Scenario: Exemplo trabalhado cobre a regra

- **WHEN** um ato de exemplo com emolumento, fundos e aliquota conhecidos e calculado
- **THEN** total, ISS, liquido e base da nota conferem com os valores esperados no teste

### Requirement: Valores reais fora desta entrega

A carga dos valores reais da tabela de custas NAO DEVE (SHALL NOT) entrar nesta mudanca. A regra e
modelada e testada agora; a carga conferida celula a celula e entrega propria.

#### Scenario: Regra existe sem tabela real

- **WHEN** a fundacao e entregue
- **THEN** a regra de composicao esta testada e nenhuma tarifa real esta carregada
