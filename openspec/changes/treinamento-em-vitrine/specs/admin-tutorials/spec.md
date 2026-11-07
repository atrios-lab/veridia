## MODIFIED Requirements

### Requirement: Catálogo de vídeos de treinamento da plataforma

Os vídeos de treinamento SHALL vir da tabela `tutorials`, única para todas as serventias, sem
vínculo com serventia, na ordem de posição. Cada entrada SHALL ter id, título, descrição,
duração, o caminho do vídeo, o caminho da legenda em WebVTT (ou nenhum), o caminho da imagem
de capa (ou nenhum), a rota do painel que ensina (ou nenhuma), se faz parte da trilha de
primeiros passos e se está publicada. Só a conta da plataforma SHALL escrever nessa tabela;
toda serventia SHALL ler o mesmo conteúdo.

#### Scenario: Publicado aparece em toda serventia
- **WHEN** a conta da plataforma publica um vídeo
- **THEN** ele aparece na tela de treinamento de toda serventia, sem deploy

#### Scenario: Rascunho não aparece
- **WHEN** um vídeo está em rascunho
- **THEN** nenhuma serventia o vê em `/admin/ajuda`, na trilha ou no link contextual

#### Scenario: Vídeo sem capa
- **WHEN** um vídeo publicado não tem imagem de capa
- **THEN** o catálogo o entrega com a capa vazia, sem erro, e ele aparece normalmente na tela

### Requirement: Tela de vídeos de treinamento aberta a todo usuário do painel

A rota `/admin/ajuda` SHALL existir para qualquer sessão com `admin.access`, sem permissão
adicional. A tela SHALL mostrar no topo um destaque com o vídeo atual e, abaixo, os vídeos
publicados em prateleiras de cards com rolagem lateral: "Primeiros passos", com os vídeos da
trilha na ordem de posição e o andamento "X de Y" no título, e "Aprofundamento", com os
demais na ordem de posição. Uma prateleira sem vídeo NÃO SHALL ser mostrada. Cada card SHALL
mostrar a capa do vídeo (ou, sem capa, uma capa gerada a partir do título), a duração sobre a
capa, a categoria (o grupo do menu da tela ensinada, ou "Painel" quando o vídeo não ensina
uma tela), o título, a tela que ensina quando houver e se já foi assistido pela pessoa. O card
do vídeo que está no destaque SHALL ser identificado como atual. A rolagem das prateleiras
NÃO SHALL depender de biblioteca de terceiros. Sem vídeo publicado, a tela SHALL informar que
os vídeos estão sendo preparados, sem erro. Uma sessão com `tutorials.manage` SHALL ver a ação
"Gerenciar vídeos" no cabeçalho.

#### Scenario: Operador vê as prateleiras
- **WHEN** um usuário com papel `staff` abre `/admin/ajuda` com três vídeos de trilha e dois
  avulsos publicados
- **THEN** vê a prateleira "Primeiros passos" com os três da trilha e a prateleira
  "Aprofundamento" com os dois avulsos, cada card com capa, duração, categoria, título e a
  marca de assistido nos que já concluiu

#### Scenario: Prateleira vazia some
- **WHEN** todos os vídeos publicados são da trilha
- **THEN** a tela mostra só a prateleira "Primeiros passos"

#### Scenario: Categoria pela tela ensinada
- **WHEN** um vídeo ensina `/admin/pedidos` e outro não ensina tela nenhuma
- **THEN** o card do primeiro mostra a categoria "Operação" e a tela "Pedidos de serviço", e o
  do segundo mostra a categoria "Painel"

#### Scenario: Card sem capa
- **WHEN** um vídeo publicado não tem imagem de capa
- **THEN** o card mostra uma capa com o título do vídeo, no mesmo tamanho das capas com imagem

#### Scenario: Card atual
- **WHEN** a pessoa abre `/admin/ajuda?video=<id>`
- **THEN** o card desse vídeo aparece marcado como atual na sua prateleira

#### Scenario: Sem vídeo publicado
- **WHEN** não há vídeo publicado e a pessoa abre `/admin/ajuda`
- **THEN** a tela informa "Os vídeos de treinamento estão sendo preparados" e não mostra
  destaque nem prateleiras

#### Scenario: Ação de gerenciar só para a plataforma
- **WHEN** um `superadmin` abre `/admin/ajuda`
- **THEN** o cabeçalho mostra "Gerenciar vídeos" levando a `/admin/ajuda/gerenciar`; um
  `admin` não vê a ação

### Requirement: Vídeo toca no painel, em player nativo com legenda

A tela SHALL tocar o vídeo do destaque em um elemento `<video>` do navegador, com controles,
legenda em português como faixa de legendas quando o vídeo tem legenda, a imagem de capa como
pôster quando o vídeo tem capa, e sem nenhum script, iframe ou recurso de terceiro. A política
de conteúdo SHALL permitir mídia apenas de `'self'`, do esquema `blob:` da própria página
(usado pelo formulário para ler a duração do arquivo antes do envio) e do host do store
configurado para o deploy, exato, sem curinga. A tela SHALL aceitar `?video=<id>` para abrir
um vídeo específico no destaque, e cada card SHALL levar a esse endereço; sem o parâmetro, com
id inexistente ou com id de rascunho, SHALL abrir o próximo não assistido da trilha ou, na
falta, o primeiro publicado.

#### Scenario: Abrir pelo id
- **WHEN** a pessoa abre `/admin/ajuda?video=<id de um vídeo publicado>`
- **THEN** o destaque mostra esse vídeo, com a legenda disponível quando existe, e os demais
  continuam nas prateleiras abaixo

#### Scenario: Clicar num card
- **WHEN** a pessoa clica no card de outro vídeo
- **THEN** a tela passa a `/admin/ajuda?video=<id desse vídeo>` e o destaque mostra esse vídeo

#### Scenario: Capa como pôster
- **WHEN** o vídeo do destaque tem imagem de capa
- **THEN** o player mostra a capa antes de a reprodução começar

#### Scenario: Id de rascunho não revela nada
- **WHEN** a pessoa abre `/admin/ajuda?video=<id de um rascunho>`
- **THEN** a tela abre com o próximo vídeo não assistido da trilha, como se o id não existisse

#### Scenario: Mídia só do store do deploy
- **WHEN** a resposta de uma rota do painel é inspecionada num deploy com store configurado
- **THEN** o cabeçalho `Content-Security-Policy` contém `media-src 'self' blob: https://<host
  do store>` e nada mais nessa diretiva

## ADDED Requirements

### Requirement: Selo de andamento no destaque

O destaque SHALL mostrar, junto do título do vídeo, um selo com o andamento da pessoa na
trilha: "Comece por aqui" quando ela não assistiu a nenhum vídeo da trilha (ou a trilha está
vazia), "Continue de onde parou · X de Y" quando assistiu a parte da trilha e "Trilha
concluída" quando assistiu a todos. O selo SHALL refletir o andamento calculado pela trilha de
primeiros passos, contando apenas vídeos da trilha.

#### Scenario: Pessoa nova
- **WHEN** a trilha tem cinco vídeos e a pessoa não assistiu a nenhum
- **THEN** o selo diz "Comece por aqui"

#### Scenario: Trilha em curso
- **WHEN** a trilha tem cinco vídeos e a pessoa assistiu a dois
- **THEN** o selo diz "Continue de onde parou · 2 de 5"

#### Scenario: Trilha concluída
- **WHEN** a pessoa assistiu aos cinco vídeos da trilha e a nenhum avulso
- **THEN** o selo diz "Trilha concluída"
