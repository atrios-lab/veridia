## ADDED Requirements

### Requirement: Livros do Registro de Imóveis com termos e assinatura
O sistema DEVE (SHALL) abrir e encerrar cada livro do Registro de Imóveis com o seu termo (Lei nº 6.015/1973, art. 4º). Os termos DEVEM sair para assinar digitalmente ou à mão. O sistema DEVE (SHALL) gerar o livro inteiro num PDF, permitir assinar as fichas em lote e encerrar o Protocolo de cada dia (art. 184). Ele NÃO DEVE (SHALL NOT) tirar um livro do banco: apagar só oculta, e alterar guarda os valores anteriores no histórico.

#### Scenario: Abrir e encerrar o Livro 2-A
- **WHEN** a funcionária abre o Livro 2-A em fichas, a partir da matrícula 1.001, e depois o encerra com a última ficha escriturada
- **THEN** os termos de abertura e de encerramento saem com o número, a forma, as fichas, a data e quem assina, prontos para assinar

#### Scenario: Protocolo do dia
- **WHEN** a funcionária pede o Protocolo de um dia em que houve prenotações e um título só para exame e cálculo
- **THEN** o PDF lista as prenotações do dia em ordem, com as colunas do art. 175, deixa de fora o título de exame e cálculo e fecha com o encerramento do dia

#### Scenario: Assinar as fichas em lote
- **WHEN** o oficial escolhe assinar as fichas de um livro
- **THEN** o assinador recebe até 20 fichas de uma vez e pede a senha do certificado uma só vez por lote

#### Scenario: Livro apagado por engano
- **WHEN** a funcionária apaga um livro lançado por engano, com justificativa
- **THEN** o livro sai da lista, continua guardado, aparece em "Apagados" e pode ser restaurado, e a auditoria registra tudo em português
