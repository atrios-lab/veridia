## Why

A suite e2e sobe um build de producao e leva minutos para rodar, entao ninguem a roda durante a
implementacao — e o resultado ja apareceu: um e2e quebrado sobreviveu commits ate alguem reparar.
O momento em que a suite de fato importa e o `git push`, quando o codigo sai da maquina; antes
disso ela so custa tempo.

## What Changes

- Um hook de `pre-push` do git passa a rodar `pnpm e2e` antes de o push sair. Falhou, o push nao
  acontece.
- O hook fica versionado no repositorio (`.githooks/`) e ligado por `core.hooksPath`, para que
  valha para qualquer clone sem passo manual esquecivel.
- Uma valvula de escape explicita: `git push --no-verify` continua passando direto, para o caso de
  push de branch de rascunho ou de emergencia.
- Nada passa a rodar e2e automaticamente durante a implementacao. Enquanto se implementa, roda-se
  apenas o teste daquilo que esta sendo mexido.

## Capabilities

### New Capabilities
- `pre-push-verification`: o que o repositorio verifica na maquina do desenvolvedor no momento do
  `git push`, e como esse gate e instalado, contornado e reportado.

### Modified Capabilities
<!-- Nenhuma: nenhum comportamento de produto muda. -->

## Nao-objetivos

- Nao mexer no CI (`.github/workflows/verify.yml`): o e2e continua rodando no pull request e no
  push para main exatamente como hoje. O hook e uma primeira barreira local, nao um substituto.
- Nao adicionar husky nem nenhuma dependencia de gerenciamento de hooks: `core.hooksPath` e um
  recurso nativo do git.
- Nao rodar typecheck, lint ou a suite `node --test` no hook. Esses ja sao rapidos e ja rodam no
  CI; o problema em questao e so o e2e, que ninguem roda.
- Nao mudar o que a suite e2e testa, nem sua configuracao no `playwright.config.ts`.

## Impact

- Novo arquivo `.githooks/pre-push` (script shell executavel).
- `package.json`: um script para ligar o `core.hooksPath` (o hook so vale depois que cada clone
  roda esse comando uma vez).
- `README.md`: uma linha dizendo como ligar e como pular o hook.
- Cuidado conhecido: a suite e2e escreve no banco real apontado pelo `.env.local`, entao rodar no
  pre-push aumenta a frequencia desses efeitos. Isso e endereco de outra mudanca, nao desta.
