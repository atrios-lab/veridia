## ADDED Requirements

### Requirement: Livro 2 digital montado pelas fichas assinadas
O sistema DEVE (SHALL) levar ao acervo, com a confirmação do funcionário, o que a ficha assinada traz: a matrícula nova, os registros e averbações novos e as retificações, guardando o texto anterior no histórico. O sistema DEVE (SHALL) propor abrir o Livro 2 na data da averbação de transporte quando não houver Livro 2 aberto, e DEVE usar a imagem assinada como página do livro. Ao substituir uma página, a anterior DEVE ficar em "Alterações".

#### Scenario: Primeira ficha assinada
- **WHEN** o oficial assina a ficha da matrícula 1 e não há Livro 2 aberto
- **THEN** o sistema mostra a data da averbação de transporte lida na ficha e, depois que o oficial confirma que é a data do 1º ato de transporte, abre o Livro 2 a partir da matrícula 1

#### Scenario: A mesma matrícula assinada de novo
- **WHEN** a ficha da matrícula 7 é assinada de novo com uma averbação nova e um ato antigo com o texto corrigido
- **THEN** o sistema aponta "Nova averbação" e "Retificação de ato já lançado", aplica as duas ao acervo depois da confirmação, substitui a página no Livro 2 e põe a página anterior em "Alterações"

### Requirement: Documento guardado em texto volta em PDF
O sistema DEVE (SHALL) mostrar e baixar em PDF, reconstruído do Markdown, o documento cujo original foi descartado depois da leitura, dizendo qual era o formato original.

#### Scenario: Cédula do Livro 3 guardada em texto
- **WHEN** a funcionária clica em "Ver em PDF" num anexo guardado só em texto
- **THEN** abre um PDF com os títulos e os parágrafos do texto e a indicação "Original em PDF, guardado só o texto"
