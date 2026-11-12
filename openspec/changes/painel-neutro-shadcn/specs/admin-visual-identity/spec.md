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

#### Scenario: Trocar o estilo não repinta o painel

- **WHEN** o estilo do site é trocado e publicado
- **THEN** o painel administrativo daquela serventia (login, configurações, redefinir senha)
  continua com o tema neutro da plataforma, no acesso seguinte e em todos os outros

### Requirement: Prévia ao vivo antes de publicar

A tela SHALL apresentar uma prévia da home no formato de celular que reflita imediatamente estilo,
textos, imagens e seções escolhidos, antes de qualquer gravação. A prévia SHALL usar os tokens de
marca e a serifada do estilo em edição dentro da própria caixa, e só dentro dela: o painel ao
redor usa o tema neutro da plataforma e NÃO SHALL mudar de aparência com a seleção nem com a
publicação.

#### Scenario: Prévia reage antes de publicar

- **WHEN** o usuário seleciona outro estilo e digita outro título, sem publicar
- **THEN** a prévia passa a mostrar a nova paleta, a nova letra e o novo título de imediato

#### Scenario: Prévia não publicada não tematiza o painel

- **WHEN** a prévia está exibindo um estilo diferente do que está publicado
- **THEN** a sidebar, o cabeçalho e os cartões do painel ao redor da prévia continuam no tema
  neutro da plataforma, não no estilo em edição nem no publicado

## REMOVED Requirements

### Requirement: Painel administrativo herda o tema do tenant

**Reason**: O painel passa a ter um tema neutro e único da plataforma. A identidade de cada
serventia interessa a quem vê o site de fora; dentro do painel ela fica no selo e no nome. O
requisito que substitui este é "Tema neutro e único do painel", em `admin-design-system`.

**Migration**: Nenhuma ação da serventia e nenhum dado a migrar. O estilo publicado continua
gravado e continua valendo para o site público, para as prévias do site dentro do painel, para
os PDFs e para os e-mails. A parte que continua verdadeira deste requisito (cores de estado
iguais em toda serventia) passa a constar de "Tema neutro e único do painel".
