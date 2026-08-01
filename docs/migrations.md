# Migrações

O schema vive em `src/db/schema.ts` e `src/db/auth-schema.ts`. O banco de verdade só muda por
arquivo de migração versionado.

## O fluxo

1. `pnpm db:generate` gera o SQL em `drizzle/`.
2. **Ler o SQL gerado, linha por linha.** É a única etapa que não dá para automatizar.
3. Commitar o SQL junto com a mudança de schema, no mesmo pull request.
4. `pnpm db:migrate` aplica no deploy, antes da publicação.

Mudança de schema sem o arquivo de migração no PR não passa na revisão.

## `push` é proibido

`drizzle-kit push` aplica o diff direto no banco, sem gerar histórico. Não existe registro do que
mudou, não existe revisão e não existe volta. Só é aceitável em protótipo local descartável, nunca
em banco compartilhado, de preview ou de produção.

## Mudança destrutiva em dois deploys

Remover ou renomear coluna ou tabela derruba a versão do código que ainda está no ar durante o
deploy. Divida em dois:

1. **Expand:** adiciona a coluna nova e passa a escrever nas duas, mantendo a antiga.
2. **Contract:** só depois que nenhum código em produção lê a antiga, um segundo deploy a remove.

Vale para renomear também: renomear é remover mais adicionar, com outro nome.

## Preview não migra produção

`db:migrate` roda apontando para o banco de produção apenas no deploy de produção. Ambiente de
preview usa banco próprio ou nenhum. Um preview que migra produção transforma um teste em
incidente.
