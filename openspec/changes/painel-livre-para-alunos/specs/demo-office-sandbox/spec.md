## ADDED Requirements

### Requirement: Aluno usa o painel do tenant de demonstração

No tenant com `demo` ligado, o papel de aluno SHALL ter todas as permissões de escritório, exceto as fechadas: gerenciar usuários, auditoria, regras de acesso, mensagens internas, cobrança, atendimento online, assinatura e certificados digitais, importação de arquivos do RCPN e das atribuições, base de conhecimento, Assistente Virtual e validação da qualificação. Fora de um tenant `demo`, o aluno SHALL ter apenas a permissão de acesso ao painel. O aluno NÃO SHALL ter nenhuma permissão de plataforma.

#### Scenario: Aluno atende um pedido
- **WHEN** um aluno no tenant de cursos muda o status de um pedido
- **THEN** a mudança é gravada e aparece para os outros alunos

#### Scenario: Aluno publica um edital
- **WHEN** um aluno publica um edital no painel do tenant de cursos
- **THEN** o edital aparece no site público de demonstração

#### Scenario: Usuários continua fechada
- **WHEN** um aluno abre `/admin/usuarios` ou `/admin/auditoria`
- **THEN** recebe 404

#### Scenario: Mensagens internas fechada
- **WHEN** um aluno abre `/admin/mensagens`
- **THEN** recebe 404, embora a Visão geral esteja aberta para ele

#### Scenario: Acesso do cartório não muda pelo aluno
- **WHEN** um aluno envia direto ao servidor a action que liga as duas etapas ou o horário de acesso
- **THEN** a action recusa e nada é gravado

#### Scenario: Chave Pix fechada
- **WHEN** um aluno envia direto ao servidor a action que troca a chave Pix
- **THEN** a action recusa e nada é gravado

#### Scenario: Fora do tenant de demonstração
- **WHEN** as permissões do papel aluno são calculadas para um tenant sem `demo`
- **THEN** o resultado é só a permissão de acesso ao painel

### Requirement: Toda permissão de escritório é classificada para o aluno

Cada permissão de escritório SHALL estar classificada, no código, como aberta ou fechada ao aluno no tenant de demonstração. Uma permissão sem classificação SHALL fazer a bateria de testes falhar.

#### Scenario: Permissão nova sem classificação
- **WHEN** uma permissão de escritório é adicionada sem entrar em nenhuma das duas listas
- **THEN** a bateria de testes falha

### Requirement: Mensagens internas com permissão própria

Mensagens internas SHALL exigir uma permissão própria, derivada da permissão da Visão geral. Todo papel de escritório que tinha a Visão geral SHALL continuar com Mensagens internas, e o Tabelião/Registrador SHALL poder concedê-la ou retirá-la em Perfis e permissões.

#### Scenario: Escrevente continua com Mensagens
- **WHEN** um escrevente de um cartório cliente, com as permissões padrão, abre `/admin/mensagens`
- **THEN** a tela abre como antes

### Requirement: Faixa do painel de demonstração

Toda tela do painel aberta por um aluno no tenant de demonstração SHALL mostrar, fixa no topo do conteúdo, uma faixa dizendo que o cartório não existe, que o que ele fizer fica visível para os outros participantes e pode ser apagado a qualquer momento, e que não deve usar dados reais. A faixa NÃO SHALL aparecer para a conta da Átrios.

#### Scenario: Faixa para o aluno
- **WHEN** um aluno abre a fila de pedidos no tenant de cursos
- **THEN** a faixa aparece no topo

#### Scenario: Sem faixa para a Átrios
- **WHEN** a conta da Átrios abre a fila de pedidos no tenant de cursos
- **THEN** a faixa não aparece

### Requirement: Nenhum e-mail sai do tenant de demonstração

No tenant com `demo` ligado, toda mensagem do cartório (ao requerente, ao cidadão, à serventia, confirmações dos formulários públicos e lembretes) NÃO SHALL ser enviada. Ela SHALL ser guardada numa caixa de saída de demonstração, com destinatário, assunto e texto. As mensagens da conta do aluno (senha esquecida, código de acesso, troca de e-mail) SHALL continuar sendo enviadas. Cada chamada de envio SHALL dizer o tenant e se a mensagem é da conta ou do cartório.

#### Scenario: Mudança de status não manda e-mail
- **WHEN** um aluno muda o status de um pedido no tenant de cursos
- **THEN** nenhum e-mail é enviado ao requerente, e a mensagem aparece na caixa de saída de demonstração

#### Scenario: Formulário público não manda e-mail
- **WHEN** alguém agenda pelo site de demonstração informando um e-mail
- **THEN** nenhum e-mail é enviado a esse endereço, e a confirmação aparece na caixa de saída de demonstração

#### Scenario: Senha esquecida continua chegando
- **WHEN** um aluno pede para redefinir a senha no tenant de cursos
- **THEN** o e-mail de redefinição é enviado a ele

