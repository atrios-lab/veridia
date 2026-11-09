## Why

O curso "LGPD no cartório" vai ser oferecido de graça a cartórios que ainda não são clientes, como porta de entrada para a plataforma. Cada cartório tem vários funcionários, e criar um tenant e uma conta para cada um não escala. Um login único compartilhado também não serve: o progresso das aulas, a tentativa da avaliação e o certificado pertencem à conta, então a primeira pessoa liberaria ou travaria o curso para todas as outras, e só ela conseguiria emitir o certificado.

## What Changes

- **Tenant de cursos.** Uma serventia nova no registro, `atrios-cursos`, no endereço `curso.atrioss.com`, que existe só para receber esses alunos. É um cartório fictício, separado do Serra Verde, com todas as atribuições.
- **Site público de demonstração.** O tenant de cursos tem site público completo, com dados fictícios: publicações, editais, transparência, agenda e formulários. O aluno vê como o site de um cartório fica na plataforma. Toda página mostra um aviso de que é uma demonstração e de que não se deve enviar dado real. O painel do aluno tem um atalho para esse site.
- **Turma.** A conta da Átrios cadastra uma turma por cartório interessado: nome do cartório como deve sair no certificado, cidade, nome e telefone do responsável, número de vagas e validade. Cada turma gera um link com um código aleatório, `curso.atrioss.com/turma/<código>`. O link carrega só o código; o nome do cartório fica guardado no sistema e nunca vem do endereço.
- **Cadastro pelo link.** Quem abre o link informa nome, e-mail e senha, lê para que os dados servem e entra direto no curso. A conta nasce no tenant de cursos, com o papel novo de aluno, ligada à turma. O link recusa cadastro depois da validade, depois de encerrado e quando as vagas acabam. Quem já tem conta é mandado para o login.
- **Papel de aluno.** O aluno só enxerga o Treinamento: assiste aos cursos publicados, faz a avaliação e emite o certificado, como qualquer funcionário de serventia. Não vê nenhuma outra tela do painel.
- **Certificado com o cartório da turma.** O certificado de um aluno de turma leva o nome do cartório cadastrado na turma, no lugar do nome do tenant de cursos. A validação pública mostra o mesmo nome.
- **Gerenciar turmas.** Uma aba "Turmas" em Treinamento › Gerenciar, só para a conta da Átrios, lista as turmas com vagas usadas e quantos concluíram. Abrir uma turma mostra cada aluno e em que ponto está: aulas assistidas, avaliação e certificado. Ali também se aumenta vagas, prorroga a validade e encerra o link.
- **Contato comercial com consentimento.** O formulário de cadastro tem uma caixa opcional, desmarcada, para o aluno aceitar contato da Átrios sobre a plataforma. O aviso de privacidade diz para que serve cada dado. O CPF continua pedido só na emissão do certificado.

## Non-goals

- Atender os pedidos, agendamentos e manifestações enviados pelo site de demonstração. Eles caem na fila do tenant de cursos e ninguém os responde.
- Mostrar ao aluno as outras telas do painel, mesmo só para leitura. Hoje cada tela usa a mesma permissão para ver e para alterar; um modo de visita exige separar as duas em todas elas, e fica para uma change própria.
- Confirmação de e-mail no cadastro.
- Apagar contas de alunos ou turmas antigas. Qualquer limpeza é remoção de dados e vai numa change separada, revisada por outra pessoa.
- Relatório para o responsável do cartório, exportação para planilha ou integração com CRM.
- Marca ou tema por turma: o tenant de cursos tem uma identidade só, a da Átrios.
- Cursos diferentes por turma: o aluno vê todos os cursos publicados, como qualquer conta.
- Usar turmas nos cartórios clientes. Os funcionários deles continuam entrando pelas contas criadas em Usuários.

## Capabilities

### New Capabilities

- `course-cohorts`: tenant de cursos com site público de demonstração, turma com link e vagas, cadastro do aluno pelo link, papel de aluno, certificado com o nome do cartório da turma, consentimento de contato e a tela de gerenciamento das turmas.

### Modified Capabilities

Nenhuma. As regras de avaliação e certificado (`course-certificates`) ainda estão na change `avaliacao-e-certificado`, não arquivada; a troca do nome do cartório no certificado fica descrita dentro de `course-cohorts`, como regra só de quem entrou por turma.

## Impact

- **Banco**, só adições:
  - tabela `course_cohorts` (a turma);
  - tabela `cohort_members` (aluno, turma, data de entrada e consentimento de contato).

  Nenhuma coluna nova na tabela de usuários. A migração de produção é manual e roda antes do merge.
- **Papéis e permissões**: papel `learner` com `admin.access` apenas; permissão de plataforma `cohorts.manage`, só do superadmin.
- **Tenant**: registro de `atrios-cursos` em `src/core/tenant/tenants/`, com nome, cidade e pessoas fictícios.
- **Seed**: `scripts/seed-demo-data.ts` passa a aceitar o tenant de cursos, além do Serra Verde, e ganha o conteúdo público (proclamas, editais, aviso e boletins mensais). Em produção, quem roda o seed ou cadastra o conteúdo pela tela é o usuário.
- **Site público**: um aviso de demonstração em todas as páginas do tenant de cursos, e só dele.
- **Rotas novas**:
  - `/turma/[codigo]`, pública, que só responde no host do tenant de cursos;
  - `/admin/ajuda/gerenciar/turmas` e a página de cada turma.
- **Rotas alteradas**: emissão do certificado lê o nome do cartório da turma; o início do painel manda o aluno para o Treinamento.
- **Infraestrutura**: domínio `curso.atrioss.com` no projeto da Vercel e no DNS, feito pelo usuário.
- **Dado pessoal**: nome, e-mail e, com consentimento, uso do contato para fins comerciais. O aviso de privacidade da tela de cadastro passa por revisão do usuário antes de ir ao ar.
