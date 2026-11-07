## MODIFIED Requirements

### Requirement: Novo vídeo por upload direto ao store

"Novo vídeo" SHALL receber um arquivo MP4 obrigatório, uma legenda WebVTT opcional, uma imagem
de capa opcional (JPEG, PNG ou WebP), título, descrição, a tela ensinada (uma rota interna do
painel ou nenhuma) e se faz parte dos primeiros passos. Com o store configurado, os arquivos
SHALL ir do navegador direto ao store, por token emitido por uma rota que exige sessão com
`tutorials.manage`, aceita apenas `video/mp4`, `text/vtt`, `image/jpeg`, `image/png` e
`image/webp`, apenas caminhos gerados pelo sistema sob a pasta de treinamento, no máximo 500 MB
para o vídeo e no máximo 2 MB para a capa. Sem store (desenvolvimento), os arquivos SHALL ir
pela server action e ser gravados em disco sob a pasta pública, com o vídeo limitado a 100 MB.
A duração SHALL ser lida do arquivo no navegador e gravada como inteiro positivo; o servidor
SHALL recusar duração ausente ou inválida. O vídeo novo SHALL nascer como rascunho, na última
posição.

#### Scenario: Token só para quem gerencia
- **WHEN** uma sessão sem `tutorials.manage` chama a rota de token de upload
- **THEN** a rota recusa com 404 e nenhum token é emitido

#### Scenario: Tipo fora da lista
- **WHEN** o token é pedido para um arquivo `video/quicktime` ou `image/gif`
- **THEN** a rota recusa

#### Scenario: Capa acima do limite
- **WHEN** o superadmin escolhe uma imagem de capa de 5 MB
- **THEN** o formulário recusa antes do envio e o store recusa se o envio for tentado

#### Scenario: Upload cria rascunho
- **WHEN** o superadmin envia "Primeiros passos.mp4" com legenda, capa, título e "faz parte dos
  primeiros passos"
- **THEN** o vídeo aparece na tela de gerenciamento como rascunho, por último, com a duração
  lida do arquivo e a capa, e não aparece em `/admin/ajuda`

#### Scenario: Upload sem capa
- **WHEN** o superadmin envia um vídeo sem escolher capa
- **THEN** o vídeo é criado normalmente, sem capa

#### Scenario: Duração inválida
- **WHEN** o formulário chega sem duração ou com duração zero
- **THEN** o servidor recusa e nada é gravado

### Requirement: Publicar, despublicar, ordenar, editar e excluir

Publicar SHALL tornar o vídeo visível em `/admin/ajuda`, na trilha e no link contextual de
toda serventia, no mesmo instante. Despublicar SHALL retirá-lo de todos esses lugares sem
apagar o vídeo nem o progresso de quem já assistiu. Subir e descer SHALL trocar a posição com
o vizinho. Editar SHALL permitir mudar título, descrição, tela ensinada, trilha e, se um
arquivo novo for enviado, substituí-lo apagando o anterior do store; a capa SHALL poder ser
trocada, apagando a anterior do store, ou removida, apagando o arquivo e deixando o vídeo sem
capa. Excluir SHALL pedir confirmação, avisando que o progresso das pessoas naquele vídeo
some, e então SHALL apagar a linha, o progresso e os arquivos do store, inclusive a capa. Toda
ação SHALL ser auditada sob o slug da plataforma, nunca sob a serventia em que a conta estava.

#### Scenario: Publicar aparece em todas as serventias
- **WHEN** o superadmin, logado pelo host da serventia A, publica um vídeo
- **THEN** um operador da serventia B vê o vídeo em `/admin/ajuda` e no card da visão geral

#### Scenario: Despublicar preserva o progresso
- **WHEN** um vídeo assistido por alguém é despublicado e depois publicado de novo
- **THEN** a marca de assistido dessa pessoa continua

#### Scenario: Trocar a capa
- **WHEN** o superadmin edita um vídeo com capa e envia outra imagem
- **THEN** o vídeo passa a mostrar a nova capa e a anterior some do store

#### Scenario: Remover a capa
- **WHEN** o superadmin edita um vídeo com capa e remove a capa
- **THEN** o arquivo some do store e o card em `/admin/ajuda` passa a mostrar a capa gerada a
  partir do título

#### Scenario: Excluir leva o progresso
- **WHEN** um vídeo com capa, assistido por três pessoas, é excluído após confirmação
- **THEN** a linha, as três marcas e os arquivos do store, inclusive a capa, desaparecem

#### Scenario: Auditoria sob a plataforma
- **WHEN** o superadmin publica um vídeo estando logado pela serventia A
- **THEN** o registro de auditoria fica sob o slug `atrios`, com a ação `tutorial.publish`, e
  não aparece na auditoria da serventia A
