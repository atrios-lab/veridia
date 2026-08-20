# service-request (delta)

## ADDED Requirements

### Requirement: Upload de anexos direto do navegador para o storage
Os anexos do cidadão DEVEM (SHALL) subir do navegador direto para o storage de blobs, sem
transitar no corpo da server action, em todos os fluxos do cidadão: anexos do pedido em
`/solicitar`, requerimento assinado, "anexar outro documento" e resposta de exigência. A
emissão do token de upload DEVE (SHALL) ser autorizada por rota do servidor que impõe tipo
permitido, tamanho máximo de 20 MB por arquivo e pathname gerado pelo servidor (nunca o nome vindo do
navegador), com rate limit. A server action que grava o pedido DEVE (SHALL) revalidar as
referências recebidas (quantidade, tipo, tamanho e origem no nosso store) antes de vinculá-las
ao registro; a URL do blob NÃO DEVE (SHALL NOT) ser exibida na UI nem servir de canal de
download — o download continua pelas rotas protegidas por protocolo + chave. Em ambiente sem
storage de blobs configurado, o envio DEVE (SHALL) seguir pelo corpo da action como antes.

#### Scenario: Anexo de 20 MB em produção
- **WHEN** o cidadão anexa um arquivo de 20 MB e envia o pedido no deploy de produção
- **THEN** o upload completa e o pedido é protocolado com o anexo, sem erro de limite de corpo da plataforma

#### Scenario: Token não autoriza fora das regras
- **WHEN** um cliente pede token de upload para um tipo não permitido, tamanho acima do máximo ou pathname fora do prefixo de anexos
- **THEN** a rota recusa a emissão do token

#### Scenario: Action não confia na referência do cliente
- **WHEN** a submissão chega com referência de anexo apontando para fora do nosso store, ou declarando tipo/tamanho fora dos limites
- **THEN** o servidor rejeita a submissão com mensagem clara e nada é gravado

#### Scenario: Desenvolvimento sem storage de blobs
- **WHEN** o app roda sem token do storage configurado
- **THEN** os anexos seguem no corpo da action e são gravados em disco local, com as mesmas validações

### Requirement: Validação de anexos no cliente antes do upload
A seleção de arquivos DEVE (SHALL) ser validada no cliente com as mesmas regras do núcleo
(quantidade, tipo, tamanho), mostrando a mensagem de recusa imediatamente e sem iniciar upload
do arquivo recusado. Arquivo com MIME vazio e extensão `.heic`/`.heif` DEVE (SHALL) ser tratado
como HEIC no cliente; no servidor, MIME vazio só é aceito se os magic bytes confirmarem HEIC. O
`accept` do input DEVE (SHALL) incluir as extensões `.heic,.heif` além dos MIMEs. O servidor
permanece a fronteira de confiança.

#### Scenario: Arquivo grande recusado sem upload
- **WHEN** o cidadão seleciona um arquivo de 30 MB
- **THEN** a mensagem de tamanho máximo aparece imediatamente e nenhum byte é enviado

#### Scenario: Foto HEIC sem MIME aceita
- **WHEN** o cidadão seleciona uma foto `.heic` que o navegador reporta sem MIME
- **THEN** o arquivo é aceito no cliente e no servidor, confirmado pelos magic bytes

#### Scenario: Executável renomeado recusado
- **WHEN** um arquivo com MIME vazio e extensão `.heic` não tem magic bytes de HEIC
- **THEN** o servidor recusa com a mensagem de tipo inválido

## MODIFIED Requirements

### Requirement: Formulário do pedido com aceites e anti-spam invisível
O formulário DEVE (SHALL) pedir nome, e-mail/WhatsApp, CPF opcional, descrição (obrigatória quando o
ato exige), finalidade quando o ato exige, anexos opcionais (até 5, imagem ou PDF, validados
no cliente antes do upload e revalidados no servidor) e aceites obrigatórios de LGPD e
veracidade. Os aceites DEVEM (SHALL) ser persistidos no registro do pedido com a data do
consentimento: a prova do consentimento cabe ao controlador (LGPD art. 8 §2), e um aceite
validado e descartado não é prova. O anti-spam DEVE (SHALL) ser um honeypot invisível (campo
`website`): sem CAPTCHA. Submissões com honeypot preenchido DEVEM (SHALL) receber resposta de
sucesso falsa sem gravação. A rota DEVE (SHALL) aplicar rate limit.

#### Scenario: Aceites obrigatórios
- **WHEN** o cidadão envia sem marcar um dos aceites
- **THEN** o servidor rejeita com erro de validação apontando o aceite faltante

#### Scenario: Aceites gravados como prova
- **WHEN** um pedido é protocolado com os dois aceites marcados
- **THEN** o registro do pedido carrega os aceites com a data do consentimento, consultáveis depois

#### Scenario: Robô cai no honeypot
- **WHEN** uma submissão chega com o campo `website` preenchido
- **THEN** a resposta simula sucesso e nenhum pedido é gravado

#### Scenario: Anexo inválido
- **WHEN** um arquivo que não é imagem nem PDF (ou excede o tamanho máximo) é selecionado ou chega ao servidor
- **THEN** o cliente recusa na seleção com mensagem clara, e o servidor rejeita a submissão que passar por fora, independentemente do `accept` do input
