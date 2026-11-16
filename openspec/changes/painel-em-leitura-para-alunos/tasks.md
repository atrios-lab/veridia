## 1. Antes de começar

- [ ] 1.1 Usuário decide o início do aluno: Visão geral em visita (proposta) ou Treinamento, com a visita só pelo menu
- [ ] 1.2 Usuário aprova a primeira onda de telas (Visão geral, Pedidos, Agenda, LGPD, Ouvidoria, Publicações, Transparência)
- [ ] 1.3 Usuário aprova o texto da faixa do painel e do atalho "Conhecer o painel do cartório"

## 2. Regra pura da visita

- [ ] 2.1 `src/core/auth/preview.ts`: `PREVIEW_SCREENS`, `canPreview(role, tenant, screen)`, `canEnter(...)` devolvendo `"manage" | "preview" | null` e `previewScope(viewer, entry)`; testes
- [ ] 2.2 Testes: visita só com papel aluno e tenant `demo`; nenhuma tela fora da lista; `can` do aluno continua só `admin.access` para toda permissão de `PERMISSIONS`
- [ ] 2.3 Texto da faixa do painel em `src/core/tenant/`, ao lado do aviso do site

## 3. Dados

- [ ] 3.1 Colunas `demo_fixture` (boolean, not null, default false) e `demo_owner_id` (text, null, FK `user.id` on delete set null) em `service_requests` e `appointments`; gerar a migração e conferir que só tem `ADD COLUMN` e a FK; `pnpm check:destructive` verde
- [ ] 3.2 `scope` obrigatório nas leituras de `src/lib/service-request.ts` usadas pelas telas da visita (lista, contagem por status, busca, busca por protocolo, histórico, anexos); testes contra PGlite com registro de demonstração, do próprio aluno, de outro aluno e anônimo
- [ ] 3.3 O mesmo em `src/lib/appointments.ts` (dia, semana, detalhe); testes contra PGlite
- [ ] 3.4 Leituras da Visão geral (`src/lib/admin-overview.ts`) com o mesmo escopo; teste de que as contagens batem com as listas
- [ ] 3.5 Campo `demoOwnerId` na escrita: uma função `...With(db, ...)` decide o dono a partir de tenant e sessão (só aluno no tenant `demo`); testes contra PGlite para aluno, anônimo e cartório cliente
- [ ] 3.6 Actions públicas de pedido, agendamento, LGPD e ouvidoria passam a sessão para essa função; conferir que o cookie da sessão chega às páginas públicas em `curso.localhost`

## 4. Telas em modo leitura

- [ ] 4.1 Faixa de modo visita na casca do painel, ligada pelo resultado de `canEnter`
- [ ] 4.2 Pedidos: lista e detalhe entram por `canEnter(..., "requests")`, com o escopo; `readOnly` esconde "Novo pedido", mudança de status, resposta, exigência e upload
- [ ] 4.3 Agenda: entra por `canEnter(..., "agenda")`; `readOnly` esconde agendar, remarcar, cancelar, comparecimento, anexos, notas e configuração
- [ ] 4.4 LGPD e Ouvidoria: lista e detalhe por `canEnter`; `readOnly` esconde resposta, decisão e encaminhamento
- [ ] 4.5 Publicações e Transparência: por `canEnter`; `readOnly` esconde criar, editar, publicar, despublicar, enviar documento e boletim
- [ ] 4.6 Visão geral: por `canEnter(..., "overview")`, com cartões só das telas visitáveis
- [ ] 4.7 Conferir, tela por tela, que abrir em visita não grava nada em nome do aluno (lido, visualização, auditoria); pular o que gravar
- [ ] 4.8 Teste em processo por tela: em visita, nenhum controle de alteração é renderizado

## 5. Menu e início

- [ ] 5.1 `AdminNavItem.preview` e a sidebar mostrando o item com `can` ou `canPreview`; teste que percorre `ADMIN_NAV` e prova que só os itens com `preview` abrem para o aluno
- [ ] 5.2 `homeFor("learner")` devolve `null` no tenant `demo` (conforme a decisão 1.1); teste
- [ ] 5.3 Atalho "Conhecer o painel do cartório" na tela de Treinamento do aluno

## 6. Seed

- [ ] 6.1 `createRecordWith` e `bookAppointmentWith` aceitam `demoFixture`, só para o seed
- [ ] 6.2 `scripts/seed-demo-data.ts` cria, para `atrios-cursos`, pedidos em cada estado, requerimentos LGPD, manifestações de ouvidoria e agendamentos de hoje e amanhã, todos com `demo_fixture = true`; atualizar o comentário do topo
- [ ] 6.3 Rodar o seed no banco local de teste e conferir a visita em `curso.localhost:3000`, no celular e no computador

## 7. Verificação e entrega

- [ ] 7.1 Fluxo no banco local: aluno A manda pedido pelo site e o vê na fila; aluno B não vê o pedido de A nem pelo protocolo; conta da Átrios vê tudo, sem faixa e com controles
- [ ] 7.2 Conferir que Configurações, Usuários, Auditoria, Mensagens, DPO e as ferramentas continuam 404 para o aluno
- [ ] 7.3 Bateria do CI: typecheck, lint, test, check:dashes, check:tokens, check:admin-scale, check:destructive, `openspec validate --all` e build
- [ ] 7.4 Aplicar a migração no Homolog e rodar o seed do tenant de cursos lá
- [ ] 7.5 Usuário aplica a migração em produção à mão e roda o seed do tenant de cursos antes do merge
- [ ] 7.6 Abrir a PR
