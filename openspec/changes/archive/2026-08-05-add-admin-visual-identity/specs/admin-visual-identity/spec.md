## ADDED Requirements

### Requirement: Aba Identidade Visual na faixa de Configurações

A rota `/admin/configuracoes/identidade-visual` SHALL exigir sessão válida na serventia do host e
a permissão `branding.edit`, checadas no servidor. A faixa de abas SHALL ser a mesma nas duas telas
de Configurações, com Serventia e Identidade Visual navegáveis por link e Encarregado e Cobrança
inertes, marcadas "em breve" e não focáveis por teclado.

#### Scenario: Navegação entre as duas abas implementadas

- **WHEN** um usuário com `branding.edit` abre `/admin/configuracoes` e clica em "Identidade Visual"
- **THEN** a URL passa a `/admin/configuracoes/identidade-visual`, a aba aparece selecionada e a
  aba Serventia continua acessível por um clique

#### Scenario: Acesso sem permissão

- **WHEN** um usuário autenticado sem `branding.edit` requisita
  `/admin/configuracoes/identidade-visual` por URL direta
- **THEN** o servidor recusa o acesso, sem revelar que a tela existe

### Requirement: Escolha do estilo do site

A tela SHALL apresentar os cinco estilos disponíveis como opções selecionáveis, exatamente uma
selecionada por vez, cada uma com as amostras de cor da própria paleta e o próprio nome escrito na
letra serifada daquele estilo. A seleção SHALL ser um controle de rádio acessível por teclado, com
o estilo em vigor marcado ao abrir a tela. O servidor SHALL recusar qualquer valor de estilo fora
dos cinco.

#### Scenario: Trocar o estilo repinta o site público

- **WHEN** o usuário seleciona "Marinho & Bronze" e aciona "Salvar e publicar"
- **THEN** o site público passa a servir a paleta e a serifada daquele estilo, sem novo deploy

#### Scenario: Estilo inexistente é recusado

- **WHEN** chega uma gravação com um estilo que não é um dos cinco
- **THEN** nada é gravado e o estilo em vigor permanece

#### Scenario: O painel não muda de estilo

- **WHEN** o estilo do site é trocado
- **THEN** o painel administrativo continua com a estética fixa da plataforma

### Requirement: Troca de logotipo e da foto de abertura

