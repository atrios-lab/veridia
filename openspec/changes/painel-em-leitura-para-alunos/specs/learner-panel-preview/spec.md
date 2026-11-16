## ADDED Requirements

### Requirement: Modo visita só para aluno no tenant de demonstração

O sistema SHALL abrir telas do painel em modo visita apenas para a sessão de papel aluno num tenant cuja configuração tem `demo` ligado. Para qualquer outro papel ou tenant, a entrada das telas SHALL continuar dependendo só da permissão de alterar.

#### Scenario: Aluno no tenant de cursos visita a fila
- **WHEN** um aluno logado no tenant de cursos abre `/admin/pedidos`
- **THEN** vê a fila de pedidos em modo visita

#### Scenario: Escrevente continua precisando da permissão
- **WHEN** um escrevente de um cartório cliente sem `requests.manage` abre `/admin/pedidos`
- **THEN** recebe 404

#### Scenario: Tenant sem demo não oferece visita
- **WHEN** a regra de visita é avaliada para o papel aluno num tenant com `demo` desligado
- **THEN** a visita é recusada

### Requirement: Lista fechada de telas visitáveis

O modo visita SHALL abrir apenas as telas que declaram ser visitáveis: Visão geral, Pedidos de serviço, Agenda, Requerimentos LGPD, Ouvidoria, Publicações e Transparência, com lista e detalhe. Toda outra tela do painel SHALL continuar respondendo 404 ao aluno, inclusive as que exigem a mesma permissão de uma tela visitável.

#### Scenario: Configurações continua fechada
- **WHEN** um aluno abre `/admin/configuracoes`
- **THEN** recebe 404, embora Publicações, que usa a mesma permissão, esteja aberta na visita

#### Scenario: Usuários e Auditoria continuam fechadas
- **WHEN** um aluno abre `/admin/usuarios` ou `/admin/auditoria`
- **THEN** recebe 404

#### Scenario: Menu mostra só as telas visitáveis
- **WHEN** um aluno abre o painel do tenant de cursos
- **THEN** o menu mostra o Treinamento e as sete telas visitáveis, e nenhum outro item que exija permissão

### Requirement: Nenhuma alteração pelo aluno

O papel aluno SHALL continuar com apenas a permissão de acesso ao painel. Toda server action e toda rota de envio de arquivo SHALL recusar o aluno no servidor, com ou sem visita. As telas abertas em visita NÃO SHALL mostrar botões nem formulários que alterem dados. Filtros, abas, busca e paginação SHALL continuar funcionando.

#### Scenario: Action recusa o aluno
- **WHEN** um aluno envia, direto ao servidor, a action que muda o status de um pedido
- **THEN** a action recusa e nada é gravado

#### Scenario: Tela sem controles de alteração
- **WHEN** um aluno abre o detalhe de um pedido em visita
- **THEN** a página não mostra o formulário de mudança de status, de resposta ou de envio de arquivo

#### Scenario: Busca funciona na visita
- **WHEN** um aluno busca pelo nome de um requerente na fila em visita
- **THEN** a fila mostra o resultado da busca dentro do que ele pode ver

#### Scenario: Recursos de IA ficam fora
- **WHEN** um aluno abre o detalhe de um requerimento LGPD em visita
- **THEN** a página não oferece o Assistente Virtual e nenhuma chamada à IA é feita

### Requirement: Faixa de modo visita

Toda tela aberta em visita SHALL mostrar, fixa no topo do conteúdo, uma faixa dizendo que é o painel de um cartório que não existe e que nada pode ser alterado. A faixa NÃO SHALL aparecer para quem entrou na tela pela permissão de alterar.

#### Scenario: Faixa na visita
- **WHEN** um aluno abre a Agenda em visita
- **THEN** a faixa de modo visita aparece no topo

#### Scenario: Conta da Átrios não vê a faixa
- **WHEN** a conta da Átrios abre a Agenda no tenant de cursos
- **THEN** a faixa de modo visita não aparece, e os controles de alteração aparecem

### Requirement: Aluno vê só dado de demonstração e o próprio

Na visita, cada lista, contagem e detalhe de pedidos, requerimentos LGPD, manifestações de ouvidoria e agendamentos SHALL mostrar apenas os registros marcados como de demonstração e os enviados pelo próprio aluno. Um registro fora disso SHALL responder 404 no detalhe, como um protocolo inexistente. Publicações e Transparência SHALL mostrar todo o conteúdo do tenant.

#### Scenario: Envio de outro aluno não aparece
- **WHEN** a aluna A enviou um pedido pelo site de demonstração e o aluno B abre a fila em visita
- **THEN** o pedido da aluna A não aparece na lista nem nas contagens

#### Scenario: Endereço direto não vaza
- **WHEN** o aluno B abre o detalhe do pedido da aluna A pelo protocolo
- **THEN** recebe 404

#### Scenario: Envio anônimo não aparece
- **WHEN** um visitante sem sessão enviou uma manifestação de ouvidoria e um aluno abre a Ouvidoria em visita
- **THEN** a manifestação não aparece

#### Scenario: Visão geral bate com as listas
- **WHEN** um aluno abre a Visão geral em visita
- **THEN** as contagens consideram só os registros que ele vê nas listas

#### Scenario: Conta da Átrios vê tudo
- **WHEN** a conta da Átrios abre a fila de pedidos do tenant de cursos
- **THEN** vê todos os registros, marcados ou não

### Requirement: Envio do aluno chega no painel dele

Quando um aluno com sessão no tenant de demonstração envia um pedido, agendamento, requerimento LGPD ou manifestação de ouvidoria pelo site público, o registro SHALL guardar a conta do aluno como dono de demonstração. Em qualquer outro tenant, ou sem sessão de aluno, o registro NÃO SHALL guardar dono.

#### Scenario: Aluno vê o próprio pedido
- **WHEN** um aluno logado envia um pedido pelo site de demonstração e abre a fila em visita
- **THEN** o pedido aparece na fila com o mesmo protocolo mostrado no site

#### Scenario: Cartório cliente não grava dono
- **WHEN** um cidadão envia um pedido pelo site de um cartório cliente
- **THEN** o registro não guarda dono de demonstração

### Requirement: Escritório de demonstração no seed

O seed de dados fictícios SHALL criar no tenant de cursos pedidos em vários estados da fila, requerimentos LGPD, manifestações de ouvidoria e agendamentos de hoje e amanhã, todos marcados como de demonstração e com pessoas inventadas. O seed SHALL continuar recusando qualquer tenant fora da lista de tenants fictícios.

#### Scenario: Fila de demonstração preenchida
- **WHEN** o seed roda para o tenant de cursos e um aluno abre a fila em visita
- **THEN** a fila mostra pedidos em mais de um estado

#### Scenario: Seed recusa cartório real
- **WHEN** o seed é chamado com o slug de um cartório cliente
- **THEN** recusa sem gravar nada

### Requirement: Início do aluno no tenant de demonstração

No tenant de demonstração, `/admin` SHALL mostrar ao aluno a Visão geral em modo visita. O cadastro pelo link da turma SHALL continuar levando o aluno direto ao curso. A tela de Treinamento SHALL oferecer um atalho para conhecer o painel do cartório.

#### Scenario: Início mostra a Visão geral
- **WHEN** um aluno abre `/admin` no tenant de cursos
- **THEN** vê a Visão geral com a faixa de modo visita

#### Scenario: Cadastro continua levando ao curso
- **WHEN** um aluno termina o cadastro pelo link da turma
- **THEN** é levado ao curso da turma
