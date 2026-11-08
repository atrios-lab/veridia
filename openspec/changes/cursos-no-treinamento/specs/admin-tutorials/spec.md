## MODIFIED Requirements

### Requirement: Catálogo de vídeos de treinamento da plataforma

Os vídeos de treinamento SHALL vir da tabela `tutorials`, única para todas as serventias, sem vínculo com serventia. Cada entrada SHALL ter:
- id, título, descrição e duração;
- o caminho do vídeo, o caminho da legenda em WebVTT (ou nenhum) e o caminho da imagem de capa (ou nenhum);
- o curso a que pertence, o tipo (Apresentação, Aula ou Encerramento) e a posição dentro do curso;
- a rota do painel que ensina (ou nenhuma);
- se faz parte da trilha de primeiros passos;
- se está publicada.

Só a conta da plataforma SHALL escrever nessa tabela. Toda serventia SHALL ler o mesmo conteúdo. Um vídeo publicado de um curso em rascunho NÃO SHALL aparecer.

#### Scenario: Publicado aparece em toda serventia
- **WHEN** a conta da plataforma publica um vídeo de um curso publicado
- **THEN** ele aparece no Treinamento de toda serventia, sem deploy

#### Scenario: Rascunho não aparece
- **WHEN** um vídeo está em rascunho
- **THEN** nenhuma serventia o vê no Treinamento, na trilha ou no link contextual

#### Scenario: Vídeo sem capa
- **WHEN** um vídeo publicado não tem imagem de capa
- **THEN** o catálogo o entrega com a capa vazia, sem erro, e ele aparece normalmente na tela

#### Scenario: Todo vídeo tem curso
- **WHEN** a migração desta change é aplicada
- **THEN** os vídeos que já existiam passam a pertencer ao curso "Uso do painel", na mesma ordem

### Requirement: Tela de vídeos de treinamento aberta a todo usuário do painel

As rotas `/admin/ajuda` e `/admin/ajuda/<slug>` SHALL existir para qualquer sessão com `admin.access`, sem permissão adicional.

A página de um curso de consulta SHALL mostrar no topo um destaque com o vídeo atual e, abaixo, os vídeos publicados do curso em prateleiras de cards com rolagem lateral:
- "Primeiros passos", com os vídeos da trilha na ordem de posição e o andamento "X de Y" no título;
- "Aprofundamento", com os demais na ordem de posição.

Uma prateleira sem vídeo NÃO SHALL ser mostrada.

Cada card SHALL mostrar:
- a capa do vídeo ou, sem capa, uma capa gerada a partir do título;
- a duração sobre a capa;
- a categoria: o grupo do menu da tela ensinada, ou "Painel" quando o vídeo não ensina uma tela;
- o título;
- a tela que ensina, quando houver;
- se já foi assistido pela pessoa.

O card do vídeo que está no destaque SHALL ser identificado como atual. A rolagem das prateleiras NÃO SHALL depender de biblioteca de terceiros. Uma sessão com `tutorials.manage` SHALL ver a ação "Gerenciar vídeos" no cabeçalho do catálogo.

#### Scenario: Operador vê as prateleiras do curso de consulta
- **WHEN** um usuário com papel `staff` abre `/admin/ajuda/uso-do-painel` com três vídeos de trilha e dois avulsos publicados
- **THEN** vê a prateleira "Primeiros passos" com os três da trilha e a prateleira "Aprofundamento" com os dois avulsos, cada card com capa, duração, categoria, título e a marca de assistido nos que já concluiu

#### Scenario: Prateleira vazia some
- **WHEN** todos os vídeos publicados do curso de consulta são da trilha
- **THEN** a página mostra só a prateleira "Primeiros passos"

#### Scenario: Categoria pela tela ensinada
- **WHEN** um vídeo ensina `/admin/pedidos` e outro não ensina tela nenhuma
- **THEN** o card do primeiro mostra a categoria "Operação" e a tela "Pedidos de serviço", e o do segundo mostra a categoria "Painel"

#### Scenario: Card sem capa
- **WHEN** um vídeo publicado não tem imagem de capa
- **THEN** o card mostra uma capa com o título do vídeo, no mesmo tamanho das capas com imagem

#### Scenario: Ação de gerenciar só para a plataforma
- **WHEN** um `superadmin` abre `/admin/ajuda`
- **THEN** o cabeçalho mostra "Gerenciar vídeos" levando a `/admin/ajuda/gerenciar`; um `admin` não vê a ação

