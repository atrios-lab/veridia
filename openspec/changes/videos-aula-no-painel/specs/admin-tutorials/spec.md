## ADDED Requirements

### Requirement: Catálogo de vídeos-aula da plataforma

Os vídeos-aula SHALL vir de um catálogo em código, único para todas as serventias, na ordem em
que a trilha os apresenta. Cada entrada SHALL ter id estável, título, descrição, duração, a
URL do vídeo, a URL da legenda em WebVTT, a rota do painel que ensina (ou nenhuma) e se faz
parte da trilha de primeiros passos. Ids SHALL ser únicos, rotas SHALL existir no painel e as
URLs de mídia SHALL apontar para host permitido pela política de conteúdo.

#### Scenario: Catálogo válido
- **WHEN** o catálogo é carregado
- **THEN** nenhum id se repete, toda rota informada é uma rota do painel e toda URL de vídeo e
  legenda usa https com host presente na lista de hosts de mídia

#### Scenario: Vídeo novo entra por código
- **WHEN** a Átrios acrescenta uma entrada ao catálogo e faz deploy
- **THEN** o vídeo aparece na tela de vídeos-aula de toda serventia, sem cadastro no painel

### Requirement: Tela de vídeos-aula aberta a todo usuário do painel

A rota `/admin/ajuda` SHALL existir para qualquer sessão com `admin.access`, sem permissão
adicional, e SHALL listar os vídeos do catálogo: primeiro os da trilha, na ordem do catálogo,
depois os demais. Cada item SHALL mostrar título, duração, a tela que ensina quando houver e
se já foi assistido pela pessoa. Com o catálogo vazio, a tela SHALL informar que os vídeos
estão sendo preparados, sem erro.

#### Scenario: Operador vê a lista
- **WHEN** um usuário com papel `staff` abre `/admin/ajuda`
- **THEN** vê todos os vídeos do catálogo, os da trilha antes dos demais, cada um com título,
  duração e a marca de assistido nos que já concluiu

#### Scenario: Catálogo vazio
- **WHEN** o catálogo não tem nenhuma entrada e a pessoa abre `/admin/ajuda`
- **THEN** a tela informa "Os vídeos-aula estão sendo preparados" e não mostra player

### Requirement: Vídeo toca no painel, em player nativo com legenda

A tela SHALL tocar o vídeo em um elemento `<video>` do navegador, com controles, legenda em
português como faixa de legendas e sem nenhum script, iframe ou recurso de terceiro. A
política de conteúdo SHALL permitir mídia apenas de `'self'` e dos hosts exatos presentes no
catálogo. A tela SHALL aceitar `?video=<id>` para abrir um vídeo específico; sem o parâmetro,
ou com id inexistente, SHALL abrir o próximo não assistido da trilha ou, na falta, o primeiro
do catálogo.

#### Scenario: Abrir pelo id
- **WHEN** a pessoa abre `/admin/ajuda?video=pedidos-de-servico`
- **THEN** o player mostra "Pedidos de serviço" com a legenda disponível e os demais vídeos
  ficam listados abaixo

#### Scenario: Id inexistente
- **WHEN** a pessoa abre `/admin/ajuda?video=nao-existe`
- **THEN** a tela abre normalmente com o próximo vídeo não assistido da trilha, sem 404

#### Scenario: Mídia de host fora do catálogo é bloqueada
- **WHEN** a resposta de uma rota do painel é inspecionada
- **THEN** o cabeçalho `Content-Security-Policy` contém `media-src 'self'` seguido apenas dos
  hosts presentes nas URLs do catálogo, sem curinga

### Requirement: Progresso é da pessoa e acompanha a conta

O sistema SHALL guardar, por usuário e por vídeo, a data da primeira vez em que o vídeo foi
concluído. Um vídeo SHALL ser marcado como assistido quando a reprodução chega ao fim ou
quando a pessoa aciona "Marcar como assistido", e SHALL poder ser desmarcado por "Desfazer".
Marcar de novo um vídeo já assistido NÃO SHALL alterar a data. O progresso SHALL ser lido e
gravado apenas com a identidade da sessão autenticada, e SHALL ser o mesmo em qualquer
máquina em que a pessoa entre.

#### Scenario: Concluir a reprodução marca sozinho
- **WHEN** a reprodução de "Primeiros passos" chega ao fim
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

#### Scenario: Id fora do catálogo é recusado
- **WHEN** a ação de marcar recebe um id que não está no catálogo
- **THEN** o servidor recusa e nada é gravado

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