A tela SHALL permitir enviar o logotipo da serventia — a versão para fundo claro e a versão para
fundo escuro, cada uma com prévia sobre o fundo em que é usada — e a fotografia do hero da home.
O servidor SHALL validar tipo e tamanho de cada arquivo antes de gravar e SHALL recusar o envio
inteiro quando um arquivo for inválido, sem alterar as imagens em vigor. O selo institucional
(favicon, marca d'água e sidebar do painel) SHALL permanecer não editável pelo painel.

#### Scenario: Envio válido substitui a imagem no site

- **WHEN** o usuário envia um PNG de 300 KB como logotipo para fundo claro e publica
- **THEN** o cabeçalho do site público passa a exibir o novo logotipo

#### Scenario: Arquivo grande demais é recusado

- **WHEN** o usuário envia um logotipo acima do limite de tamanho
- **THEN** nada é gravado, o logotipo em vigor permanece e a tela explica o limite

#### Scenario: Tipo não aceito é recusado no servidor

- **WHEN** chega um arquivo que não é imagem de um tipo aceito
- **THEN** nada é gravado, mesmo que o seletor de arquivos do navegador tenha sido contornado

#### Scenario: Serventia sem foto de abertura

- **WHEN** a serventia não tem fotografia de hero configurada
- **THEN** a home serve o degradê do estilo escolhido, e a tela oferece o envio sem apresentar
  imagem quebrada

### Requirement: Textos de abertura da home

A frase de destaque e o título de boas-vindas do hero SHALL ser editáveis na aba e SHALL ser o que
a home pública exibe. Ambos SHALL ser obrigatórios e validados no servidor. Enquanto não houver
gravação, a home SHALL exibir os valores que a configuração da serventia já define.

#### Scenario: Texto editado aparece na home

- **WHEN** o usuário altera o título de boas-vindas e publica
- **THEN** o hero da home pública passa a exibir o novo título

#### Scenario: Texto em branco é recusado

- **WHEN** o formulário é publicado com a frase de destaque vazia
- **THEN** nada é gravado e o campo exibe o erro, com os demais valores preservados no formulário

### Requirement: Seções do site ligadas e desligadas

A tela SHALL listar as seções que a atribuição da serventia concede, com interruptor para as
opcionais e cadeado, sem interruptor, para as obrigatórias. Desligar uma seção opcional SHALL
retirá-la da navegação e das rotas do site público. Nenhuma gravação, forjada ou não, SHALL
desligar uma seção obrigatória, e nenhuma gravação SHALL ligar seção que a atribuição não concede.

#### Scenario: Desligar uma seção opcional

- **WHEN** o usuário desliga "Editais" e publica
- **THEN** o link some da navegação pública e a rota deixa de responder como seção ativa

#### Scenario: Seção obrigatória não tem interruptor

- **WHEN** o usuário abre a aba
- **THEN** Canal LGPD, Ouvidoria e Transparência aparecem com cadeado e sem controle que sugira
  desligá-las

#### Scenario: Gravação forjada não desliga o que é obrigatório

- **WHEN** chega uma gravação listando uma seção obrigatória como desligada
- **THEN** a seção continua no ar

#### Scenario: Seção não concedida não aparece

- **WHEN** a serventia não tem a atribuição que concede uma seção
- **THEN** a seção não aparece na lista, ligada ou desligada

### Requirement: Prévia ao vivo antes de publicar

A tela SHALL apresentar uma prévia da home no formato de celular que reflita imediatamente estilo,
textos, imagens e seções escolhidos, antes de qualquer gravação. A prévia SHALL usar apenas os
tokens de marca dentro da própria caixa, sem alterar a estética do painel ao redor.

#### Scenario: Prévia reage antes de publicar

- **WHEN** o usuário seleciona outro estilo e digita outro título, sem publicar
- **THEN** a prévia passa a mostrar a nova paleta, a nova letra e o novo título de imediato

#### Scenario: Prévia não vaza para o painel

- **WHEN** a prévia está exibindo um estilo diferente do que está publicado
- **THEN** a sidebar, o cabeçalho e os cartões do painel continuam com as cores fixas da plataforma

### Requirement: Publicação atômica com descarte

A aba SHALL gravar todas as suas escolhas numa única operação, acionada por "Salvar e publicar".
Nenhuma alteração SHALL valer no site público antes disso. "Descartar mudanças" SHALL devolver o
formulário e a prévia ao que está publicado. Uma gravação bem-sucedida SHALL registrar entrada em
`audit_log` com autor, ação e serventia, e SHALL revalidar o site público.

#### Scenario: Nada vale antes de publicar

- **WHEN** o usuário troca estilo, textos e seções e sai da tela sem publicar
- **THEN** o site público continua exatamente como estava

#### Scenario: Descartar volta ao publicado

- **WHEN** o usuário aciona "Descartar mudanças"
- **THEN** o formulário e a prévia voltam ao estado publicado, sem gravar nada

#### Scenario: Uma gravação, um rastro

- **WHEN** uma publicação é aceita
- **THEN** existe uma linha em `audit_log` identificando quem publicou, em qual serventia e
  quando, e o site público passa a servir o novo conteúdo

#### Scenario: Falha de gravação não publica pela metade

- **WHEN** a gravação falha no banco
- **THEN** nenhuma das escolhas passa a valer e a tela informa a falha preservando o que foi
  preenchido

### Requirement: Fronteira do que a serventia pode alterar sobre si

A gravação da aba SHALL aceitar apenas estilo, logotipos, foto de abertura, textos de abertura e
seções desligadas. Nome, CNS, atribuições e selo SHALL permanecer fora da forma gravável, de modo
que uma gravação que os carregue não os altere.

#### Scenario: Campo fora do escopo é descartado

- **WHEN** chega uma gravação carregando `attributions` ou `cns` junto das escolhas visuais
- **THEN** as escolhas visuais são gravadas e os demais campos são descartados sem efeito
