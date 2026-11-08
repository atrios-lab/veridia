# Instruções para o Claude

## Antes de abrir qualquer PR

Rode a mesma bateria do CI (`.github/workflows/verify.yml`), nesta ordem, e só abra a PR com tudo
verde:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check:dashes && pnpm check:tokens && pnpm check:destructive
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
