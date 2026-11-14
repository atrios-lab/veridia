## ADDED Requirements

### Requirement: Leitura dos documentos nos campos da guia
Os campos da guia, no site e no painel, DEVEM (SHALL) oferecer anexar os documentos para o sistema
ler e preencher. A leitura DEVE (SHALL) tomar só o que o texto diz de forma clara: as partes com
CPF ou CNPJ válido (nome, papel de transmitente ou adquirente pelo termo próximo, estado civil,
profissão e endereço), a matrícula, a inscrição imobiliária, a descrição e o tipo do imóvel e o
valor em reais. Ela DEVE (SHALL) preencher só os campos em branco, sem repetir uma parte já
informada, e a pessoa DEVE (SHALL) conferir antes de salvar.

#### Scenario: Matrícula em PDF pesquisável
- **WHEN** o cliente anexa a certidão da matrícula em PDF pesquisável
- **THEN** o proprietário entra como transmitente, com CPF, estado civil, profissão e endereço, e a matrícula, a inscrição e a descrição do imóvel ficam preenchidas para conferir

#### Scenario: Foto ou PDF sem texto
- **WHEN** o arquivo é uma foto ou um PDF digitalizado sem texto
- **THEN** o arquivo segue anexado e a tela diz que ele não foi lido, pedindo PDF pesquisável ou o preenchimento à mão

### Requirement: Os documentos lidos vão no campo de anexos do pedido
No site, os documentos anexados nos campos da guia DEVEM (SHALL) seguir com o pedido no campo de
anexos que já existe, sob a mesma regra de guarda (até 30 dias depois do encerramento do
protocolo), e a tela DEVE (SHALL) avisar o cliente para enviar em PDF pesquisável ou digitalizado
em ótima qualidade. No painel a leitura NÃO DEVE (SHALL NOT) guardar o arquivo, e a tela DEVE
(SHALL) lembrar a serventia de baixar os documentos do pedido para o seu arquivo (nuvem ou HD).

#### Scenario: Pedido de guia enviado
- **WHEN** o cliente lê a matrícula nos campos da guia e envia o pedido
- **THEN** a matrícula chega ao protocolo como anexo, junto dos demais documentos
