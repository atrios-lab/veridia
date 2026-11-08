## MODIFIED Requirements

### Requirement: Novo vídeo por upload direto ao store

"Novo vídeo" SHALL receber:
- um arquivo MP4 obrigatório;
- uma legenda WebVTT opcional;
- uma imagem de capa opcional (JPEG, PNG ou WebP);
- título e descrição;
- o curso, obrigatório;
- o tipo (Apresentação, Aula ou Encerramento);
- a tela ensinada (uma rota interna do painel ou nenhuma) e se faz parte dos primeiros passos. Esses dois campos SHALL aparecer só quando o curso escolhido não é sequencial.

Um curso SHALL ter no máximo uma Apresentação e um Encerramento. O servidor SHALL recusar um segundo.

Com o store configurado, os arquivos SHALL ir do navegador direto ao store, por token emitido por uma rota que:
- exige sessão com `tutorials.manage`;
- aceita apenas `video/mp4`, `text/vtt`, `image/jpeg`, `image/png`, `image/webp` e `application/pdf`;
- aceita apenas caminhos gerados pelo sistema sob a pasta de treinamento;
- limita o vídeo a 500 MB, a capa a 2 MB e a apostila a 20 MB.

Sem store (desenvolvimento), os arquivos SHALL ir pela server action e ser gravados em disco sob a pasta pública, com o vídeo limitado a 100 MB.

A duração SHALL ser lida do arquivo no navegador e gravada como inteiro positivo. O servidor SHALL recusar duração ausente ou inválida. O vídeo novo SHALL nascer como rascunho, na última posição do curso.

#### Scenario: Token só para quem gerencia
- **WHEN** uma sessão sem `tutorials.manage` chama a rota de token de upload
- **THEN** a rota recusa com 404 e nenhum token é emitido

#### Scenario: Tipo fora da lista
- **WHEN** o token é pedido para um arquivo `video/quicktime` ou `image/gif`
- **THEN** a rota recusa

#### Scenario: Capa acima do limite
- **WHEN** o superadmin escolhe uma imagem de capa de 5 MB
- **THEN** o formulário recusa antes do envio e o store recusa se o envio for tentado

#### Scenario: Upload cria rascunho no curso
- **WHEN** o superadmin envia "aula-1.mp4" no curso "LGPD no cartório", tipo Aula
- **THEN** o vídeo aparece no gerenciamento como rascunho desse curso, por último, com a duração lida do arquivo, e não aparece para as serventias

#### Scenario: Upload sem capa
- **WHEN** o superadmin envia um vídeo sem escolher capa
- **THEN** o vídeo é criado normalmente, sem capa

#### Scenario: Segunda Apresentação
- **WHEN** o curso já tem uma Apresentação e o superadmin envia outra
- **THEN** o servidor recusa e nada é gravado

#### Scenario: Duração inválida
- **WHEN** o formulário chega sem duração ou com duração zero
- **THEN** o servidor recusa e nada é gravado

### Requirement: Publicar, despublicar, ordenar, editar e excluir

Publicar SHALL tornar o vídeo visível, no mesmo instante e para toda serventia, desde que o curso dele esteja publicado:
- na página do curso;
- na trilha;
- no link contextual.

Despublicar SHALL retirá-lo de todos esses lugares sem apagar o vídeo nem o progresso de quem já assistiu.

Subir e descer SHALL trocar a posição com o vizinho dentro do mesmo curso.

Editar SHALL permitir mudar título, descrição, curso, tipo, tela ensinada e trilha. Se um arquivo novo for enviado, ele SHALL substituir o anterior, apagando o antigo do store. A capa SHALL poder ser trocada, apagando a anterior do store, ou removida, apagando o arquivo e deixando o vídeo sem capa. Mudar o vídeo de curso SHALL levá-lo para a última posição do curso novo.

Excluir SHALL pedir confirmação, avisando que o progresso das pessoas naquele vídeo some, e então SHALL apagar a linha, o progresso e os arquivos do store, inclusive a capa.

Toda ação SHALL ser auditada sob o slug da plataforma, nunca sob a serventia em que a conta estava.

#### Scenario: Publicar aparece em todas as serventias
- **WHEN** o superadmin, logado pelo host da serventia A, publica um vídeo de um curso publicado
- **THEN** um operador da serventia B vê o vídeo na página do curso

#### Scenario: Despublicar preserva o progresso
- **WHEN** um vídeo assistido por alguém é despublicado e depois publicado de novo
- **THEN** a marca de assistido dessa pessoa continua

#### Scenario: Ordenar dentro do curso
- **WHEN** o superadmin sobe a Aula 3 do LGPD
- **THEN** ela troca de lugar com a Aula 2 do mesmo curso, e nenhum vídeo de outro curso muda de posição

#### Scenario: Trocar a capa
- **WHEN** o superadmin edita um vídeo com capa e envia outra imagem
- **THEN** o vídeo passa a mostrar a nova capa e a anterior some do store

#### Scenario: Remover a capa
- **WHEN** o superadmin edita um vídeo com capa e remove a capa
- **THEN** o arquivo some do store e o card passa a mostrar a capa gerada a partir do título

#### Scenario: Excluir leva o progresso
- **WHEN** um vídeo com capa, assistido por três pessoas, é excluído após confirmação
- **THEN** a linha, as três marcas e os arquivos do store, inclusive a capa, desaparecem

#### Scenario: Auditoria sob a plataforma
- **WHEN** o superadmin publica um vídeo estando logado pela serventia A
- **THEN** o registro de auditoria fica sob o slug `atrios`, com a ação `tutorial.publish`, e não aparece na auditoria da serventia A
