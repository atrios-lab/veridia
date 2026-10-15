# admin-tutorials Specification

## Purpose
O módulo Treinamento como a serventia o usa: os vídeos da plataforma que ensinam cada tela do
painel, tocados em player nativo em `/admin/ajuda`, o progresso de cada pessoa, a trilha de
primeiros passos que a Visão geral sugere e o link "Como usar esta tela" no cabeçalho da tela
ensinada. O conteúdo vem da tabela `tutorials`, igual para toda serventia; quem o publica está
em `admin-tutorials-management`. Sincronizado das changes `videos-aula-no-painel` e
`gerenciar-treinamento-pelo-painel`.
## Requirements
### Requirement: Catálogo de vídeos de treinamento da plataforma

Os vídeos de treinamento SHALL vir da tabela `tutorials`, única para todas as serventias, sem
vínculo com serventia, na ordem de posição. Cada entrada SHALL ter id, título, descrição,
duração, o caminho do vídeo, o caminho da legenda em WebVTT (ou nenhum), a rota do painel que
ensina (ou nenhuma), se faz parte da trilha de primeiros passos e se está publicada. Só a
conta da plataforma SHALL escrever nessa tabela; toda serventia SHALL ler o mesmo conteúdo.

#### Scenario: Publicado aparece em toda serventia
- **WHEN** a conta da plataforma publica um vídeo
- **THEN** ele aparece na tela de treinamento de toda serventia, sem deploy

#### Scenario: Rascunho não aparece
- **WHEN** um vídeo está em rascunho
- **THEN** nenhuma serventia o vê em `/admin/ajuda`, na trilha ou no link contextual

### Requirement: Tela de vídeos de treinamento aberta a todo usuário do painel

A rota `/admin/ajuda` SHALL existir para qualquer sessão com `admin.access`, sem permissão
adicional, e SHALL listar os vídeos publicados: primeiro os da trilha, na ordem de posição,
depois os demais. Cada item SHALL mostrar título, duração, a tela que ensina quando houver e
se já foi assistido pela pessoa. Sem vídeo publicado, a tela SHALL informar que os vídeos
estão sendo preparados, sem erro. Uma sessão com `tutorials.manage` SHALL ver a ação
"Gerenciar vídeos" no cabeçalho.

#### Scenario: Operador vê a lista
- **WHEN** um usuário com papel `staff` abre `/admin/ajuda`
- **THEN** vê todos os vídeos publicados, os da trilha antes dos demais, cada um com título,
  duração e a marca de assistido nos que já concluiu

#### Scenario: Sem vídeo publicado
- **WHEN** não há vídeo publicado e a pessoa abre `/admin/ajuda`
- **THEN** a tela informa "Os vídeos de treinamento estão sendo preparados" e não mostra player

#### Scenario: Ação de gerenciar só para a plataforma
- **WHEN** um `superadmin` abre `/admin/ajuda`
- **THEN** o cabeçalho mostra "Gerenciar vídeos" levando a `/admin/ajuda/gerenciar`; um
  `admin` não vê a ação

### Requirement: Vídeo toca no painel, em player nativo com legenda

A tela SHALL tocar o vídeo em um elemento `<video>` do navegador, com controles, legenda em
português como faixa de legendas quando o vídeo tem legenda, e sem nenhum script, iframe ou
recurso de terceiro. A política de conteúdo SHALL permitir mídia apenas de `'self'`, do
esquema `blob:` da própria página (usado pelo formulário para ler a duração do arquivo antes
do envio) e do host do store configurado para o deploy, exato, sem curinga. A tela SHALL aceitar `?video=<id>`
para abrir um vídeo específico; sem o parâmetro, com id inexistente ou com id de rascunho,
SHALL abrir o próximo não assistido da trilha ou, na falta, o primeiro publicado.

#### Scenario: Abrir pelo id
- **WHEN** a pessoa abre `/admin/ajuda?video=<id de um vídeo publicado>`
- **THEN** o player mostra esse vídeo, com a legenda disponível quando existe, e os demais
  ficam listados ao lado

#### Scenario: Id de rascunho não revela nada
- **WHEN** a pessoa abre `/admin/ajuda?video=<id de um rascunho>`
- **THEN** a tela abre com o próximo vídeo não assistido da trilha, como se o id não existisse

