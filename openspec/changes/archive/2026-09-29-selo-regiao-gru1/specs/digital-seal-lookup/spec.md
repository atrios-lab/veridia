## ADDED Requirements

### Requirement: Chamadas ao TJ partem do Brasil
Toda requisição ao SIEX do TJRN feita para a consulta do selo (abertura de sessão, imagem do captcha e submissão da consulta) DEVE (SHALL) ser executada a partir de função hospedada na região `gru1` (São Paulo). A abertura da sessão e a submissão que a reutiliza DEVEM (SHALL) rodar na mesma região. A região das demais rotas do site NÃO DEVE (SHALL NOT) mudar por causa deste requisito.

#### Scenario: Imagem do captcha servida a partir de São Paulo
- **WHEN** o cidadão abre `/selo` e o navegador pede `/selo/captcha`
- **THEN** a função que atende a rota executa em `gru1`, e é dali que parte a requisição ao TJ

#### Scenario: Submissão na mesma região da sessão
- **WHEN** o cidadão envia a consulta pela página `/selo`
- **THEN** a server action executa em `gru1`, a mesma região em que a sessão do TJ foi aberta

#### Scenario: Resto do site não muda de região
- **WHEN** qualquer rota fora de `/selo` é atendida
- **THEN** ela continua na região padrão do projeto

### Requirement: Falha na conversa com o TJ fica registrada sem dado pessoal
Quando uma requisição ao TJ falhar (status HTTP não-sucesso, sessão sem `JSESSIONID`, timeout ou erro de rede), o servidor DEVE (SHALL) registrar em log a etapa (`session`, `captcha` ou `lookup`), o status HTTP quando houver, o motivo da falha e a região de execução. O registro NÃO DEVE (SHALL NOT) conter o identificador da sessão do TJ, o código do selo, o texto do captcha nem o endereço do cidadão. O registro NÃO DEVE (SHALL NOT) alterar o que o cidadão vê.

#### Scenario: TJ recusa a abertura da sessão
- **WHEN** o TJ responde 403 à abertura da sessão
- **THEN** o log registra etapa `session`, status 403 e a região, e o cidadão vê o mesmo aviso de imagem indisponível de antes

#### Scenario: Timeout na imagem do captcha
- **WHEN** a busca da imagem excede o tempo limite
- **THEN** o log registra etapa `captcha` e motivo `timeout`, sem status HTTP

#### Scenario: Sessão sem identificador
- **WHEN** o TJ responde 200 à abertura da sessão sem enviar `JSESSIONID`
- **THEN** o log registra etapa `session` e que a sessão veio sem identificador

#### Scenario: Nada do cidadão no log
- **WHEN** a submissão da consulta falha
- **THEN** o registro não contém o `JSESSIONID`, o código do selo nem o texto do captcha digitado
