## 1. Hook

- [x] 1.1 Criar `.githooks/pre-push`: script `sh` que roda `pnpm e2e`, ignora o stdin do git e
      propaga o codigo de saida, com uma mensagem dizendo que `git push --no-verify` pula o gate.
- [x] 1.2 Dar permissao de execucao ao arquivo e conferir que o git guardou o bit
      (`git ls-files -s .githooks/pre-push` deve mostrar modo `100755`).

## 2. Instalacao

- [x] 2.1 Adicionar o script `hooks` ao `package.json`: `git config core.hooksPath .githooks`.
- [x] 2.2 Documentar no `README.md`: rodar `pnpm hooks` uma vez por clone, o que o hook faz e que
      `git push --no-verify` o contorna.

## 3. Verificacao

- [x] 3.1 Rodar `pnpm hooks` e confirmar que `git config core.hooksPath` devolve `.githooks`.
- [x] 3.2 Confirmar que o hook aborta o push quando a suite falha: com um `pnpm` de mentira no
      PATH devolvendo 1, o hook sai com 1 e o `git push` para um remoto bare local e recusado.
- [x] 3.3 Confirmar que `git push --no-verify` nao dispara o hook.
