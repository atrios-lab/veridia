## Context

A change `turmas-do-curso-por-link` criou o tenant de cursos (`atrios-cursos`, Cartório Vale do Silício, fictício, `demo: true`) e o papel `learner`, que tem só `admin.access`. O aluno entra pelo link da turma, faz o curso e vê o site público de demonstração, mas no painel só enxerga o Treinamento.

Como o painel controla acesso hoje:

- Cada tela checa, no servidor, uma permissão `*.manage` (ou `content.edit`, `desk.access`) e responde 404 sem ela. A mesma permissão vale para ver e para alterar.
- Cada server action e cada rota de upload checa a mesma permissão antes de gravar.
- O menu (`src/app/admin/_components/nav.ts`) esconde o item sem permissão, por cortesia. Quem garante o acesso é a checagem da rota.
- Dentro de uma tela, recursos extras pedem permissões próprias. No detalhe do pedido, por exemplo, a IA e os certificados checam outras permissões além de `requests.manage`.

Uma permissão abre várias telas: `content.edit` abre Publicações, Configurações e as configurações de Guias e ISS, e `channels.manage` abre Agenda, LGPD e Ouvidoria.

Os formulários do site de demonstração gravam de verdade (decisão de 09/11/2026). Pedidos, LGPD e ouvidoria vão para `service_requests`, separados pela coluna `kind`, e agendamentos vão para `appointments`. Tudo cai no tenant de cursos, que hoje não tem nenhum registro criado pelo seed nessas tabelas. Portanto, tudo que existe nelas foi digitado por alunos ou por visitantes, possivelmente com dado real apesar do aviso.

## Goals / Non-Goals

**Goals:**
- O aluno conhece o lado do cartório (fila, agenda, canais do cidadão, publicações, transparência) no Vale do Silício.
- Nenhuma alteração possível. A garantia está no servidor e não depende de esconder botão.
- O aluno nunca vê dado digitado por outra pessoa.
- O aluno manda um pedido pelo site e o vê chegar no painel.
- Ampliar a visita depois é incluir uma tela por vez, sem reabrir a regra de segurança.

**Non-Goals:**
- Ver as demais ferramentas, Usuários, Auditoria, mensagens, chat ou IA (ver proposal).
- Separar ver e alterar para os papéis de escritório.
- Limpar os registros enviados pelos alunos.

## Decisions

### 1. A visita é uma regra de papel e de tela, não uma permissão nova

```
src/core/auth/preview.ts   (puro)

PREVIEW_SCREENS = ["overview", "requests", "agenda", "data-rights",
                   "ombudsman", "publications", "transparency"] as const

canPreview(role, tenant, screen) =
  role === "learner" && tenant.demo === true && PREVIEW_SCREENS.includes(screen)

canEnter(session, tenant, permission, screen) =
  can(role, permission, granted) || canPreview(role, tenant, screen)
```

- **A tela entra por escolha explícita.** A página passa o próprio `screen`. Uma tela que não passa nada continua só com `can`. Assim, Configurações não abre por dividir `content.edit` com Publicações.
- **`can` não muda, e o aluno continua com `["admin.access"]`.** Toda action e toda rota de upload segue recusando, porque checa `can` e não `canEnter`. O teste que já prova que `learner` só tem `admin.access` passa a ser a garantia de escrita da visita inteira.
- **`tenant.demo` é exigido além do papel.** Um aluno só existe no tenant de cursos, mas a regra não confia nisso. Um teste prova que nenhum tenant real liga `demo` (já existe) e que `canPreview` é falso fora dele.
- **O resultado diz se a entrada foi por visita.** `canEnter` devolve `"manage" | "preview" | null`, e a página repassa `readOnly = (resultado === "preview")` aos componentes.

*Alternativa considerada*: permissões de leitura (`requests.view`, `channels.view`...) para todos os papéis. Descartada nesta change: é a separação ver/alterar em todo o painel, com novas linhas em Perfis e permissões e decisões do Tabelião. O aluno só precisa de um caminho estreito.

*Alternativa considerada*: dar ao aluno as permissões `*.manage` e bloquear as actions por papel. Descartada: inverte a segurança, porque cada action nova teria de lembrar de recusar o aluno, e uma esquecida grava.