#### Scenario: Cartório cliente envia normalmente
- **WHEN** um escrevente de um cartório cliente muda o status de um pedido
- **THEN** o e-mail ao requerente é enviado como hoje

### Requirement: Aluno vê o que teria sido enviado

O tenant de demonstração SHALL ter uma tela "E-mails de demonstração" com as mensagens guardadas, da mais recente para a mais antiga, cada uma com link para o registro de origem quando houver. No histórico de um registro, a mensagem guardada SHALL aparecer como "Demonstração: e-mail não enviado". A tela NÃO SHALL ter item no menu: o acesso SHALL ser pelos links do histórico dos registros. A tela NÃO SHALL existir fora do tenant de demonstração.

#### Scenario: Aluno lê o e-mail não enviado
- **WHEN** um aluno muda o status de um pedido e abre "E-mails de demonstração"
- **THEN** vê o e-mail que o requerente receberia, com link para o pedido

#### Scenario: Fora do menu
- **WHEN** um aluno abre o painel do tenant de cursos
- **THEN** o menu não mostra o item "E-mails de demonstração", e o link do histórico de um pedido leva à mensagem

#### Scenario: Tela inexistente em cartório cliente
- **WHEN** um usuário de cartório cliente abre o endereço da tela "E-mails de demonstração"
- **THEN** recebe 404

### Requirement: Nada sai para sistemas externos

No tenant de demonstração, nenhuma ferramenta SHALL fazer chamada a sistema externo: prefeitura, CENSEC, Receita Federal, Justiça Aberta ou aviso a buscadores. Geração de arquivo para download SHALL continuar funcionando. A IA SHALL ficar desligada no tenant de demonstração.

#### Scenario: Publicação não avisa buscadores
- **WHEN** um aluno publica um edital no tenant de cursos
- **THEN** nenhum aviso é mandado a buscadores

#### Scenario: Sem IA
- **WHEN** um aluno abre o detalhe de um requerimento LGPD no tenant de cursos
- **THEN** o painel não oferece o Assistente Virtual e nenhuma chamada à IA é feita

### Requirement: Escritório de demonstração no seed

O seed de dados fictícios SHALL criar no tenant de cursos pedidos em vários estados da fila, requerimentos LGPD, manifestações de ouvidoria e agendamentos de hoje e amanhã, com pessoas inventadas e e-mails no domínio reservado para exemplo. O seed SHALL continuar recusando qualquer tenant fora da lista de tenants fictícios.

#### Scenario: Fila preenchida
- **WHEN** o seed roda para o tenant de cursos e um aluno abre a fila
- **THEN** a fila mostra pedidos em mais de um estado

#### Scenario: Seed recusa cartório real
- **WHEN** o seed é chamado com o slug de um cartório cliente
- **THEN** recusa sem gravar nada

### Requirement: Limpeza do cartório de demonstração

A conta da Átrios SHALL poder limpar o cartório de demonstração: apagar as linhas do tenant de demonstração numa lista fechada de tabelas do escritório e os arquivos delas, e rodar o seed de novo. A limpeza SHALL recusar qualquer tenant fora da lista de tenants fictícios ou sem `demo`. A limpeza NÃO SHALL tocar contas, sessões, turmas, membros de turma, progresso, avaliações, certificados, cursos, vídeos nem a auditoria, nem linhas de outro tenant. A limpeza SHALL rodar só quando a conta da Átrios pede, e NÃO SHALL rodar sozinha por agendamento. Cada limpeza SHALL ficar registrada na auditoria da plataforma, com quantas linhas foram apagadas por tabela.

#### Scenario: Limpeza volta ao estado inicial
- **WHEN** a conta da Átrios confirma a limpeza do tenant de cursos
- **THEN** os pedidos criados pelos alunos somem, e a fila volta a mostrar só os pedidos do seed

#### Scenario: Conta e certificado ficam
- **WHEN** a limpeza roda
- **THEN** as contas dos alunos, as turmas, o progresso e os certificados continuam iguais

#### Scenario: Outro tenant intocado
- **WHEN** a limpeza roda para o tenant de cursos
- **THEN** nenhuma linha do Serra Verde nem de cartório cliente muda

#### Scenario: Sem limpeza automática
- **WHEN** passa uma semana sem a conta da Átrios pedir a limpeza
- **THEN** o que os alunos fizeram continua no cartório de demonstração

#### Scenario: Recusa cartório real
- **WHEN** a limpeza é chamada com o slug de um cartório cliente
- **THEN** recusa sem apagar nada

### Requirement: Início do aluno no tenant de demonstração

No tenant de demonstração, `/admin` SHALL mostrar ao aluno a Visão geral. O cadastro pelo link da turma SHALL continuar levando o aluno direto ao curso.

#### Scenario: Início mostra a Visão geral
- **WHEN** um aluno abre `/admin` no tenant de cursos
- **THEN** vê a Visão geral com a faixa de demonstração

#### Scenario: Cadastro continua levando ao curso
- **WHEN** um aluno termina o cadastro pelo link da turma
- **THEN** é levado ao curso da turma
