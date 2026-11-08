## ADDED Requirements

### Requirement: Cursos da plataforma

O sistema SHALL guardar cursos numa tabela própria, única para todas as serventias, com:
- slug único;
- título e descrição;
- capa opcional e apostila em PDF opcional;
- indicação de curso sequencial ou de consulta;
- posição e data de publicação.

Todo vídeo de treinamento SHALL pertencer a exatamente um curso e ter um tipo: Apresentação, Aula ou Encerramento.

Num curso:
- a Apresentação SHALL vir antes de todos os itens e o Encerramento depois de todos;
- as Aulas SHALL seguir a posição;
- as Aulas publicadas SHALL ser numeradas a partir de 1, na ordem.

Só a conta da plataforma SHALL escrever nessas tabelas. Um curso em rascunho, e todo vídeo dele, NÃO SHALL aparecer para nenhuma serventia.

#### Scenario: Numeração das aulas
- **WHEN** um curso tem uma Apresentação, doze Aulas publicadas e um Encerramento
- **THEN** a lista mostra "Apresentação", "Aula 1" a "Aula 12" e "Encerramento", nessa ordem

#### Scenario: Aula despublicada não deixa buraco
- **WHEN** a Aula 4 de doze é despublicada
- **THEN** a lista mostra onze aulas numeradas de 1 a 11, sem pular número

#### Scenario: Curso em rascunho
- **WHEN** um curso não está publicado
- **THEN** ele não aparece no catálogo, e `/admin/ajuda/<slug>` responde 404

### Requirement: Catálogo de cursos em /admin/ajuda

A rota `/admin/ajuda` SHALL mostrar a toda sessão com `admin.access`:
- os cursos publicados que têm ao menos um vídeo publicado, na ordem de posição;
- para cada curso, a capa, o título, o número de vídeos, a duração total e o andamento da pessoa ("X de Y");
- acima dos cursos, um destaque "Continue de onde parou" com o próximo item aberto do curso em que a pessoa assistiu algo por último. Para quem nunca assistiu a nada, o destaque SHALL mostrar o primeiro item do primeiro curso. Para quem concluiu todos os cursos, o destaque NÃO SHALL aparecer.

Cada curso SHALL levar a `/admin/ajuda/<slug>`. Sem nenhum curso para mostrar, a tela SHALL informar que os vídeos estão sendo preparados.

#### Scenario: Dois cursos
- **WHEN** existem os cursos publicados "Uso do painel" e "LGPD no cartório" e a pessoa assistiu a 2 de 7 e a 3 de 14
- **THEN** o catálogo mostra os dois cards com "2 de 7" e "3 de 14"

#### Scenario: Continue de onde parou
- **WHEN** o último vídeo que a pessoa terminou foi a Aula 2 do LGPD
- **THEN** o destaque oferece a Aula 3 do LGPD

#### Scenario: Pessoa nova
- **WHEN** a pessoa nunca assistiu a nenhum vídeo
- **THEN** o destaque oferece o primeiro item do primeiro curso publicado

### Requirement: Página do curso

A rota `/admin/ajuda/<slug>` SHALL mostrar um curso publicado com:
- título, descrição, número de vídeos, duração total e andamento da pessoa;
- o link "Apostila (PDF)" quando o curso tem apostila.

Num curso de consulta, a página SHALL ser a vitrine, com destaque e prateleiras, restrita aos vídeos do curso.

Num curso sequencial, a página SHALL mostrar:
- o player;
- a lista de todos os itens na ordem do curso, cada um com o rótulo (Apresentação, "Aula N" ou Encerramento), o título, a duração e a marca de assistido ou de fechado;
- ao fim de um item, a ação "Próxima aula" levando ao item seguinte.

A página SHALL aceitar `?video=<id>` de um item do curso. Sem o parâmetro, ou com o id de um item fechado ou de fora do curso, SHALL abrir o primeiro item aberto e ainda não assistido. Se todos já foram assistidos, SHALL abrir o primeiro item.

#### Scenario: Curso sequencial
- **WHEN** a pessoa abre `/admin/ajuda/lgpd-no-cartorio`
- **THEN** vê o player e a lista "Apresentação, Aula 1 a 12, Encerramento", com a marca de assistido, aberto ou fechado em cada item

