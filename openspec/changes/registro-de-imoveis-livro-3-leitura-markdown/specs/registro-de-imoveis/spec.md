## ADDED Requirements

### Requirement: Leitura do Livro 3 e documento guardado em Markdown
O sistema DEVE (SHALL) ler o arquivo de um registro do Livro 3, extrair natureza, título, partes, valores, garantias, averbações e anotações para conferência, e, quando a serventia escolher guardar só o texto, DEVE (SHALL) guardar o documento em Markdown e não manter o arquivo original no armazenamento.

#### Scenario: Cédula anexada só como texto
- **WHEN** a funcionária anexa a cédula no Livro 3 com "Guardar só o texto"
- **THEN** a conferência mostra os campos lidos, o anexo fica como .md e o arquivo original é descartado

### Requirement: Anotações do Livro 3
O sistema DEVE (SHALL) permitir lançar, editar e apagar anotações num registro do Livro 3, guardando o texto anterior a cada edição, e NÃO DEVE (SHALL NOT) tirar uma anotação apagada do banco: ela fica oculta e pode ser restaurada.

#### Scenario: Anotação editada
- **WHEN** a funcionária altera o texto de uma anotação
- **THEN** o registro mostra o texto novo e guarda o anterior no histórico da anotação
