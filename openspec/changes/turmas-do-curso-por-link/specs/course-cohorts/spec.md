## ADDED Requirements

### Requirement: Tenant de cursos sem site público

A plataforma SHALL ter um tenant próprio para alunos de turmas, `atrios-cursos`, que responde em `curso.atrioss.com`. Nesse host, só o painel, o cadastro por turma, as rotas de API e os arquivos estáticos SHALL responder; qualquer outra página pública SHALL redirecionar para o login do painel.

#### Scenario: Raiz manda para o login
- **WHEN** alguém abre `curso.atrioss.com/`
- **THEN** é redirecionado para `/admin/login`

#### Scenario: Página pública de serventia não existe ali
- **WHEN** alguém abre `curso.atrioss.com/solicitar`
- **THEN** é redirecionado para `/admin/login`, sem formulário de pedido

#### Scenario: Cartórios clientes não mudam
- **WHEN** alguém abre a raiz do site de um cartório cliente
- **THEN** o site público do cartório aparece como antes

### Requirement: Turma com link próprio

A conta da Átrios SHALL poder criar uma turma informando:
- nome do cartório, como deve sair no certificado;
- cidade;
- nome e telefone do responsável;
- número de vagas, de pelo menos 1;
- validade do link.

Cada turma SHALL ter um código aleatório único, e o link SHALL ser `https://curso.atrioss.com/turma/<código>`. O link NÃO SHALL carregar o nome do cartório nem outro dado da turma.

#### Scenario: Criar turma
- **WHEN** a conta da Átrios cria a turma do "2º Ofício de X/RN" com 15 vagas e 30 dias
- **THEN** a turma aparece na lista com um código e um botão para copiar o link

#### Scenario: Link com o host do tenant de cursos
- **WHEN** a conta da Átrios copia o link estando logada no host de outro tenant
- **THEN** o link copiado usa `curso.atrioss.com`

### Requirement: Só a Átrios gerencia turmas

Criar, editar, encerrar e ver turmas SHALL exigir a permissão de plataforma `cohorts.manage`, que só o superadmin tem. A checagem SHALL ser feita no servidor.

#### Scenario: Registrador não vê turmas
- **WHEN** um registrador de cartório cliente abre a tela de turmas
- **THEN** recebe 404

#### Scenario: Ação forjada recusada
- **WHEN** uma conta sem `cohorts.manage` envia a ação de criar turma
- **THEN** o servidor recusa e nada é gravado

### Requirement: Cadastro do aluno pelo link

O link de uma turma aberta SHALL mostrar um formulário com nome completo, e-mail e senha, o nome do cartório da turma e o aviso de para que servem os dados. Ao enviar, o servidor SHALL criar uma conta com papel de aluno no tenant de cursos, ligada à turma, e SHALL entrar com ela, levando o aluno ao curso de LGPD.

O nome SHALL ter pelo menos duas palavras. O e-mail SHALL ser único em toda a plataforma.

O cadastro público genérico do sistema de autenticação SHALL continuar desligado: só um código de turma válido cria conta.

#### Scenario: Cadastro aceito
- **WHEN** Maria abre o link de uma turma com vagas e envia nome, e-mail e senha válidos
- **THEN** a conta dela é criada, ligada à turma, e ela cai logada no curso de LGPD

#### Scenario: E-mail já usado
- **WHEN** alguém se cadastra com um e-mail que já tem conta
- **THEN** o formulário diz que a conta já existe e indica o login, sem criar outra

#### Scenario: Link em host de cartório cliente
- **WHEN** alguém abre `/turma/<código>` no domínio de um cartório cliente
- **THEN** recebe 404

#### Scenario: Muitas tentativas
- **WHEN** o mesmo endereço IP envia o formulário além do limite
- **THEN** o envio é recusado com aviso para tentar mais tarde

### Requirement: Link respeita validade, encerramento e vagas

O link NÃO SHALL aceitar cadastro quando a turma está vencida, encerrada ou com todas as vagas usadas. A contagem de vagas SHALL valer mesmo com cadastros simultâneos.

