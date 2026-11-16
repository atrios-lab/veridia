## Context

A change `turmas-do-curso-por-link` criou o tenant de cursos (`atrios-cursos`, Cartório Vale do Silício, fictício, `demo: true`) e o papel `learner`, que tem só `admin.access`. O aluno entra pelo link da turma, faz o curso e vê o site público de demonstração, mas no painel só enxerga o Treinamento.

Como o painel controla acesso hoje:

- Cada tela e cada server action checam, no servidor, uma permissão, e a mesma vale para ver e para alterar. O menu esconde o item sem permissão, por cortesia.
- Uma permissão abre várias telas. `desk.access` abre a Visão geral, o e-mail corporativo e as Mensagens internas. `content.edit` abre Publicações, a página de Configurações e as subpáginas Cobrança, Notificações, Encarregado e Quem assina.
- `DERIVED_FROM` separa uma permissão nova de uma existente sem mudar quem já a tinha: quem tinha a mãe ganha a filha.
- `sendEmail` (`src/lib/email/send.ts`) não sabe de tenant. Quem chama monta remetente e destinatário.
- A IA de cada serventia pode ser desligada pela conta da Átrios (`src/lib/ai-platform.ts`, change #351).

Na tela, o papel `learner` se chama **Participante** (decisão do usuário em 16/11/2026), e não "aluno" nem "cliente". Neste documento, "aluno" segue designando o papel.

O usuário decidiu em 16/11/2026: o painel fica livre para o aluno mexer, num cartório **compartilhado** por todos os alunos, e **nenhum e-mail sai**: o painel mostra o que teria sido enviado.

## Goals / Non-Goals

**Goals:**
- O aluno usa o painel do Vale do Silício como um funcionário usaria.
- Nada do que o aluno faz sai da plataforma: nenhum e-mail, nenhuma chamada à IA, nenhum envio a sistema externo.
- O aluno não vê a lista dos outros alunos, nem o e-mail deles, nem a auditoria. O nome de outro aluno aparece só onde o painel já mostra quem fez uma alteração, como no histórico do pedido (`actorName` em `listRecordHistory`), e o aviso do cadastro diz isso.
- O aluno não consegue trancar o cartório para os outros nem trocar a chave Pix do site de demonstração.
- O cartório volta ao estado inicial por uma rotina revisada, sem tocar em conta, turma ou certificado.

**Non-Goals:**
- Uma cópia do cartório por aluno (descartada pelo usuário).
- Liberar o painel fora do tenant `demo`.

## Decisions

### 1. Permissões do aluno: lista fixa, só no tenant de demonstração

```
src/core/auth/roles.ts

DEMO_OPEN_PERMISSIONS = [ "desk.access", "requests.manage", ... ]   -- escrita à mão
DEMO_CLOSED_PERMISSIONS = [
  "user.manage", "audit.manage", "access.manage",    // pessoas e acesso
  "messages.use",                                    // mensagens entre alunos
  "billing.edit",                                    // chave Pix
  "chat.manage", "chat.settings",                    // atendimento online
  "signer.use", "certificates.manage",               // credencial real
  "rcpn.import", "attributions.import",              // base real de cartório
  "knowledge.manage", "dpo.assist",                  // IA
  "qualificacao.validate",                           // validação de saída da IA
]

effectivePermissions("learner", configured, tenant) =
  tenant.demo ? ["admin.access", ...DEMO_OPEN_PERMISSIONS] : ["admin.access"]
```

- **Duas listas escritas à mão, sem subtração** (decidido na implementação). Uma permissão de escritório nova não entra em nenhuma das duas por conta própria, e um teste falha até que ela esteja em exatamente uma: aberta ao aluno ou fechada. Assim, quem cria a permissão é obrigado a decidir, e o "painel livre" continua livre sem que nada novo exponha pessoas ou credenciais por descuido.
- **As permissões de plataforma** (`PLATFORM_PERMISSIONS`) nunca entram.
- **`tenant.demo` é exigido**, e a sessão (`src/lib/session.ts`) passa o tenant. Um aluno só existe no tenant de cursos, mas a regra não depende disso: fora do `demo`, o aluno volta a ter só `admin.access`.
- **O teste de `turmas-do-curso-por-link`** "learner só tem `admin.access`" passa a valer fora do `demo`. Um teste novo cobre a lista dentro dele.

*Alternativa considerada*: dar ao aluno o papel `staff` no tenant de cursos. Descartada: `staff` é configurável em Perfis e permissões e poderia ser alterado por engano. O aluno precisa de uma lista que só o código muda.

### 2. Telas que dividem permissão com uma tela fechada

- **Mensagens internas** usa `desk.access`, como a Visão geral. Ganha a permissão própria `messages.use`, derivada de `desk.access` em `DERIVED_FROM`: todo papel de escritório continua com ela, e o aluno não. Ela entra em `GRANTABLE_LABELS` como "Mensagens internas", seguindo a convenção de uma linha por ferramenta (decisão de 11/11/2026).
- **Cobrança** abre com `content.edit`. A página continua abrindo para o aluno, mas o formulário da chave Pix e a action dele exigem `billing.edit`, que o aluno não tem. Na implementação, conferir que a action da chave Pix checa `billing.edit` e, se só checar `content.edit`, corrigir. Isso também fecha uma brecha para os papéis de escritório.
- **Perfis e permissões** e **Assistente Virtual** já usam `user.manage`, e **duas etapas** e **horário de acesso** já usam `access.manage`: ficam fechados sem mudança.
- Um teste percorre `ADMIN_NAV` com as permissões do aluno e confere que os itens fechados (Mensagens, Atendimento, DPO, Usuários, base jurídica, assinador e as telas da Átrios) não aparecem, e que os principais da mesa aparecem.
- **Auditoria** não pede permissão no menu, mas quem não tem `audit.manage` vê ali só as notificações endereçadas a si. Para o aluno, isso não mostra ninguém.

### 3. E-mail: caixa de saída de demonstração

```
OutgoingEmail
  + tenant: { slug: string; demo: boolean }    -- obrigatório
  + kind: "account" | "office"                 -- obrigatório

sendEmail(email):
  if (email.tenant.demo && email.kind === "office") → insere em demo_outbox, não chama o Postmark
  senão → como hoje

demo_outbox
  id uuid pk, tenant_slug text, to text, subject text, text text,
  related_kind text null,                         -- "request" ou "appointment"
  related_protocol text null,                     -- o protocolo do registro
  created_at timestamptz
  index (tenant_slug, created_at)
```

- **Os dois campos são obrigatórios**, para o compilador apontar cada chamada. Ninguém esquece de classificar uma mensagem.
- **`account`**: esqueci a senha, código de acesso, troca de e-mail. Sem eles o aluno não entra, e o destinatário é a própria conta.
- **`office`**: todo o resto. Isso inclui as confirmações dos formulários públicos do site de demonstração, que hoje saem para o endereço digitado, que pode ser de um terceiro real.
- **O HTML não é guardado.** O texto basta para mostrar, e o HTML guardaria o layout do e-mail inteiro por mensagem.
- **Como o aluno vê.** Uma tela nova, "E-mails de demonstração" (`/admin/demonstracao/emails`), só no tenant `demo` e para quem tem `desk.access`, lista os últimos 100, com link para o registro. A tela não tem item no menu (decisão do usuário em 16/11/2026): só se chega a ela pelos links do histórico dos registros. No detalhe do registro, onde o histórico diz que um e-mail foi enviado, passa a dizer "Demonstração: e-mail não enviado", com link para o texto.
- **Lembretes automáticos** (agenda, papel de segurança) passam pelo mesmo `sendEmail` e caem na caixa também.

*Alternativa considerada*: usar `EMAIL_REDIRECT_TO`. Descartada: é por deploy, não por tenant, e mandaria tudo a uma caixa que ninguém lê.

### 4. IA desligada

`aiBlockedWith` (`src/lib/ai.ts`), a checagem por onde passa toda chamada à IA, inclusive a do DPO, recusa o tenant `demo` antes de olhar os interruptores (decidido na implementação). Assim, nenhum passo manual em produção é necessário, e nem o interruptor da Átrios nem o do Tabelião ligam a IA ali. As permissões de IA (`dpo.assist`, `knowledge.manage`, `qualificacao.validate`) também ficam fora, então o aluno não vê os botões. A qualificação continua usável no modo sem IA, do jeito que já funciona com a IA desligada.

### 5. Saídas para sistemas externos

A decisão fica numa função pura, `isOutboundAllowed(tenant)` (`src/core/tenant/demo-office.ts`). O levantamento da implementação achou só duas chamadas que saem da plataforma por conta do cartório: o Postmark, que já passa só por `sendEmail`, e o IndexNow. Prefeitura, CENSEC, Receita e Justiça Aberta só geram arquivo para download. A consulta de selo ao TJ é uma leitura pública, que não envia nada em nome do cartório, e continua igual.

O IndexNow avisa buscadores de páginas novas do site. No tenant de cursos ele fica desligado, porque as páginas do site de demonstração não devem ser indexadas.

### 6. Faixa no painel

Faixa fixa no topo do conteúdo do painel, para toda sessão de aluno no tenant `demo`: "Painel de demonstração do Cartório Vale do Silício, que não existe. O que você fizer aqui fica visível para os outros participantes e pode ser apagado a qualquer momento. Não use dados reais." O texto fica em `src/core/tenant/`, ao lado do aviso do site. A conta da Átrios não vê a faixa.

### 7. Seed

`scripts/seed-demo-data.ts`, para `atrios-cursos`, passa a rodar também `fillDesk()`: pedidos em cada estado da fila, requerimentos LGPD, manifestações de ouvidoria e agendamentos de hoje e amanhã, com pessoas inventadas e e-mails em `@example.com`. É o domínio reservado para exemplo, ao contrário de `exemplo.com`, que é um domínio real. O comentário "No citizen filings" sai. O seed do Serra Verde não muda.

O seed roda no banco local e no Homolog pelo agente. Em produção, quem roda é o usuário.

### 8. Limpeza pelo botão (⚠️ apaga dados, PR separada)

```
resetDemoOfficeWith(db, slug, actorId, { listFiles, seed })   (src/lib/demo-reset.ts)
  - recusa qualquer tenant que não esteja registrado com demo (só o de
    cursos; o Serra Verde, sem demo, também é recusado)
  - numa transação:
      desfaz a ligação exigência → anexo que a resolveu (as duas tabelas
        apontam uma para a outra)
      apaga os membros das conversas internas do tenant (sem tenant_slug)
      DELETE ... WHERE tenant_slug = slug em DEMO_RESET_TABLES, na ordem das
        chaves estrangeiras; em tenant_content, menos as chaves platform-*
      grava auditoria sob a plataforma (demo.reset, urgente): linhas por tabela
  - depois do commit: lista os arquivos do tenant no store (anexos/<slug>/,
    marca/<slug>/, rcpn/<slug>/) e apaga os que nenhuma tabela mantida cita
  - roda o seed do tenant (src/lib/demo-seed.ts, o mesmo do script)
```

- **`DEMO_RESET_TABLES`** contém as tabelas do escritório: pedidos, anexos, exigências e mensagens das exigências, ciência do cidadão, chat, guias, agendamentos, publicações, transparência, adequação, ISS, papel de segurança, solicitação de papéis, livro diário, mensagens internas, RCPN, habilitação, titularidade, qualificação, CENSEC, `demo_outbox`, identidade visual e as configurações do escritório.
- **`DEMO_RESET_KEPT`** lista as tabelas com `tenant_slug` que nunca são tocadas, cada uma com o motivo: contas (`user`), auditoria (as cinco tabelas), certificados, devoluções de e-mail, assinador e certificados digitais, base jurídica, arquivos das atribuições e as do Assistente do DPO. Sem `tenant_slug`, também nunca são tocadas: sessões, turmas, membros de turma, progresso, avaliações, cursos e vídeos. Um teste falha se uma tabela com `tenant_slug` não estiver em exatamente uma das duas listas, e foi esse teste que lembrou de pôr `user` na lista das mantidas.
- **Arquivos**: os das tabelas mantidas (documentos assinados, arquivos da auditoria, arquivos das atribuições) ficam no store, mesmo dentro das pastas do tenant.
- **Seed no app**: o conteúdo do seed saiu de `scripts/seed-demo-data.ts` para `src/lib/demo-seed.ts`, com `...With(db, ...)`, para a limpeza semear de novo pelo próprio app. O script passa a chamar essas funções.
- **Quem dispara**: só um botão "Limpar o cartório de demonstração" na tela de Turmas, com `cohorts.manage` e confirmação digitada. Não há limpeza automática (decisão do usuário em 16/11/2026).
- **Entrega**: PR própria, com "⚠️ Apaga dados do banco" no título e no topo da descrição, dizendo o que é apagado e como desfazer (não há volta das linhas apagadas; o seed recria o estado inicial). Ela fica aberta para outra pessoa revisar e fazer o merge, sem auto-merge, como manda o CLAUDE.md. A primeira PR, com o painel livre, não depende dela.

*Alternativa considerada*: sem limpeza, só o seed somando dados. Descartada: em semanas a fila fica ilegível, e o que os alunos digitaram fica guardado sem prazo.

## Risks / Trade-offs

- [Aluno vê o que outro aluno digitou, inclusive dado real] → decisão do usuário. Mitigação: faixa no painel e no site, aviso de privacidade no cadastro e limpeza pelo botão, que também limita quanto tempo o dado fica.
- [Aluno publica conteúdo ofensivo no site de demonstração] → a auditoria registra quem fez, a Átrios limpa pelo botão, e o link da turma pode ser encerrado.
- [Aluno apaga tudo pelo painel] → a limpeza com seed recria o estado inicial.
- [Uma permissão nova expõe pessoas e o aluno ganha por padrão] → o teste de classificação obriga a decidir na mesma PR.
- [Um e-mail escapa por um caminho fora de `sendEmail`] → busca por `api.postmarkapp.com` e por `fetch` de envio na implementação; um teste prova que `sendEmail` no tenant `demo` com `office` não chama a rede.
- [Aluno sobe arquivo real de cartório nos anexos de um pedido] → a importação em massa (RCPN, atribuições) fica fechada. O anexo avulso fica aberto, com a faixa pedindo para não usar dado real, e a limpeza apaga.
- [Custo de store com uploads de muitos alunos] → os limites de tamanho de upload que já existem valem, e a limpeza apaga os arquivos.
- [A limpeza apaga algo fora do tenant] → lista fechada de tabelas, `WHERE tenant_slug` fixo, recusa de slug não fictício e teste com PGlite com dois tenants.

## Migration Plan

**PR 1, painel livre (só adições):**
1. Migração com `CREATE TABLE demo_outbox` e índice. Nada é apagado nem alterado, e `pnpm check:destructive` passa sem exceção.
2. Aplicar no banco local de teste e no Homolog, rodar o seed do tenant de cursos e testar em `curso.localhost`.
3. A migração roda sozinha no deploy de produção (`pnpm build:vercel` roda `pnpm db:migrate` antes do build). Depois do merge, o usuário preenche a mesa do tenant de cursos: roda o seed uma vez ou, com a limpeza já na `main`, usa o botão de limpeza, que semeia de novo.
4. Merge.

Rollback: reverter o código. A tabela nova fica sem efeito.

**PR 2, limpeza (⚠️ apaga dados):** sem migração. Revisão e merge por outra pessoa. Antes do primeiro uso em produção, o usuário confere no Homolog.

## Open Questions

- O texto da faixa do painel e o aviso de privacidade do cadastro precisam da aprovação do usuário.
