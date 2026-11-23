## MODIFIED Requirements

### Requirement: Escolha do estilo do site

A tela SHALL apresentar os dez estilos disponíveis como opções selecionáveis, exatamente uma
selecionada por vez, cada uma com as amostras de cor da própria paleta e o próprio nome escrito na
letra serifada daquele estilo. A seleção SHALL ser um controle de rádio acessível por teclado, com
o estilo em vigor marcado ao abrir a tela. O servidor SHALL recusar qualquer valor de estilo fora
dos dez.

#### Scenario: Trocar o estilo repinta o site público

- **WHEN** o usuário seleciona "Marinho & Bronze" e aciona "Salvar e publicar"
- **THEN** o site público passa a servir a paleta e a serifada daquele estilo, sem novo deploy

#### Scenario: Escolher um dos estilos novos

- **WHEN** o usuário seleciona "Petróleo & Ouro" e aciona "Salvar e publicar"
- **THEN** o site público passa a servir a paleta petróleo e dourado com a serifada Merriweather,
  sem novo deploy

#### Scenario: Estilo inexistente é recusado

- **WHEN** chega uma gravação com um estilo que não é um dos dez
- **THEN** nada é gravado e o estilo em vigor permanece

#### Scenario: Trocar o estilo não repinta o painel

- **WHEN** o estilo do site é trocado e publicado
- **THEN** o painel administrativo daquela serventia (login, configurações, redefinir senha)
  continua com o tema neutro da plataforma, no acesso seguinte e em todos os outros
