## Why

O aluno de turma já vê o site público do Cartório Vale do Silício, o lado do cidadão. O lado do cartório, que é o que a Átrios vende, ele não vê: no painel só aparece o Treinamento. Quem faz o curso sai sem saber como a serventia recebe um pedido, cuida da agenda ou responde a um requerimento LGPD. Liberar o painel do Vale do Silício para o aluno usar de verdade, com dados fictícios, fecha essa lacuna sem criar conta nem tenant para cada lead.

## What Changes

- **Painel liberado para o aluno.** No tenant de demonstração, o papel de aluno passa a usar o painel como um funcionário: atende pedidos, mexe na agenda, responde LGPD e ouvidoria, publica editais, preenche transparência e usa as ferramentas. Tudo isso com os dados fictícios do Cartório Vale do Silício.
- **Cartório compartilhado** (decisão do usuário em 16/11/2026). Todos os alunos mexem no mesmo cartório e veem o que os outros fizeram, inclusive o que aparece no site público de demonstração. Uma faixa fixa no painel avisa: "Painel de demonstração do Cartório Vale do Silício, que não existe. O que você fizer aqui fica visível para os outros alunos e pode ser apagado a qualquer momento. Não use dados reais."
- **O que continua fechado**, porque expõe outras pessoas, prende o cartório de todos, custa dinheiro ou envolve credencial real:
  - Usuários, Perfis e permissões e Auditoria;
  - Mensagens internas;
  - duas etapas e horário de acesso;
  - chave Pix e cobrança;
  - atendimento online;
  - assinador e certificados digitais;
  - importação de arquivos do RCPN e das atribuições;
  - base de conhecimento e Assistente Virtual.
- **Nenhum e-mail sai do cartório de demonstração** (decisão do usuário em 16/11/2026). O que o sistema mandaria ao requerente ou à serventia fica guardado numa caixa de saída de demonstração. O painel mostra o texto com o aviso "Demonstração: e-mail não enviado". Os e-mails da conta do aluno (esqueci a senha, código de acesso) continuam saindo, porque sem eles o aluno não entra.
- **IA desligada no tenant de demonstração.** Fica desligada pelo controle por serventia que a Átrios já tem, sem gastar crédito.
- **Seed mais completo.** `scripts/seed-demo-data.ts` passa a criar também no tenant de cursos o escritório que cria no Serra Verde: pedidos em vários estados, requerimentos LGPD, manifestações de ouvidoria e agendamentos.
- **Limpeza pelo botão, em PR separada e revisada (⚠️ apaga dados do banco).** Só quando a Átrios clica num botão na tela de Turmas, uma rotina apaga o que os alunos mexeram no tenant de cursos e roda o seed de novo. Ela vale só para esse tenant e para uma lista fechada de tabelas. Contas, turmas, progresso, avaliações e certificados nunca são tocados. Pela regra do projeto, essa parte vai numa PR própria, aberta com o aviso no título e deixada para outra pessoa revisar e fazer o merge.
- **Início do aluno.** `/admin` mostra ao aluno a Visão geral, como a qualquer funcionário. O cadastro pelo link continua levando direto ao curso.

## Non-goals

- Uma cópia do cartório para cada aluno. Foi considerada e descartada pelo usuário em favor do cartório compartilhado.
- Abrir as telas da lista de fechadas, mesmo para leitura.
- Mandar e-mail de verdade a partir do cartório de demonstração, mesmo para o próprio aluno.
- Preencher no seed todas as ferramentas (RCPN, Livro diário, papel de segurança, DOI, CENSEC, qualificação, guias, ISS, titularidade). Elas abrem vazias e o aluno pode lançar dados nelas. O seed de cada uma pode vir depois.
- Liberar o painel em cartório cliente ou no Serra Verde. Só o tenant com `demo: true` e só o papel de aluno.
- Mudar o que os papéis de escritório podem fazer nos cartórios clientes, além da separação de Mensagens internas (decisão 3 do design).

## Capabilities

### New Capabilities

- `demo-office-sandbox`: o painel do tenant de demonstração liberado ao aluno. Inclui as permissões do aluno e o que fica fechado, a faixa, a caixa de saída de demonstração no lugar do envio de e-mail, a IA desligada, o seed do escritório e a limpeza pelo botão.

### Modified Capabilities

Nenhuma nas specs principais. A regra "Aluno vê só o Treinamento" está na change `turmas-do-curso-por-link`, ainda não arquivada, e esta change a substitui dentro de `demo-office-sandbox`. Se aquela change for arquivada antes desta, a regra entra aqui como MODIFIED de `course-cohorts`.

## Impact

- **Papéis e permissões**:
  - o aluno ganha uma lista fixa de permissões de escritório, válida só no tenant `demo`;
  - a permissão nova `messages.use`, derivada de `desk.access`, separa Mensagens internas da Visão geral. Os papéis de escritório continuam com ela, porque derivam dela.
- **E-mail**: `sendEmail` passa a exigir o tenant e o tipo da mensagem (`account` ou `office`). No tenant `demo`, mensagens `office` vão para a caixa de saída de demonstração.
- **Banco**, primeira PR só com adições: tabela `demo_outbox`, para os e-mails não enviados.
- **Banco**, segunda PR, ⚠️ destrutiva: a rotina de limpeza, que apaga linhas do tenant `atrios-cursos` numa lista fechada de tabelas e os arquivos delas no store. Não muda schema. Revisão e merge por outra pessoa.
- **Telas**:
  - a faixa na casca do painel;
  - a tela nova "E-mails de demonstração", só no tenant `demo`;
  - no histórico de cada registro, "e-mail não enviado" no lugar de "enviado";
  - as telas fechadas continuam com 404 por permissão.
- **Saídas externas**: toda chamada a sistema externo das ferramentas abertas ao aluno é pulada no tenant `demo`, e o IndexNow fica desligado nele.
- **Seed**: escritório de demonstração para `atrios-cursos`. Em produção, quem roda o seed é o usuário.
- **Dado pessoal**: o que um aluno digita no painel ou no site de demonstração fica visível aos outros alunos. O aviso de privacidade do cadastro (tarefa 7.4 de `turmas-do-curso-por-link`, ainda pendente) precisa dizer isso e que pode ser apagado a qualquer momento. A faixa repete o aviso.
