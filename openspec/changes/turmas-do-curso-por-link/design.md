## Context

O curso "LGPD no cartório" está em produção desde 08/11/2026, com avaliação e certificado (changes `cursos-no-treinamento` e `avaliacao-e-certificado`). Tudo nele é por conta:

- o progresso fica em `tutorial_progress`, com chave (conta, vídeo);
- a tentativa aberta é única por (conta, curso), e o intervalo de 5 h conta por conta;
- o certificado é único por (conta, curso) e guarda o nome do tenant da sessão.

Contas de painel não se cadastram sozinhas: `disableSignUp` está ligado em `src/lib/auth.ts`, e as contas nascem em Usuários (`createUser`, com convite por e-mail) ou por script (`scripts/seed-admin.ts`). A sessão só vale no tenant da própria conta (`getSession` com `canAccessTenant`), e o superadmin entra em qualquer tenant registrado.

Cada tela do painel exige a mesma permissão para ser vista e para ser alterada: Pedidos pede `requests.manage`, Agenda pede `channels.manage`, e assim por diante. O menu esconde o que a permissão não dá. Uma conta com só `admin.access` vê o início e o Treinamento.

O objetivo comercial: muitos funcionários de cartórios que ainda não são clientes fazem o curso, recebem o certificado e conhecem a plataforma, sem a Átrios criar conta por conta.

## Goals / Non-Goals

**Goals:**
- Um link por cartório, que cada funcionário usa para criar a própria conta em um minuto.
- O curso, a avaliação e o certificado funcionando para cada aluno como já funcionam hoje, sem mudar as regras deles.
- O certificado com o nome do cartório do aluno, vindo do cadastro da turma, nunca do que o aluno digitou ou do endereço.
- Um link vazado não vira porta aberta: validade, vagas e encerramento.
- A Átrios vê, por turma, quem entrou e até onde foi.
- O aluno conhece o site público de um cartório na plataforma, com dados fictícios, sem risco de confundir com um cartório real.

**Non-Goals:**
- Ver as telas do painel em modo de leitura, confirmação de e-mail, limpeza de contas, relatório para o cartório, CRM e marca por turma (ver proposal).

## Decisions

### 1. Um tenant só para os alunos

```
TENANTS
  ├─ cartorio-marinho      (cliente)
  ├─ ...                   (clientes)
  ├─ cartorio-demonstracao (Serra Verde, gravações)
  └─ atrios-cursos         (alunos das turmas)   ← novo
       hosts: curso.atrioss.com, curso.localhost
```

`atrios-cursos` entra no registro como qualquer serventia, porque a sessão, o tema, o painel e o site dependem disso. É um cartório fictício, como o Serra Verde, mas outro: nome, cidade, titular, encarregado, telefones e e-mails inventados, e todas as atribuições, para o site mostrar todas as seções. O nome de trabalho é "Cartório de Vale Claro/RN", a confirmar com o usuário; não pode coincidir com município ou cartório real.

Um módulo puro (`src/core/tenant/courses-tenant.ts`) exporta `COURSES_TENANT_SLUG` e `isCoursesTenant(tenant)`. É o único lugar que conhece o slug; rotas e páginas perguntam a ele.

*Alternativa considerada*: pôr os alunos no Serra Verde. Descartada: Serra Verde é onde os vídeos são gravados, e lista de contas, auditoria e dados de alunos apareceriam nas gravações.

*Alternativa considerada*: um tenant por cartório interessado. Descartada: é config em código, PR e deploy para cada lead, o problema que esta change resolve.

### 2. Site público de demonstração

O tenant de cursos serve o site público inteiro, como qualquer serventia. O aluno vê o que o cidadão veria no site do próprio cartório: início, solicitar, agendar, acompanhar, editais, LGPD, ouvidoria, transparência, selo e contato.

```
curso.atrioss.com/            site público de Vale Claro (fictício)
curso.atrioss.com/turma/XXXX  cadastro do aluno
curso.atrioss.com/admin       painel do aluno (só Treinamento)
```

