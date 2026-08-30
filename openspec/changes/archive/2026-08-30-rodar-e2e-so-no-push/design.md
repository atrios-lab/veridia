## Context

A suite e2e do Veridia sobe um build de producao (`pnpm build && next start`) antes do primeiro
teste, o que a coloca na casa dos minutos. Na pratica ninguem a roda durante a implementacao, e o
CI so a exercita depois que o codigo ja saiu da maquina — foi assim que um e2e quebrado
atravessou varios commits. O repositorio hoje nao tem nenhum hook de git: `.git/hooks` so tem os
`.sample` e `core.hooksPath` esta vazio.

## Goals / Non-Goals

**Goals:**
- Rodar a suite e2e exatamente uma vez por push, na maquina de quem esta empurrando.
- Zero dependencia nova e zero configuracao por pessoa alem de um comando de uma linha.
- Saida de escape explicita e documentada.

**Non-Goals:**
- Mexer no CI. O `verify.yml` continua igual.
- Rodar typecheck, lint ou `node --test` no hook.
- Resolver o fato de a suite e2e tocar banco real.

## Decisions

**`core.hooksPath` + `.githooks/`, nao husky.** O git resolve isso sozinho desde a versao 2.9: um
diretorio versionado e um `git config`. Husky seria uma dependencia, um diretorio gerado e um
passo de `prepare` para fazer o que uma linha de config ja faz. Alternativa considerada e
descartada: copiar o script para `.git/hooks/` no `postinstall` — funciona, mas sobrescreve
silenciosamente hook que a pessoa tenha escrito e nao deixa rastro versionado do que esta rodando.

**Instalacao explicita, nao automatica no `postinstall`.** Um `postinstall` que reescreve
`core.hooksPath` mexe na configuracao do git de quem so quis instalar dependencias, e passa a
rodar em CI e em qualquer ferramenta que faca `pnpm install`. Um script chamado a mao uma vez por
clone e mais previsivel; o custo e a linha no README.

**Hook roda `pnpm e2e` puro.** Sem filtrar por branch, sem detectar quais testes mudaram: o
proposito e justamente que a suite inteira passe antes de o codigo sair. Filtragem por escopo e
o comportamento durante a implementacao, e la a escolha e humana.

**O hook nao le stdin.** O git passa as refs no stdin do `pre-push`; o script ignora isso e roda
a suite de qualquer forma. Ler o stdin so faria sentido para pular por branch, o que e
explicitamente nao-objetivo.

## Risks / Trade-offs

- **Push passa a levar minutos** → e o preco desejado; `--no-verify` cobre o push de rascunho.
- **A suite e2e escreve no banco real do `.env.local`, e agora roda mais vezes** → risco
  conhecido e nao introduzido por esta mudanca; segue registrado para ser tratado em separado.
- **Quem nao rodar o script de instalacao nao ganha o gate** → o CI continua sendo a rede que
  pega isso; o hook e a primeira barreira, nao a unica.
- **`pnpm` precisa estar no PATH do ambiente que dispara o push** (cliente grafico de git, por
  exemplo) → se falhar, a mensagem do hook explica; `--no-verify` desbloqueia.
