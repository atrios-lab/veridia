## ADDED Requirements

### Requirement: Livros no modelo da Lei nº 6.015/1973
O sistema DEVE (SHALL) gerar os Livros 1 a 5 no desenho dos anexos da Lei nº 6.015/1973, com o cabeçalho e as colunas de cada modelo.

#### Scenario: Livro 1 do mês
- **WHEN** a funcionária abre o Livro 1 de novembro
- **THEN** o PDF traz as colunas Nº de ordem, Data, Nome do apresentante, Natureza formal do título e Anotações, e o encerramento de cada dia

### Requirement: Certidões do Registro de Imóveis
O sistema DEVE (SHALL) emitir as certidões de inteiro teor, de registro e ônus, em resumo, por quesitos e negativa, no modelo da serventia, mencionando sempre as alterações posteriores ao ato (art. 21).

#### Scenario: Certidão de ônus de matrícula livre
- **WHEN** a matrícula não tem ônus nem restrições em vigor
- **THEN** a certidão de registro e ônus certifica que o imóvel está livre e desembaraçado de ônus reais, judiciais ou extrajudiciais

### Requirement: Encerramento diário do Protocolo com data do dia
O sistema DEVE (SHALL) lembrar o encerramento diário do Protocolo e encerrar os dias pendentes, cada um com a data do próprio dia.

#### Scenario: Semana encerrada na sexta
- **WHEN** a funcionária encerra na sexta os dias de segunda a sexta
- **THEN** sai um termo para cada dia, datado daquele dia, e o dia sem título sai "encerrado sem apontamentos"

### Requirement: Livro 5 na matrícula
O sistema DEVE (SHALL) mostrar, na matrícula, as pessoas que figuram nela, com os atos em que aparecem e a situação de cada uma.

#### Scenario: Matrícula com hipoteca
- **WHEN** a matrícula tem o proprietário e o credor de uma hipoteca
- **THEN** o painel "Pessoas (Livro 5)" lista os dois, com os atos e "proprietário" e "credor"
