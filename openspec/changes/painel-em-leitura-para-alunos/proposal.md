## Why

O aluno de turma já vê o site público do Cartório Vale do Silício, o lado do cidadão. O lado do cartório, que é o que a Átrios vende, ele não vê: no painel só aparece o Treinamento. Quem faz o curso sai sem saber como a serventia recebe um pedido, cuida da agenda ou responde a um requerimento LGPD. Um painel do Vale do Silício que o aluno possa visitar, sem alterar nada, fecha essa lacuna sem criar conta nem tenant para cada lead.

## What Changes

- **Modo visita.** O aluno abre um conjunto fechado de telas do painel do Vale do Silício só para leitura. Na primeira onda entram: Visão geral, Pedidos de serviço, Agenda, Requerimentos LGPD, Ouvidoria, Publicações e Transparência, com a lista e o detalhe de cada uma.
- **Nada se altera.** O aluno continua sem nenhuma permissão além de `admin.access`, então toda server action e toda rota de upload segue recusando no servidor como hoje. As telas visitadas escondem os botões e formulários de alteração e mostram uma faixa fixa: "Modo visita. Este é o painel do Cartório Vale do Silício, que não existe. Nada aqui pode ser alterado."
- **Cada tela entra por escolha explícita.** A visita não abre uma permissão inteira (`requests.manage`, `content.edit`...): cada tela da lista se declara visitável no código. Uma tela nova, ou uma tela que divide a permissão com outra, continua fechada para o aluno até alguém incluí-la.
- **O aluno só vê dado fictício e o que ele mesmo enviou.** Os registros que o seed cria ficam marcados como de demonstração. Um pedido, agendamento, requerimento LGPD ou manifestação de ouvidoria enviado pelo site por um aluno logado fica marcado com a conta dele. Na visita, cada lista, contagem e detalhe mostra só os marcados como demonstração e os do próprio aluno. O que outro aluno ou um visitante anônimo enviou nunca aparece, nem pelo endereço direto (404).
- **Envie e veja chegar.** O aluno manda um pedido pelo site de demonstração e o encontra na fila do painel, com o mesmo protocolo.
- **Início do aluno.** `/admin` passa a mostrar ao aluno a Visão geral em modo visita, em vez de redirecionar para o Treinamento. O cadastro pelo link continua levando direto ao curso, e o Treinamento segue em destaque no menu.
- **Seed.** `scripts/seed-demo-data.ts` passa a criar, também no tenant de cursos, pedidos em vários estados, requerimentos LGPD, manifestações de ouvidoria e agendamentos de hoje e amanhã, todos marcados como demonstração.

## Non-goals

- Qualquer alteração pelo aluno, mesmo que "de mentira" ou desfeita depois: mudar status, responder, publicar, agendar pelo painel.
- Usuários e Auditoria: mostrariam nomes, e-mails e ações dos outros alunos.
- Mensagens internas e Atendimento online: o chat do tenant de cursos é desligado, e as mensagens seriam entre alunos.
- Assistente Virtual, DPO e qualquer tela que chame a IA: custa crédito a cada uso, e a conversa ficaria visível a outros.
- As demais ferramentas (RCPN, Livro diário, papel de segurança, DOI, CENSEC, qualificação, guias, ISS, titularidade, assinador, Configurações). Cada uma precisa de dados fictícios próprios e entra numa change seguinte, uma onda por vez.
- Modo visita em cartório cliente ou no Serra Verde. Só o tenant marcado como demonstração (`demo: true`) oferece a visita, e só para o papel de aluno.
- Separar "ver" de "alterar" para os papéis de escritório. Escrevente, Substituto e os demais continuam com uma permissão por tela.
- Apagar os registros que os alunos enviaram. Limpeza é remoção de dados e vai numa change separada, revisada por outra pessoa.

## Capabilities

### New Capabilities

- `learner-panel-preview`: o modo visita do aluno no painel do tenant de demonstração. Inclui a lista fechada de telas visitáveis, a faixa, a ausência de controles de alteração, a recusa de toda alteração no servidor, o filtro que mostra só dado de demonstração e o do próprio aluno, a marcação do que o aluno envia pelo site e os dados do seed.

### Modified Capabilities

- `admin-shell`: a navegação passa a oferecer ao aluno, no tenant de demonstração, os itens das telas visitáveis, mesmo sem a permissão que elas exigem para alterar.

A regra "Aluno vê só o Treinamento" está na change `turmas-do-curso-por-link`, ainda não arquivada. Esta change a substitui pelo modo visita, descrito dentro de `learner-panel-preview`. Se aquela change for arquivada antes desta, a regra entra aqui como MODIFIED de `course-cohorts`.

## Impact

- **Banco**, só adições, sem apagar nem alterar dado existente:
  - `service_requests.demo_fixture boolean not null default false` e `appointments.demo_fixture`, iguais;
  - `service_requests.demo_owner_id text null` e `appointments.demo_owner_id`, com a conta do aluno que enviou, `on delete set null`.

  As linhas que já existem ficam com `false` e `null`, ou seja, invisíveis na visita. `pnpm check:destructive` deve passar sem exceção. A migração de produção é manual e roda antes do merge, como nas changes anteriores.
- **Núcleo**: `src/core/auth/preview.ts`, puro, com a lista de telas visitáveis e `canPreview(role, tenant, screen)`. `can` não muda.
- **Telas**: as sete telas da primeira onda trocam a checagem de entrada por "pode alterar ou pode visitar" e recebem `readOnly` para esconder os controles. As leituras de `src/lib/service-request.ts` e `src/lib/appointments.ts` (listas, contagens, busca por protocolo) ganham o filtro de visita. A Visão geral usa as mesmas leituras filtradas.
- **Site público**: as actions dos formulários de pedido, agendamento, LGPD e ouvidoria gravam `demo_owner_id` quando há sessão de aluno no tenant de demonstração.
- **Menu e início**: `nav.ts` ganha o campo da tela visitável; `homeFor("learner")` deixa de redirecionar.
- **Seed**: dados de escritório também para `atrios-cursos`. Em produção, o seed é rodado pelo usuário.
- **Dado pessoal**: o aluno passa a ver dados de pessoas fictícias e os que ele mesmo digitou. Nenhum dado de outra pessoa real fica visível. Esse é o ponto central da revisão.