**Aviso de demonstração.** Toda página pública do tenant de cursos mostra uma faixa fixa no topo: "Site de demonstração. Este cartório não existe. Não envie dados reais." Acima de cada formulário público, o mesmo aviso aparece de novo, perto do botão de enviar. A faixa é ligada por um campo novo e opcional na configuração do tenant, `demo: true`, e não pelo slug, para o Serra Verde poder usar o mesmo aviso no futuro se o usuário quiser. Nesta change, só o tenant de cursos liga o campo; o Serra Verde fica como está, porque as gravações do curso já usam o site dele sem a faixa.

**Formulários funcionam.** Pedido, agendamento, LGPD e ouvidoria gravam e mostram o protocolo, para o aluno ver o fluxo inteiro, inclusive o acompanhamento. Os registros caem na fila do tenant de cursos, que ninguém atende. O expurgo dos arquivos dos protocolos, que já existe, vale para eles também.

*Alternativa considerada*: bloquear o envio dos formulários. Descartada: o protocolo e o acompanhamento são a parte que mais convence, e o aviso cobre o risco de dado real.

*Alternativa considerada*: o atendimento online (chat) ligado. Descartado: ninguém responde, e um chat sem resposta passa a imagem errada. O chat do tenant de cursos fica desligado na configuração.

**Atalho no painel.** A tela de Treinamento do aluno mostra um botão "Ver o site do cartório de demonstração", que abre a raiz do mesmo host em nova aba.

**Conteúdo.** O que vem da configuração (seções, contatos, horários, tema) está no arquivo do tenant. O que vem do banco (publicações, editais, documentos de transparência, boletim) é preenchido por seed:
- `scripts/seed-demo-data.ts` passa a aceitar uma lista fechada de tenants fictícios (`cartorio-demonstracao` e `atrios-cursos`), escolhida por argumento, e recusa qualquer outro, como já faz hoje;
- ganha o conteúdo público que hoje falta: editais de cada setor, documentos de transparência e um boletim;
- não cria pedidos de cidadão no tenant de cursos, porque ninguém vai ver a fila do painel ali.

O seed roda no banco local e no Homolog pelo agente. Em produção, o usuário roda o seed ou cadastra o conteúdo pela tela com a conta da Átrios.

### 3. Dados

```
course_cohorts                                   -- a turma
  id uuid pk
  code text unique                               -- XXXX-XXXX, Crockford base32
  office_name text                               -- como sai no certificado
  office_city text                               -- "Cidade/UF"
  contact_name text, contact_phone text          -- responsável que recebeu o link
  seats int                                      -- vagas, >= 1
  expires_at timestamptz                         -- validade do link
  closed_at timestamptz null                     -- encerrada à mão
  created_at, updated_at, created_by text

cohort_members                                   -- o aluno na turma
  user_id text pk → user (cascade)
  cohort_id uuid → course_cohorts (restrict)
  joined_at timestamptz
  contact_consent_at timestamptz null            -- aceitou contato comercial
  index (cohort_id)
```

A ligação aluno ↔ turma fica numa tabela própria, e não numa coluna da tabela `user`, por três motivos:
- a tabela de usuários é a do Better Auth, e não precisa saber de turma;
- uma conta tem no máximo uma turma, e a chave primária em `user_id` garante isso;
- o consentimento de contato é dado da turma, não da conta.

`restrict` na turma: uma turma com alunos não some. Apagar turma não faz parte desta change.

O código da turma tem 8 caracteres (40 bits), no mesmo alfabeto do código do certificado (`certificateCode` em `src/core/courses/certificate.ts`), exibido como `XXXX-XXXX`. Na entrada, aceita minúsculas, sem hífen e as trocas comuns (O por 0, I e L por 1), como o certificado já faz.

### 4. Papel de aluno e permissão de turmas

```
ROLES               admin | staff | superadmin | learner   ← novo
learner             ["admin.access"]
PLATFORM_PERMISSIONS ["tutorials.manage", "cohorts.manage"] ← novo
```