### 2. Só dado de demonstração e o do próprio aluno

```
service_requests, appointments
  + demo_fixture   boolean not null default false   -- criado pelo seed
  + demo_owner_id  text null → user(id) on delete set null  -- aluno que enviou
```

```
previewScope(viewer) =
  | { kind: "all" }                          -- quem tem a permissão de alterar
  | { kind: "preview", ownerId: viewer.id }  -- visita

where (preview): demo_fixture = true OR demo_owner_id = ownerId
```

- As funções de leitura de `src/lib/service-request.ts` e `src/lib/appointments.ts` usadas pelas telas da visita (lista, contagem por status, busca por protocolo, histórico, anexos) recebem `scope` como parâmetro **obrigatório**, sem valor padrão. Assim o compilador aponta cada chamada, e nenhuma fica sem decidir.
- No detalhe, um protocolo fora do escopo dá 404, igual a um protocolo inexistente.
- A Visão geral usa as mesmas leituras com o mesmo escopo, então as contagens batem com as listas.
- Publicações e Transparência não recebem filtro: só a conta da Átrios e o seed escrevem ali, e o conteúdo já é público no site.
- As linhas que já existem ficam `false`/`null` e somem da visita. Nada é apagado.

**Marca do dono no envio.** As actions públicas de pedido, agendamento, LGPD e ouvidoria leem a sessão. Se o tenant é `demo` e a sessão é de aluno desse tenant, gravam `demo_owner_id`. O site e o painel do tenant de cursos estão no mesmo host (`curso.atrioss.com`), então o cookie da sessão chega às páginas públicas. Visitante anônimo grava `null` e nunca aparece na visita.

*Alternativa considerada*: uma tabela à parte, `demo_records(kind, record_id, owner_id)`. Descartada: o filtro vira junção em cada leitura, e o registro e a marca podem divergir. Duas colunas novas, com valor padrão, não alteram nenhuma linha existente.

*Alternativa considerada*: mostrar só o seed, sem o envio do aluno. Descartada: "mande um pedido e veja chegar" é a parte que mais convence, e o custo é uma coluna e quatro actions.

*Alternativa considerada*: gravar os envios do site de demonstração noutro slug. Descartada: quebra o acompanhamento do protocolo no site, que hoje funciona.

### 3. Tela em modo leitura

- **Faixa fixa** no topo do conteúdo do painel, sempre que a tela foi aberta por visita: "Modo visita. Este é o painel do Cartório Vale do Silício, que não existe. Nada aqui pode ser alterado." O texto fica em `src/core/tenant/` ao lado do aviso do site, como dado e não solto no componente.
- **Controles de alteração não aparecem.** Cada tela da lista recebe `readOnly` e não renderiza botões de ação, formulários de mudança de status, respostas, upload, "Novo pedido", configuração da agenda, publicar e despublicar. Filtros, abas, busca, paginação e links de navegação continuam funcionando, porque são GET.
- **A action recusa de qualquer forma.** Se um controle escapar da revisão, o envio volta com a mensagem de permissão que a action já tem. Isso é feio, mas não grava. Um teste por tela renderiza a página em visita e confere que não há `<form>` apontando para uma server action.
- **Recursos com permissão própria** (IA no pedido, certificados, assinatura na transparência) já ficam fora, porque o aluno não tem essas permissões. Nenhuma chamada à IA acontece na visita.

*Alternativa considerada*: um `<fieldset disabled>` em volta de toda a página. Descartada: desliga também a busca e os filtros, e a tela parece quebrada.

### 4. Leitura sem efeito colateral

Abrir uma tela em visita não pode gravar nada em nome do aluno. Na implementação, cada tela da lista é conferida:

- O expurgo de arquivos vencidos que a fila de pedidos roda ao abrir (`purgeExpiredRequestFiles`) é regra da plataforma, não ação do aluno, e continua rodando.
- Se alguma tela marcar "lido", registrar visualização ou gravar auditoria ao abrir, isso é pulado na visita. Gravar a visita do aluno na auditoria do tenant de cursos encheria o log e não serve a ninguém.

### 5. Menu e início

