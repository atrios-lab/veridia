## Context

A fundacao entregou o painel como esqueleto protegido: sessao em banco, middleware barrando `/admin`
e uma checagem autoritativa no layout a cada requisicao. O que ela nao entregou foi o vinculo com
serventia. A tabela `user` tem `id`, `email`, `role` e nada que diga de qual serventia a pessoa e, e
a guarda em `src/app/admin/(dashboard)/layout.tsx` confere apenas `can(role, "admin.access")`.

As tabelas de dado ja nascem por serventia: `tenant_branding`, `tenant_content` e `audit_log` todas
carregam `tenant_slug`. So o usuario ficou de fora. E uma assimetria que ninguem sente enquanto o
painel imprime duas linhas, e que vira vazamento entre serventias na primeira consulta de conteudo.

A restricao de produto foi decidida e e mais estreita do que o comum em plataformas multi-tenant:
**nao existe conta com acesso a mais de uma serventia**, nem para suporte da Atrios. Quem precisa
operar o painel de uma serventia tem usuario naquela serventia.

O registro de serventias e config as code em `src/core/tenant/`, sem tabela no banco. O `tenant_slug`
do usuario referencia esse registro, e nao ha chave estrangeira possivel.

## Goals / Non-Goals

**Goals:**

- Usuario do painel pertence a exatamente uma serventia, sem estado invalido representavel.
- A decisao de acesso e funcao pura do nucleo, testavel sem banco e sem servidor.
- Papel e escopo permanecem dimensoes independentes.
- Credencial correta no dominio errado nao deixa sessao utilizavel para tras.
- Migracao aditiva, em um deploy, com o usuario ja existente preservado.

**Non-Goals:**

- Convite ou gestao de usuarios por interface.
- Acesso multi-serventia, papel privilegiado que ignore escopo, chave de suporte.
- Papeis ou permissoes novos.
- Isolamento no banco (RLS, schema por serventia).
- Estilo em qualquer tela.

## Decisions

- **Coluna obrigatoria, nao anulavel.** `tenant_slug` em `user` e `NOT NULL`. A alternativa
  considerada foi anulavel, com nulo significando "equipe da Atrios, acessa todas". Foi recusada por
  decisao de produto, e o efeito colateral e bom: sem o caso nulo, nao existe estado que o codigo
  precise lembrar de tratar, e nenhuma consulta futura pode esquecer de filtrar por engano.

- **Sem chave estrangeira, com validacao no schema.** O registro de serventias e codigo, nao tabela,
  entao nao ha para onde apontar. A validacao acontece onde o usuario nasce (o seed) e no schema
  Zod, contra o registro. O custo assumido: um slug pode ficar orfao se uma serventia for removida do
  registro. E aceitavel porque remover serventia e evento raro e manual, e o efeito e o usuario
  deixar de conseguir entrar, nunca entrar na serventia errada.

- **Decisao de acesso no nucleo, junto do papel.** `canAccessTenant(user, tenantSlug)` entra em
  `src/core/auth/roles.ts`, ao lado de `can`. As duas sao combinadas por quem chama, nao dentro de
  uma funcao so: papel e escopo respondem perguntas diferentes e vao ser consultados separadamente
  quando o painel tiver telas. A alternativa, uma funcao unica `canAccessAdmin(user, tenant)`, foi
  recusada porque esconde qual das duas condicoes falhou, e e exatamente isso que a auditoria
  precisa registrar.

- **Recusa no login, nao so na guarda do painel.** Autenticar cria sessao; deixar a sessao existir e
  barrar so na guarda deixaria uma credencial viva para a serventia errada, dependendo de toda rota
  futura lembrar de checar. A acao de login verifica o escopo logo apos autenticar e, quando nao
  bate, encerra a sessao antes de responder. E o mesmo caminho de revogacao que a fundacao ja provou
  em teste.

