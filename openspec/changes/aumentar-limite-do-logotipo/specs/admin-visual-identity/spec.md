## MODIFIED Requirements

### Requirement: Troca de logotipo e da foto de abertura

A tela SHALL permitir enviar o logotipo da serventia — a versão para fundo claro e a versão para
fundo escuro, cada uma com prévia sobre o fundo em que é usada — e a fotografia do hero da home.
O servidor SHALL validar tipo e tamanho de cada arquivo antes de gravar e SHALL recusar o envio
inteiro quando um arquivo for inválido, sem alterar as imagens em vigor. O logotipo (claro e
escuro) SHALL aceitar até 3 MB; a foto de abertura SHALL aceitar até 4 MB. O selo institucional
(favicon, marca d'água e sidebar do painel) SHALL permanecer não editável pelo painel.

#### Scenario: Envio válido substitui a imagem no site

- **WHEN** o usuário envia um PNG de 300 KB como logotipo para fundo claro e publica
- **THEN** o cabeçalho do site público passa a exibir o novo logotipo

#### Scenario: Logotipo dentro do novo teto é aceito

- **WHEN** o usuário envia um PNG de 2,8 MB como logotipo para fundo escuro
- **THEN** o arquivo é aceito e gravado

#### Scenario: Arquivo grande demais é recusado

- **WHEN** o usuário envia um logotipo acima de 3 MB
- **THEN** nada é gravado, o logotipo em vigor permanece e a tela informa o limite de 3 MB

#### Scenario: Tipo não aceito é recusado no servidor

- **WHEN** chega um arquivo que não é imagem de um tipo aceito
- **THEN** nada é gravado, mesmo que o seletor de arquivos do navegador tenha sido contornado

#### Scenario: Serventia sem foto de abertura

- **WHEN** a serventia não tem fotografia de hero configurada
- **THEN** a home serve o degradê do estilo escolhido, e a tela oferece o envio sem apresentar
  imagem quebrada
