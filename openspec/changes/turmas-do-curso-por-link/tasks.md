## 1. Antes de começar

- [x] 1.1 Nome do cartório fictício: "Cartório Vale do Silício", em Vale do Silício/RN (usuário, 09/11/2026)
- [x] 1.1.1 Remetente dos e-mails: o endereço padrão da plataforma, da Átrios; o tenant de cursos não define `emailFrom` (usuário, 09/11/2026)
- [x] 1.2 Validade padrão do link: 30 dias (usuário, 09/11/2026)

## 2. Tenant de cursos e site de demonstração

- [x] 2.1 `src/core/tenant/courses-tenant.ts`: `COURSES_TENANT_SLUG` e `isCoursesTenant`; registrar `atrios-cursos` em `src/core/tenant/tenants/` e em `TENANTS`, cartório fictício com todas as atribuições, hosts `curso.atrioss.com` e `curso.localhost`; testes de resolução por host
- [x] 2.2 Campo opcional `demo` no schema do tenant, falso por padrão, ligado só no tenant de cursos; teste que prova que nenhum outro tenant o liga
- [x] 2.3 Faixa de demonstração no layout público quando `demo` está ligado, e aviso perto do botão de enviar nos formulários de pedido, agendamento, LGPD e ouvidoria
- [x] 2.4 Atendimento online desligado no tenant de cursos (o layout esconde o chat de todo tenant `demo`)
- [x] 2.5 Atalho "Ver o site do cartório de demonstração" na tela de Treinamento do aluno
- [x] 2.6 `scripts/seed-demo-data.ts` recebe o slug por argumento, aceita só a lista fechada de tenants fictícios e grava, para o tenant de cursos, proclamas, um edital de cada outro setor, um aviso e três boletins, sem pedidos de cidadão (documentos de transparência ficam para a tela, porque são PDFs)
- [x] 2.7 Conferir no navegador, em `curso.localhost:3000`, cada seção do site com o conteúdo do seed e a faixa visível, no celular e no computador

## 3. Papel e permissão

- [x] 3.1 Papel `learner` em `ROLES`, com `["admin.access"]`, fora de `PANEL_ROLES`; rótulo "Aluno" em `ROLE_LABELS`
- [x] 3.2 Permissão de plataforma `cohorts.manage` em `PLATFORM_PERMISSIONS`
- [x] 3.3 Testes em `roles.test.ts`: `learner` só tem `admin.access`; `admin` e `staff` não têm `cohorts.manage`; `learner` é recusado em `createUser`
- [x] 3.4 `homeFor(role)` puro e redirecionamento do início do painel para `/admin/ajuda` quando o papel é `learner`; teste
- [x] 3.5 Permissão `desk.access` para a Visão geral e o e-mail corporativo, e pílula do chat só com `chat.manage`, para o menu do aluno mostrar só o Treinamento

## 4. Dados e regras puras

- [x] 4.1 Tabelas `course_cohorts` e `cohort_members` no schema Drizzle; gerar a migração `0035` e conferir que só tem `CREATE TABLE` e índices; `pnpm check:destructive` verde
- [x] 4.2 `src/core/cohorts/code.ts`: código de 8 caracteres no alfabeto do certificado, formato `XXXX-XXXX`, normalização da entrada; testes
- [x] 4.3 `src/core/cohorts/cohort.ts`: estado do link (`open`, `expired`, `closed`, `full`), validação da criação e da edição da turma (vagas >= 1 e nunca abaixo das usadas), validação do cadastro do aluno (nome com duas palavras, e-mail, senha); testes
- [x] 4.4 `src/core/cohorts/progress.ts`: situação do aluno a partir de vídeos assistidos, última tentativa e certificado; testes

## 5. Leitura e escrita

- [x] 5.1 `src/lib/cohorts.ts`: criar, editar, encerrar e reabrir turma, com auditoria sob a plataforma; testes contra PGlite
- [x] 5.2 `joinCohortWith(db, ...)`: transação que trava a turma, confere estado e vagas, cria `user`, `account` (senha em hash) e `cohort_members`; testes contra PGlite para cadastro aceito, e-mail repetido, turma vencida, encerrada e cheia, e duas inscrições disputando a última vaga
- [x] 5.3 Teste de que a conta criada por `joinCohortWith` faz login pelo Better Auth
- [x] 5.4 Listagem das turmas (vagas usadas, concluíram) e detalhe com os alunos e o progresso de cada um; testes contra PGlite
- [x] 5.5 `issueCertificateWith` usa o `office_name` da turma quando a conta é de turma; testes contra PGlite para aluno de turma, funcionário de cliente e turma renomeada depois da emissão

## 6. Cadastro pelo link

- [x] 6.1 Página `src/app/turma/[codigo]/page.tsx`: 404 fora do tenant de cursos; mensagens de link inexistente, sem inscrições e sem vagas; aluno já logado vai para o curso
- [x] 6.2 Formulário com nome, e-mail, senha, caixa de contato desmarcada e aviso de privacidade (rascunho para o usuário aprovar)
- [x] 6.3 Action: limite por IP, chama `joinCohortWith`, entra com `auth.api.signInEmail` e redireciona para `/admin/ajuda/lgpd-no-cartorio`; e-mail repetido aponta para o login
- [x] 6.4 Painel de avaliação mostra o nome do cartório da turma antes da emissão

## 7. Tela de turmas

- [x] 7.1 Aba "Turmas" em Treinamento › Gerenciar, só com `cohorts.manage` (404 sem a permissão)
- [x] 7.2 Lista de turmas e formulário de nova turma; botão de copiar o link com o host do tenant de cursos
- [x] 7.3 Página da turma: dados, link, aumentar vagas, prorrogar, encerrar e reabrir; lista de alunos com progresso, avaliação, certificado e consentimento
- [ ] 7.4 Usuário aprova o aviso de privacidade e a caixa de contato da tela de cadastro (rascunho em `src/app/(public)/turma/[codigo]/join-form.tsx`)

## 8. Verificação e entrega

- [x] 8.1 Fluxo em `curso.localhost` contra o Homolog: site com faixa, cadastro pela turma, menu do aluno, avaliação aprovada e prévia do certificado com o nome da turma. Não testados no navegador: a emissão com CPF (coberta pelos testes com PGlite) e a tela de turmas da conta da Átrios (sem conta superadmin de teste no Homolog)
- [x] 8.2 Conferir que `demo.localhost` e um cartório cliente continuam sem a faixa de demonstração
- [x] 8.3 Bateria do CI: typecheck, lint, test, check:dashes, check:tokens, check:destructive, `openspec validate --all` e build
- [x] 8.4 Aplicar a migração `0035` no Homolog e rodar o seed do tenant de cursos lá (09/11/2026; no Homolog também ficaram o curso `lgpd-teste-turmas`, a turma de teste e a aluna `aluna.teste.turmas@exemplo.com`)
- [ ] 8.4.1 Testar no Preview, com a conta da Átrios, a tela de turmas
- [ ] 8.5 Usuário liga `curso.atrioss.com` na Vercel e no DNS e preenche o conteúdo público em produção, pelo seed ou pela tela
- [x] 8.6 Aplicar a migração em produção à mão antes do merge (feito pelo usuário em 09/11/2026); abrir a PR (#207)