- **A leitura da sessao e o ponto unico de aplicacao.** Corrigido durante a implementacao: a acao de
  login nao e a unica porta. A rota `/api/auth/[...all]` tambem emite sessao, e um POST direto por
  ela criava cookie valido no dominio de outra serventia, verificado contra o banco real. Guardar so
  a acao seria consertar um caller e deixar o outro aberto. A checagem passou para `getSession`, por
  onde toda leitura de sessao passa: sessao de outra serventia devolve nulo, o que torna inerte o
  cookie emitido no dominio errado e vale para qualquer rota futura sem ela precisar lembrar. A
  recusa na acao continua, para o cookie nao ficar para tras depois do formulario.

- **Encerrar a sessao na acao, nao por hook da biblioteca.** O Better Auth permite recusar em
  `databaseHooks.session.create.before`, o que evitaria criar a linha. Foi recusado: prende a regra
  de autorizacao dentro da biblioteca, e a fundacao decidiu o contrario (a lib responde quem e, o
  nucleo responde o que pode). O custo e uma linha de sessao criada e apagada em seguida, invisivel
  para quem tentou e barata para o banco.

- **Resposta identica a de credencial invalida.** Dizer "essa conta e de outra serventia" confirma
  que o e-mail existe na plataforma e revela em qual serventia a pessoa trabalha. A tela devolve a
  mesma mensagem generica que ja existe. A auditoria registra a diferenca, porque ela e interna.

- **Migracao em tres passos dentro de um arquivo.** Adicionar `NOT NULL` numa tabela com linha
  existente exige preencher antes. O SQL gerado sera editado a mao para: adicionar anulavel,
  preencher com a serventia padrao, tornar obrigatoria. Sao aditivos, aplicados numa transacao, e
  cabem em um deploy. A regra dos dois deploys da fundacao vale para remocao e renomeacao, que nao e
  o caso aqui.

- **`ADMIN_SEED_TENANT` como variavel propria.** Reaproveitar `DEFAULT_TENANT` acoplaria duas
  decisoes distintas: qual serventia servir um host desconhecido e a que serventia o usuario semeado
  pertence. A variavel nova tem `DEFAULT_TENANT` como valor padrao, que e o que faz o seed continuar
  funcionando sem mudanca de configuracao.

## Risks / Trade-offs

- **O usuario existente em producao muda de significado.** Hoje `atrios@atrioss.com` entra em
  qualquer painel; depois da migracao ele pertence a serventia padrao e so entra naquela. →
  Mitigacao: o backfill usa a serventia padrao, que e a piloto, e o comportamento passa a ser o
  documentado. Se a Atrios precisar operar outra serventia, cria usuario nela.

- **Slug orfao.** Remover uma serventia do registro deixa usuarios apontando para um slug que nao
  existe. → Mitigacao: o efeito e negar acesso, nunca conceder na serventia errada. Um teste afirma
  que slug desconhecido nao autoriza nada.

- **A regra depende de toda consulta futura filtrar por serventia.** O escopo protege a entrada do
  painel, nao as consultas que ainda serao escritas. → Mitigacao: as tabelas ja tem `tenant_slug`, e
  a mudanca do painel deve derivar a serventia da sessao, nunca de parametro da requisicao. Fora do
  escopo desta entrega, e registrado aqui para nao se perder.

- **Sessao criada e apagada a cada tentativa no dominio errado.** → Mitigacao: o rate limit ja
  existente nas rotas de autenticacao limita o volume, e a linha e apagada na mesma requisicao.

## Migration Plan

1. Gerar a migracao, editar o SQL a mao para adicionar anulavel, preencher e tornar obrigatoria.
2. Aplicar no deploy, antes da publicacao, como manda `docs/migrations.md`.
3. Nenhuma etapa de contract: a mudanca nao remove nem renomeia nada.

Rollback: reverter o deploy e apagar a coluna. Como nada passa a depender dela fora do painel, a
volta nao perde dado de negocio.

## Open Questions

- Nenhuma. A pergunta que existia, se a equipe da Atrios teria acesso a varias serventias, foi
  decidida: nao tera.