- `learner` não entra em `PANEL_ROLES`: o registrador nunca oferece esse papel em Usuários, e um envio forjado é recusado como hoje.
- `canAccessTenant` não muda: o aluno tem `tenantSlug = atrios-cursos` e só entra lá.
- O rótulo em português é "Aluno", em `ROLE_LABELS`.
- Com só `admin.access`, o menu já mostra apenas o Treinamento. O início do painel, para o aluno, redireciona para `/admin/ajuda`; a regra fica numa função pura (`homeFor(role)`) chamada pela página inicial.
- Todas as telas que o aluno não vê já respondem 404 por permissão. Um teste percorre as permissões de escritório e prova que `learner` não tem nenhuma além de `admin.access`.

### 5. Cadastro pelo link

```
GET /turma/K7QM-2XPA   (só no host do tenant de cursos; em outro host, 404)
  ├─ código desconhecido            → "Este link não existe"
  ├─ encerrada ou vencida           → "Este link não aceita mais inscrições"
  ├─ sem vagas                      → "As vagas desta turma acabaram"
  ├─ já logado como aluno           → redireciona para o curso
  └─ senão                          → formulário

  Curso de LGPD para o 2º Ofício de X/RN
  Nome completo  [                    ]
  E-mail         [                    ]
  Senha          [                    ]   (mínimo do Better Auth)
  [ ] Aceito receber contato da Átrios sobre a plataforma
  Aviso: para que servem nome, e-mail e, se marcado, o contato
  [Criar conta e começar]
```

A server action:
1. Limita por IP com `isRateLimited`.
2. Valida nome (duas palavras), e-mail e senha com Zod, numa função pura em `src/core/cohorts/`.
3. Recusa e-mail já usado, com "Já existe uma conta com esse e-mail. Entre pelo login.", e link para `/admin/login`.
4. Numa transação:
   - trava a linha da turma (`SELECT ... FOR UPDATE`);
   - confere, de novo, validade, encerramento e vagas (`count(cohort_members) < seats`);
   - cria o usuário (`role = learner`, `tenantSlug = atrios-cursos`, `emailVerified = true`), a conta `credential` com a senha em hash (`ctx.password.hash`) e a linha em `cohort_members`.
5. Grava auditoria (`cohort.join`) no tenant de cursos.
6. Entra com `auth.api.signInEmail` (o plugin `nextCookies` grava o cookie) e redireciona para `/admin/ajuda/lgpd-no-cartorio`.

A conta é criada pelo servidor, atrás do código válido. `disableSignUp` continua ligado: o endpoint público de cadastro do Better Auth segue fechado.

A transação insere `user` e `account` direto pelo Drizzle, e não pelo `internalAdapter`, para que vaga, conta e vínculo entrem juntos ou não entrem. O formato das linhas segue o que `scripts/seed-admin.ts` gera, e um teste faz login com a conta criada assim.

*Alternativa considerada*: contar vagas fora da transação. Descartada: dois cadastros ao mesmo tempo passariam do limite.

*Alternativa considerada*: confirmação de e-mail antes de entrar. Fica fora: é um passo a mais antes da primeira aula, e o aluno que errar o e-mail ainda pode pedir à Átrios.

### 6. Nome do cartório no certificado

Na emissão (`issueCertificateWith`), se a conta tem linha em `cohort_members`, `tenantName` recebe o `office_name` da turma; senão, continua o nome do tenant. O painel de avaliação mostra o mesmo nome antes da emissão. A fotografia gravada em `certificates` não muda de formato, e a validação pública já lê dali.

`tenant_slug` continua `atrios-cursos`: diz por onde a pessoa emitiu, não onde trabalha.

Editar o nome do cartório de uma turma depois não muda certificados já emitidos, como já acontece com o nome do curso.

### 7. Tela de turmas

```
/admin/ajuda/gerenciar/turmas            (cohorts.manage)
  lista: cartório, cidade, código com botão copiar link,
         vagas usadas/total, concluíram, validade, situação
  [+ Nova turma] → formulário (nome do cartório, cidade, responsável,
                   telefone, vagas, validade em dias, padrão 30)

/admin/ajuda/gerenciar/turmas/[id]
  dados da turma, link, [Aumentar vagas] [Prorrogar] [Encerrar]
  alunos: nome, e-mail, entrou em, aulas assistidas x/y,
          avaliação (não fez / reprovou / aprovado), certificado, aceita contato
```

