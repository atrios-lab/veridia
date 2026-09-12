## MODIFIED Requirements

### Requirement: Cabeçalho da tela e rodapé de usuário

O painel SHALL exibir, em toda tela, uma barra do topo única com: o gatilho da busca global
(placeholder "Buscar no painel", com o atalho Ctrl K indicado), o indicador de disponibilidade
do chat e o menu do usuário. O menu do usuário SHALL mostrar as iniciais e o nome da pessoa e,
ao ser aberto, o papel dela em português e a ação "Sair"; Escape e clique fora SHALL fechá-lo.
Em telas estreitas a barra SHALL oferecer o botão que abre a navegação em gaveta.

O título da tela SHALL aparecer no conteúdo da própria tela, abaixo da barra, com subtítulo e
ações opcionais. A barra do topo SHALL NOT exibir título nem data. A sidebar SHALL NOT exibir
rodapé de usuário.

O atalho "Trocar senha" e o sino de notificações previstos no design NÃO SHALL ser renderizados
enquanto não houver tela de troca de senha dentro do painel nem fonte de dados de notificações:
controle que não leva a lugar nenhum é pior que controle ausente.

#### Scenario: Barra do topo em toda tela

- **WHEN** o usuário abre qualquer tela do painel
- **THEN** a barra do topo mostra a busca global, o indicador do chat e o nome do usuário, e o
  título da tela aparece no conteúdo abaixo dela

#### Scenario: Menu do usuário

- **WHEN** o usuário clica no próprio nome na barra do topo
- **THEN** o menu abre mostrando o papel dele em português e a ação "Sair"

#### Scenario: Sair encerra a sessão

- **WHEN** o usuário abre o menu do usuário e aciona "Sair"
- **THEN** a sessão é encerrada no servidor e a pessoa volta ao login com o aviso de saída

#### Scenario: Busca global pela barra

- **WHEN** o usuário clica no campo "Buscar no painel" ou pressiona Ctrl K
- **THEN** a busca global abre
