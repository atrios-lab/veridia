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
impresso.

#### Scenario: Mês sem ato
- **WHEN** o mês não teve ato de mudança de titularidade
- **THEN** o painel gera o ofício sem movimento, com a mesma fundamentação

### Requirement: Envio eletrônico mediante recibo de entrega
O envio DEVE (SHALL) ser registrado como remessa por meio eletrônico à plataforma do CNB/CF
(notas), do ONR (registro de imóveis) ou às duas (CNN, art. 184-A, § 2º), com a data e o número do
recibo de entrega, que é obrigatório; o comprovante PODE (MAY) ser anexado. A entrega do ofício em
papel à SEMUT PODE (MAY) ser registrada à parte e NÃO DEVE (SHALL NOT) contar como o envio.

#### Scenario: Registrar o envio
- **WHEN** a serventia informa a data, a plataforma e o recibo de entrega
- **THEN** o mês aparece como enviado, com a plataforma, o recibo e o comprovante

#### Scenario: Só protocolo na prefeitura
- **WHEN** alguém tenta registrar o envio sem plataforma ou sem recibo
- **THEN** o painel recusa e cita o art. 184-A, § 2º

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

### Requirement: Arquivos da Carga CTP e da DOI
O painel DEVE (SHALL) gerar, dos atos do mês, a Carga CTP (Comunicação de Transações às
Prefeituras) em XML, JSON, TXT separado por "|" e CSV, e a DOI com os nomes de campo e os códigos do
manual de importação da DOI-Web (JSON) e em XML; e a DOI de cada ato. O ofício DEVE (SHALL) sair
também em Word. Campo que o título não traz NÃO DEVE (SHALL NOT) ser inventado nem enviado vazio.

#### Scenario: Baixar a DOI do mês
- **WHEN** a serventia escolhe "DOI · JSON (DOI-Web)"
- **THEN** recebe `doi-AAAA-MM.json` com uma declaração por ato, operação, partes e imóvel com os códigos da DOI

### Requirement: Mês negativo e numeração do ofício
Sem ato no mês, o botão DEVE (SHALL) ser "Mês negativo". O ofício DEVE (SHALL) ter Editar (refazer
com os atos atuais e a data), Modificar numeração (número do ano não usado por outro ofício) e
Excluir, todos com justificativa; cada ato DEVE (SHALL) ter Editar e Excluir.

#### Scenario: Número já usado
- **WHEN** alguém tenta dar a um ofício o número de outro
- **THEN** o painel recusa e diz qual número já está em uso

### Requirement: Pergunta na guia
A guia de ITIV ou ITCD DEVE (SHALL) perguntar se a serventia deseja gerar a comunicação à prefeitura
e a DOI, e abrir o ato preenchido com as partes, o imóvel, a operação e o valor da guia.

#### Scenario: Da guia ao ato
- **WHEN** a serventia clica em "Sim, gerar a comunicação" numa guia de ITIV
- **THEN** o formulário abre com transmitentes, adquirentes, imóvel e valor da guia, faltando a data, o livro e as folhas