#### Scenario: Turma vencida
- **WHEN** alguém abre o link depois da validade
- **THEN** a página diz que o link não aceita mais inscrições e não mostra o formulário

#### Scenario: Turma encerrada
- **WHEN** a conta da Átrios encerra a turma e alguém abre o link
- **THEN** a página diz que o link não aceita mais inscrições

#### Scenario: Última vaga disputada
- **WHEN** resta uma vaga e duas pessoas enviam o cadastro ao mesmo tempo
- **THEN** só uma conta é criada, e a outra pessoa vê que as vagas acabaram

#### Scenario: Código desconhecido
- **WHEN** alguém abre um link com código que não existe
- **THEN** a página diz que o link não existe

### Requirement: Aluno vê só o Treinamento

O papel de aluno SHALL ter apenas a permissão de acesso ao painel. O aluno SHALL ver o Treinamento, assistir aos cursos publicados, fazer a avaliação e emitir o certificado. Toda outra tela do painel SHALL responder 404 para ele. O papel de aluno NÃO SHALL ser oferecido nem aceito na criação de contas em Usuários.

#### Scenario: Início leva ao Treinamento
- **WHEN** um aluno abre `/admin`
- **THEN** é levado para `/admin/ajuda`

#### Scenario: Tela de pedidos fechada
- **WHEN** um aluno abre `/admin/pedidos`
- **THEN** recebe 404

#### Scenario: Registrador não cria aluno
- **WHEN** um registrador envia a criação de conta com papel de aluno
- **THEN** o servidor recusa

### Requirement: Certificado com o cartório da turma

O certificado de um aluno de turma SHALL trazer o nome do cartório cadastrado na turma no lugar do nome do tenant. A validação pública SHALL mostrar o mesmo nome. Contas que não são de turma SHALL continuar com o nome do próprio tenant.

#### Scenario: Aluno de turma
- **WHEN** um aluno da turma do "2º Ofício de X/RN" emite o certificado
- **THEN** o PDF e a validação pública dizem "2º Ofício de X/RN"

#### Scenario: Funcionário de cliente
- **WHEN** um funcionário de um cartório cliente emite o certificado
- **THEN** o certificado traz o nome do cartório dele, como antes

#### Scenario: Turma renomeada depois
- **WHEN** a Átrios corrige o nome do cartório da turma depois de um certificado emitido
- **THEN** o certificado já emitido continua com o nome da emissão

### Requirement: Consentimento de contato

O formulário de cadastro SHALL ter uma caixa opcional, desmarcada, para o aluno aceitar contato da Átrios sobre a plataforma. A data do aceite SHALL ser gravada. Sem o aceite, a tela de turmas SHALL indicar que o aluno não aceitou contato.

#### Scenario: Aceita contato
- **WHEN** o aluno marca a caixa e se cadastra
- **THEN** a tela da turma mostra que ele aceitou contato, com a data

#### Scenario: Não marca
- **WHEN** o aluno se cadastra sem marcar a caixa
- **THEN** a conta é criada normalmente, e a tela da turma mostra que ele não aceitou contato

### Requirement: Acompanhamento da turma

A tela de uma turma SHALL listar cada aluno com nome, e-mail, data de entrada, aulas assistidas do curso de LGPD sobre o total, situação da avaliação (não fez, reprovou, aprovado), se emitiu certificado e se aceitou contato. A lista de turmas SHALL mostrar vagas usadas, vagas totais e quantos alunos emitiram certificado.

A conta da Átrios SHALL poder aumentar as vagas, prorrogar a validade e encerrar o link. Reduzir vagas abaixo das já usadas SHALL ser recusado.

#### Scenario: Progresso do aluno
- **WHEN** um aluno assistiu a 7 de 14 vídeos e ainda não fez a avaliação
- **THEN** a linha dele mostra "7 de 14" e "não fez"

#### Scenario: Reduzir vagas abaixo do usado
- **WHEN** a turma tem 9 alunos e a Átrios tenta deixar 8 vagas
- **THEN** a alteração é recusada com a explicação
