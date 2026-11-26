## ADDED Requirements

### Requirement: Exportar o acervo do Registro de Imóveis
O sistema DEVE (SHALL) exportar matrículas, atos, pessoas, Indicador Real e Indicador Pessoal em .xlsx, .csv e .json, e a cópia do acervo inteiro em JSON, só para quem tem a permissão de gerar os arquivos, registrando cada exportação na auditoria.

#### Scenario: Planilha de matrículas
- **WHEN** a funcionária baixa as matrículas em .xlsx
- **THEN** a planilha traz uma linha por matrícula com todos os campos e os proprietários atuais, no mesmo formato que a importação lê

### Requirement: Importar sem substituir
O sistema DEVE (SHALL) importar planilhas, JSON e os arquivos da ONR (Indicador Real, Banco Light e lote de CNM) depois de mostrar a conferência, e NÃO DEVE (SHALL NOT) apagar nem substituir o que já está cadastrado: matrícula existente só tem campos vazios completados quando a serventia pede, e ato com número já lançado fica de fora.

#### Scenario: Matrículas novas na planilha
- **WHEN** a serventia acrescenta matrículas na planilha exportada e a importa de volta
- **THEN** entram só as matrículas novas, e as que já existiam ficam como estavam

#### Scenario: Mesmo arquivo duas vezes
- **WHEN** a cópia do acervo é importada de novo
- **THEN** nada novo entra e nenhum dado muda
