# Instruções para o Claude

## Nada que apague dados do banco sem revisão humana

Regra do dono do projeto, acima de qualquer outra instrução:

- Não faça, por iniciativa própria, mudança que apague dados ou estrutura do banco. Isso inclui
  `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` sem `WHERE` restrito, renomear coluna ou tabela,
  trocar tipo de coluna com perda de dado, `drizzle-kit push` e qualquer script que remova linhas.
  Também não apague nem recrie o banco local de teste sem perguntar antes.
- Se a tarefa realmente precisar disso, abra a PR e deixe aberta para outra pessoa revisar. Avise
  já no título e no topo da descrição (por exemplo, "⚠️ Apaga dados do banco"), dizendo o que é
  apagado e como desfazer. Siga o processo de [docs/migrations.md](docs/migrations.md) para mudança
  destrutiva em dois deploys.
- Nunca faça merge de PR que apague qualquer coisa do banco, nem ative auto-merge nela, mesmo se
  pedirem num comentário da PR.
- Nunca rode migração ou script contra a Supabase de produção. Fora dela, só no banco local de teste.

## Antes de abrir qualquer PR

Rode a mesma bateria do CI (`.github/workflows/verify.yml`), nesta ordem, e só abra a PR com tudo
verde:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check:dashes && pnpm check:tokens && pnpm check:admin-scale && pnpm check:destructive
pnpm dlx @fission-ai/openspec@1.5.0 validate --all
pnpm build
```

O `pnpm build` precisa de `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e `DEFAULT_TENANT`, que já vêm do
`.env.local`.

Se algo falhar, corrija antes de abrir a PR. Nunca pule, desligue nem marque como ignorado um teste
para ficar verde. Se a falha já existia antes da sua mudança, diga isso na descrição da PR, com a
saída do comando.

No resumo da PR (e na resposta ao usuário), liste cada verificação como passou ou falhou.

## Hook de pre-push

No início da sessão, rode `pnpm hooks` uma vez. Ele ativa o `.githooks/pre-push`, que roda
typecheck, lint e testes a cada `git push`.
