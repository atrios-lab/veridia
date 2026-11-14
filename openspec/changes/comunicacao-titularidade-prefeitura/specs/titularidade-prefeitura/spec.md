## ADDED Requirements

### Requirement: Ler a escritura ou o registro
O painel DEVE (SHALL) aceitar o PDF pesquisável ou o Word (.docx) da escritura ou do registro e
preencher, a partir do texto, o serviço e o ato, a data, o livro e as folhas, a operação da tabela
da DOI, o imóvel, os valores e as partes com CPF ou CNPJ válido. O que o texto não diz NÃO DEVE
(SHALL NOT) ser adivinhado. O arquivo NÃO DEVE (SHALL NOT) ser guardado.

#### Scenario: Escritura em Word
- **WHEN** a serventia envia o traslado de uma compra e venda em .docx
- **THEN** a operação vem como "Compra e venda", a data e o livro preenchidos, e a vendedora em transmitentes e o comprador em adquirentes

#### Scenario: PDF digitalizado
- **WHEN** o arquivo não tem texto
- **THEN** o painel diz que não há o que ler e pede o preenchimento à mão

### Requirement: Ato completo antes de entrar na comunicação
O ato DEVE (SHALL) ter a data, a operação (CNN, art. 184-A, § 3º), ao menos um transmitente e um
adquirente, CPF ou CNPJ válido quando informado, e matrícula, inscrição imobiliária ou endereço.

#### Scenario: Sem operação
- **WHEN** a operação não é escolhida
- **THEN** o painel recusa e cita o art. 184-A, § 3º

### Requirement: Comunicação do mês e prazo
Os atos DEVEM (SHALL) ser agrupados pelo mês em que foram praticados, com o prazo no último dia
útil do mês seguinte, contado no calendário da serventia, e o aviso de prazo vencido sem envio.

#### Scenario: Dezembro
- **WHEN** o mês é novembro de 2026
- **THEN** o prazo é 30/12/2026, porque 31/12 não tem expediente

### Requirement: Ofício à Secretaria Municipal de Tributação
O painel DEVE (SHALL) gerar o ofício numerado do mês, com o destinatário, a fundamentação (CNN,
art. 184-A; Resolução CNJ nº 547/2024, art. 4º), a gratuidade (§ 9º), a relação e a ficha de cada
ato; sem ato, o ofício sem movimento. O ofício DEVE (SHALL) poder ser assinado digitalmente ou
impresso, e o envio registrado com data, canal e recibo.

#### Scenario: Registrar o envio
- **WHEN** a serventia informa a data, o canal e o recibo
- **THEN** o mês aparece como enviado, com o recibo

### Requirement: Planilha do mês
O painel DEVE (SHALL) oferecer a planilha do mês, com o código da operação da DOI ao lado da
descrição, aberta no Excel.

#### Scenario: Baixar a planilha
- **WHEN** a serventia clica em "Planilha do mês"
- **THEN** recebe um CSV com uma linha por ato

### Requirement: Alterar e excluir sem apagar
Todo ato e todo ofício DEVEM (SHALL) poder ser alterados ou excluídos com justificativa; a
exclusão só marca, e cada ato vai para a auditoria. A permissão própria DEVE (SHALL) aparecer em
Perfis e permissões.

#### Scenario: Excluir em duplicidade
- **WHEN** um ato lançado duas vezes é excluído com justificativa
- **THEN** ele sai do mês e fica guardado, com quem excluiu, quando e por quê