### Requirement: Vídeo toca no painel, em player nativo com legenda

A página do curso SHALL tocar o vídeo atual em um elemento `<video>` do navegador, com:
- controles;
- legenda em português como faixa de legendas, quando o vídeo tem legenda;
- a imagem de capa como pôster, quando o vídeo tem capa;
- nenhum script, iframe ou recurso de terceiro.

A política de conteúdo SHALL permitir mídia apenas de `'self'`, do esquema `blob:` da própria página (usado pelo formulário para ler a duração do arquivo antes do envio) e do host do store configurado para o deploy, exato, sem curinga.

`/admin/ajuda?video=<id>` de um vídeo publicado SHALL redirecionar para a página do curso desse vídeo, mantendo o parâmetro. Um id de rascunho ou inexistente SHALL levar ao catálogo, sem revelar nada.

#### Scenario: Abrir pelo id
- **WHEN** a pessoa abre `/admin/ajuda/uso-do-painel?video=<id de um vídeo publicado do curso>`
- **THEN** o destaque mostra esse vídeo, com a legenda quando existe

#### Scenario: Capa como pôster
- **WHEN** o vídeo atual tem imagem de capa
- **THEN** o player mostra a capa antes de a reprodução começar

#### Scenario: Id de rascunho não revela nada
- **WHEN** a pessoa abre `/admin/ajuda?video=<id de um rascunho>`
- **THEN** a tela mostra o catálogo, como se o id não existisse

#### Scenario: Mídia só do store do deploy
- **WHEN** a resposta de uma rota do painel é inspecionada num deploy com store configurado
- **THEN** o cabeçalho `Content-Security-Policy` contém `media-src 'self' blob: https://<host do store>` e nada mais nessa diretiva

### Requirement: Progresso é da pessoa e acompanha a conta

O sistema SHALL guardar, por usuário e por vídeo, a data da primeira vez em que o vídeo foi concluído, com chave estrangeira para o vídeo.

Num curso de consulta, um vídeo SHALL ser marcado como assistido quando a reprodução chega ao fim ou quando a pessoa aciona "Marcar como assistido", e SHALL poder ser desmarcado por "Desfazer". Num curso sequencial, valem as regras da capability `admin-courses`: só ao fim, sem marcar à mão e sem desfazer.

Marcar de novo um vídeo já assistido NÃO SHALL alterar a data. O progresso SHALL ser lido e gravado apenas com a identidade da sessão autenticada, e SHALL ser o mesmo em qualquer máquina em que a pessoa entre. Excluir o vídeo SHALL excluir o progresso de todos nele; despublicar NÃO SHALL.

#### Scenario: Concluir a reprodução marca sozinho
- **WHEN** a reprodução de um vídeo aberto chega ao fim
- **THEN** o vídeo passa a constar como assistido, com a data de agora

#### Scenario: Marcar à mão e desfazer no curso de consulta
- **WHEN** a pessoa aciona "Marcar como assistido" num vídeo do curso "Uso do painel" e depois "Desfazer"
- **THEN** o vídeo aparece como assistido após a primeira ação e volta a não assistido após a segunda

#### Scenario: Desfazer recusado em curso sequencial
- **WHEN** a ação de desmarcar recebe o id de uma aula de curso sequencial
- **THEN** o servidor recusa e a marca continua

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

Os vídeos marcados como trilha no curso "Uso do painel" SHALL compor a trilha de primeiros passos, na ordem do curso. A marca de trilha em vídeos de outros cursos SHALL ser ignorada.

O sistema SHALL calcular, para a pessoa, quantos vídeos da trilha ela assistiu, quantos há ao todo e qual é o próximo não assistido. A trilha NÃO SHALL impedir o uso de nenhuma tela: é sugestão, nunca condição.

#### Scenario: Próximo da trilha
- **WHEN** a trilha tem sete vídeos e a pessoa assistiu ao primeiro e ao terceiro
- **THEN** o andamento é "2 de 7" e o próximo é o segundo

#### Scenario: Vídeo fora da trilha não conta
- **WHEN** o curso tem sete vídeos de trilha e dois avulsos, todos assistidos menos um avulso
- **THEN** a trilha consta como completa, "7 de 7"

#### Scenario: Aulas de outro curso não entram na trilha
- **WHEN** a pessoa assiste a todas as aulas do curso de LGPD e a nenhum vídeo do painel
- **THEN** o card da Visão geral continua mostrando "0 de 7"
