## MODIFIED Requirements

### Requirement: Payload Pix com valor fixo montado a partir da chave e do município da serventia

O núcleo SHALL montar o payload Pix EMV ("Copia e Cola") de uma cobrança a partir de quatro
entradas: a chave Pix da serventia, o município cadastrado da serventia, o nome da serventia e o
valor em centavos do pedido. O payload SHALL ser um Pix estático (ponto de iniciação `11`), com o
valor fixado no campo correspondente e com o número do protocolo (sem pontuação) como
identificador da transação. O CRC16 final SHALL ser calculado sobre o restante do payload e
conferido por teste contra payloads Pix válidos conhecidos.

Esta é regra pura: SHALL viver em `src/core`, sem I/O e sem depender de pacote externo para a
montagem do TLV ou o cálculo do CRC.

#### Scenario: Payload muda com o valor
- **WHEN** dois pedidos da mesma serventia têm valores diferentes
- **THEN** os payloads gerados diferem apenas no campo de valor e no CRC recalculado

#### Scenario: Protocolo vira identificador da transação
- **WHEN** o protocolo é `REQ.2026.000148`
- **THEN** o payload traz `REQ2026000148` como identificador da transação, sem pontuação

#### Scenario: CRC confere com um payload Pix válido conhecido
- **WHEN** os mesmos dados de entrada de um payload Pix de referência, publicamente conhecido como
  válido, são usados
- **THEN** o payload montado pelo núcleo é byte a byte idêntico ao de referência

### Requirement: QR code e código Copia e Cola exibidos quando o payload puder ser montado

A consulta pública de protocolo SHALL exibir um QR code e o texto "Copia e Cola" correspondente,
com botão de copiar, quando um pedido tem valor definido e a serventia tem chave Pix cadastrada. O
município, sendo dado estrutural sempre presente para uma serventia válida, deixa de ser uma
condição separada. O QR SHALL ser desenhado no servidor, como SVG, sem chamada a serviço externo
de geração de QR.

#### Scenario: QR aparece com valor e chave presentes
- **WHEN** um pedido tem valor definido e a serventia tem chave Pix cadastrada
- **THEN** a consulta de protocolo mostra o QR code e o código Copia e Cola com botão de copiar

#### Scenario: Nenhum payload sai para serviço externo
- **WHEN** a consulta de protocolo é aberta com QR disponível
- **THEN** o QR é renderizado inteiramente a partir de dados já carregados no servidor, sem
  requisição a API de terceiro para desenhar a imagem

### Requirement: Sem chave, nenhum QR incompleto é exibido

Faltando a chave Pix ou o valor do pedido, o sistema NÃO SHALL tentar montar ou exibir um QR code
parcial. A ausência de qualquer um dos dois SHALL ser tratada como "sem cobrança Pix disponível",
sem erro visível ao cidadão. O município não entra mais nessa checagem: é dado estrutural do
tenant, sempre presente para uma serventia validada por `parseTenant`.

#### Scenario: Pedido sem valor não gera QR
- **WHEN** um pedido não tem `amountCents` definido
- **THEN** nenhum QR é exibido, mesmo que a serventia tenha chave Pix cadastrada

#### Scenario: Serventia sem chave não gera QR
- **WHEN** a serventia não tem chave Pix cadastrada
- **THEN** nenhum QR é exibido, mesmo que o pedido tenha valor definido

## REMOVED Requirements

### Requirement: Cidade da serventia cadastrada e validada no bloco Cobrança

**Reason**: a cidade do Merchant City deixou de ser um valor por-chave, digitado pelo registrador
na aba Cobrança, e passou a ser o município estrutural do tenant (`tenant.municipality`),
definido uma vez em `src/core/tenant/tenants/*.ts` — o mesmo tratamento já dado a nome e CNS. Ver
`prefill-pix-city-from-tenant` e o requirement modificado de `admin-office-settings` ("Dados
estruturais aparecem em leitura, nunca em edição").

**Migration**: nenhuma migração de dado é necessária. `pix.city`, gravado como override em
`tenant_content`, para de ser lido (o schema não declara mais o campo); toda serventia passa a
usar `tenant.municipality`, preenchido no código de cada tenant no mesmo commit que remove este
requirement. O campo "Cidade" some da aba Cobrança; o formulário volta a ter só tipo e valor da
chave.
