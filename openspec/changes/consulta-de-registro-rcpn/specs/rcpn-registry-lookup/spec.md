## ADDED Requirements

### Requirement: Consulta "Seu registro é daqui?"
O site da serventia DEVE (SHALL) oferecer, gratuitamente, a consulta de registro do RCPN por
nome completo, nome da mãe e data de nascimento do registro. Antes de consultar, a pessoa DEVE
(SHALL) informar o próprio nome, CPF válido, número da OAB quando advogado, e a finalidade, de
uma lista, e DEVE (SHALL) marcar a declaração de que usará a informação só para essa
finalidade. A página DEVE (SHALL) ficar atrás do gating de seção do site.

#### Scenario: Consulta sem a declaração
- **WHEN** a pessoa tenta consultar sem marcar a declaração de finalidade
- **THEN** a consulta não é feita e o campo da declaração é indicado

### Requirement: Correspondência exata no site
A consulta pública DEVE (SHALL) considerar localizado só o registro em que os três dados batem,
ignorando acentos, maiúsculas, espaços repetidos e as partículas "de", "da", "do", "dos" e
"das" no meio do nome. A consulta pública NÃO DEVE (SHALL NOT) sugerir nomes parecidos nem
revelar dado de registro que não bata nos três.

#### Scenario: Acento diferente
- **WHEN** a pessoa digita o nome sem acento e a data e a mãe batem
- **THEN** o registro é localizado

#### Scenario: Só o nome bate
- **WHEN** o nome bate e a data de nascimento não
- **THEN** a resposta é a de não localizado, sem mencionar o registro de mesmo nome

### Requirement: Resposta de registro localizado
Com o registro localizado, a resposta DEVE (SHALL) dizer que o registro é desta serventia e
qual o tipo (nascimento, casamento ou óbito). Ela DEVE (SHALL) mostrar cada profissão declarada
no registro dizendo de quem é (pai, mãe, cônjuge, falecido). Também DEVE (SHALL) mostrar o
casamento ou o óbito encontrado no índice da serventia para a mesma pessoa (mesmo nome e mesma
data de nascimento), com a data. A resposta DEVE (SHALL) trazer o aviso de que a informação é
para orientação, não tem valor de certidão, e de que a certidão sai com todas as anotações e
averbações do registro. Ela também DEVE (SHALL) oferecer os pedidos de certidão (segunda via) e
de inteiro teor, já preenchidos com o registro localizado.

#### Scenario: Advogado consulta a profissão
- **WHEN** um advogado consulta um registro de casamento em que consta a profissão do cônjuge
- **THEN** a resposta mostra a profissão e de quem ela é, o aviso de orientação, e o botão de pedir o inteiro teor já preenchido

#### Scenario: Casamento encontrado na mesma serventia
- **WHEN** o registro de nascimento localizado tem, no índice, um casamento da mesma pessoa
- **THEN** a resposta informa que consta casamento registrado nesta serventia, com a data, e que a certidão de nascimento sai com a anotação do casamento

### Requirement: A resposta nunca afirma ausência
A resposta NÃO DEVE (SHALL NOT) afirmar que o registrado não é casado, que não é falecido, que
não há profissão no registro, ou que o registro não existe na serventia. Profissão vazia nos
dados DEVE (SHALL) ser dita como "não está nos dados digitais; o livro pode trazer", com o
pedido de busca oferecido. Registro não localizado DEVE (SHALL) ser dito como não encontrado nos
dados digitais, informando o período que eles cobrem, com o pedido de busca (`rcpn-busca`)
oferecido, já preenchido com os dados consultados.

#### Scenario: Registro antigo fora do índice
- **WHEN** a pessoa consulta um registro anterior ao período coberto pelo índice
- **THEN** a resposta diz que não foi encontrado nos dados digitais, mostra o período coberto e oferece o pedido de busca

#### Scenario: Profissão não digitada
- **WHEN** o registro localizado não tem a profissão nos dados
- **THEN** a resposta diz que a profissão não está nos dados digitais e oferece a busca para conferência no livro

### Requirement: Proteção da consulta pública
Toda consulta DEVE (SHALL) ser registrada com os dados consultados, quem consultou, a
finalidade, o resultado (localizado ou não, sem a resposta completa) e o IP com hash. A
consulta DEVE (SHALL) ter limite de tentativas por IP e por CPF de quem consulta, no padrão da
página de verificação de documentos. O registro das consultas DEVE (SHALL) ser visível na área
RCPN do painel a quem tem a permissão de importar.

#### Scenario: Muitas consultas seguidas
- **WHEN** um mesmo IP passa do limite de consultas
- **THEN** novas consultas são recusadas por um tempo, com mensagem clara, e o excesso fica registrado