- `AdminNavItem` ganha `preview?: PreviewScreen`. A sidebar mostra o item quando `can(...)` ou `canPreview(...)`. Subitens sem `preview` continuam escondidos.
- Na visita, o grupo do item aparece igual ao do escritório. O Treinamento continua com o destaque `attention`.
- `homeFor("learner")` passa a devolver `null` **no tenant demo**: `/admin` mostra a Visão geral com a faixa. O cadastro pelo link continua indo direto ao curso, e o botão "Ver o site do cartório de demonstração" ganha a vizinhança "Conhecer o painel do cartório".

### 6. Seed

`scripts/seed-demo-data.ts`, para `atrios-cursos`, passa a criar o mesmo tipo de escritório que cria no Serra Verde: pedidos em cada estado da fila, requerimentos LGPD, manifestações de ouvidoria e agendamentos de hoje e amanhã, todos com `demo_fixture = true` e pessoas inventadas. O comentário "No citizen filings" sai. `createRecordWith` e `bookAppointmentWith` ganham o campo opcional `demoFixture`, usado só pelo seed.

O seed roda no banco local e no Homolog pelo agente. Em produção, quem roda é o usuário (regra do CLAUDE.md).

### 7. Onde mora cada regra

- `src/core/auth/preview.ts`: telas visitáveis, `canPreview`, `canEnter`, `previewScope`.
- `src/core/tenant/`: texto da faixa do painel.
- `src/lib/service-request.ts`, `src/lib/appointments.ts`: filtro de escopo nas leituras e marca do dono na escrita.
- `src/app/(public)/{solicitar,agendar,lgpd,ouvidoria}/actions.ts`: `demo_owner_id`.
- `src/app/admin/(dashboard)/{page,pedidos,agenda,lgpd,ouvidoria,publicacoes,transparencia}`: entrada por `canEnter` e `readOnly`.
- `src/app/admin/_components/nav.ts` e a sidebar: `preview`.

## Risks / Trade-offs

- [Uma leitura esquece o escopo e mostra o envio de outro aluno] → `scope` obrigatório nas funções, e um teste com PGlite por tela grava um registro de outro aluno e um anônimo e prova que nenhum aparece na lista, na contagem nem no detalhe.
- [Um botão de alteração escapa e aparece na visita] → a action recusa no servidor, e o teste por tela procura formulários de action.
- [Uma tela nova divide permissão com uma visitável e abre sem querer] → a visita é por `screen`, não por permissão. Um teste percorre `ADMIN_NAV` e confere que só os itens com `preview` abrem para o aluno.
- [O aluno digita dado real no site e depois o vê no painel] → só ele vê o que digitou. A faixa do site já pede que não envie dado real.
- [A visita mostra um cartório vazio em produção] → o seed precisa rodar antes do merge. Ele está no plano de migração e na lista de tarefas do usuário.
- [Duas colunas a mais em tabelas grandes] → `ADD COLUMN ... DEFAULT false` não reescreve a tabela no Postgres 11+, e `demo_owner_id` é `null`. Índice só se a medição mostrar necessidade: o filtro roda junto do `tenant_slug`, que já é indexado.
- [Mudança no início do aluno confunde quem já entrou] → o cadastro e o login com `next` continuam levando ao curso, e o Treinamento segue em destaque.

## Migration Plan

1. Migração com `ALTER TABLE ... ADD COLUMN` nas duas tabelas, com valor padrão e chave estrangeira `on delete set null`. Nada é removido nem renomeado, e `pnpm check:destructive` passa sem exceção.
2. Aplicar no banco local de teste e no Homolog, rodar o seed do tenant de cursos e testar a visita em `curso.localhost`.
3. Antes do merge, o usuário aplica a migração em produção à mão e roda o seed do tenant de cursos.
4. Merge. Entrar com uma conta de aluno de teste, percorrer as sete telas, mandar um pedido pelo site e encontrá-lo na fila.

Rollback: reverter o código. As colunas novas ficam sem efeito. Removê-las seria mudança destrutiva, com a revisão que isso exige.

## Open Questions

- O texto da faixa do painel e do atalho "Conhecer o painel do cartório" precisa da aprovação do usuário.
- O início do aluno passa a ser a Visão geral (decisão 5) ou continua o Treinamento, com a Visão geral só pelo menu?
- A primeira onda de telas está boa, ou alguma das ferramentas (RCPN, Livro diário, qualificação) deve entrar já?
