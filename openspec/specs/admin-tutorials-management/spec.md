# admin-tutorials-management Specification

## Purpose
O lado da plataforma do módulo Treinamento: a permissão `tutorials.manage`, exclusiva do
papel `superadmin`, a tela `/admin/ajuda/gerenciar` onde a conta da Átrios sobe, ordena,
publica e exclui os vídeos que toda serventia vê, e o upload direto do navegador ao store.
Primeira capability em que uma tela dentro do painel de uma serventia age sobre todas.
Sincronizado da change `gerenciar-treinamento-pelo-painel`.
## Requirements
### Requirement: Permissão de plataforma exclusiva do papel superadmin

O sistema SHALL distinguir permissões da serventia de permissões da plataforma. A permissão
`tutorials.manage` SHALL ser de plataforma: o papel `superadmin` SHALL possuí-la e nenhum
papel atribuível pelo painel (`admin`, `staff`) SHALL possuí-la. Acrescentar uma permissão de
plataforma NÃO SHALL conceder nada a `admin` ou `staff`.

#### Scenario: Superadmin gerencia, registrador não
- **WHEN** as permissões de cada papel são consultadas
- **THEN** `superadmin` tem `tutorials.manage` e `admin` e `staff` não têm

#### Scenario: Registrador continua com tudo da serventia
- **WHEN** as permissões de `admin` são consultadas
- **THEN** ele tem todas as permissões da serventia, as mesmas de antes desta change

### Requirement: Tela de gerenciamento só para quem tem a permissão

A rota `/admin/ajuda/gerenciar` SHALL responder 404 a qualquer sessão sem `tutorials.manage`,
inclusive a de um `admin` da serventia. A tela SHALL exibir um aviso fixo de que o conteúdo é
da plataforma e aparece no Treinamento de todas as serventias. A tela SHALL listar todos os
vídeos, rascunhos e publicados, na ordem de posição, com selo nos rascunhos e "sem legenda"
nos que não têm legenda, e SHALL oferecer para cada um: subir, descer, publicar ou
despublicar, editar, excluir e conferir no player.

#### Scenario: Admin da serventia não vê a tela
- **WHEN** um usuário com papel `admin` abre `/admin/ajuda/gerenciar`
- **THEN** recebe 404

#### Scenario: Conta da plataforma vê tudo
- **WHEN** um `superadmin` abre `/admin/ajuda/gerenciar` com dois vídeos publicados e um
  rascunho
- **THEN** vê os três, o rascunho com selo "Rascunho", e o aviso de conteúdo da plataforma no
  topo

### Requirement: Novo vídeo por upload direto ao store

"Novo vídeo" SHALL receber um arquivo MP4 obrigatório, uma legenda WebVTT opcional, título,
descrição, a tela ensinada (uma rota interna do painel ou nenhuma) e se faz parte dos primeiros
passos. Com o store configurado, o arquivo SHALL ir do navegador direto ao store, por token
emitido por uma rota que exige sessão com `tutorials.manage`, aceita apenas `video/mp4` e
`text/vtt`, apenas caminhos gerados pelo sistema sob a pasta de treinamento, e no máximo 500 MB.
Sem store (desenvolvimento), o arquivo SHALL ir pela server action e ser gravado em disco sob a
pasta pública, com o vídeo limitado a 100 MB. A duração SHALL ser lida do arquivo no navegador
e gravada como inteiro positivo; o servidor SHALL recusar duração ausente ou inválida. O vídeo
novo SHALL nascer como rascunho, na última posição.

#### Scenario: Token só para quem gerencia
- **WHEN** uma sessão sem `tutorials.manage` chama a rota de token de upload
- **THEN** a rota recusa com 404 e nenhum token é emitido

#### Scenario: Tipo fora da lista
- **WHEN** o token é pedido para um arquivo `video/quicktime`
- **THEN** a rota recusa

#### Scenario: Upload cria rascunho
- **WHEN** o superadmin envia "Primeiros passos.mp4" com legenda, título e "faz parte dos
  primeiros passos"
- **THEN** o vídeo aparece na tela de gerenciamento como rascunho, por último, com a duração
  lida do arquivo, e não aparece em `/admin/ajuda`

#### Scenario: Duração inválida
- **WHEN** o formulário chega sem duração ou com duração zero
- **THEN** o servidor recusa e nada é gravado

### Requirement: Publicar, despublicar, ordenar, editar e excluir

Publicar SHALL tornar o vídeo visível em `/admin/ajuda`, na trilha e no link contextual de
toda serventia, no mesmo instante. Despublicar SHALL retirá-lo de todos esses lugares sem
apagar o vídeo nem o progresso de quem já assistiu. Subir e descer SHALL trocar a posição com
o vizinho. Editar SHALL permitir mudar título, descrição, tela ensinada, trilha e, se um
arquivo novo for enviado, substituí-lo apagando o anterior do store. Excluir SHALL pedir
confirmação, avisando que o progresso das pessoas naquele vídeo some, e então SHALL apagar a
linha, o progresso e os arquivos do store. Toda ação SHALL ser auditada sob o slug da
plataforma, nunca sob a serventia em que a conta estava.

#### Scenario: Publicar aparece em todas as serventias
- **WHEN** o superadmin, logado pelo host da serventia A, publica um vídeo
- **THEN** um operador da serventia B vê o vídeo em `/admin/ajuda` e no card da visão geral

#### Scenario: Despublicar preserva o progresso
- **WHEN** um vídeo assistido por alguém é despublicado e depois publicado de novo
- **THEN** a marca de assistido dessa pessoa continua

#### Scenario: Excluir leva o progresso
- **WHEN** um vídeo assistido por três pessoas é excluído após confirmação
- **THEN** a linha, as três marcas e os arquivos do store desaparecem

#### Scenario: Auditoria sob a plataforma
- **WHEN** o superadmin publica um vídeo estando logado pela serventia A
- **THEN** o registro de auditoria fica sob o slug `atrios`, com a ação `tutorial.publish`, e
  não aparece na auditoria da serventia A