#### Scenario: Apostila
- **WHEN** o curso tem apostila
- **THEN** a página mostra o link "Apostila (PDF)", que abre o arquivo

#### Scenario: Item fechado pela URL
- **WHEN** a pessoa abre `?video=<id da Aula 5>` sem ter assistido à Aula 4
- **THEN** a página abre o primeiro item aberto e ainda não assistido, sem erro

#### Scenario: Link antigo
- **WHEN** alguém abre `/admin/ajuda?video=<id>` de um vídeo publicado
- **THEN** é redirecionado para `/admin/ajuda/<slug do curso do vídeo>?video=<id>`

### Requirement: Sequência nos cursos sequenciais

Num curso sequencial, um item SHALL estar aberto quando todos os itens anteriores do curso foram assistidos pela pessoa. Quando a pessoa assistiu a todos os itens do curso, todos SHALL ficar abertos.

Um item fechado:
- NÃO SHALL poder ser aberto pela lista;
- SHALL mostrar o que falta assistir para abri-lo.

O servidor SHALL recusar marcar como assistido um item fechado. A regra SHALL ser a mesma na página e no servidor.

#### Scenario: Próxima aula abre ao terminar a anterior
- **WHEN** a pessoa termina a Aula 1
- **THEN** a Aula 2 passa a aparecer aberta, e a Aula 3 continua fechada

#### Scenario: Tudo assistido, tudo aberto
- **WHEN** a pessoa assistiu a todos os itens do curso
- **THEN** todos aparecem abertos e podem ser revistos em qualquer ordem

#### Scenario: Servidor recusa item fechado
- **WHEN** a ação de marcar como assistido recebe o id da Aula 5 de quem não assistiu à Aula 4
- **THEN** o servidor recusa e nada é gravado

#### Scenario: Curso de consulta não tem sequência
- **WHEN** a pessoa abre qualquer vídeo do curso "Uso do painel"
- **THEN** ele toca, sem depender dos outros

### Requirement: Aula sequencial só conta como assistida ao fim

Num curso sequencial, o player SHALL seguir estas regras:
- o item SHALL ser marcado como assistido só quando a reprodução chega ao fim;
- o player NÃO SHALL oferecer "Marcar como assistido" nem "Desfazer";
- enquanto o item não foi assistido, o player SHALL impedir adiantar além do ponto mais distante já reproduzido, deixando voltar livremente;
- um item já assistido SHALL tocar sem essa restrição.

#### Scenario: Sem botão de marcar
- **WHEN** a pessoa abre uma aula de curso sequencial
- **THEN** o player não mostra "Marcar como assistido"

#### Scenario: Adiantar é bloqueado
- **WHEN** a pessoa, no minuto 1 de uma aula ainda não assistida, arrasta a barra para o minuto 3
- **THEN** o vídeo volta ao ponto mais distante já reproduzido

#### Scenario: Rever é livre
- **WHEN** a pessoa reabre uma aula já assistida e arrasta para o fim
- **THEN** o vídeo vai para onde ela escolheu

### Requirement: Gerenciamento de cursos

Em `/admin/ajuda/gerenciar`, uma sessão com `tutorials.manage` SHALL criar, editar, ordenar, publicar, despublicar e excluir cursos, com:
- título;
- slug (minúsculas, números e hífen, único, diferente de `gerenciar`);
- descrição;
- capa opcional (JPEG, PNG ou WebP, até 2 MB);
- apostila opcional (PDF, até 20 MB);
- indicação de sequencial.

O formulário de vídeo SHALL escolher o curso e o tipo do vídeo.

Excluir um curso que ainda tem vídeos SHALL ser recusado. Excluir um curso vazio SHALL apagar também a capa e a apostila do store. Toda ação SHALL ser auditada sob o slug da plataforma.

#### Scenario: Criar curso
- **WHEN** o superadmin cria "LGPD no cartório" com slug `lgpd-no-cartorio`, sequencial, com capa e apostila
- **THEN** o curso aparece no gerenciamento como rascunho e não aparece no catálogo

#### Scenario: Slug reservado
- **WHEN** o superadmin tenta criar um curso com slug `gerenciar`
- **THEN** o formulário recusa o slug

#### Scenario: Curso com vídeos não é excluído
- **WHEN** o superadmin tenta excluir um curso que tem três vídeos
- **THEN** a exclusão é recusada com a orientação de mover ou excluir os vídeos antes
