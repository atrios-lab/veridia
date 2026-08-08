## MODIFIED Requirements

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

#### Scenario: Trocar o estilo também repinta o painel

- **WHEN** o estilo do site é trocado e publicado
- **THEN** o painel administrativo daquela serventia (login, configurações, redefinir senha)
  passa a herdar a mesma paleta e a mesma serifada, no próximo acesso

### Requirement: Prévia ao vivo antes de publicar

A tela SHALL apresentar uma prévia da home no formato de celular que reflita imediatamente estilo,
textos, imagens e seções escolhidos, antes de qualquer gravação. A prévia SHALL usar os tokens de
marca dentro da própria caixa; como o estilo publicado é o mesmo que o painel ao redor já usa,
alterar a seleção sem publicar não deve mudar a aparência do painel fora da caixa da prévia — só o
que está publicado tematiza o painel.

#### Scenario: Prévia reage antes de publicar

- **WHEN** o usuário seleciona outro estilo e digita outro título, sem publicar
- **THEN** a prévia passa a mostrar a nova paleta, a nova letra e o novo título de imediato

#### Scenario: Prévia não publicada não tematiza o painel

- **WHEN** a prévia está exibindo um estilo diferente do que está publicado
- **THEN** a sidebar, o cabeçalho e os cartões do painel ao redor da prévia continuam no estilo
  publicado, não no estilo em edição

## ADDED Requirements

### Requirement: Painel administrativo herda o tema do tenant

O painel administrativo autenticado SHALL renderizar toda tela de uma serventia — login,
dashboard, configurações e redefinir senha — com a paleta de marca (`--brand-*`) e a fonte
serifada do estilo publicado daquela serventia, resolvidos pelo tenant da sessão ou do host, a
mesma fonte de verdade que o site público já usa. Cores de estado (erro, aviso, sucesso, campo e
campo somente-leitura) SHALL
permanecer fixas independentemente do estilo, para que o significado de cada uma não varie entre
serventias.

#### Scenario: Duas serventias, dois painéis

- **WHEN** uma pessoa administra a serventia A (estilo Vinho & Pérola) e depois entra na serventia
  B (estilo Grafite & Cobre)
- **THEN** o painel de cada serventia usa a paleta e a serifada do próprio estilo publicado, sem
  configuração adicional

#### Scenario: Estado continua legível em qualquer estilo

- **WHEN** um formulário do painel exibe uma mensagem de erro, independentemente do estilo
  publicado da serventia
- **THEN** a cor de erro é a mesma em toda serventia
