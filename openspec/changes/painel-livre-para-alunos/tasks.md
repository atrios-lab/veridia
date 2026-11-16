## 1. Antes de começar

- [x] 1.1 Painel livre, com cartório compartilhado por todos os alunos (usuário, 16/11/2026)
- [x] 1.2 Nenhum e-mail sai do tenant de demonstração; o painel mostra o que teria sido enviado (usuário, 16/11/2026)
- [x] 1.3 Limpeza só pelo botão da Átrios, sem rodar sozinha (usuário, 16/11/2026)
- [x] 1.4 Usuário aprova o texto da faixa do painel e o trecho novo do aviso de privacidade do cadastro (o que o participante digita fica visível aos outros participantes, junto com o nome dele quando o painel mostra quem alterou, e pode ser apagado a qualquer momento) (aprovado em 16/11/2026)
- [x] 1.6 Na tela, o papel se chama "Participante": rótulo do papel e tela de Turmas já trocados; a faixa e o aviso do cadastro usam "participantes" (usuário, 16/11/2026)
- [x] 1.5 "E-mails de demonstração" fica fora do menu, só pelos links do histórico (usuário, 16/11/2026)

## 2. Permissões do aluno (PR 1)

- [x] 2.1 `messages.use` em `OFFICE_PERMISSIONS`, derivada de `desk.access` em `DERIVED_FROM`, com rótulo em `GRANTABLE_LABELS`; Mensagens internas (tela, actions e item do menu) passa a exigi-la; testes de que os papéis de escritório continuam com ela
- [x] 2.2 `DEMO_CLOSED_PERMISSIONS` e `DEMO_OPEN_PERMISSIONS` em `roles.ts`; `effectivePermissions` recebe o tenant e dá a lista ao aluno só com `demo`; `src/lib/session.ts` passa o tenant
- [x] 2.3 Testes: aluno fora do `demo` só com `admin.access`; dentro, nenhuma de `DEMO_CLOSED` nem de `PLATFORM_PERMISSIONS`; toda permissão de escritório classificada numa das duas listas
- [x] 2.4 Conferir que a action da chave Pix exige `billing.edit`; corrigir se só exigir `content.edit`, com teste
- [x] 2.5 Teste que percorre `ADMIN_NAV` com as permissões do aluno e confere a lista de itens esperada
- [x] 2.6 `homeFor("learner")` devolve `null` no tenant `demo`; teste

## 3. E-mail (PR 1)

- [x] 3.1 Tabela `demo_outbox` no schema; gerar a migração e conferir que só tem `CREATE TABLE` e índice; `pnpm check:destructive` verde
- [x] 3.2 `OutgoingEmail` com `tenant` e `kind` obrigatórios; `sendEmail` desvia `office` do tenant `demo` para `demo_outbox` numa função `...With(db, ...)`; testes contra PGlite de que não há chamada à rede nesse caso e de que `account` e cartório cliente seguem como hoje
- [x] 3.3 Classificar cada chamada de `sendEmail` (o compilador lista todas), incluindo as do Better Auth (`account`) e os lembretes automáticos (`office`)
- [x] 3.4 Buscar envios fora de `sendEmail` (`api.postmarkapp.com`, outros `fetch` de envio) e passá-los pela mesma regra
- [x] 3.5 Tela "E-mails de demonstração" (`/admin/demonstracao/emails`), sem item no menu, 404 fora do `demo`; histórico dos registros com "Demonstração: e-mail não enviado"

## 4. Saídas externas e IA (PR 1)

- [x] 4.1 `isOutboundAllowed(tenant)` puro; teste
- [x] 4.2 Percorrer as ferramentas abertas ao aluno e pular, no `demo`, toda chamada a sistema externo (IndexNow, prefeitura, CENSEC, Receita, Justiça Aberta); listar o que foi encontrado na descrição da PR
- [x] 4.3 Conferir que, com as permissões do aluno, nenhum botão de IA aparece e nenhuma rota de IA aceita a sessão dele

## 5. Faixa e seed (PR 1)

- [x] 5.1 Faixa do painel de demonstração na casca do painel, para aluno no `demo`; texto em `src/core/tenant/`
- [x] 5.2 `scripts/seed-demo-data.ts` roda `fillDesk()` também para `atrios-cursos`, com e-mails em `@example.com`; atualizar o comentário do topo
- [x] 5.3 Rodar o seed no banco local de teste e percorrer o painel como aluno em `curso.localhost:3000`, no celular e no computador

## 6. Verificação e entrega da PR 1

- [x] 6.1 Fluxo no banco local: aluno muda status de pedido e o outro aluno vê; e-mail cai na caixa de demonstração; publicação aparece no site; Usuários, Auditoria, Mensagens, duas etapas e Pix recusados
- [x] 6.2 Conferir que cartório cliente e Serra Verde não mudam: sem faixa, e-mails saem, Mensagens abre para o escrevente
- [x] 6.3 Bateria do CI: typecheck, lint, test, check:dashes, check:tokens, check:admin-scale, check:destructive, `openspec validate --all` e build
- [ ] 6.4 Aplicar a migração no Homolog e rodar o seed do tenant de cursos lá
- [ ] 6.5 Usuário aplica a migração em produção à mão e roda o seed do tenant de cursos, antes do merge (a IA já fica recusada no código, sem passo manual)
- [x] 6.6 Abrir a PR 1 (#353)

## 7. Limpeza do cartório (PR 2, ⚠️ apaga dados do banco)

- [ ] 7.1 `DEMO_RESET_TABLES`, lista fechada, e `resetDemoOfficeWith(db, store, slug)`: recusa slug não fictício ou sem `demo`, apaga por `tenant_slug` numa transação, apaga os arquivos do store, roda o seed e grava auditoria da plataforma
- [ ] 7.2 Testes contra PGlite com dois tenants: apaga só o tenant de cursos; não toca contas, turmas, progresso, avaliações, certificados, cursos, vídeos nem auditoria; recusa cartório real
- [ ] 7.3 Botão "Limpar o cartório de demonstração" na tela de Turmas, com `cohorts.manage` e confirmação digitada
- [ ] 7.4 Testar no banco local de teste; nunca rodar contra a produção
- [ ] 7.5 Abrir a PR 2 com "⚠️ Apaga dados do banco" no título e no topo da descrição, dizendo o que é apagado e como desfazer; deixar aberta para outra pessoa revisar, sem merge e sem auto-merge