#### Scenario: Mídia só do store do deploy
- **WHEN** a resposta de uma rota do painel é inspecionada num deploy com store configurado
- **THEN** o cabeçalho `Content-Security-Policy` contém `media-src 'self' blob: https://<host
  do store>` e nada mais nessa diretiva

### Requirement: Progresso é da pessoa e acompanha a conta

O sistema SHALL guardar, por usuário e por vídeo, a data da primeira vez em que o vídeo foi
concluído, com chave estrangeira para o vídeo. Um vídeo SHALL ser marcado como assistido
quando a reprodução chega ao fim ou quando a pessoa aciona "Marcar como assistido", e SHALL
poder ser desmarcado por "Desfazer". Marcar de novo um vídeo já assistido NÃO SHALL alterar a
data. O progresso SHALL ser lido e gravado apenas com a identidade da sessão autenticada, e
SHALL ser o mesmo em qualquer máquina em que a pessoa entre. Excluir o vídeo SHALL excluir o
progresso de todos nele; despublicar NÃO SHALL.

#### Scenario: Concluir a reprodução marca sozinho
- **WHEN** a reprodução de um vídeo chega ao fim
- **THEN** o vídeo passa a constar como assistido, com a data de agora

#### Scenario: Marcar à mão e desfazer
- **WHEN** a pessoa aciona "Marcar como assistido" num vídeo e depois "Desfazer"
- **THEN** o vídeo aparece como assistido após a primeira ação e volta a não assistido após a
  segunda

#### Scenario: Data da primeira conclusão
- **WHEN** um vídeo já assistido em 10/09 chega ao fim de novo em 15/09
- **THEN** a data de assistido continua 10/09

#### Scenario: Progresso segue a conta
- **WHEN** a pessoa marca um vídeo num computador e entra em outro
- **THEN** o vídeo aparece assistido no segundo computador

#### Scenario: Id fora da tabela é recusado
- **WHEN** a ação de marcar recebe um id que não é de um vídeo publicado
- **THEN** o servidor recusa e nada é gravado

#### Scenario: Exclusão em cascata
- **WHEN** um vídeo com marcas de assistido é excluído
- **THEN** as marcas desaparecem junto

### Requirement: Trilha de primeiros passos

Os vídeos marcados como trilha no catálogo SHALL compor a trilha de primeiros passos, na
ordem do catálogo. O sistema SHALL calcular, para a pessoa, quantos vídeos da trilha ela
assistiu, quantos há ao todo e qual é o próximo não assistido. A trilha NÃO SHALL impedir o
uso de nenhuma tela: é sugestão, nunca condição.

#### Scenario: Próximo da trilha
- **WHEN** a trilha tem sete vídeos e a pessoa assistiu ao primeiro e ao terceiro
- **THEN** o andamento é "2 de 7" e o próximo é o segundo

#### Scenario: Vídeo fora da trilha não conta
- **WHEN** o catálogo tem sete vídeos de trilha e dois avulsos, todos assistidos menos um avulso
- **THEN** a trilha consta como completa, "7 de 7"

### Requirement: Link contextual na tela ensinada

Toda tela do painel cujo cabeçalho de página é renderizado SHALL oferecer o link "Como usar
esta tela" quando o catálogo tem um vídeo cuja rota cobre a rota atual. A rota do catálogo
SHALL cobrir a si mesma e as subordinadas (`/admin/pedidos` cobre `/admin/pedidos/novo`),
com a mais longa vencendo; `/admin` SHALL cobrir apenas a si mesma. O link SHALL levar a
`/admin/ajuda?video=<id>`.

#### Scenario: Tela com vídeo
- **WHEN** o catálogo tem um vídeo com rota `/admin/pedidos` e a pessoa abre
  `/admin/pedidos/novo`
- **THEN** o cabeçalho mostra "Como usar esta tela" apontando para
  `/admin/ajuda?video=<id daquele vídeo>`

#### Scenario: Tela sem vídeo
- **WHEN** o catálogo não tem vídeo cuja rota cubra `/admin/usuarios`
- **THEN** o cabeçalho de `/admin/usuarios` não mostra o link

#### Scenario: A raiz não vaza para as filhas
- **WHEN** o catálogo tem um vídeo com rota `/admin` e nenhum com rota `/admin/usuarios`
- **THEN** o cabeçalho de `/admin/usuarios` não mostra o link

