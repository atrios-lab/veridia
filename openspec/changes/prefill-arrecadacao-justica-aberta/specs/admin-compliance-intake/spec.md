## ADDED Requirements

### Requirement: Receita bruta pré-preenchida com origem e data
Quando o config da serventia carregar a receita bruta levantada no Justiça Aberta, a Seção 1 SHALL
apresentar os campos de receita do último semestre e do semestre anterior já preenchidos com esses
valores, e SHALL exibir, junto de cada campo preenchido, a origem do dado e a data da extração,
convidando à correção. O valor pré-preenchido SHALL ser editável, e o que a serventia digitar SHALL
prevalecer. A classe, a subclasse e os prazos SHALL ser calculados a partir do valor que estiver no
campo, seja ele o pré-preenchido ou o corrigido. Uma serventia sem receita no config SHALL ver os
campos vazios, como hoje.

#### Scenario: Valor vem preenchido com a data da extração
- **WHEN** a titular de uma serventia cujo config traz receita extraída em 10/07/2026 abre a Seção 1
- **THEN** o campo mostra o valor levantado e a nota de que veio do Justiça Aberta naquela data, com o convite a corrigir se declarou depois

#### Scenario: A correção da serventia prevalece
- **WHEN** a titular substitui o valor pré-preenchido por outro
- **THEN** a classe e os prazos passam a refletir o valor digitado, e a nota de origem deixa de valer para aquele campo

#### Scenario: Serventia sem receita no config
- **WHEN** uma serventia cujo config não traz receita abre a Seção 1
- **THEN** os dois campos aparecem vazios e a seção se comporta como antes desta mudança

### Requirement: Receita ausente na origem nunca vira zero
Receita igual a zero na origem SHALL ser tratada como declaração ausente, não como valor: o campo
SHALL aparecer vazio e SHALL informar que o Justiça Aberta não tinha declaração para aquele semestre
na data da extração. O sistema SHALL NOT pré-preencher o número zero, e SHALL NOT calcular classe,
subclasse ou prazo a partir de uma receita ausente. Os dois semestres SHALL ser avaliados de forma
independente.

#### Scenario: Zero na origem chega como campo vazio
- **WHEN** a serventia tem receita zero no semestre atual na origem
- **THEN** o campo do último semestre aparece vazio, com a nota de que não havia declaração na extração, e nenhuma classe é exibida

#### Scenario: Um semestre ausente não apaga o outro
- **WHEN** a origem traz zero no semestre atual e valor no semestre anterior
- **THEN** o campo do semestre anterior vem preenchido com sua nota de origem, e o do último semestre fica vazio

#### Scenario: Ausência não classifica
- **WHEN** a receita do último semestre está vazia
- **THEN** a tela inicial do módulo continua dizendo que a classe aparece assim que a receita for informada

### Requirement: Aviso quando a receita fica perto de um teto de classe
A Seção 1 SHALL exibir um aviso junto do campo quando a receita bruta informada ficar a menos de 10%
de um teto de classe do art. 16, nomeando a fronteira, a distância até ela e o que muda de um lado
para o outro: prazo da Etapa 1 e obrigatoriedade do encarregado. O aviso SHALL NOT impedir a
resposta, o avanço da seção nem o envio.

#### Scenario: Logo acima do teto da Classe 1
- **WHEN** a serventia informa R$ 303.767,52
- **THEN** a tela mostra a classificação como Classe 2 e avisa que o valor está a menos de R$ 4.000 do limite com a Classe 1, dizendo o que muda entre as duas

#### Scenario: Logo abaixo do teto da Classe 1
- **WHEN** a serventia informa R$ 297.556,06
- **THEN** a tela mostra Classe 1 e avisa a proximidade do limite com a Classe 2

#### Scenario: Longe de qualquer teto
- **WHEN** a serventia informa R$ 98.562,53
- **THEN** nenhum aviso de fronteira aparece

#### Scenario: O aviso não bloqueia
- **WHEN** a serventia mantém um valor que está perto do teto
- **THEN** a seção conclui normalmente e o envio continua disponível
