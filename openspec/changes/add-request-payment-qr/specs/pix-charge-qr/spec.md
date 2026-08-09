## ADDED Requirements

### Requirement: Payload Pix com valor fixo montado a partir da chave e da cidade da serventia

O núcleo SHALL montar o payload Pix EMV ("Copia e Cola") de uma cobrança a partir de quatro
entradas: a chave Pix da serventia, a cidade cadastrada da serventia, o nome da serventia e o
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
com botão de copiar, quando um pedido tem valor definido e a serventia tem chave Pix e cidade
cadastradas simultaneamente. O QR SHALL ser desenhado no servidor, como SVG, sem chamada a serviço
externo de geração de QR.

#### Scenario: QR aparece com os três dados presentes
- **WHEN** um pedido tem valor definido e a serventia tem chave e cidade cadastradas
- **THEN** a consulta de protocolo mostra o QR code e o código Copia e Cola com botão de copiar

#### Scenario: Nenhum payload sai para serviço externo
- **WHEN** a consulta de protocolo é aberta com QR disponível
- **THEN** o QR é renderizado inteiramente a partir de dados já carregados no servidor, sem
  requisição a API de terceiro para desenhar a imagem

### Requirement: Sem chave ou sem cidade, nenhum QR incompleto é exibido

Faltando a chave Pix, a cidade, ou o valor do pedido, o sistema NÃO SHALL tentar montar ou exibir
um QR code parcial. A ausência de qualquer um dos três SHALL ser tratada como "sem cobrança Pix
disponível", sem erro visível ao cidadão.

#### Scenario: Serventia com chave mas sem cidade
- **WHEN** a serventia tem chave Pix cadastrada e nenhuma cidade cadastrada
- **THEN** nenhum QR é exibido, mesmo que o pedido tenha valor definido

#### Scenario: Pedido sem valor não gera QR
- **WHEN** um pedido não tem `amountCents` definido
- **THEN** nenhum QR é exibido, mesmo que a serventia tenha chave e cidade cadastradas

### Requirement: Cidade da serventia cadastrada e validada no bloco Cobrança

O bloco "Chave Pix da serventia" (`/admin/configuracoes/cobranca`) SHALL incluir um campo
"Cidade", obrigatório para salvar em conjunto com a chave. O servidor SHALL normalizar o valor
gravado para maiúsculas sem acento e SHALL recusar a gravação quando o valor exceder 15
caracteres após a normalização, com erro no campo. A permissão para gravar SHALL ser a mesma já
exigida para a chave Pix (`billing.edit`).

#### Scenario: Cidade acompanha a chave ao salvar
- **WHEN** um usuário com `billing.edit` salva tipo, valor e cidade válidos
- **THEN** os três ficam gravados juntos como override da serventia

#### Scenario: Cidade em branco é recusada
- **WHEN** o formulário é enviado com chave válida e cidade em branco
- **THEN** nada é gravado e o campo de cidade exibe erro

#### Scenario: Serventia com chave cadastrada antes desta mudança
- **WHEN** uma serventia tem chave Pix cadastrada e nunca preencheu cidade
- **THEN** a tela de Cobrança mostra o campo Cidade vazio, e a consulta de protocolo se comporta
  como se não houvesse chave, até a cidade ser preenchida
