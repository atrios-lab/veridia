## 1. Antes de começar

- [ ] 1.1 Confirmar com o usuário os dados da Átrios para a configuração do tenant de cursos (nome, CNPJ, telefone, e-mail, encarregado)
- [ ] 1.2 Confirmar com o usuário a validade padrão do link (proposta: 30 dias)

## 2. Tenant de cursos

- [ ] 2.1 `src/core/tenant/courses-tenant.ts`: `COURSES_TENANT_SLUG` e `isCoursesTenant`; registrar `atrios-cursos` em `src/core/tenant/tenants/` e em `TENANTS`, com hosts `curso.atrioss.com` e `curso.localhost`; testes de resolução por host
- [ ] 2.2 Função pura `coursesTenantRedirect(host, pathname)` (deixa passar `/admin`, `/turma`, `/api` e estáticos; o resto vai para `/admin/login`); testes, incluindo que hosts de cartórios clientes nunca são redirecionados
- [ ] 2.3 Chamar `coursesTenantRedirect` no `src/middleware.ts`

## 3. Papel e permissão

- [ ] 3.1 Papel `learner` em `ROLES`, com `["admin.access"]`, fora de `PANEL_ROLES`; rótulo "Aluno" em `ROLE_LABELS`
- [ ] 3.2 Permissão de plataforma `cohorts.manage` em `PLATFORM_PERMISSIONS`
- [ ] 3.3 Testes em `roles.test.ts`: `learner` só tem `admin.access`; `admin` e `staff` não têm `cohorts.manage`; `learner` é recusado em `createUser`
- [ ] 3.4 `homeFor(role)` puro e redirecionamento do início do painel para `/admin/ajuda` quando o papel é `learner`; teste

## 4. Dados e regras puras

- [ ] 4.1 Tabelas `course_cohorts` e `cohort_members` no schema Drizzle; gerar a migração `0035` e conferir que só tem `CREATE TABLE` e índices; `pnpm check:destructive` verde
- [ ] 4.2 `src/core/cohorts/code.ts`: código de 8 caracteres no alfabeto do certificado, formato `XXXX-XXXX`, normalização da entrada; testes
- [ ] 4.3 `src/core/cohorts/cohort.ts`: estado do link (`open`, `expired`, `closed`, `full`), validação da criação e da edição da turma (vagas >= 1 e nunca abaixo das usadas), validação do cadastro do aluno (nome com duas palavras, e-mail, senha); testes
- [ ] 4.4 `src/core/cohorts/progress.ts`: situação do aluno a partir de vídeos assistidos, última tentativa e certificado; testes

## 5. Leitura e escrita

- [ ] 5.1 `src/lib/cohorts.ts`: criar, editar, encerrar e reabrir turma, com auditoria sob a plataforma; testes contra PGlite
- [ ] 5.2 `joinCohortWith(db, ...)`: transação que trava a turma, confere estado e vagas, cria `user`, `account` (senha em hash) e `cohort_members`; testes contra PGlite para cadastro aceito, e-mail repetido, turma vencida, encerrada e cheia, e duas inscrições disputando a última vaga
- [ ] 5.3 Teste de que a conta criada por `joinCohortWith` faz login pelo Better Auth
- [ ] 5.4 Listagem das turmas (vagas usadas, concluíram) e detalhe com os alunos e o progresso de cada um; testes contra PGlite
- [ ] 5.5 `issueCertificateWith` usa o `office_name` da turma quando a conta é de turma; testes contra PGlite para aluno de turma, funcionário de cliente e turma renomeada depois da emissão

## 6. Cadastro pelo link

- [ ] 6.1 Página `src/app/turma/[codigo]/page.tsx`: 404 fora do tenant de cursos; mensagens de link inexistente, sem inscrições e sem vagas; aluno já logado vai para o curso
- [ ] 6.2 Formulário com nome, e-mail, senha, caixa de contato desmarcada e aviso de privacidade (rascunho para o usuário aprovar)
- [ ] 6.3 Action: limite por IP, chama `joinCohortWith`, entra com `auth.api.signInEmail` e redireciona para `/admin/ajuda/lgpd-no-cartorio`; e-mail repetido aponta para o login
- [ ] 6.4 Painel de avaliação mostra o nome do cartório da turma antes da emissão

## 7. Tela de turmas

- [ ] 7.1 Aba "Turmas" em Treinamento › Gerenciar, só com `cohorts.manage` (404 sem a permissão)
- [ ] 7.2 Lista de turmas e formulário de nova turma; botão de copiar o link com o host do tenant de cursos
- [ ] 7.3 Página da turma: dados, link, aumentar vagas, prorrogar, encerrar e reabrir; lista de alunos com progresso, avaliação, certificado e consentimento
- [ ] 7.4 Revisar textos da tela de cadastro e da tela de turmas com o agente de UX writing

## 8. Verificação e entrega

- [ ] 8.1 Seed local: tenant de cursos com uma turma de teste; fluxo inteiro em `curso.localhost:3000` (cadastro, aulas, avaliação, certificado com o nome da turma, validação pública)
- [ ] 8.2 Conferir que a raiz de `demo.localhost` e de um cartório cliente continua com o site público
- [ ] 8.3 Bateria do CI: typecheck, lint, test, check:dashes, check:tokens, check:destructive, `openspec validate --all` e build
- [ ] 8.4 Aplicar a migração `0035` no Homolog e testar no Preview
- [ ] 8.5 Usuário liga `curso.atrioss.com` na Vercel e no DNS
- [ ] 8.6 Aplicar a migração em produção à mão antes do merge; abrir a PR