O link copiado usa o host do tenant de cursos, nunca o host onde o superadmin está logado. "Concluíram" conta alunos com certificado emitido. O progresso é lido das tabelas que já existem (`tutorial_progress`, `quiz_attempts`, `certificates`), sem cópia.

Encerrar só grava `closed_at`. Reabrir é limpar `closed_at` e, se vencida, prorrogar.

### 8. Onde mora cada regra

- `src/core/tenant/`: tenant de cursos, campo `demo` e o texto do aviso.
- `src/core/cohorts/`: código da turma, estado do link (`open`, `expired`, `closed`, `full`), validação do cadastro, situação do aluno a partir do progresso.
- `src/lib/cohorts.ts`: leitura e escrita no banco, com `...With(database)` para os testes em PGlite, como `src/lib/certificates.ts`.
- `src/app/turma/[codigo]/`: página e action do cadastro.
- `src/app/admin/(dashboard)/ajuda/gerenciar/turmas/`: telas da Átrios.

## Risks / Trade-offs

- [Link repassado para fora do cartório] → vagas e validade limitam; a Átrios vê os nomes e e-mails na turma e encerra o link.
- [Aluno digita o nome de outro cartório] → o cartório do certificado vem da turma, e o aluno não escolhe.
- [Conta de aluno ganha mais poder no futuro por engano] → `learner` recebe uma lista fixa; um teste falha se ela passar de `admin.access`.
- [Abuso do cadastro, criação de contas em massa] → limite por IP, código de 40 bits e vagas por turma.
- [Uso do contato sem base legal] → caixa opcional e desmarcada, data do aceite gravada, aviso revisado pelo usuário antes do deploy.
- [Aluno digita dado real num formulário do site de demonstração] → faixa em todas as páginas, aviso perto de cada botão de enviar e expurgo dos arquivos que já existe; a política de guarda das contas, em aberto, vale também para esses registros.
- [Aluno confunde o cartório fictício com um real] → nome e cidade inventados, faixa fixa e o texto "Este cartório não existe".
- [Faixa de demonstração aparece num cartório cliente] → o campo `demo` só existe na configuração em código e nasce falso; um teste prova que nenhum tenant real o liga.
- [Aluno esquece a senha] → "Esqueci a senha" já existe e funciona por e-mail, no host do tenant de cursos.
- [Contas de alunos acumulam para sempre] → sem limpeza nesta change; a política de guarda fica em aberto.
- [Inserção direta em `user` e `account` diverge do Better Auth numa atualização] → teste de login com conta criada pelo cadastro.

## Migration Plan

1. Migração `0035`, só com `CREATE TABLE` e índices. Nada é apagado nem alterado; `pnpm check:destructive` deve passar sem exceção.
2. Aplicar no Homolog, rodar o seed do tenant de cursos e testar o fluxo inteiro em `curso.localhost`, incluindo o site público.
3. Antes do merge, aplicar a migração em produção à mão, pela `POSTGRES_URL_NON_POOLING`, como nas changes anteriores.
4. O usuário liga `curso.atrioss.com` no projeto da Vercel e no DNS.
5. O usuário preenche o conteúdo público do tenant de cursos em produção, pelo seed ou pela tela.
6. Merge. Criar a primeira turma de teste, cadastrar uma conta, assistir, fazer a prova e emitir o certificado.

Rollback: reverter o código. As duas tabelas novas podem ficar no banco sem efeito; removê-las seria mudança destrutiva, com a revisão que isso exige.

## Open Questions

- Texto do aviso de privacidade e da caixa de contato: o rascunho entra na implementação e o usuário aprova antes do deploy.
- Validade padrão do link: 30 dias, ou outro prazo.
- Nome e cidade do cartório fictício (nome de trabalho: "Cartório de Vale Claro/RN").
- Remetente dos e-mails do tenant de cursos (senha esquecida, protocolo do site de demonstração): o endereço da Átrios ou um endereço fictício que não recebe resposta.
- Quanto tempo guardar contas de alunos que nunca concluíram.
