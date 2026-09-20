## ADDED Requirements

### Requirement: Card da trilha de primeiros passos

A tela `/admin` SHALL mostrar, na coluna de cards ao lado de "Atalhos de teclado", o card
"Primeiros passos" com o andamento da pessoa na trilha de vídeos de treinamento ("N de M assistidos") e
o link para o próximo vídeo não assistido. O card SHALL ser omitido quando a trilha está
completa ou quando o catálogo não tem vídeo de trilha. O andamento SHALL ser o da pessoa da
sessão, não o da serventia.

#### Scenario: Pessoa no meio da trilha
- **WHEN** a trilha tem sete vídeos e a pessoa assistiu a três
- **THEN** o card mostra "3 de 7 assistidos" e "Próximo: <título>" levando a
  `/admin/ajuda?video=<id do próximo>`

#### Scenario: Trilha completa some
- **WHEN** a pessoa assistiu a todos os vídeos da trilha
- **THEN** o card não aparece, e os demais cards da coluna continuam no lugar

#### Scenario: Andamento é por pessoa
- **WHEN** duas pessoas da mesma serventia abrem `/admin`, uma com dois vídeos assistidos e
  outra com nenhum
- **THEN** cada uma vê o próprio andamento
